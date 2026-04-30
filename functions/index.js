/**
 * Import function triggers from their respective submodules:
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */
/* eslint-disable */
const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const logger = require("firebase-functions/logger");
const admin = require('firebase-admin');
const functions = require('firebase-functions');
const axios = require("axios");
const querystring = require("querystring");
admin.initializeApp();
// 🔐 EKQR KEY (move to env later)


// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });




exports.createAddMoneyOrder = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send({ error: "Method not allowed" });
  }

  try {
    const {
      userId,
      amount,
      customer_name,
      customer_email,
      customer_mobile,
    } = req.body;

    if (!userId || !amount) {
      return res.status(400).send({ error: "Missing fields" });
    }

    const userRef = admin.firestore().collection("users").doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).send({ error: "User not found" });
    }

    const preBalance = Number(userSnap.data().wallet || 0);
    const client_txn_id = "txn_" + Date.now();

    // 🔹 Save pending transaction
    const txnRef = await userRef
      .collection("AddMoneyByGetway")
      .add({
        userId,
        customer_name,
        customer_email,
        customer_mobile,
        amount: Number(amount),
        preBalance,
        paymentstatus: "pending",
        client_txn_id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
const EKQR_KEY = "b86c32c1-982f-48c0-b7cb-2aa2e8209e9d";
    // 🔹 EKQR API call
    const payload = {
      key: EKQR_KEY,
      client_txn_id,
      amount: amount.toString(),
      p_info: "Wallet Topup",
      customer_name,
      customer_email,
      customer_mobile,
      redirect_url: "https://github.com/",
    };

    const response = await axios.post(
      "https://api.ekqr.in/api/v2/create_order",
      payload
    );

    return res.status(200).send({
      ...response.data,
      firestoreTxnId: txnRef.id,
    });
  } catch (err) {
    logger.error("createAddMoneyOrder error", err);
    return res.status(500).send({
      error: err.response?.data || err.message,
    });
  }
});


exports.upiWebhook = onRequest(async (req, res) => {
  try {
    let body = req.body;

    // ✅ Handle application/x-www-form-urlencoded
    if (!body || Object.keys(body).length === 0) {
      body = querystring.parse(req.rawBody.toString());
    }

    const {
      client_txn_id,
      status,
      upi_txn_id,
      amount,
    } = body;

    if (!client_txn_id) {
      return res.status(400).send("Missing client_txn_id");
    }

    // 🔍 Find matching transaction
    const usersSnap = await admin.firestore().collection("users").get();

    for (const userDoc of usersSnap.docs) {
      const txnSnap = await userDoc.ref
        .collection("AddMoneyByGetway")
        .where("client_txn_id", "==", client_txn_id)
        .limit(1)
        .get();

      if (!txnSnap.empty) {
        const txnDoc = txnSnap.docs[0];
        const txnData = txnDoc.data();

        if (status === "success") {
          const postBalance =
            Number(txnData.preBalance) + Number(amount);

          // 🔹 Update transaction
					// compute date/time in Indian Standard Time (IST)
					const now = new Date();
					const utc = now.getTime() + now.getTimezoneOffset() * 60000;
					const ist = new Date(utc + 5.5 * 60 * 60000);
					const pad = (n) => String(n).padStart(2, '0');
					const paymentReceivedDate = `${ist.getFullYear()}-${pad(ist.getMonth() + 1)}-${pad(ist.getDate())}`;
					const hh24 = ist.getHours();
					const hh12 = ((hh24 + 11) % 12) + 1;
					const ampm = hh24 >= 12 ? 'PM' : 'AM';
					const paymentReceivedTime = `${hh12}:${pad(ist.getMinutes())} ${ampm}`;

					await txnDoc.ref.update({
						paymentstatus: "success",
						upi_txn_id,
						postBalance,
						paymentReceivedDate,
						paymentReceivedTime,
					});

          // 🔹 Update wallet
          await userDoc.ref.update({
            wallet: admin.firestore.FieldValue.increment(Number(amount)),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } else {
          await txnDoc.ref.update({
            paymentstatus: "failure",
          });
        }

        break;
      }
    }

    return res.status(200).send("OK");
  } catch (err) {
    logger.error("upiWebhook error", err);
    return res.status(500).send("Webhook error");
  }
});


/**
 * Endpoint: singledigitbets
 * Expects JSON POST body:
 * {
 *   uid: string,
 *   code: 'SD',
 *   gameId: string,
 *   gameName?: string,
 *   bets: [{ number: string, points: number, game: 'open'|'close' }]
 * }
 *
 * For each bet this will create a document under users/{uid}/userbets
 * and deduct the total amount from users/{uid}.wallet inside a transaction.
 */
exports.singledigitbets = onRequest(async (req, res) => {
	if (req.method !== 'POST') return res.status(405).send({ error: 'Method not allowed' });
	try {
		// Verify Firebase ID token from Authorization header
		const authHeader = (req.headers.authorization || req.headers.Authorization || '').toString();
		if (!authHeader.startsWith('Bearer ')) return res.status(401).send({ error: 'Missing or invalid Authorization header' });
		const idToken = authHeader.split('Bearer ')[1].trim();
		let decoded;
		try {
			decoded = await admin.auth().verifyIdToken(idToken);
		} catch (err) {
			return res.status(401).send({ error: 'Invalid ID token' });
		}

		const body = req.body || {};
		const { uid, code, gameId, gameName, bets } = body;
		// Ensure caller uid matches provided uid
		if (!decoded || !decoded.uid || decoded.uid !== uid) {
			return res.status(403).send({ error: 'Caller UID does not match provided uid' });
		}
		if (!uid || !Array.isArray(bets) || code !== 'SD' || !gameId) {
			return res.status(400).send({ error: 'Invalid payload' });
		}

		// Validate bets
		const parsedBets = bets.map((b) => ({
			number: String(b.number),
			points: Number(b.points),
			game: b.game === 'close' ? 'close' : 'open',
		}));
		const totalAmount = parsedBets.reduce((s, b) => s + (Number.isFinite(b.points) ? b.points : 0), 0);

		// Fetch game timings and validate against current Indian Standard Time (IST)
		try {
			const gameRef = admin.firestore().collection('games').doc(String(gameId));
			const gameSnap = await gameRef.get();
			if (!gameSnap.exists) return res.status(400).send({ error: 'Game not found' });
			const gameData = gameSnap.data() || {};
			const openTimeStr = gameData.openTime ? String(gameData.openTime) : null;
			const closeTimeStr = gameData.closeTime ? String(gameData.closeTime) : null;

			const parseTime12h = (t) => {
				if (!t || typeof t !== 'string') return null;
				const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
				if (!m) return null;
				let h = parseInt(m[1], 10);
				const min = parseInt(m[2], 10);
				const mer = m[3].toUpperCase();
				if (h === 12) h = 0;
				const hours24 = mer === 'PM' ? h + 12 : h;
				return { hours24, minutes: min };
			};

			// current time in IST
			const now = new Date();
			const utc = now.getTime() + now.getTimezoneOffset() * 60000;
			const istOffsetMs = (5 * 60 + 30) * 60000; // +05:30
			const nowIst = new Date(utc + istOffsetMs);

			const isAfterTimeStr = (timeStr) => {
				const parsed = parseTime12h(timeStr);
				if (!parsed) return false;
				const target = new Date(nowIst);
				target.setHours(parsed.hours24, parsed.minutes, 0, 0);
				return nowIst.getTime() > target.getTime();
			};

			const hasOpen = parsedBets.some((b) => b.game === 'open');
			if (hasOpen && openTimeStr && isAfterTimeStr(openTimeStr)) {
				return res.status(400).send({ error: 'your request is delayed for open bit' });
			}

			const hasClose = parsedBets.some((b) => b.game === 'close');
			if (hasClose && closeTimeStr && isAfterTimeStr(closeTimeStr)) {
				return res.status(400).send({ error: 'your request is delayed for close bit' });
			}
		} catch (err) {
			logger.error('singledigitbets timing validation error', err);
			return res.status(500).send({ error: 'Timing validation failed' });
		}

		const userRef = admin.firestore().collection('users').doc(uid);

		await admin.firestore().runTransaction(async (tx) => {
			const userSnap = await tx.get(userRef);
			if (!userSnap.exists) throw new Error('User not found');
			const userData = userSnap.data() || {};
			const walletRaw = userData.wallet;
			const wallet = typeof walletRaw === 'number' ? walletRaw : Number(walletRaw || 0);
			if (wallet < totalAmount) throw new Error('Insufficient wallet balance');
			// Create bet docs in user's subcollection and record pre/post balances
			const userBetsRef = userRef.collection('userbets');
			const serverTs = admin.firestore.FieldValue.serverTimestamp();

			// Apply bets one-by-one so each bet records the wallet before and after that single bet
			let currBalance = wallet;
			for (const b of parsedBets) {
				const amount = Number.isFinite(b.points) ? b.points : 0;
				const preBalance = currBalance;
				const postBalance = currBalance - amount;
				const doc = {
					amount: amount,
					gameId: String(gameId),
					gameName: gameName || null,
					gamecode: String(code),
					open: b.game === 'open',
					close: b.game === 'close',
					SDnumber: String(b.number),
					username: userData.name || null,
					userId: uid,
					mobile: userData.phone || null,
					resultstatus: 'pending',
					createdAt: serverTs,
					preBalance: preBalance,
					postBalance: postBalance,
				};
				const newDocRef = userBetsRef.doc();
				tx.set(newDocRef, doc);
				// decrement current balance for next bet
				currBalance = postBalance;
			}

			// Deduct wallet to the final remaining balance after all bets
			tx.update(userRef, { wallet: currBalance, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
		});

		return res.status(200).send({ ok: true, deducted: totalAmount });
	} catch (err) {
		logger.error('singledigitbets error', err);
		const msg = err && err.message ? err.message : String(err);
		return res.status(500).send({ error: msg });
	}
});

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

/**
 * Endpoint: jodidigitsbets
 * Same behavior as singledigitbets but for Jodi digits (code 'JD').
 */
exports.jodidigitsbets = onRequest(async (req, res) => {
	if (req.method !== 'POST') return res.status(405).send({ error: 'Method not allowed' });
	try {
		// Verify Firebase ID token from Authorization header
		const authHeader = (req.headers.authorization || req.headers.Authorization || '').toString();
		if (!authHeader.startsWith('Bearer ')) return res.status(401).send({ error: 'Missing or invalid Authorization header' });
		const idToken = authHeader.split('Bearer ')[1].trim();
		let decoded;
		try {
			decoded = await admin.auth().verifyIdToken(idToken);
		} catch (err) {
			return res.status(401).send({ error: 'Invalid ID token' });
		}

		const body = req.body || {};
		const { uid, code, gameId, gameName, bets } = body;
		// Ensure caller uid matches provided uid
		if (!decoded || !decoded.uid || decoded.uid !== uid) {
			return res.status(403).send({ error: 'Caller UID does not match provided uid' });
		}
		if (!uid || !Array.isArray(bets) || code !== 'JD' || !gameId) {
			return res.status(400).send({ error: 'Invalid payload' });
		}

		// Validate bets
		const parsedBets = bets.map((b) => ({
			number: String(b.number),
			points: Number(b.points),
			game: b.game === 'close' ? 'close' : 'open',
		}));
		const totalAmount = parsedBets.reduce((s, b) => s + (Number.isFinite(b.points) ? b.points : 0), 0);

		// Fetch game openTime and validate against Indian Standard Time (IST)
		try {
			const gameRef = admin.firestore().collection('games').doc(String(gameId));
			const gameSnap = await gameRef.get();
			if (!gameSnap.exists) return res.status(400).send({ error: 'Game not found' });
			const gameData = gameSnap.data() || {};
			const openTimeStr = gameData.openTime ? String(gameData.openTime) : null;

			const parseTime12h = (t) => {
				if (!t || typeof t !== 'string') return null;
				const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
				if (!m) return null;
				let h = parseInt(m[1], 10);
				const min = parseInt(m[2], 10);
				const mer = m[3].toUpperCase();
				if (h === 12) h = 0;
				const hours24 = mer === 'PM' ? h + 12 : h;
				return { hours24, minutes: min };
			};

			const now = new Date();
			const utc = now.getTime() + now.getTimezoneOffset() * 60000;
			const istOffsetMs = (5 * 60 + 30) * 60000; // +05:30
			const nowIst = new Date(utc + istOffsetMs);

			const isAfterTimeStr = (timeStr) => {
				const parsed = parseTime12h(timeStr);
				if (!parsed) return false;
				const target = new Date(nowIst);
				target.setHours(parsed.hours24, parsed.minutes, 0, 0);
				return nowIst.getTime() > target.getTime();
			};

			// Validate both open and close bets against openTime
			if (parsedBets.length > 0 && openTimeStr && isAfterTimeStr(openTimeStr)) {
				return res.status(400).send({ error: 'your request is delayed for bit' });
			}
		} catch (err) {
			logger.error('jodidigitsbets timing validation error', err);
			return res.status(500).send({ error: 'Timing validation failed' });
		}

		const userRef = admin.firestore().collection('users').doc(uid);

		await admin.firestore().runTransaction(async (tx) => {
			const userSnap = await tx.get(userRef);
			if (!userSnap.exists) throw new Error('User not found');
			const userData = userSnap.data() || {};
			const walletRaw = userData.wallet;
			const wallet = typeof walletRaw === 'number' ? walletRaw : Number(walletRaw || 0);
			if (wallet < totalAmount) throw new Error('Insufficient wallet balance');

			// Create bet docs in user's subcollection and record pre/post balances
			const userBetsRef = userRef.collection('userbets');
			const serverTs = admin.firestore.FieldValue.serverTimestamp();

			// Apply bets one-by-one so each bet records the wallet before and after that single bet
			let currBalance = wallet;
			for (const b of parsedBets) {
				const amount = Number.isFinite(b.points) ? b.points : 0;
				const preBalance = currBalance;
				const postBalance = currBalance - amount;
				const doc = {
					amount: amount,
					gameId: String(gameId),
					gameName: gameName || null,
					gamecode: String(code),
					open: b.game === 'open',
					close: b.game === 'close',
					JDnumber: String(b.number),
					username: userData.name || null,
					userId: uid,
					mobile: userData.phone || null,
					resultstatus: 'pending',
					createdAt: serverTs,
					preBalance: preBalance,
					postBalance: postBalance,
				};
				const newDocRef = userBetsRef.doc();
				tx.set(newDocRef, doc);
				// decrement current balance for next bet
				currBalance = postBalance;
			}

			// Deduct wallet to the final remaining balance after all bets
			tx.update(userRef, { wallet: currBalance, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
		});

		return res.status(200).send({ ok: true, deducted: totalAmount });
	} catch (err) {
		logger.error('jodidigitsbets error', err);
		const msg = err && err.message ? err.message : String(err);
		return res.status(500).send({ error: msg });
	}
});

/**
 * Endpoint: singlepanadigitsbets
 * Handles Single Pana bets (code 'SP').
 */
exports.singlepanadigitsbets = onRequest(async (req, res) => {
	if (req.method !== 'POST') return res.status(405).send({ error: 'Method not allowed' });
	try {
		// Verify Firebase ID token from Authorization header
		const authHeader = (req.headers.authorization || req.headers.Authorization || '').toString();
		if (!authHeader.startsWith('Bearer ')) return res.status(401).send({ error: 'Missing or invalid Authorization header' });
		const idToken = authHeader.split('Bearer ')[1].trim();
		let decoded;
		try {
			decoded = await admin.auth().verifyIdToken(idToken);
		} catch (err) {
			return res.status(401).send({ error: 'Invalid ID token' });
		}

		const body = req.body || {};
		const { uid, code, gameId, gameName, bets } = body;
		// Ensure caller uid matches provided uid
		if (!decoded || !decoded.uid || decoded.uid !== uid) {
			return res.status(403).send({ error: 'Caller UID does not match provided uid' });
		}
		if (!uid || !Array.isArray(bets) || code !== 'SP' || !gameId) {
			return res.status(400).send({ error: 'Invalid payload' });
		}

		// Validate bets
		const parsedBets = bets.map((b) => ({
			number: String(b.number),
			points: Number(b.points),
			game: b.game === 'close' ? 'close' : 'open',
		}));
		const totalAmount = parsedBets.reduce((s, b) => s + (Number.isFinite(b.points) ? b.points : 0), 0);

		// Fetch game timings and validate against Indian Standard Time (IST)
		try {
			const gameRef = admin.firestore().collection('games').doc(String(gameId));
			const gameSnap = await gameRef.get();
			if (!gameSnap.exists) return res.status(400).send({ error: 'Game not found' });
			const gameData = gameSnap.data() || {};
			const openTimeStr = gameData.openTime ? String(gameData.openTime) : null;
			const closeTimeStr = gameData.closeTime ? String(gameData.closeTime) : null;

			const parseTime12h = (t) => {
				if (!t || typeof t !== 'string') return null;
				const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
				if (!m) return null;
				let h = parseInt(m[1], 10);
				const min = parseInt(m[2], 10);
				const mer = m[3].toUpperCase();
				if (h === 12) h = 0;
				const hours24 = mer === 'PM' ? h + 12 : h;
				return { hours24, minutes: min };
			};

			// current time in IST
			const now = new Date();
			const utc = now.getTime() + now.getTimezoneOffset() * 60000;
			const istOffsetMs = (5 * 60 + 30) * 60000; // +05:30
			const nowIst = new Date(utc + istOffsetMs);

			const isAfterTimeStr = (timeStr) => {
				const parsed = parseTime12h(timeStr);
				if (!parsed) return false;
				const target = new Date(nowIst);
				target.setHours(parsed.hours24, parsed.minutes, 0, 0);
				return nowIst.getTime() > target.getTime();
			};

			const hasOpen = parsedBets.some((b) => b.game === 'open');
			if (hasOpen && openTimeStr && isAfterTimeStr(openTimeStr)) {
				return res.status(400).send({ error: 'your request is delayed for open bit' });
			}

			const hasClose = parsedBets.some((b) => b.game === 'close');
			if (hasClose && closeTimeStr && isAfterTimeStr(closeTimeStr)) {
				return res.status(400).send({ error: 'your request is delayed for close bit' });
			}
		} catch (err) {
			logger.error('singlepanadigitsbets timing validation error', err);
			return res.status(500).send({ error: 'Timing validation failed' });
		}

		const userRef = admin.firestore().collection('users').doc(uid);

		await admin.firestore().runTransaction(async (tx) => {
			const userSnap = await tx.get(userRef);
			if (!userSnap.exists) throw new Error('User not found');
			const userData = userSnap.data() || {};
			const walletRaw = userData.wallet;
			const wallet = typeof walletRaw === 'number' ? walletRaw : Number(walletRaw || 0);
			if (wallet < totalAmount) throw new Error('Insufficient wallet balance');

			// Create bet docs in user's subcollection and record pre/post balances
			const userBetsRef = userRef.collection('userbets');
			const serverTs = admin.firestore.FieldValue.serverTimestamp();

			// Apply bets one-by-one so each bet records the wallet before and after that single bet
			let currBalance = wallet;
			for (const b of parsedBets) {
				const amount = Number.isFinite(b.points) ? b.points : 0;
				const preBalance = currBalance;
				const postBalance = currBalance - amount;
				const doc = {
					amount: amount,
					gameId: String(gameId),
					gameName: gameName || null,
					gamecode: String(code),
					open: b.game === 'open',
					close: b.game === 'close',
					SPnumber: String(b.number),
					username: userData.name || null,
					userId: uid,
					mobile: userData.phone || null,
					resultstatus: 'pending',
					createdAt: serverTs,
					preBalance: preBalance,
					postBalance: postBalance,
				};
				const newDocRef = userBetsRef.doc();
				tx.set(newDocRef, doc);
				// decrement current balance for next bet
				currBalance = postBalance;
			}

			// Deduct wallet to the final remaining balance after all bets
			tx.update(userRef, { wallet: currBalance, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
		});

		return res.status(200).send({ ok: true, deducted: totalAmount });
	} catch (err) {
		logger.error('singlepanadigitsbets error', err);
		const msg = err && err.message ? err.message : String(err);
		return res.status(500).send({ error: msg });
	}
});

/**
 * Endpoint: doublepanadigitsbets
 * Handles Double Pana bets (code 'DP').
 */
exports.doublepanadigitsbets = onRequest(async (req, res) => {
	if (req.method !== 'POST') return res.status(405).send({ error: 'Method not allowed' });
	try {
		// Verify Firebase ID token from Authorization header
		const authHeader = (req.headers.authorization || req.headers.Authorization || '').toString();
		if (!authHeader.startsWith('Bearer ')) return res.status(401).send({ error: 'Missing or invalid Authorization header' });
		const idToken = authHeader.split('Bearer ')[1].trim();
		let decoded;
		try {
			decoded = await admin.auth().verifyIdToken(idToken);
		} catch (err) {
			return res.status(401).send({ error: 'Invalid ID token' });
		}

		const body = req.body || {};
		const { uid, code, gameId, gameName, bets } = body;
		// Ensure caller uid matches provided uid
		if (!decoded || !decoded.uid || decoded.uid !== uid) {
			return res.status(403).send({ error: 'Caller UID does not match provided uid' });
		}
		if (!uid || !Array.isArray(bets) || code !== 'DP' || !gameId) {
			return res.status(400).send({ error: 'Invalid payload' });
		}

		// Validate bets
		const parsedBets = bets.map((b) => ({
			number: String(b.number),
			points: Number(b.points),
			game: b.game === 'close' ? 'close' : 'open',
		}));
		const totalAmount = parsedBets.reduce((s, b) => s + (Number.isFinite(b.points) ? b.points : 0), 0);

		// Fetch game timings and validate against Indian Standard Time (IST)
		try {
			const gameRef = admin.firestore().collection('games').doc(String(gameId));
			const gameSnap = await gameRef.get();
			if (!gameSnap.exists) return res.status(400).send({ error: 'Game not found' });
			const gameData = gameSnap.data() || {};
			const openTimeStr = gameData.openTime ? String(gameData.openTime) : null;
			const closeTimeStr = gameData.closeTime ? String(gameData.closeTime) : null;

			const parseTime12h = (t) => {
				if (!t || typeof t !== 'string') return null;
				const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
				if (!m) return null;
				let h = parseInt(m[1], 10);
				const min = parseInt(m[2], 10);
				const mer = m[3].toUpperCase();
				if (h === 12) h = 0;
				const hours24 = mer === 'PM' ? h + 12 : h;
				return { hours24, minutes: min };
			};

			// current time in IST
			const now = new Date();
			const utc = now.getTime() + now.getTimezoneOffset() * 60000;
			const istOffsetMs = (5 * 60 + 30) * 60000; // +05:30
			const nowIst = new Date(utc + istOffsetMs);

			const isAfterTimeStr = (timeStr) => {
				const parsed = parseTime12h(timeStr);
				if (!parsed) return false;
				const target = new Date(nowIst);
				target.setHours(parsed.hours24, parsed.minutes, 0, 0);
				return nowIst.getTime() > target.getTime();
			};

			const hasOpen = parsedBets.some((b) => b.game === 'open');
			if (hasOpen && openTimeStr && isAfterTimeStr(openTimeStr)) {
				return res.status(400).send({ error: 'your request is delayed for open bit' });
			}

			const hasClose = parsedBets.some((b) => b.game === 'close');
			if (hasClose && closeTimeStr && isAfterTimeStr(closeTimeStr)) {
				return res.status(400).send({ error: 'your request is delayed for close bit' });
			}
		} catch (err) {
			logger.error('doublepanadigitsbets timing validation error', err);
			return res.status(500).send({ error: 'Timing validation failed' });
		}

		const userRef = admin.firestore().collection('users').doc(uid);

		await admin.firestore().runTransaction(async (tx) => {
			const userSnap = await tx.get(userRef);
			if (!userSnap.exists) throw new Error('User not found');
			const userData = userSnap.data() || {};
			const walletRaw = userData.wallet;
			const wallet = typeof walletRaw === 'number' ? walletRaw : Number(walletRaw || 0);
			if (wallet < totalAmount) throw new Error('Insufficient wallet balance');

			// Create bet docs in user's subcollection and record pre/post balances
			const userBetsRef = userRef.collection('userbets');
			const serverTs = admin.firestore.FieldValue.serverTimestamp();

			// Apply bets one-by-one so each bet records the wallet before and after that single bet
			let currBalance = wallet;
			for (const b of parsedBets) {
				const amount = Number.isFinite(b.points) ? b.points : 0;
				const preBalance = currBalance;
				const postBalance = currBalance - amount;
				const doc = {
					amount: amount,
					gameId: String(gameId),
					gameName: gameName || null,
					gamecode: String(code),
					open: b.game === 'open',
					close: b.game === 'close',
					DPnumber: String(b.number),
					username: userData.name || null,
					userId: uid,
					mobile: userData.phone || null,
					resultstatus: 'pending',
					createdAt: serverTs,
					preBalance: preBalance,
					postBalance: postBalance,
				};
				const newDocRef = userBetsRef.doc();
				tx.set(newDocRef, doc);
				// decrement current balance for next bet
				currBalance = postBalance;
			}

			// Deduct wallet to the final remaining balance after all bets
			tx.update(userRef, { wallet: currBalance, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
		});

		return res.status(200).send({ ok: true, deducted: totalAmount });
	} catch (err) {
		logger.error('doublepanadigitsbets error', err);
		const msg = err && err.message ? err.message : String(err);
		return res.status(500).send({ error: msg });
	}
});

/**
 * Endpoint: triplepanadigitsbets
 * Handles Triple Pana bets (code 'TP').
 */
exports.triplepanadigitsbets = onRequest(async (req, res) => {
	if (req.method !== 'POST') return res.status(405).send({ error: 'Method not allowed' });
	try {
		// Verify Firebase ID token from Authorization header
		const authHeader = (req.headers.authorization || req.headers.Authorization || '').toString();
		if (!authHeader.startsWith('Bearer ')) return res.status(401).send({ error: 'Missing or invalid Authorization header' });
		const idToken = authHeader.split('Bearer ')[1].trim();
		let decoded;
		try {
			decoded = await admin.auth().verifyIdToken(idToken);
		} catch (err) {
			return res.status(401).send({ error: 'Invalid ID token' });
		}

		const body = req.body || {};
		const { uid, code, gameId, gameName, bets } = body;
		// Ensure caller uid matches provided uid
		if (!decoded || !decoded.uid || decoded.uid !== uid) {
			return res.status(403).send({ error: 'Caller UID does not match provided uid' });
		}
		if (!uid || !Array.isArray(bets) || code !== 'TP' || !gameId) {
			return res.status(400).send({ error: 'Invalid payload' });
		}

		// Validate bets
		const parsedBets = bets.map((b) => ({
			number: String(b.number),
			points: Number(b.points),
			game: b.game === 'close' ? 'close' : 'open',
		}));
		const totalAmount = parsedBets.reduce((s, b) => s + (Number.isFinite(b.points) ? b.points : 0), 0);

		// Fetch game timings and validate against Indian Standard Time (IST)
		try {
			const gameRef = admin.firestore().collection('games').doc(String(gameId));
			const gameSnap = await gameRef.get();
			if (!gameSnap.exists) return res.status(400).send({ error: 'Game not found' });
			const gameData = gameSnap.data() || {};
			const openTimeStr = gameData.openTime ? String(gameData.openTime) : null;
			const closeTimeStr = gameData.closeTime ? String(gameData.closeTime) : null;

			const parseTime12h = (t) => {
				if (!t || typeof t !== 'string') return null;
				const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
				if (!m) return null;
				let h = parseInt(m[1], 10);
				const min = parseInt(m[2], 10);
				const mer = m[3].toUpperCase();
				if (h === 12) h = 0;
				const hours24 = mer === 'PM' ? h + 12 : h;
				return { hours24, minutes: min };
			};

			// current time in IST
			const now = new Date();
			const utc = now.getTime() + now.getTimezoneOffset() * 60000;
			const istOffsetMs = (5 * 60 + 30) * 60000; // +05:30
			const nowIst = new Date(utc + istOffsetMs);

			const isAfterTimeStr = (timeStr) => {
				const parsed = parseTime12h(timeStr);
				if (!parsed) return false;
				const target = new Date(nowIst);
				target.setHours(parsed.hours24, parsed.minutes, 0, 0);
				return nowIst.getTime() > target.getTime();
			};

			const hasOpen = parsedBets.some((b) => b.game === 'open');
			if (hasOpen && openTimeStr && isAfterTimeStr(openTimeStr)) {
				return res.status(400).send({ error: 'your request is delayed for open bit' });
			}

			const hasClose = parsedBets.some((b) => b.game === 'close');
			if (hasClose && closeTimeStr && isAfterTimeStr(closeTimeStr)) {
				return res.status(400).send({ error: 'your request is delayed for close bit' });
			}
		} catch (err) {
			logger.error('triplepanadigitsbets timing validation error', err);
			return res.status(500).send({ error: 'Timing validation failed' });
		}

		const userRef = admin.firestore().collection('users').doc(uid);

		await admin.firestore().runTransaction(async (tx) => {
			const userSnap = await tx.get(userRef);
			if (!userSnap.exists) throw new Error('User not found');
			const userData = userSnap.data() || {};
			const walletRaw = userData.wallet;
			const wallet = typeof walletRaw === 'number' ? walletRaw : Number(walletRaw || 0);
			if (wallet < totalAmount) throw new Error('Insufficient wallet balance');

			// Create bet docs in user's subcollection and record pre/post balances
			const userBetsRef = userRef.collection('userbets');
			const serverTs = admin.firestore.FieldValue.serverTimestamp();

			// Apply bets one-by-one so each bet records the wallet before and after that single bet
			let currBalance = wallet;
			for (const b of parsedBets) {
				const amount = Number.isFinite(b.points) ? b.points : 0;
				const preBalance = currBalance;
				const postBalance = currBalance - amount;
				const doc = {
					amount: amount,
					gameId: String(gameId),
					gameName: gameName || null,
					gamecode: String(code),
					open: b.game === 'open',
					close: b.game === 'close',
					TPnumber: String(b.number),
					username: userData.name || null,
					userId: uid,
					mobile: userData.phone || null,
					resultstatus: 'pending',
					createdAt: serverTs,
					preBalance: preBalance,
					postBalance: postBalance,
				};
				const newDocRef = userBetsRef.doc();
				tx.set(newDocRef, doc);
				// decrement current balance for next bet
				currBalance = postBalance;
			}

			// Deduct wallet to the final remaining balance after all bets
			tx.update(userRef, { wallet: currBalance, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
		});

		return res.status(200).send({ ok: true, deducted: totalAmount });
	} catch (err) {
		logger.error('triplepanadigitsbets error', err);
		const msg = err && err.message ? err.message : String(err);
		return res.status(500).send({ error: msg });
	}
});

/**
 * Endpoint: halfsangambets
 * Expects JSON POST body:
 * { uid, code: 'HS', gameId, gameName, bets: [{ number, points, game:'open'|'close' }] }
 * Creates documents under users/{uid}/userbets with HS-specific fields and deducts wallet.
 */
exports.halfsangambets = onRequest(async (req, res) => {
	if (req.method !== 'POST') return res.status(405).send({ error: 'Method not allowed' });
	try {
		const authHeader = (req.headers.authorization || req.headers.Authorization || '').toString();
		if (!authHeader.startsWith('Bearer ')) return res.status(401).send({ error: 'Missing or invalid Authorization header' });
		const idToken = authHeader.split('Bearer ')[1].trim();
		let decoded;
		try { decoded = await admin.auth().verifyIdToken(idToken); } catch (err) { return res.status(401).send({ error: 'Invalid ID token' }); }

		const body = req.body || {};
		const { uid, code, gameId, gameName, bets } = body;
		if (!decoded || !decoded.uid || decoded.uid !== uid) return res.status(403).send({ error: 'Caller UID does not match provided uid' });
		if (!uid || !Array.isArray(bets) || code !== 'HS' || !gameId) return res.status(400).send({ error: 'Invalid payload' });

		// Validate bets
		const parsedBets = bets.map((b) => ({ number: String(b.number), points: Number(b.points), game: b.game === 'close' ? 'close' : 'open' }));
		const totalAmount = parsedBets.reduce((s, b) => s + (Number.isFinite(b.points) ? b.points : 0), 0);

		// Fetch game timings and validate against Indian Standard Time (IST)
		try {
			const gameRef = admin.firestore().collection('games').doc(String(gameId));
			const gameSnap = await gameRef.get();
			if (!gameSnap.exists) return res.status(400).send({ error: 'Game not found' });
			const gameData = gameSnap.data() || {};
			const openTimeStr = gameData.openTime ? String(gameData.openTime) : null;

			const parseTime12h = (t) => {
				if (!t || typeof t !== 'string') return null;
				const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
				if (!m) return null;
				let h = parseInt(m[1], 10);
				const min = parseInt(m[2], 10);
				const mer = m[3].toUpperCase();
				if (h === 12) h = 0;
				const hours24 = mer === 'PM' ? h + 12 : h;
				return { hours24, minutes: min };
			};

			const now = new Date();
			const utc = now.getTime() + now.getTimezoneOffset() * 60000;
			const istOffsetMs = (5 * 60 + 30) * 60000; // +05:30
			const nowIst = new Date(utc + istOffsetMs);

			const isAfterTimeStr = (timeStr) => {
				const parsed = parseTime12h(timeStr);
				if (!parsed) return false;
				const target = new Date(nowIst);
				target.setHours(parsed.hours24, parsed.minutes, 0, 0);
				return nowIst.getTime() > target.getTime();
			};

			// For Half Sangam both open and close bets should be validated against openTime
			const hasAny = parsedBets.length > 0;
			if (hasAny && openTimeStr && isAfterTimeStr(openTimeStr)) {
				return res.status(400).send({ error: 'your request is delayed for open and close bit' });
			}
		} catch (err) {
			logger.error('halfsangambets timing validation error', err);
			return res.status(500).send({ error: 'Timing validation failed' });
		}

		const userRef = admin.firestore().collection('users').doc(uid);

		await admin.firestore().runTransaction(async (tx) => {
			const userSnap = await tx.get(userRef);
			if (!userSnap.exists) throw new Error('User not found');
			const userData = userSnap.data() || {};
			const walletRaw = userData.wallet;
			const wallet = typeof walletRaw === 'number' ? walletRaw : Number(walletRaw || 0);
			if (wallet < totalAmount) throw new Error('Insufficient wallet balance');

			const userBetsRef = userRef.collection('userbets');
			const serverTs = admin.firestore.FieldValue.serverTimestamp();

			// Apply bets one-by-one so each bet records the wallet before and after that single bet
			let currBalance = wallet;
			for (const b of parsedBets) {
				// Expect number in format '<digit>-<pana>' e.g. '6-234'
				const parts = (''+b.number).split('-');
				const first = parts[0] || '';
				const second = parts[1] || '';

				const amount = Number.isFinite(b.points) ? b.points : 0;
				const preBalance = currBalance;
				const postBalance = currBalance - amount;

				let doc = {
					amount: amount,
					gameId: String(gameId),
					gameName: gameName || null,
					gamecode: String(code),
					username: userData.name || null,
					userId: uid,
					mobile: userData.phone || null,
					resultstatus: 'pending',
					createdAt: serverTs,
					preBalance: preBalance,
					postBalance: postBalance,
				};

				if (b.game === 'open') {
					doc.HSOpenDigitnumber = String(first);
					doc.HSClosePananumber = String(second);
					doc.open = true;
					doc.close = false;
				} else {
					doc.HSCloseDigitnumber = String(first);
					doc.HSOpenPananumber = String(second);
					doc.open = false;
					doc.close = true;
				}

				const newDocRef = userBetsRef.doc();
				tx.set(newDocRef, doc);
				// decrement current balance for next bet
				currBalance = postBalance;
			}

			// Deduct wallet to the final remaining balance after all bets
			tx.update(userRef, { wallet: currBalance, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
		});

		return res.status(200).send({ ok: true, deducted: totalAmount });
	} catch (err) {
		logger.error('halfsangambets error', err);
		const msg = err && err.message ? err.message : String(err);
		return res.status(500).send({ error: msg });
	}
});

/**
 * Endpoint: fullsangambets
 * Expects JSON POST body:
 * { uid, code: 'FS', gameId, gameName, bets: [{ number, points, game:'open'|'close' }] }
 * Creates documents under users/{uid}/userbets with FS-specific fields and deducts wallet.
 */
exports.fullsangambets = onRequest(async (req, res) => {
	if (req.method !== 'POST') return res.status(405).send({ error: 'Method not allowed' });
	try {
		const authHeader = (req.headers.authorization || req.headers.Authorization || '').toString();
		if (!authHeader.startsWith('Bearer ')) return res.status(401).send({ error: 'Missing or invalid Authorization header' });
		const idToken = authHeader.split('Bearer ')[1].trim();
		let decoded;
		try { decoded = await admin.auth().verifyIdToken(idToken); } catch (err) { return res.status(401).send({ error: 'Invalid ID token' }); }

		const body = req.body || {};
		const { uid, code, gameId, gameName, bets } = body;
		if (!decoded || !decoded.uid || decoded.uid !== uid) return res.status(403).send({ error: 'Caller UID does not match provided uid' });
		if (!uid || !Array.isArray(bets) || code !== 'FS' || !gameId) return res.status(400).send({ error: 'Invalid payload' });

		// Validate bets
		const parsedBets = bets.map((b) => ({ number: String(b.number), points: Number(b.points), game: b.game === 'close' ? 'close' : 'open' }));
		const totalAmount = parsedBets.reduce((s, b) => s + (Number.isFinite(b.points) ? b.points : 0), 0);

		// Fetch game timings and validate against Indian Standard Time (IST)
		try {
			const gameRef = admin.firestore().collection('games').doc(String(gameId));
			const gameSnap = await gameRef.get();
			if (!gameSnap.exists) return res.status(400).send({ error: 'Game not found' });
			const gameData = gameSnap.data() || {};
			const openTimeStr = gameData.openTime ? String(gameData.openTime) : null;

			const parseTime12h = (t) => {
				if (!t || typeof t !== 'string') return null;
				const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
				if (!m) return null;
				let h = parseInt(m[1], 10);
				const min = parseInt(m[2], 10);
				const mer = m[3].toUpperCase();
				if (h === 12) h = 0;
				const hours24 = mer === 'PM' ? h + 12 : h;
				return { hours24, minutes: min };
			};

			const now = new Date();
			const utc = now.getTime() + now.getTimezoneOffset() * 60000;
			const istOffsetMs = (5 * 60 + 30) * 60000; // +05:30
			const nowIst = new Date(utc + istOffsetMs);

			const isAfterTimeStr = (timeStr) => {
				const parsed = parseTime12h(timeStr);
				if (!parsed) return false;
				const target = new Date(nowIst);
				target.setHours(parsed.hours24, parsed.minutes, 0, 0);
				return nowIst.getTime() > target.getTime();
			};

			// For Full Sangam both open and close bets validated against openTime
			const hasAny = parsedBets.length > 0;
			if (hasAny && openTimeStr && isAfterTimeStr(openTimeStr)) {
				return res.status(400).send({ error: 'your request is delayed for bit' });
			}
		} catch (err) {
			logger.error('fullsangambets timing validation error', err);
			return res.status(500).send({ error: 'Timing validation failed' });
		}

		const userRef = admin.firestore().collection('users').doc(uid);

		await admin.firestore().runTransaction(async (tx) => {
			const userSnap = await tx.get(userRef);
			if (!userSnap.exists) throw new Error('User not found');
			const userData = userSnap.data() || {};
			const walletRaw = userData.wallet;
			const wallet = typeof walletRaw === 'number' ? walletRaw : Number(walletRaw || 0);
			if (wallet < totalAmount) throw new Error('Insufficient wallet balance');

			// Create bet docs in user's subcollection and record pre/post balances
			const userBetsRef = userRef.collection('userbets');
			const serverTs = admin.firestore.FieldValue.serverTimestamp();

			// Apply bets one-by-one so each bet records the wallet before and after that single bet
			let currBalance = wallet;
			for (const b of parsedBets) {
				// Expect number in format '<openPana>-<closePana>' e.g. '789-234'
				const parts = (''+b.number).split('-');
				const first = parts[0] || '';
				const second = parts[1] || '';

				const amount = Number.isFinite(b.points) ? b.points : 0;
				const preBalance = currBalance;
				const postBalance = currBalance - amount;

				let doc = {
					amount: amount,
					gameId: String(gameId),
					gameName: gameName || null,
					gamecode: String(code),
					username: userData.name || null,
					userId: uid,
					mobile: userData.phone || null,
					resultstatus: 'pending',
					createdAt: serverTs,
					preBalance: preBalance,
					postBalance: postBalance,
				};

				if (b.game === 'open') {
					doc.FSOpenPananumber = String(first);
					doc.FSClosePananumber = String(second);
					doc.open = true;
					doc.close = false;
				} else {
					// treat as close-type bet; swap semantics if needed
					doc.FSClosePananumber = String(first);
					doc.FSOpenPananumber = String(second);
					doc.open = false;
					doc.close = true;
				}

				const newDocRef = userBetsRef.doc();
				tx.set(newDocRef, doc);
				// decrement current balance for next bet
				currBalance = postBalance;
			}

			// Deduct wallet to the final remaining balance after all bets
			tx.update(userRef, { wallet: currBalance, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
		});

		return res.status(200).send({ ok: true, deducted: totalAmount });
	} catch (err) {
		logger.error('fullsangambets error', err);
		const msg = err && err.message ? err.message : String(err);
		return res.status(500).send({ error: msg });
	}
});

/**
 * Endpoint: withdrawalrequest
 * Expects JSON POST body: { uid: string, amount: number }
 * Verifies ID token, checks withdrawal config (open/close times and limit),
 * checks user's wallet and bank details, creates a document under
 * users/{uid}/userWithdrawal and deducts wallet inside a transaction.
 */
exports.withdrawalrequest = onRequest(async (req, res) => {
	if (req.method !== 'POST') return res.status(405).send({ error: 'Method not allowed' });
	try {
		const authHeader = (req.headers.authorization || req.headers.Authorization || '').toString();
		if (!authHeader.startsWith('Bearer ')) return res.status(401).send({ error: 'Missing or invalid Authorization header' });
		const idToken = authHeader.split('Bearer ')[1].trim();
		let decoded;
		try {
			decoded = await admin.auth().verifyIdToken(idToken);
		} catch (err) {
			return res.status(401).send({ error: 'Invalid ID token' });
		}

		const body = req.body || {};
		const { uid, amount } = body;
		if (!decoded || !decoded.uid || decoded.uid !== uid) {
			return res.status(403).send({ error: 'Caller UID does not match provided uid' });
		}
		const numAmount = Number(amount);
		if (!uid || !Number.isFinite(numAmount) || numAmount <= 0) return res.status(400).send({ error: 'Invalid payload' });

		// load withdrawal config (first doc in collection)
		const cfgSnap = await admin.firestore().collection('withdrawal').limit(1).get();
		if (cfgSnap.empty) return res.status(400).send({ error: 'Withdrawal configuration not found' });
		const cfg = cfgSnap.docs[0].data() || {};
		const openTimeStr = cfg.openTime || null;
		const closeTimeStr = cfg.closeTime || null;
		const limitVal = typeof cfg.limit === 'number' ? cfg.limit : Number(cfg.limit || 0);

		// helpers to interpret times in IST
		const parseTimeToMinutes = (t) => {
			if (!t) return null;
			const m = (''+t).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?$/);
			if (!m) return null;
			let hh = Number(m[1]);
			const mm = Number(m[2]);
			const ampm = (m[3] || '').toLowerCase();
			if (ampm === 'pm' && hh < 12) hh += 12;
			if (ampm === 'am' && hh === 12) hh = 0;
			return hh * 60 + mm;
		};
		const nowIstMinutes = () => {
			const now = new Date();
			const utc = now.getTime() + now.getTimezoneOffset() * 60000;
			const ist = new Date(utc + 5.5 * 60 * 60000);
			return ist.getHours() * 60 + ist.getMinutes();
		};
		const isNowBetween = (openStr, closeStr) => {
			if (!openStr || !closeStr) return false;
			const open = parseTimeToMinutes(openStr);
			const close = parseTimeToMinutes(closeStr);
			if (open == null || close == null) return false;
			const now = nowIstMinutes();
			if (open <= close) return now >= open && now <= close;
			return now >= open || now <= close;
		};

		if (!isNowBetween(openTimeStr, closeTimeStr)) return res.status(400).send({ error: 'Withdrawals allowed only during configured open hours' });
		// treat `limit` as minimum withdrawal amount (apply only if > 0)
		if (Number.isFinite(limitVal) && limitVal > 0 && numAmount < limitVal) return res.status(400).send({ error: `Minimum withdrawal amount is ${limitVal}` });

		const userRef = admin.firestore().collection('users').doc(uid);

		await admin.firestore().runTransaction(async (tx) => {
			const userSnap = await tx.get(userRef);
			if (!userSnap.exists) throw new Error('User not found');
			const userData = userSnap.data() || {};
			const walletRaw = userData.wallet;
			const wallet = typeof walletRaw === 'number' ? walletRaw : Number(walletRaw || 0);
			if (wallet < numAmount) throw new Error('Insufficient wallet balance');

			const bankRef = userRef.collection('bank').doc('details');
			const bankSnap = await tx.get(bankRef);
			if (!bankSnap.exists) throw new Error('Bank details not found');
			const bank = bankSnap.data() || {};

			// compute IST formatted date/time
			const now = new Date();
			const utc = now.getTime() + now.getTimezoneOffset() * 60000;
			const ist = new Date(utc + 5.5 * 60 * 60000);
			const pad = (n) => String(n).padStart(2, '0');
			const dateStr = `${ist.getFullYear()}-${pad(ist.getMonth()+1)}-${pad(ist.getDate())}`;
			const hh24 = ist.getHours();
			const hh12 = ((hh24 + 11) % 12) + 1;
			const ampm = hh24 >= 12 ? 'PM' : 'AM';
			const timeStr = `${hh12}:${pad(ist.getMinutes())} ${ampm}`;

			const prebalance = wallet;
			const postbalance = wallet - numAmount;

			const userWithdrawalRef = userRef.collection('userWithdrawal').doc();
			const doc = {
				withdrawalammount: numAmount,
				DateofReq: dateStr,
				TimeofReq: timeStr,
				accountNo: bank.accountNo || null,
				ifsc: bank.ifsc || null,
				holderName: bank.holderName || null,
				phone: bank.phone || null,
				upiId: bank.upiId || null,
				method: bank.method || null,
				prebalance: prebalance,
				postbalance: postbalance,
				status: 'pending',
				requestedByUid: uid,
				createdAt: admin.firestore.FieldValue.serverTimestamp(),
				updatedAt: admin.firestore.FieldValue.serverTimestamp(),
			};

			tx.set(userWithdrawalRef, doc);
			tx.update(userRef, { wallet: postbalance, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
		});

		return res.status(200).send({ ok: true });
	} catch (err) {
		logger.error('withdrawalrequest error', err);
		const msg = err && err.message ? err.message : String(err);
		return res.status(500).send({ error: msg });
	}
});

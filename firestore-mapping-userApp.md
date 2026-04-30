# Firestore Mapping — userApp

Generated: automated scan of `userApp` source (Dec 11, 2025)

Project: `mobileapp-1fd35` (from `firebaseConfig.ts`)

Summary: this app uses a small set of Firestore collections and user-scoped subcollections. The app relies on Cloud Functions (in `functions/index.js`) to create bet documents and to update sensitive fields (like `wallet`). Clients read user/profile, game, rate, and help messages; clients write `help_admin` messages but should NOT write `userbets` or update `wallet` directly.

Collections

- `users` (document id = `uid`)

  - Purpose: primary user profile & runtime data.
  - Observed fields:
    - `name` (string | null)
    - `phone` (string | null)
    - `email` (string | null)
    - `deviceId` (string | null)
    - `wallet` (number | string coercible to number)
    - `createdAt` (timestamp)
    - `updatedAt` (timestamp)
    - any other admin-managed flags/claims
  - Usage:
    - Client: reads profile and `wallet` (e.g. `profile.tsx`, game screens)
    - Cloud Functions: `functions/index.js` reads and updates `wallet` inside transactions.

  Subcollections:

  - `userbets` (documents created by Cloud Functions)

    - Purpose: store each bet for user
    - Observed/expected fields (per bet document):
      - `amount` (number) — points placed
      - `gameId` (string)
      - `gameName` (string|null)
      - `gamecode` (string) — one of: `SD`, `JD`, `SP`, `DP`, `TP` etc.
      - `open` (boolean)
      - `close` (boolean)
      - one of the number fields depending on `gamecode`:
        - `SDnumber`, `JDnumber`, `SPnumber`, `DPnumber`, `TPnumber` (strings)
      - `username` (string|null)
      - `userId` (string)
      - `mobile` (string|null)
      - `resultstatus` (string) — e.g. `pending`, `won`, `lost`
      - `createdAt` (timestamp)
    - Writes: created inside Cloud Functions (transactional `tx.set`) — client does not write these directly.

  - `help_admin` (chat/messages between user and admin)
    - Observed fields:
      - `text` (string)
      - `imageUrl` (string) optional
      - `type` (`text` | `image`)
      - `senderId` (string)
      - `seen` (boolean)
      - `createdAt` (timestamp)
    - Usage: client reads ordered by `createdAt` and writes new messages (both text and image uploads).

- `games` (top-level collection)

  - Document id: arbitrary `gameId` (used in game screens)
  - Observed fields:
    - `name` (string)
    - `openTime` (string | timestamp) — stored in code as string or timestamp
    - `closeTime` (string | timestamp)
    - `clear_result` (boolean) — indicates whether the market can accept bets
    - other game-specific metadata
  - Usage: client subscribes to `games/{id}` for timing and status checks (e.g. `single-digit.tsx`)

- `rates` (top-level collection)
  - Each document can contain arbitrary rate information
  - Common candidate fields: `value`, `rate`, `price`, `amount` (any primitive), plus `updatedAt` / `updated_at` / `at`
  - Usage: client fetches all docs and displays primary value (see `rate-chart.tsx`) — documents are read-only from client.

Notes from `functions/index.js`

- Multiple cloud function HTTP endpoints accept bets and perform transactions:
  - `singledigitbets`, `jodidigitsbets`, `singlepanadigitsbets`, `doublepanadigitsbets`, `triplepanadigitsbets` (and possibly others)
  - Each verifies Firebase ID token (admin.auth().verifyIdToken), reads `users/{uid}` inside a transaction, checks `wallet` balance, writes new documents to `users/{uid}/userbets` and updates `users/{uid}.wallet` using `tx.update`.

Security & rules recommendations

- Principle: clients may read their own `users/{uid}` and write to `users/{uid}/help_admin`, but clients MUST NOT be allowed to write `userbets` or modify the `wallet` field. Only trusted server code (Cloud Functions) should modify `wallet` and create `userbets`.

Suggested rules (conceptual):

rules_version = '2';
service cloud.firestore {
match /databases/{database}/documents {
// Allow authenticated users to read their own profile
match /users/{userId} {
allow read: if request.auth != null && request.auth.uid == userId;
// Prevent client from updating wallet or other admin fields
allow update: if request.auth != null && request.auth.uid == userId
&& !("wallet" in request.resource.data) // deny changes to wallet
&& // additional checks for allowed fields
true;

      // Prevent client from writing to userbets — only functions should create bets
      match /userbets/{betId} {
        allow read: if request.auth != null && request.auth.uid == userId;
        allow write: if false; // no client writes
      }

      // Allow user to create help messages (chat)
      match /help_admin/{msgId} {
        allow create: if request.auth != null && request.auth.uid == userId
                      && (request.resource.data.senderId == request.auth.uid)
                      && (request.resource.data.createdAt == request.time || request.resource.data.createdAt == null);
        allow read: if request.auth != null && request.auth.uid == userId;
        // allow updates only from server / admin — restrict client updates
        allow update, delete: if false;
      }
    }

    // Public reads for games and rates
    match /games/{doc} { allow read: if true; allow write: if false; }
    match /rates/{doc} { allow read: if true; allow write: if false; }

}
}

Index recommendations

- Firestore automatically indexes single fields like `createdAt` for ordering.
- Observed queries:
  - `users/{uid}/userbets` ordered by `createdAt` (single-field index) — no composite index required.
  - `users/{uid}/help_admin` ordered by `createdAt` — single-field index is sufficient.
- If you later add queries combining `gamecode` + `createdAt` or other compound filters, add a composite index via `firestore indexes` or the Firebase console.

Operational notes & improvements

- Ensure Cloud Functions environment is deployed to the same `projectId` (`myapp-808b0`).
- Consider storing numeric `wallet` as number (avoid string) and ensuring `createdAt` uses `serverTimestamp()` for consistent ordering.
- Add monitoring/alerts around Cloud Functions that modify wallets (to detect accidental double-charges).
- If you want clients to place bets directly (not recommended), implement server-validated Callable functions and restrict writes in security rules.

Files referenced while generating this mapping:

- `app/sections/bid-history.tsx`
- `app/sections/profile.tsx`
- `app/sections/message.tsx`
- `app/sections/rate-chart.tsx`
- `app/sections/games/[id]/*.tsx`
- `functions/index.js`
- `firebaseConfig.ts`

If you want, I can:

- generate a stricter `firestore.rules` file based on the suggested snippet,
- produce a `firestore.indexes.json` template for any composite index you plan to add,
- or produce a migration script (Node) to normalize `wallet` field types and set missing `createdAt` timestamps.

---

End of mapping

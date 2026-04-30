import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { auth, db } from '../../firebaseConfig'

function parseTimeToMinutes(t: string) {
  // expects formats like "6:00 PM" or "11:00 AM"
  if (!t) return null
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?$/)
  if (!m) return null
  let hh = Number(m[1])
  const mm = Number(m[2])
  const ampm = (m[3] || '').toLowerCase()
  if (ampm === 'pm' && hh < 12) hh += 12
  if (ampm === 'am' && hh === 12) hh = 0
  return hh * 60 + mm
}

function nowIstMinutes() {
  const now = new Date()
  const utc = now.getTime() + now.getTimezoneOffset() * 60000
  const istOffset = 5.5 * 60 * 60000
  const ist = new Date(utc + istOffset)
  return ist.getHours() * 60 + ist.getMinutes()
}

function isNowBetween(openStr: string | null, closeStr: string | null) {
  if (!openStr || !closeStr) return false
  const open = parseTimeToMinutes(openStr)
  const close = parseTimeToMinutes(closeStr)
  if (open == null || close == null) return false
  const now = nowIstMinutes()
  if (open <= close) return now >= open && now <= close
  // across midnight
  return now >= open || now <= close
}

export default function WithdrawMoneySection() {
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [configLoading, setConfigLoading] = useState(true)
  const [openTime, setOpenTime] = useState<string | null>(null)
  const [closeTime, setCloseTime] = useState<string | null>(null)
  const [limit, setLimit] = useState<number | null>(null)
  const [updatedAt, setUpdatedAt] = useState<any>(null)
  const [wallet, setWallet] = useState<number>(0)
  const [amount, setAmount] = useState<string>('')
  const [bankDetails, setBankDetails] = useState<any>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(u => setUid(u?.uid ?? null))
    return () => unsubAuth()
  }, [])

  useEffect(() => {
    // load withdrawal config (take first doc from `withdrawal` collection)
    setConfigLoading(true)

    const load = async () => {
      try {
        const snap = await db.collection('withdrawal').limit(1).get()
        if (!snap.empty) {
          const d = snap.docs[0].data() as any
          setOpenTime(d.openTime ?? null)
          setCloseTime(d.closeTime ?? null)
          setLimit(typeof d.limit === 'number' ? d.limit : (Number(d.limit) || null))
          setUpdatedAt(d.updatedAt ?? null)
        }
      } catch (e) {
        console.warn('failed load withdrawal config', e)
      } finally {
        setConfigLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!uid) { setLoading(false); return }
    setLoading(true)
    const ref = db.collection('users').doc(uid)
    const unsub = ref.onSnapshot(snap => {
      const data = snap.data() as any
      const raw = data?.wallet
      const num = typeof raw === 'number' ? raw : Number(raw ?? 0)
      setWallet(Number.isFinite(num) ? num : 0)
      setLoading(false)
    }, () => setLoading(false))

    // load bank details
    const bankRef = db.collection('users').doc(uid).collection('bank').doc('details')
    const unsubBank = bankRef.onSnapshot(snap => {
      setBankDetails(snap.exists ? (snap.data() as any) : null)
    }, () => setBankDetails(null))

    return () => { unsub(); unsubBank(); }
  }, [uid])

  const canSendNow = useMemo(() => isNowBetween(openTime, closeTime), [openTime, closeTime])

  const onSubmit = useCallback(async () => {
    if (!uid) { Alert.alert('Not signed in'); return }
    const amt = Number(amount)
    if (!amt || amt <= 0) { Alert.alert('Invalid amount'); return }
    if (limit != null && amt < limit) { Alert.alert('Minimum withdrawal is ₹' + limit); return }
    if (wallet < amt) { Alert.alert('Insufficient balance'); return }
    if (!canSendNow) { Alert.alert('Unavailable', 'Withdrawals are allowed only during open hours'); return }
    if (!bankDetails || !bankDetails.accountNo) {
      Alert.alert(
        'Bank details missing',
        'Add your bank details before withdrawing',
        [
          { text: 'OK', onPress: () => router.push('/sections/bank-details') }
        ],
      )
      return
    }

    setSending(true)
    try {
      const url = `https://backend-9k4j.onrender.com/api/add-money/withdrawal-request`
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) throw new Error('Not authenticated')
      const payload = { uid, amount: amt }
      const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify(payload) })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || data?.message || 'Request failed')
      Alert.alert('Requested', 'Withdrawal request sent')
      setAmount('')
    } catch (e: any) {
      Alert.alert('Failed', e?.message || String(e))
    } finally {
      setSending(false)
    }
  }, [uid, amount, wallet, limit, canSendNow, bankDetails])

  if (loading || configLoading) return <View style={styles.center}><ActivityIndicator /></View>

  // replace these lines only

  return (
    <View style={styles.container}>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Open Time:</Text>
        <Text style={styles.infoValue}>{openTime ?? '—'}</Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Close Time:</Text>
        <Text style={styles.infoValue}>{closeTime ?? '—'}</Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Limit:</Text>
        <Text style={styles.infoValue}>
          {limit != null ? `₹ ${limit}` : '—'}
        </Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Your Wallet:</Text>
        <Text style={styles.infoValue}>₹ {wallet}</Text>
      </View>

      <View style={{ marginTop: 6 }}>
        <Text style={styles.label}>Amount</Text>

        <TextInput
          value={amount}
          onChangeText={t => setAmount(t.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          placeholder="Enter amount"
          placeholderTextColor="#8b90b5"
          style={styles.input}
        />
      </View>

      <View style={{ marginTop: 10 }}>
        <Text style={styles.label}>
          Bank Details for Above Withdrawal Money
        </Text>

        {bankDetails ? (
          <View style={{ gap: 4 }}>
            <Text style={styles.bankText}>{bankDetails.holderName || '—'}</Text>
            <Text style={styles.bankText}>
              Acct: {bankDetails.accountNo || '—'}
            </Text>
            <Text style={styles.bankText}>
              IFSC: {bankDetails.ifsc || '—'}
            </Text>
          </View>
        ) : (
          <Text style={styles.emptyText}>
            No bank details found. Add in Bank Details section.
          </Text>
        )}
      </View>

      <TouchableOpacity
        onPress={onSubmit}
        disabled={sending}
        style={[
          styles.btn,
          (!canSendNow || sending) ? styles.btnDisabled : null
        ]}
      >
        {sending ? (
          <ActivityIndicator color="#111827" />
        ) : (
          <Text style={styles.btnText}>Send Withdrawal Request</Text>
        )}
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#10112a',
    gap: 14,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10112a',
  },

  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    color: '#f4f6ff',
    marginBottom: 10,
    letterSpacing: 0.4,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#1e2044',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2d5a',
  },

  infoLabel: {
    fontWeight: '700',
    color: '#facc15',
    fontSize: 14,
  },

  label: {
    fontWeight: '700',
    fontSize: 14,
    color: '#f4f6ff',
    marginBottom: 4,
  },

  input: {
    borderWidth: 1,
    borderColor: '#2a2d5a',
    backgroundColor: '#1e2044',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: '#ffffff',
    fontSize: 15,
  },
  // add these styles only

 

  bankText: {
    color: '#cbd5e1',
    fontSize: 14,
  },

  emptyText: {
    color: '#6b7280',
    fontSize: 14,
  },

  btn: {
    marginTop: 18,
    backgroundColor: '#facc15',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: {
      width: 0,
      height: 3,
    },
  },

  btnDisabled: {
    opacity: 0.5,
  },

  btnText: {
    color: '#111827',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  infoValue: {
  color: '#ffffff',
  fontSize: 14,
  fontWeight: '600',
},
})

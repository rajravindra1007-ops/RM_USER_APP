import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useLocalSearchParams, useNavigation } from 'expo-router'
import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { auth, db } from '../../../../firebaseConfig'

const THEME = {
  bg: '#10112a',
  card: '#1e2050',
  gold: '#f5c518',
  text: '#ffffff',
  subText: '#a0aec0',
  inputBg: '#1e2044',
  border: '#2a2d5a',
}
type Bid = {
  id: string
  number: string
  points: string
  game: string
}

type SubmitPayload = {
  uid: string | null
  code: string
  gameId: string
  gameName: string | null
  bets: { number: string; points: number; game: string }[]
}

const JODI_DIGIT_URL = 'https://rmgames.live/api/user-bets/jodidigitsbets'
const GAME_CHART_URL = 'https://rmgames.live/api/game-chart/chart'
const TODAY_MONEY_URL = 'https://rmgames.live/api/game-chart/todaymoney'

export default function JodiDigitsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const navigation = useNavigation()
  const [number, setNumber] = useState('')
  const [points, setPoints] = useState('')
  const [bids, setBids] = useState<Bid[]>([])
  const [wallet, setWallet] = useState<number>(0)
  const [clearResult, setClearResult] = useState<boolean | null>(null)
  const [openTime, setOpenTime] = useState<string | null>(null)
  const [gameName, setGameName] = useState<string | null>(null)
  const [allowedOpen, setAllowedOpen] = useState<boolean>(false)
  const [initialCheckDone, setInitialCheckDone] = useState(false)
  const numberInputRef = useRef<TextInput | null>(null)
  const pointsInputRef = useRef<TextInput | null>(null)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [confirmVisible, setConfirmVisible] = useState(false)

  useEffect(() => {
    const title = gameName ? `${gameName} - Jodi` : 'Jodi Digits'
    navigation.setOptions({
      title,
      headerStyle: { backgroundColor: '#0b1f4c' },
      headerTintColor: '#f4f6ff',
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
          <MaterialCommunityIcons name="wallet" size={18} color="#facc15" style={{ marginRight: 8 }} />
          <Text style={{ color: '#facc15', fontWeight: '700' }}>
            {Number.isFinite(Number(wallet)) ? Number(wallet).toFixed(2) : '0.00'}
          </Text>
        </View>
      ),
    })
  }, [navigation, gameName, wallet])

  useEffect(() => {
    const user = auth.currentUser
    if (!user) return
    const unsub = db
      .collection('users')
      .doc(user.uid)
      .onSnapshot(
        (snap) => {
          const data = snap.data() as any
          const raw = data?.wallet
          const num = typeof raw === 'number' ? raw : Number(raw ?? 0)
          setWallet(Number.isFinite(num) ? num : 0)
        },
        () => setWallet(0)
      )
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!id) return
    const unsub = db
      .collection('games')
      .doc(String(id))
      .onSnapshot(
        (snap) => {
          const data = snap.data() as any
            const cr = data?.clear_result
            const oTime = data?.openTime ? String(data.openTime) : null
            setClearResult(cr)
            setOpenTime(oTime)
            setGameName(data?.name ?? null)
          const now = new Date()
          const canOpen = cr === true && isFutureTime(oTime, now)
          setAllowedOpen(canOpen)
          if (!canOpen && !initialCheckDone) {
            setInitialCheckDone(true)
            Alert.alert('Not Available', 'Jodi betting is not available for this game at this time.')
            navigation.goBack()
          }
          if (!initialCheckDone) setInitialCheckDone(true)
        },
        () => {
          if (!initialCheckDone) {
            setInitialCheckDone(true)
            Alert.alert('Unavailable', 'Unable to load game details.')
            navigation.goBack()
          }
        }
      )
    return () => unsub()
  }, [id, navigation, initialCheckDone])

  // Warm-up cloud function to avoid cold-start delay on first Submit
  useEffect(() => {
    if (!initialCheckDone) return
    let abort = false
    ;(async () => {
      try {
        console.time('JD warmup')
        const url = JODI_DIGIT_URL
        const body = JSON.stringify({ uid: auth.currentUser ? auth.currentUser.uid : null, code: 'JD', gameId: String(id), bets: [] })
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 4000)
        await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: controller.signal }).catch(() => {})
        clearTimeout(timeout)
        if (!abort) console.timeEnd('JD warmup')
      } catch (err) {
        try { console.timeEnd('JD warmup') } catch (_) {}
      }
    })()
    return () => { abort = true }
  }, [initialCheckDone, id])

  // autofocus and keyboard listeners
  useEffect(() => {
    const t = setTimeout(() => { try { numberInputRef.current?.focus() } catch (_) {} }, 180)
    const showEvent = Platform.OS === 'android' ? 'keyboardDidShow' : 'keyboardWillShow'
    const hideEvent = Platform.OS === 'android' ? 'keyboardDidHide' : 'keyboardWillHide'
    const onShow = (e: any) => setKeyboardHeight(e.endCoordinates?.height || 240)
    const onHide = () => setKeyboardHeight(0)
    const s = Keyboard.addListener(showEvent, onShow)
    const h = Keyboard.addListener(hideEvent, onHide)
    return () => { clearTimeout(t); s.remove(); h.remove() }
  }, [])

  const onAdd = () => {
    if (!allowedOpen) {
      Alert.alert('Not Available', 'Jodi betting is closed for this game.')
      return
    }

    if (!/^\d{2}$/.test(number)) {
      Alert.alert('Invalid Jodi', 'Please enter exactly 2 digits (00-99).')
      return
    }
    if (!points.trim() || isNaN(Number(points)) || Number(points) <= 0) {
      Alert.alert('Invalid Points', 'Please enter valid points.')
      return
    }

    const totalAdded = bids.reduce((sum, bid) => sum + Number(bid.points), 0)
    const totalRequired = totalAdded + Number(points)

    const newBid: Bid = {
      id: Date.now().toString(),
      number: number,
      points: points,
      game: 'open',
    }
    setBids((prev) => [...prev, newBid])
    setNumber('')
    setPoints('')
    setTimeout(() => { try { numberInputRef.current?.focus() } catch (_) {} }, 80)
  }

  const onDelete = (bidId: string) => {
    setBids((prev) => prev.filter((b) => b.id !== bidId))
  }

  const onPressSubmit = () => {
    if (submitting) return
    if (bids.length === 0) {
      Alert.alert('No Bids', 'Please add at least one bid before submitting.')
      return
    }
    const user = auth.currentUser
    if (!user) {
      Alert.alert('Not signed in')
      return
    }

    // Validate wallet sufficiency before submitting
    const totalRequired = bids.reduce((sum, bid) => sum + Number(bid.points), 0)
    if (totalRequired > wallet) {
      Alert.alert('Insufficient Balance', `You need ₹${totalRequired} but only have ₹${wallet} in your wallet.`)
      return
    }

    // show confirmation modal
    setConfirmVisible(true)
  }

  const performSubmit = async () => {
    const user = auth.currentUser
    if (!user) throw new Error('Not signed in')
    try {
      setSubmitting(true)
      const totalAmount = bids.reduce((sum, bid) => sum + Number(bid.points), 0)
      const payload: SubmitPayload = {
        uid: user.uid,
        code: 'JD',
        gameId: String(id),
        gameName: gameName || null,
        bets: bids.map((b) => ({ number: b.number, points: Number(b.points), game: b.game })),
      }

      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) throw new Error('Not authenticated')

      triggerChartRequest(payload, idToken)
      triggerTodayMoneyRequest(totalAmount, payload, idToken)

      const resp = await fetch(JODI_DIGIT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify(payload),
      })
      const data = await resp.json()
      if (!resp.ok) {
        throw new Error(data?.error || 'Submission failed')
      }
      Alert.alert('Submitted', `Submitted ${bids.length} bet(s).`)
      setBids([])
    } finally {
      setSubmitting(false)
    }
  }

  const onConfirmSubmit = async () => {
    try {
      await performSubmit()
    } catch (e: any) {
      Alert.alert('Submit failed', e?.message || String(e))
    } finally {
      setConfirmVisible(false)
    }
  }

  const totalPoints = bids.reduce((sum, bid) => sum + Number(bid.points), 0)
  const walletAfter = wallet - totalPoints

  if (!initialCheckDone) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Loading...</Text>
      </View>
    )
  }

  if (!allowedOpen) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#ef4444', textAlign: 'center' }}>
          Jodi betting is closed for this game.
        </Text>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.container, { paddingBottom: 160 }]} keyboardShouldPersistTaps="handled"> 
        {/* Open Radio */}
        <View style={styles.radioRow}>
          <View style={styles.radioContainer}>
            <View style={styles.radioOuter}>
              <View style={styles.radioInner} />
            </View>
            <Text style={styles.radioLabel}>Open</Text>
          </View>
        </View>

        {/* Input Form */}
        <View style={styles.formCard}>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Jodi :</Text>
            <TextInput
              ref={numberInputRef}
              value={number}
              onChangeText={(t) => {
                const cleaned = t.replace(/[^0-9]/g, '').slice(0, 2)
                setNumber(cleaned)
                if (/^\d{2}$/.test(cleaned)) {
                  try { pointsInputRef.current?.focus() } catch (_) {}
                }
              }}
              keyboardType="number-pad"
              placeholder="00-99"
              placeholderTextColor="#9ca3af"
              style={[styles.input, styles.fieldInput]}
              maxLength={2}
              returnKeyType="next"
              onSubmitEditing={() => { try { pointsInputRef.current?.focus() } catch (_) {} }}
            />
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Points :</Text>
            <TextInput
              ref={pointsInputRef}
              value={points}
              onChangeText={(t) => setPoints(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="Enter points"
              placeholderTextColor="#9ca3af"
              style={[styles.input, styles.fieldInput]}
              returnKeyType="done"
            />
          </View>

          <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>

      {/* Bids List */}
      {bids.length > 0 && (
        <View style={styles.listCard}>
          <Text style={styles.listTitle}>Your Bids ({bids.length})</Text>
          {bids.map((bid) => (
            <View key={bid.id} style={styles.bidRow}>
              <View style={styles.bidInfo}>
                <Text style={styles.bidText}>Number: {bid.number}</Text>
                <Text style={styles.bidText}>Points: {bid.points}</Text>
                <Text style={styles.bidText}>Game: {bid.game}</Text>
              </View>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(bid.id)}>
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

        </ScrollView>

        {/* Fixed submit at bottom (adjusts with keyboard) */}
        <View style={[styles.submitWrapper, { bottom: keyboardHeight ? keyboardHeight + 48 : 48 }]} pointerEvents="box-none">
          <TouchableOpacity style={styles.submitBtnFixed} onPress={onPressSubmit} disabled={bids.length === 0 || submitting}>
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitBtnText}>{`Submit · ${bids.length} bet(s) · ₹ ${totalPoints}`}</Text>
            )}
          </TouchableOpacity>
        </View>
        
        {/* Confirmation modal */}
        <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
          <View style={styles.confirmOverlay}>
            <ScrollView contentContainerStyle={styles.confirmScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.confirmCard}>
                <Text style={styles.confirmTitle}>{`${gameName || 'Game'} - Jodi`}</Text>

                <View style={styles.centeredValueBlock}>
                  <Text style={styles.centeredLabel}>Total Games</Text>
                  <Text style={styles.centeredValue}>{bids.length}</Text>
                </View>

                <View style={styles.centeredValueBlock}>
                  <Text style={styles.centeredLabel}>Total Amount</Text>
                  <Text style={styles.centeredValue}>₹ {totalPoints}</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.confirmRowResponsive}>
                  <View style={styles.confirmCol}>
                    <Text style={styles.confirmLabelSmall}>Wallet before</Text>
                    <Text style={styles.confirmValueSmall}>{wallet.toFixed(2)}</Text>
                  </View>
                  <View style={styles.confirmCol}>
                    <Text style={styles.confirmLabelSmall}>Wallet after</Text>
                    <Text style={styles.confirmValueSmall}>{walletAfter.toFixed(2)}</Text>
                  </View>
                </View>

                <Text style={styles.confirmNote}>* Note: Played game(s) can't be cancelled</Text>

                <View style={styles.confirmButtonsRow}>
                  <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setConfirmVisible(false)}>
                    <Text style={styles.confirmCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmSaveBtn} onPress={onConfirmSubmit} disabled={submitting}>
                    <Text style={styles.confirmSaveText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </Modal>
      </SafeAreaView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { paddingTop: 0, paddingHorizontal: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: '#1f2937', textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 12 },
  walletCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  walletLabel: { fontSize: 10, color: '#166534', fontWeight: '600', marginBottom: 2 },
  walletAmount: { fontSize: 12, fontWeight: '700', color: '#15803d' },
  walletUsed: { fontSize: 10, color: '#dc2626', fontWeight: '600', marginTop: 2 },
  walletTiny: { fontSize: 10, color: '#15803d', fontWeight: '700' },
  radioRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 0, marginBottom: 8 },
  radioContainer: { flexDirection: 'row', alignItems: 'center' },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#111827' },
  radioLabel: { fontSize: 16, fontWeight: '600', color: '#111827' },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
    marginBottom: 8,
    marginTop: 8,
  },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flex: 0.35,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1f2937',
  },
  fieldInput: {
    flex: 0.65,
  },
  addBtn: {
    backgroundColor: THEME.gold,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  addBtnText: { color: 'Black', fontWeight: '700', fontSize: 16 },
  listCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
    marginBottom: 20,
  },
  listTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 12 },
  bidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  bidInfo: { flex: 1 },
  bidText: { fontSize: 14, color: '#374151', marginBottom: 2 },
  deleteBtn: {
    backgroundColor: THEME.bg,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  deleteBtnText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },
  submitBtn: {
    backgroundColor: THEME.gold,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  submitBtnText: { color: 'Black', fontWeight: '700', fontSize: 16 },
  submitWrapper: { position: 'absolute', left: 32, right: 32, alignItems: 'center' },
  submitBtnFixed: { backgroundColor: THEME.gold, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18, alignItems: 'center', width: '100%' },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    elevation: 6,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    color: '#111827',
  },
  centeredValueBlock: {
    alignItems: 'center',
    marginBottom: 10,
  },
  centeredLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 6,
  },
  centeredValue: {
    fontSize: 18,
    fontWeight: '500',
    color: '#111827',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e5e7eb',
    marginVertical: 10,
  },
  confirmRowResponsive: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  confirmCol: { flex: 1, alignItems: 'center' },
  confirmLabelSmall: { fontSize: 13, color: '#374151', marginBottom: 4 },
  confirmValueSmall: { fontSize: 16, fontWeight: '700', color: '#111827' },
  confirmScroll: { flexGrow: 1, justifyContent: 'center', width: '100%' },
  confirmNote: {
    marginTop: 10,
    fontSize: 11,
    color: '#b91c1c',
    textAlign: 'center',
  },
  confirmButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  confirmCancelBtn: {
    flex: 1,
    marginRight: 8,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#e5e7eb',
  },
  confirmSaveBtn: {
    flex: 1,
    marginLeft: 8,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
   backgroundColor: THEME.gold,
  },
  confirmCancelText: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  confirmSaveText: {
    color: 'Black',
    fontWeight: '700',
  },
})

function triggerChartRequest(payload: SubmitPayload, token: string | null) {
  // Fire-and-forget chart sync so Jodi submit stays snappy
  ;(async () => {
    try {
      const resp = await fetch(GAME_CHART_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      })
      if (!resp.ok) {
        const data = await resp.json().catch(() => null)
        throw new Error(data?.error || 'Chart update failed')
      }
    } catch (err: any) {
      console.warn('Chart update request failed:', err?.message || err)
    }
  })()
}

function triggerTodayMoneyRequest(totalAmount: number, payload: SubmitPayload, token: string | null) {
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) return
  ;(async () => {
    try {
      const body = {
        uid: payload.uid,
        code: payload.code,
        gameId: payload.gameId,
        gameName: payload.gameName,
        totalAmount,
      }
      const resp = await fetch(TODAY_MONEY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      })
      if (!resp.ok) {
        const data = await resp.json().catch(() => null)
        throw new Error(data?.error || 'Today money update failed')
      }
    } catch (err: any) {
      console.warn('Today money update failed:', err?.message || err)
    }
  })()
}

// Helpers
const isFutureTime = (timeStr: string | null, now: Date) => {
  if (!timeStr) return false
  const parsed = parseTime12h(timeStr)
  if (!parsed) return false
  const dt = new Date(now)
  dt.setHours(parsed.hours24, parsed.minutes, 0, 0)
  return dt.getTime() > now.getTime()
}

const parseTime12h = (t: string): { hours24: number; minutes: number } | null => {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  const mer = m[3].toUpperCase()
  if (h === 12) h = 0
  const hours24 = mer === 'PM' ? h + 12 : h
  return { hours24, minutes: min }
}

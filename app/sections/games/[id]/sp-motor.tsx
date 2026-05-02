import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useLocalSearchParams, useNavigation } from 'expo-router'
import React, { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { auth, db, firebaseWebConfig } from '../../../../firebaseConfig'

const THEME = {
  bg: '#10112a',
  card: '#1e2050',
  gold: '#f5c518',
  text: '#ffffff',
  subText: '#a0aec0',
  inputBg: '#1e2044',
  border: '#2a2d5a',
}
// Safe console timers: some release JS engines may not have console.time/timeEnd
const safeTime = (label: string) => { try { if (typeof console?.time === 'function') console.time(label) } catch (_) {} }
const safeTimeEnd = (label: string) => { try { if (typeof console?.timeEnd === 'function') console.timeEnd(label) } catch (_) {} }

type Bid = { id: string; number: string; points: string; game: 'open' | 'close' }

type SubmitPayload = {
  uid: string | null
  code: string
  gameId: string
  gameName: string | null
  bets: { number: string; points: number; game: 'open' | 'close' }[]
}

const SINGLE_PANA_URL = 'https://api.rmgames.live/api/user-bets/singlepanadigitsbets'
const GAME_CHART_URL = 'https://api.rmgames.live/api/game-chart/chart'
const TODAY_MONEY_URL = 'https://api.rmgames.live/api/game-chart/todaymoney'

const PANA_NUMBERS = [
  '127', '136', '145', '190', '235', '280', '370', '389', '460', '479', '569', '578',
  '128', '137', '146', '236', '245', '290', '380', '470', '489', '560', '579', '678',
  '129', '138', '147', '156', '237', '246', '345', '390', '480', '570', '589', '679',
  '120', '139', '148', '157', '238', '247', '256', '346', '490', '580', '670', '689',
  '130', '149', '158', '167', '239', '248', '257', '347', '356', '590', '680', '789',
  '140', '159', '168', '230', '249', '258', '267', '348', '357', '456', '690', '780',
  '123', '150', '169', '178', '240', '259', '268', '349', '358', '367', '457', '790',
  '124', '160', '278', '179', '250', '269', '340', '359', '368', '458', '467', '890',
  '125', '134', '170', '189', '260', '279', '350', '369', '468', '378', '459', '567',
  '126', '135', '180', '234', '270', '289', '360', '379', '450', '469', '478', '568',
]

// Precompute bitmasks for fast matching: each digit 0-9 maps to a bit in a 32-bit int
const makeMask = (s: string) => {
  let m = 0
  for (let i = 0; i < s.length; i++) m |= 1 << Number(s[i])
  return m
}

const PANA_MASKS: { num: string; mask: number }[] = PANA_NUMBERS.map((p) => ({ num: p, mask: makeMask(p) }))

export default function SpMotor() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const navigation = useNavigation()
  const [selected, setSelected] = useState<'open' | 'close'>('open')
  const [digits, setDigits] = useState('') // user typed digits (4-9)
  const [points, setPoints] = useState('')
  const [bids, setBids] = useState<Bid[]>([])
  const bidsRef = useRef<Bid[]>([])
  const existingKeysRef = useRef<Set<string>>(new Set())
  const totalPointsRef = useRef<number>(0)
  const [preMatches, setPreMatches] = useState<string[]>([])
  const [addLoading, setAddLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [confirmVisible, setConfirmVisible] = useState(false)
  const [wallet, setWallet] = useState<number>(0)
  const [openTime, setOpenTime] = useState<string | null>(null)
  const [closeTime, setCloseTime] = useState<string | null>(null)
  const [gameName, setGameName] = useState<string | null>(null)
  const [allowedOpen, setAllowedOpen] = useState(false)
  const [allowedClose, setAllowedClose] = useState(false)
  const [initialCheckDone, setInitialCheckDone] = useState(false)

  useEffect(() => {
    const title = gameName ? `${gameName} - SP Motor` : 'SP Motor'
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

  // focus number input on opening the section
  const numberInputRef = useRef<TextInput | null>(null)
  useEffect(() => {
    if (initialCheckDone) {
      setTimeout(() => numberInputRef.current?.focus(), 150)
    }
  }, [initialCheckDone])

  // keyboard tracking so submit button rises above it
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const showSub = Keyboard.addListener(showEvent, (e: any) => setKeyboardHeight(e.endCoordinates?.height || 300))
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0))
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  // also focus when switching between Open/Close tabs
  useEffect(() => {
    setTimeout(() => numberInputRef.current?.focus(), 120)
  }, [selected])

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
          const cTime = data?.closeTime ? String(data.closeTime) : null
          const gName = data?.name ?? data?.gameName ?? null
          setOpenTime(oTime)
          setCloseTime(cTime)
          setGameName(gName)
          const now = new Date()
          const canOpen = cr === true && isBeforeOrEqual(oTime, now)
          const canClose = cr === true && isBeforeOrEqual(cTime, now)
          setAllowedOpen(canOpen)
          setAllowedClose(canClose)
          if (!canOpen && canClose) setSelected('close')
          if (!canOpen && !canClose && !initialCheckDone) {
            setInitialCheckDone(true)
            Alert.alert('Not Available', 'SP Motor betting is closed for this game.')
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
        safeTime('SP warmup')
        const url = `https://us-central1-${firebaseWebConfig.projectId}.cloudfunctions.net/singlepanadigitsbets`
        // Minimal payload; function may require auth but even a rejected request warms container
        const body = JSON.stringify({ uid: auth.currentUser ? auth.currentUser.uid : null, code: 'SP', gameId: String(id), bets: [] })
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 4000)
        await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: controller.signal }).catch(() => {})
        clearTimeout(timeout)
        if (!abort) safeTimeEnd('SP warmup')
      } catch (err) {
        // ignore warmup errors
        try { safeTimeEnd('SP warmup') } catch (_) {}
      }
    })()
    return () => { abort = true }
  }, [initialCheckDone, id])

  // Helper: digits field only numbers, limit 9
  const onDigitsChange = (t: string) => {
    const cleaned = t.replace(/[^0-9]/g, '').slice(0, 9)
    setDigits(cleaned)
    // compute matches immediately for fast Add
    if (cleaned.length >= 4) {
      const mask = makeMask(cleaned)
      const out: string[] = []
      for (let i = 0, L = PANA_MASKS.length; i < L; i++) {
        const entry = PANA_MASKS[i]
        if ((entry.mask & mask) === entry.mask) out.push(entry.num)
      }
      setPreMatches(out)
    } else {
      setPreMatches([])
    }
  }

  const onAdd = async () => {
    safeTime('SP onAdd')
    // allow UI to show loading indicator before work
    setAddLoading(true)
    await new Promise((r) => setTimeout(r, 0))
    if (selected === 'open' && !allowedOpen) {
      setAddLoading(false)
      Alert.alert('Not Available', 'Open bets are closed for this game.')
      return
    }
    if (selected === 'close' && !allowedClose) {
      setAddLoading(false)
      Alert.alert('Not Available', 'Close bets are closed for this game.')
      return
    }

     const value = Number(points)
        
      if (!points.trim() || isNaN(value) || value < 5) {
        setAddLoading(false)
        Alert.alert('Invalid Points', 'Minimum amount is 5')
        return
      }else{
        setAddLoading(false)
      }

    if (digits.length < 4 || digits.length > 9) {
      setAddLoading(false)
      Alert.alert('Invalid Number', 'Enter At least 4 - 9 digits for SP Motor.')
      return
    }
    if (!points.trim() || isNaN(Number(points)) || Number(points) <= 0) {
      setAddLoading(false)
      Alert.alert('Invalid Points', 'Please enter valid points.')
      return
    }

     

    // use precomputed matches (computed while typing) to speed up Add
    const matches = preMatches
    if (matches.length === 0) {
      setAddLoading(false)
      Alert.alert('No Matches', 'No three-digit numbers match the digits you entered.')
      return
    }

    // compute total required using ref (faster than reduce over large arrays)
    const pts = Number(points)
    const totalAdded = totalPointsRef.current
    const totalRequired = totalAdded + matches.length * pts
    // if (totalRequired > wallet) {
    //   setAddLoading(false)
    //   Alert.alert('Insufficient Balance', `You need ₹${totalRequired} but only have ₹${wallet} in your wallet.`)
    //   return
    // }
    // add matches as individual bids, avoid duplicates using existingKeysRef
    const existing = existingKeysRef.current
    const now = Date.now()
    const newBids: Bid[] = []
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i]
      const key = m + '|' + selected
      if (!existing.has(key)) {
        const nb: Bid = { id: String(now) + '_' + i, number: m, points: String(pts), game: selected }
        newBids.push(nb)
        existing.add(key)
      }
    }
    if (newBids.length === 0) {
      setAddLoading(false)
      Alert.alert('Duplicate', 'All matching numbers already added.')
      safeTimeEnd('SP onAdd')
      return
    }
    // update refs and state once
    newBids.forEach((nb) => { bidsRef.current.push(nb); totalPointsRef.current += Number(nb.points) })
    setBids([...bidsRef.current])
    setDigits('')
    setPoints('')
    setAddLoading(false)
    safeTimeEnd('SP onAdd')
  }

  const onDelete = (id: string) => setBids((p) => p.filter((b) => b.id !== id))

  // keep refs in sync when bids state changes (for deletes or external updates)
  useEffect(() => {
    bidsRef.current = bids
    existingKeysRef.current = new Set(bids.map((b) => b.number + '|' + b.game))
    totalPointsRef.current = bids.reduce((s, b) => s + Number(b.points), 0)
  }, [bids])

  const onPressSubmit = () => {
    // quick client-side validation before showing modal
    const total = bids.reduce((s, b) => s + Number(b.points), 0)
    if (total === 0) { Alert.alert('No Bets', 'Please add some bets before submitting.'); return }
    if (total > wallet) { Alert.alert('Insufficient Balance', 'You do not have enough balance to place these bets.'); return }
    const user = auth.currentUser
    if (!user) { Alert.alert('Not Signed In', 'Please sign in to place bets.'); return }

    setConfirmVisible(true)
  }

  const performSubmit = async () => {
    const total = bids.reduce((s, b) => s + Number(b.points), 0)
    const payload: SubmitPayload = {
      uid: auth.currentUser ? auth.currentUser.uid : null,
      code: 'SP',
      gameId: String(id),
      gameName: gameName ?? null,
      bets: bids.map((b) => ({ number: String(b.number), points: Number(b.points), game: b.game })),
    }

    const user = auth.currentUser
    if (!user) { Alert.alert('Not Signed In', 'Please sign in to place bets.'); setConfirmVisible(false); return }
    setSubmitLoading(true)
    try {
      const token = await user.getIdToken()
      triggerChartRequest(payload, token)
      triggerTodayMoneyRequest(total, payload, token)
      const res = await fetch(SINGLE_PANA_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || JSON.stringify(data))
      // success — clear bids and update local refs
      bidsRef.current = []
      existingKeysRef.current = new Set()
      totalPointsRef.current = 0
      setBids([])
      Alert.alert('Success', `Placed ${payload.bets.length} SP bets. Deducted ₹${data.deducted ?? total}.`)
    } catch (err: any) {
      Alert.alert('Submit Failed', err?.message || String(err))
    } finally {
      setSubmitLoading(false)
      setConfirmVisible(false)
    }
  }

  if (!initialCheckDone) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Loading...</Text>
      </View>
    )
  }

  if (!allowedOpen && !allowedClose) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#ef4444', textAlign: 'center' }}>
          SP Motor betting is closed for this game.
        </Text>
      </View>
    )
  }

  const totalPoints = bids.reduce((s, b) => s + Number(b.points), 0)
  const walletAfter = wallet - totalPoints
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <FlatList
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          data={bids}
          keyExtractor={(item) => item.id}
          initialNumToRender={10}
          maxToRenderPerBatch={20}
          windowSize={11}
          removeClippedSubviews={true}
          ListHeaderComponent={(
            <>
              {/* Radio Buttons */}
              <View style={styles.radioRow}>
                {allowedOpen && (
                  <Radio
                    label="Open"
                    checked={selected === 'open'}
                    onPress={() => setSelected('open')}
                  />
                )}
                {allowedOpen && allowedClose && <View style={{ width: 20 }} />}
                {allowedClose && (
                  <Radio
                    label="Close"
                    checked={selected === 'close'}
                    onPress={() => setSelected('close')}
                  />
                )}
              </View>

              {/* Input Form */}
              <View style={styles.formCard}>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Single Pana :</Text>
                  <View style={styles.fieldInput}>
                    <TextInput
                      ref={numberInputRef}
                      value={digits}
                      onChangeText={onDigitsChange}
                      keyboardType="number-pad"
                      placeholder="Enter 4-9 digits"
                      placeholderTextColor="#9ca3af"
                      style={styles.input}
                    />
                  </View>
                </View>

                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Points :</Text>
                  <View style={styles.fieldInput}>
                    <TextInput
                      value={points}
                      onChangeText={(t) => setPoints(t.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      placeholder="Enter points"
                      placeholderTextColor="#9ca3af"
                      style={styles.input}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.addBtn, addLoading ? styles.addBtnDisabled : null]}
                  onPress={onAdd}
                  disabled={addLoading}
                >
                  {addLoading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.addBtnText}>+ Add</Text>
                  )}
                </TouchableOpacity>
              </View>

              {bids.length > 0 && (
                <View style={{ paddingHorizontal: 6, paddingVertical: 8, alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>{`Total: ${bids.length} bet(s) · ₹ ${totalPoints}`}</Text>
                </View>
              )}
            </>
          )}
          renderItem={({ item: bid }) => (
            <View style={styles.listCard}>
              <View style={styles.bidRow}>
                <View style={styles.bidInfo}>
                  <Text style={styles.bidText}>Number: {bid.number}</Text>
                  <Text style={styles.bidText}>Points: {bid.points}</Text>
                  <Text style={styles.bidText}>Game: {bid.game}</Text>
                </View>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(bid.id)}>
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />

        {/* Fixed submit at bottom (adjusts with keyboard) */}
        <View style={[styles.submitWrapper, { bottom: keyboardHeight ? keyboardHeight + 48 : 48 }]}>
          <TouchableOpacity
            style={[styles.submitBtnFixed, { opacity: totalPoints === 0 ? 0.6 : 1 }]}
            onPress={onPressSubmit}
            disabled={submitLoading || totalPoints === 0}
          >
            {submitLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitBtnText}>{`Submit · ${bids.length} bet(s) · ₹ ${totalPoints}`}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Confirmation popup before calling cloud function */}
        <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
          <View style={styles.confirmOverlay}>
            <ScrollView contentContainerStyle={styles.confirmScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.confirmCard}>
                <Text style={styles.confirmTitle}>{`${gameName || 'Game'} ${selected === 'open' ? 'Open' : 'Close'}`}</Text>

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
                  <TouchableOpacity style={styles.confirmSaveBtn} onPress={performSubmit} disabled={submitLoading}>
                     {submitLoading ? (
                            <ActivityIndicator color="#ffffff" />
                          ) : (
                            <Text style={styles.confirmSaveText}>Save</Text>
                          )}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function triggerChartRequest(payload: SubmitPayload, token: string | null) {
  // Fire-and-forget chart sync so bet submit flow stays responsive
  ;(async () => {
    try {
      const res = await fetch(GAME_CHART_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
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
      const res = await fetch(TODAY_MONEY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Today money update failed')
      }
    } catch (err: any) {
      console.warn('Today money update failed:', err?.message || err)
    }
  })()
}

function Radio({ label, checked, onPress }: { label: string; checked: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.radioContainer} onPress={onPress}>
      <View style={styles.radioOuter}>{checked && <View style={styles.radioInner} />}</View>
      <Text style={styles.radioLabel}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { paddingTop: 44, paddingHorizontal: 16, paddingBottom: 90 },
  title: { fontSize: 22, fontWeight: '700', color: '#1f2937', textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 12 },
  walletCard: { backgroundColor: 'transparent', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 8, marginBottom: 8 },
  walletLabel: { fontSize: 11, color: '#166534', fontWeight: '600', marginBottom: 4 },
  walletAmount: { fontSize: 12, fontWeight: '700', color: '#15803d' },
  walletUsed: { fontSize: 11, color: '#dc2626', fontWeight: '600', marginTop: 4 },
  walletTiny: { fontSize: 11, color: '#15803d', fontWeight: '600' },
  radioRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 6, marginBottom: 12 },
  radioContainer: { flexDirection: 'row', alignItems: 'center' },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#111827', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#111827' },
  radioLabel: { fontSize: 16, fontWeight: '600', color: '#111827' },
  formCard: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb', marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  fieldLabel: { fontSize: 16, fontWeight: '700', color: '#111827', flex: 0.4 },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: '#1f2937' },
  fieldInput: { flex: 0.6 },
  addBtn: { backgroundColor: THEME.gold, borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  addBtnText: { color: 'Black', fontWeight: '700', fontSize: 16 },
  addBtnDisabled: { opacity: 0.7 },
  listCard: { backgroundColor: '#ffffff', borderRadius: 12, padding: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb', marginBottom: 12 },
  listTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937', marginBottom: 8 },
  bidRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10, backgroundColor: '#f9fafb', borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  bidInfo: { flex: 1 },
  bidText: { fontSize: 13, color: '#374151', marginBottom: 2 },
  deleteBtn: { backgroundColor: THEME.bg, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10 },
  deleteBtnText: { color: '#ffffff', fontWeight: '600', fontSize: 13 },
  submitWrapper: { position: 'absolute', left: 32, right: 32, alignItems: 'center' },
  submitBtnFixed: { backgroundColor: THEME.gold, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18, alignItems: 'center', width: '100%' },
  submitBtnText: { color: 'Black', fontWeight: '700', fontSize: 16 },
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

// Helpers: parse 12h and check if the provided time is in future or not crossed
const parseTime12h = (t: string | null) => {
  if (!t) return null
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  const mer = m[3].toUpperCase()
  if (h === 12) h = 0
  const hours24 = mer === 'PM' ? h + 12 : h
  return { hours24, minutes: min }
}

const isBeforeOrEqual = (timeStr: string | null, now: Date) => {
  if (!timeStr) return false
  const parsed = parseTime12h(timeStr)
  if (!parsed) return false
  // compute IST now
  const utc = now.getTime() + now.getTimezoneOffset() * 60000
  const ist = new Date(utc + (5 * 60 + 30) * 60000)
  const target = new Date(ist)
  target.setHours(parsed.hours24, parsed.minutes, 0, 0)
  // return true if current IST is <= target (not crossed)
  return ist.getTime() <= target.getTime()
}

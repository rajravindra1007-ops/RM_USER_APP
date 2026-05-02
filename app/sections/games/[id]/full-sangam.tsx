import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useLocalSearchParams, useNavigation } from 'expo-router'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { auth, db, firebaseWebConfig } from '../../../../firebaseConfig'

type SubmitPayload = {
  uid: string | null
  code: string
  gameId: string
  gameName: string | null
  bets: { number: string; points: number; game: 'open' | 'close' }[]
}
const THEME = {
  bg: '#10112a',
  card: '#1e2050',
  gold: '#f5c518',
  text: '#ffffff',
  subText: '#a0aec0',
  inputBg: '#1e2044',
  border: '#2a2d5a',
}

const FULL_SANGAM_URL = 'https://api.rmgames.live/api/user-bets/fullsangambets'
const GAME_CHART_URL = 'https://api.rmgames.live/api/game-chart/chart'
const TODAY_MONEY_URL = 'https://api.rmgames.live/api/game-chart/todaymoney'

const PANAS = [
  '127','136','145','190','235','280','370','389','460','479','569','578',
  '128','137','146','236','245','290','380','470','489','560','579','678',
  '129','138','147','156','237','246','345','390','480','570','589','679',
  '120','139','148','157','238','247','256','346','490','580','670','689',
  '130','149','158','167','239','248','257','347','356','590','680','789',
  '140','159','168','230','249','258','267','348','357','456','690','780',
  '123','150','169','178','240','259','268','349','358','367','457','790',
  '124','160','278','179','250','269','340','359','368','458','467','890',
  '125','134','170','189','260','279','350','369','468','378','459','567',
  '126','135','180','234','270','289','360','379','450','469','478','568',
  '118','226','244','299','334','488','550','668','677','100','119','155',
  '227','335','344','399','588','669','110','200','228','255','366','499',
  '660','688','778','166','229','300','337','355','445','599','779','788',
  '112','220','266','338','400','446','455','699','770','113','122','177',
  '339','447','500','799','889','600','114','277','330','448','466','556',
  '880','899','115','133','188','223','377','449','557','566','700','116',
  '224','233','288','440','477','558','800','990','117','144','199','225',
  '388','559','577','667','900','000','777','444','111','888','555','222','999','666','333'
]

export default function FullSangamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const navigation = useNavigation()

  const [gameName, setGameName] = useState<string | null>(null)
  const [openTime, setOpenTime] = useState<string | null>(null)
  const [clearResult, setClearResult] = useState<boolean | null>(null)

  const [openPana, setOpenPana] = useState<string | null>(null)
  const [closePana, setClosePana] = useState<string | null>(null)
  const [points, setPoints] = useState('')

  const [wallet, setWallet] = useState<number>(0)
  const [list, setList] = useState<any[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [confirmVisible, setConfirmVisible] = useState(false)

  const [panaDropdownFor, setPanaDropdownFor] = useState<'open'|'close'|null>(null)
  const [filteredPanas, setFilteredPanas] = useState<string[]>(PANAS)

  useEffect(() => {
    const title = gameName ? `${gameName} - Full Sangam` : 'Full Sangam'
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

  // remove visible title per UX; keep nav options unchanged

  useEffect(() => {
    if (!id) return
    const unsub = db.collection('games').doc(String(id)).onSnapshot(snap => {
      const d = snap.data() as any
      setGameName(d?.name ?? null)
      setOpenTime(d?.openTime ?? null)
      setClearResult(!!d?.clear_result)
    }, () => {})
    return () => unsub()
  }, [id])

  // refs and keyboard handling
  const pointsRef = useRef<TextInput | null>(null)
  const openRef = useRef<TextInput | null>(null)
  const closeRef = useRef<TextInput | null>(null)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const showSub = Keyboard.addListener(showEvent, (e: any) => setKeyboardHeight(e.endCoordinates?.height || 300))
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0))
    return () => { showSub.remove(); hideSub.remove() }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => openRef.current?.focus(), 200)
    return () => clearTimeout(t)
  }, [])

  // Warm-up cloud function to reduce cold-start on first Submit
  useEffect(() => {
    if (!openTime || !clearResult) return
    let abort = false
    ;(async () => {
      try {
        console.time('FS warmup')
        const url = `https://us-central1-${firebaseWebConfig.projectId}.cloudfunctions.net/fullsangambets`
        const body = JSON.stringify({ uid: auth.currentUser ? auth.currentUser.uid : null, code: 'FS', gameId: String(id), bets: [] })
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 4000)
        await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: controller.signal }).catch(() => {})
        clearTimeout(timeout)
        if (!abort) console.timeEnd('FS warmup')
      } catch (err) {
        // ignore warmup errors
      }
    })()
    return () => { abort = true }
  }, [openTime, clearResult, id])

  // If market time/place not allowed, show popup and go back
  useEffect(() => {
    if (openTime == null) return
    // allow only when clearResult is true and current IST minutes <= openTime minutes
    const o = parseTime(openTime)
    if (o == null) return
    if (!clearResult || nowIst() > o) {
      Alert.alert('Time exceeded', 'Market closed or result not cleared', [{ text: 'OK', onPress: () => navigation.goBack() }])
    }
  }, [openTime, clearResult, navigation])

  useEffect(() => {
    const sub = auth.onAuthStateChanged(u => {
      if (!u) { setWallet(0); return }
      const unsub = db.collection('users').doc(u.uid).onSnapshot(s => {
        const data = s.data() as any
        const raw = data?.wallet
        const num = typeof raw === 'number' ? raw : Number(raw ?? 0)
        setWallet(Number.isFinite(num) ? num : 0)
      })
      return () => unsub()
    })
    return () => sub()
  }, [])

  const parseTime = (t?: string|null) => {
    if (!t) return null
    const m = (''+t).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?$/)
    if (!m) return null
    let hh = Number(m[1]); const mm = Number(m[2]); const ampm = (m[3]||'').toLowerCase()
    if (ampm === 'pm' && hh < 12) hh += 12
    if (ampm === 'am' && hh === 12) hh = 0
    return hh*60 + mm
  }
  const nowIst = () => { const now = new Date(); const utc = now.getTime() + now.getTimezoneOffset()*60000; const ist = new Date(utc + 5.5*60*60000); return ist.getHours()*60 + ist.getMinutes() }

  const isAllowed = useMemo(() => {
    if (!clearResult) return false
    const o = parseTime(openTime); if (o == null) return false
    return nowIst() <= o
  }, [openTime, clearResult])

  const checkPoints = (s: string) => { const n = Number(s); return Number.isFinite(n) && n > 0 }

  useEffect(() => {
    // when points typed, optionally validate wallet sufficiency for that single entry
    if (!checkPoints(points)) return
    const p = Number(points)
    if (wallet < p) {
      // don't block typing; show soft alert
      // optional: you can disable Add button instead
    }
  }, [points, wallet])

  const handleOpenPanaChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 3)
    setOpenPana(cleaned || null)
    if (!cleaned) {
      setFilteredPanas(PANAS)
      setPanaDropdownFor(null)
      return
    }
    const matches = PANAS.filter(p => p.startsWith(cleaned))
    setFilteredPanas(matches)
    setPanaDropdownFor('open')
    if (cleaned.length === 3) {
      setTimeout(() => closeRef.current?.focus(), 80)
    }
  }

  const handleClosePanaChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 3)
    setClosePana(cleaned || null)
    if (!cleaned) {
      setFilteredPanas(PANAS)
      setPanaDropdownFor(null)
      return
    }
    const matches = PANAS.filter(p => p.startsWith(cleaned))
    setFilteredPanas(matches)
    setPanaDropdownFor('close')
    if (cleaned.length === 3) {
      setTimeout(() => pointsRef.current?.focus(), 100)
    }
  }

  const selectPana = (value: string) => {
    if (panaDropdownFor === 'open') {
      setOpenPana(value)
      setPanaDropdownFor(null)
      setTimeout(() => {
        closeRef.current?.focus()
      }, 80)
    } else if (panaDropdownFor === 'close') {
      setClosePana(value)
      setPanaDropdownFor(null)
      setTimeout(() => pointsRef.current?.focus(), 120)
    } else {
      setPanaDropdownFor(null)
    }
  }

  const addEntry = () => {
    if (!openPana || !PANAS.includes(openPana)) { Alert.alert('Select open pana'); return }
    if (!closePana || !PANAS.includes(closePana)) { Alert.alert('Select close pana'); return }
    if (!checkPoints(points)) { Alert.alert('Enter valid points'); return }
    const pts = Number(points)
    // Allow adding regardless of current wallet; final check happens on submit
    const entry = { id: Date.now().toString(), number: `${openPana}-${closePana}`, points: pts, game: 'open' }
    setList(prev => [entry, ...prev])
    setOpenPana(null); setClosePana(null); setPoints('')
  }

  const handleSubmit = () => {
    if (submitting) return
    if (!list || list.length === 0) { Alert.alert('No items', 'Please add entries before submitting'); return }
    const total = list.reduce((s, it) => s + Number(it.points), 0)
    if (total > wallet) { Alert.alert('Insufficient Balance', `You need ₹${total} but only have ₹${wallet} in your wallet.`); return }
    setConfirmVisible(true)
  }

  const performSubmit = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const user = auth.currentUser
      if (!user) { Alert.alert('Not signed in'); return }
      const idToken = await user.getIdToken()
      const payload: SubmitPayload = {
        uid: user.uid,
        code: 'FS',
        gameId: String(id),
        gameName: gameName || null,
        bets: list.map(it => ({ number: it.number, points: Number(it.points), game: it.game })),
      }

      const totalAmount = payload.bets.reduce((sum, bet) => sum + Number(bet.points), 0)
      triggerChartRequest(payload, idToken)
      triggerTodayMoneyRequest(totalAmount, payload, idToken)

      const res = await fetch(FULL_SANGAM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Request failed')
      Alert.alert('Submitted', `Deducted: ${data.deducted}`)
      setList([])
      setConfirmVisible(false)
    } catch (err: any) {
      Alert.alert('Error', err?.message || String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {!isAllowed && <Text style={styles.warn}>Market not open or cleared result not available</Text>}

          {/* Single "Open" radio like reference UI */}
          <View style={styles.radioRow}>
            <View style={styles.radioContainer}>
              <View style={styles.radioOuter}>
                <View style={styles.radioInner} />
              </View>
              <Text style={styles.radioLabel}>Open</Text>
            </View>
          </View>

          <View style={styles.formCard}>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Open Pana :</Text>
              <View style={styles.fieldInput}>
                <TextInput
                  ref={openRef}
                  value={openPana ?? ''}
                  onChangeText={handleOpenPanaChange}
                  keyboardType="number-pad"
                  placeholder="Select open pana"
                  placeholderTextColor="#9ca3af"
                  maxLength={3}
                  style={styles.input}
                  autoFocus
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => closeRef.current?.focus()}
                  onFocus={() => {
                    const val = (openPana ?? '').trim()
                    const base = val ? PANAS.filter(p => p.startsWith(val)) : PANAS
                    setFilteredPanas(base)
                    setPanaDropdownFor('open')
                  }}
                />
                {panaDropdownFor === 'open' && filteredPanas.length > 0 && (
                  <View style={styles.dropdownList}>
                    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                      {filteredPanas.map(item => (
                        <TouchableOpacity key={item} style={styles.dropdownItem} onPress={() => selectPana(item)}>
                          <Text style={styles.dropdownItemText}>{item}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Close Pana :</Text>
              <View style={styles.fieldInput}>
                <TextInput
                  ref={closeRef}
                  value={closePana ?? ''}
                  onChangeText={handleClosePanaChange}
                  keyboardType="number-pad"
                  placeholder="Select close pana"
                  placeholderTextColor="#9ca3af"
                  maxLength={3}
                  style={styles.input}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => pointsRef.current?.focus()}
                  onFocus={() => {
                    const val = (closePana ?? '').trim()
                    const base = val ? PANAS.filter(p => p.startsWith(val)) : PANAS
                    setFilteredPanas(base)
                    setPanaDropdownFor('close')
                  }}
                />
                {panaDropdownFor === 'close' && filteredPanas.length > 0 && (
                  <View style={styles.dropdownList}>
                    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                      {filteredPanas.map(item => (
                        <TouchableOpacity key={item} style={styles.dropdownItem} onPress={() => selectPana(item)}>
                          <Text style={styles.dropdownItemText}>{item}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Points :</Text>
              <View style={styles.fieldInput}>
                <TextInput
                  ref={pointsRef}
                  value={points}
                  onChangeText={t => setPoints(t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  maxLength={7}
                  returnKeyType="done"
                  placeholder="Enter points"
                  placeholderTextColor="#9ca3af"
                  style={[styles.input, styles.pointsInput]}
                />
              </View>
            </View>

            <TouchableOpacity onPress={addEntry} style={styles.addBtn}>
              <Text style={styles.addText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {list.length > 0 && (
            <View style={styles.listCard}>
              <Text style={styles.listTitle}>Your Bids ({list.length})</Text>
              {list.map(it => (
                <View key={it.id} style={styles.listItemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bidText}>Number: {it.number}</Text>
                    <Text style={styles.bidText}>Points: {it.points}</Text>
                    <Text style={styles.bidText}>Game: {it.game}</Text>
                  </View>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => setList(prev => prev.filter(row => row.id !== it.id))}>
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

        </ScrollView>

        <View style={[styles.submitWrapper, { bottom: keyboardHeight ? keyboardHeight + 48 : 48 }] }>
          <TouchableOpacity
            style={[styles.submitBtnFixed, { opacity: list.length === 0 || submitting ? 0.7 : 1 }]}
            onPress={handleSubmit}
            disabled={list.length === 0 || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitText}>{`Submit · ${list.length} bet(s) · ₹ ${list.reduce((s, it) => s + Number(it.points), 0)}`}</Text>
            )}
          </TouchableOpacity>
        </View>
        <Modal visible={confirmVisible} animationType="fade" transparent onRequestClose={() => { if (!submitting) setConfirmVisible(false) }}>
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>{gameName ? `${gameName} - Full Sangam` : 'Full Sangam'}</Text>
              <ScrollView contentContainerStyle={styles.confirmScroll}>
                <View style={styles.centeredValueBlock}>
                  <Text style={styles.centeredLabel}>Total Bets</Text>
                  <Text style={styles.centeredValue}>{list.length}</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.centeredValueBlock}>
                  <Text style={styles.centeredLabel}>Total Bid Amount</Text>
                  <Text style={styles.centeredValue}>₹ {list.reduce((s, it) => s + Number(it.points), 0)}</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.confirmRowResponsive}>
                  <View style={styles.confirmCol}>
                    <Text style={styles.confirmLabelSmall}>Wallet before deduction</Text>
                    <Text style={styles.confirmValueSmall}>₹ {Number.isFinite(Number(wallet)) ? Number(wallet).toFixed(2) : '0.00'}</Text>
                  </View>
                  <View style={styles.confirmCol}>
                    <Text style={styles.confirmLabelSmall}>Wallet after deduction</Text>
                    <Text style={styles.confirmValueSmall}>₹ {(Number.isFinite(Number(wallet)) ? Number(wallet) - list.reduce((s, it) => s + Number(it.points), 0) : 0).toFixed(2)}</Text>
                  </View>
                </View>

                <Text style={styles.confirmNote}>Please confirm your bets. Tap Save to place the bets.</Text>
              </ScrollView>

              <View style={styles.confirmButtonsRow}>
                <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => { if (!submitting) setConfirmVisible(false) }} disabled={submitting}>
                  <Text style={styles.confirmCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmSaveBtn} onPress={performSubmit} disabled={submitting}>
                  {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmSaveText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { paddingTop: 40, paddingHorizontal: 16, paddingBottom: 160, gap: 12 },
  warn: { color: '#ef4444', textAlign: 'center', marginBottom: 4 },
  radioRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 4, marginBottom: 12 },
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
  },
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
    flex: 0.38,
  },
  fieldInput: {
    flex: 0.62,
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
  pointsInput: {
    paddingVertical: 8,
    fontSize: 15,
  },
  dropdownList: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    maxHeight: 200,
    zIndex: 20,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  dropdownItemText: { fontSize: 14, color: '#374151' },
  emptyText: { textAlign: 'center', paddingVertical: 10, color: '#9ca3af' },
  addBtn: {
    backgroundColor: THEME.gold,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  addText: { color: 'Black', fontWeight: '700', fontSize: 16 },
  listCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
    marginTop: 8,
  },
  listTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 8 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  deleteBtn: {
    backgroundColor: THEME.bg,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginLeft: 12,
    alignSelf: 'center',
  },
  deleteBtnText: { color: '#ffffff', fontWeight: '600', fontSize: 13 },
  bidText: { fontSize: 14, color: '#374151', marginBottom: 2 },
  submitWrapper: { position: 'absolute', left: 32, right: 32, alignItems: 'center' },
  submitBtnFixed: {
    backgroundColor: THEME.gold,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  submitText: { color: 'Black', fontWeight: '700', fontSize: 16 },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 12,
  },
  confirmTitle: { textAlign: 'center', fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 12 },
  confirmScroll: { paddingVertical: 6 },
  centeredValueBlock: { alignItems: 'center', marginVertical: 6 },
  centeredLabel: { fontSize: 13, color: '#6b7280', marginBottom: 6 },
  centeredValue: { fontSize: 18, color: '#111827', fontWeight: '500' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#e5e7eb', marginVertical: 12 },
  confirmRowResponsive: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  confirmCol: { flex: 1, alignItems: 'center' },
  confirmLabelSmall: { fontSize: 13, color: '#6b7280', marginBottom: 6 },
  confirmValueSmall: { fontSize: 16, color: '#111827', fontWeight: '700' },
  confirmNote: { marginTop: 12, color: '#6b7280', textAlign: 'center', fontSize: 13 },
  confirmButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  confirmCancelBtn: { flex: 1, marginRight: 8, paddingVertical: 10, borderRadius: 8, backgroundColor: '#f3f4f6', alignItems: 'center' },
  confirmSaveBtn: { flex: 1, marginLeft: 8, paddingVertical: 10, borderRadius: 8, backgroundColor: THEME.gold, alignItems: 'center' },
  confirmCancelText: { color: '#111827', fontWeight: '700' },
  confirmSaveText: { color: 'Black', fontWeight: '800' },
})

function triggerChartRequest(payload: SubmitPayload, token: string | null) {
  // Silent chart sync so Full Sangam flow is unaffected by network hiccups
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
    } catch (err) {
      console.debug('Full Sangam chart update skipped', err)
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
    } catch (err) {
      console.debug('Full Sangam today money sync failed', err)
    }
  })()
}


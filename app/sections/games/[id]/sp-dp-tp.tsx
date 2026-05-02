import React, { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'

import CustomAlert from '@/app/components/CustomAlert'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { useLocalSearchParams, useNavigation } from 'expo-router'
import { InteractionManager, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native'
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
type Bid = { id: string; number: string; points: string; game: 'open' | 'close'; type: 'SP' | 'DP' | 'TP' }

type SubmitPayload = {
  uid: string | null
  code: 'SP' | 'DP' | 'TP'
  gameId: string
  gameName: string | null
  bets: { number: string; points: number; game: 'open' | 'close' }[]
}

const USER_BET_BASE_URL = 'https://api.rmgames.live/api/user-bets/'
const GAME_CHART_URL = 'https://api.rmgames.live/api/game-chart/chart'
const TODAY_MONEY_URL = 'https://api.rmgames.live/api/game-chart/todaymoney'

const SINGLE_PANA_NUMBERS = [
  '127','136','145','190','235','280','370','389','460','479','569','578','128','137','146','236','245','290','380','470','489','560','579','678','129','138','147','156','237','246','345','390','480','570','589','679','120','139','148','157','238','247','256','346','490','580','670','689','130','149','158','167','239','248','257','347','356','590','680','789','140','159','168','230','249','258','267','348','357','456','690','780','123','150','169','178','240','259','268','349','358','367','457','790','124','160','278','179','250','269','340','359','368','458','467','890','125','134','170','189','260','279','350','369','468','378','459','567','126','135','180','234','270','289','360','379','450','469','478','568',
]

const DOUBLE_PANA_NUMBERS = [
  '118','226','244','299','334','336','488','550','668','677','100','119','155','227','335','344','399','588','669','110','200','228','255','366','499','660','688','778','166','229','300','337','355','445','599','779','788','112','220','266','338','400','446','455','699','770','113','122','177','339','447','500','799','889','600','114','277','330','448','466','556','880','899','115','133','188','223','377','449','557','566','700','116','224','233','288','440','477','558','800','990','117','144','199','225','388','559','577','667','900',
]

const TRIPLE_PANA_NUMBERS = ['000','111','222','333','444','555','666','777','888','999']

export default function SpDpTp() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const navigation = useNavigation()

  const [allowedOpen, setAllowedOpen] = useState(false)
  const [allowedClose, setAllowedClose] = useState(false)
  const [initialCheckDone, setInitialCheckDone] = useState(false)

  const [selectedSection, setSelectedSection] = useState<'open' | 'close'>('open')

  const [useSP, setUseSP] = useState(true)
  const [useDP, setUseDP] = useState(false)
  const [useTP, setUseTP] = useState(false)

  const [singleNumber, setSingleNumber] = useState('')
  const [points, setPoints] = useState('')

  const [bids, setBids] = useState<Bid[]>([])
  const [wallet, setWallet] = useState<number>(0)
  const [gameName, setGameName] = useState<string | null>(null)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [confirmVisible, setConfirmVisible] = useState(false)

  const bidsRef = useRef<Bid[]>([])
  const existingKeysRef = useRef<Set<string>>(new Set())
  const totalPointsRef = useRef<number>(0)
  const numberInputRef = useRef<TextInput | null>(null)
  const pointsRef = useRef<TextInput | null>(null)
  // removed manual keyboard height tracking; submit button will stay fixed

  const [alert, setAlert] = useState({
        visible: false,
        title: '',
        message: '',
        buttons: undefined as any,
      })
      
      
      const showAlert = (title: string, message: string, buttons?: any) => {
        setAlert({
          visible: true,
          title,
          message,
          buttons,
        })
      }

  useEffect(() => {
    const title = gameName ? `${gameName} - SP DP TP` : 'SP DP TP'
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
    const unsub = db.collection('users').doc(user.uid).onSnapshot(
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

  // read game times and compute IST-based visibility
  useEffect(() => {
    if (!id) return
    const unsub = db.collection('games').doc(String(id)).onSnapshot(
      (snap) => {
        const data = snap.data() as any
        setGameName(data?.name ?? data?.gameName ?? null)
        const oTime = data?.openTime ? String(data.openTime) : null
        const cTime = data?.closeTime ? String(data.closeTime) : null
        const now = new Date()
        setAllowedOpen(isBeforeOrEqual(oTime, now))
        setAllowedClose(isBeforeOrEqual(cTime, now))
        if (!initialCheckDone) setInitialCheckDone(true)
        // if only one is allowed, pick it
        if (isBeforeOrEqual(oTime, now) && !isBeforeOrEqual(cTime, now)) setSelectedSection('open')
        if (!isBeforeOrEqual(oTime, now) && isBeforeOrEqual(cTime, now)) setSelectedSection('close')
      },
      () => {
        if (!initialCheckDone) setInitialCheckDone(true)
      }
    )
    return () => unsub()
  }, [id, initialCheckDone])

  // warmup cloud functions to reduce cold start on first submit
  useEffect(() => {
    if (!initialCheckDone) return
    let abort = false
    ;(async () => {
      try {
        const base = `https://us-central1-${firebaseWebConfig.projectId}.cloudfunctions.net/`
        const urls = [
          base + 'singlepanadigitsbets',
          base + 'doublepanadigitsbets',
          base + 'triplepanadigitsbets',
        ]
        for (let i = 0; i < urls.length; i++) {
          try {
            const u = urls[i]
            console.time(`warmup-${i}`)
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 4000)
            await fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid: auth.currentUser ? auth.currentUser.uid : null, code: 'warm', gameId: String(id), bets: [] }), signal: controller.signal }).catch(() => {})
            clearTimeout(timeout)
            if (!abort) console.timeEnd(`warmup-${i}`)
          } catch (e) {
            try { console.timeEnd(`warmup-${i}`) } catch (_) {}
          }
        }
      } catch (_) {}
    })()
    return () => { abort = true }
  }, [initialCheckDone, id])

  // Focus input when the screen gains focus (after interactions)
  useFocusEffect(
    React.useCallback(() => {
      let mounted = true
      const handle = InteractionManager.runAfterInteractions(() => {
        if (mounted) numberInputRef.current?.focus()
      })
      return () => {
        mounted = false
        try { ;(handle as any)?.cancel?.() } catch (_) {}
      }
    }, [selectedSection])
  )

  // when user switches between Open/Close, focus number input
  useEffect(() => {
    setTimeout(() => { numberInputRef.current?.focus() }, 120)
  }, [selectedSection])

  const onSingleNumberChange = (t: string) => {
    const v = t.replace(/[^0-9]/g, '').slice(0, 1)
    setSingleNumber(v)
    if (v.length === 1) {
      setTimeout(() => { try { pointsRef.current?.focus() } catch (_) {} }, 80)
    }
  }

  // keyboard listeners so fixed submit rises above keyboard
  // removed manual keyboard listeners — rely on platform default behavior

  const toggleCheckbox = (type: 'SP' | 'DP' | 'TP') => {
    if (type === 'SP') setUseSP((s) => !s)
    if (type === 'DP') setUseDP((s) => !s)
    if (type === 'TP') setUseTP((s) => !s)
  }

  const onAdd = () => {
    if (!useSP && !useDP && !useTP) {
      showAlert('Select Type', 'Please select at least one of SP / DP / TP.')
      return
    }
    if (!/^[0-9]$/.test(singleNumber)) {
      showAlert('Invalid Number', 'Enter a single digit (0-9).')
      return
    }
    if (!points.trim() || isNaN(Number(points)) || Number(points) <= 0) {
      showAlert('Invalid Points', 'Please enter valid points.')
      return
    }
     const value = Number(points)
    
      if (!points.trim() || isNaN(value) || value < 5) {
        showAlert('Invalid Points', 'Minimum amount is 5')
        return
      }

    const targetDigit = Number(singleNumber)

    const now = Date.now()
    const newToAdd: Bid[] = []
    const toUpdate: { number: string; type: 'SP' | 'DP' | 'TP'; game: 'open' | 'close' }[] = []
    let idx = 0
    const existingKeys = existingKeysRef.current

    const pushCandidate = (num: string, type: 'SP' | 'DP' | 'TP') => {
      const key = `${num}|${type}|${selectedSection}`
      if (!existingKeys.has(key)) {
        newToAdd.push({ id: `${now}-${type}-${idx++}`, number: num, points: String(Number(points)), game: selectedSection, type })
      } else {
        toUpdate.push({ number: num, type, game: selectedSection })
      }
    }

    if (useSP) {
      for (let num of SINGLE_PANA_NUMBERS) {
        const sum = num.split('').reduce((s, ch) => s + Number(ch), 0)
        if (sum % 10 === targetDigit) pushCandidate(num, 'SP')
      }
    }
    if (useDP) {
      for (let num of DOUBLE_PANA_NUMBERS) {
        const sum = num.split('').reduce((s, ch) => s + Number(ch), 0)
        if (sum % 10 === targetDigit) pushCandidate(num, 'DP')
      }
    }
    if (useTP) {
      for (let num of TRIPLE_PANA_NUMBERS) {
        const sum = num.split('').reduce((s, ch) => s + Number(ch), 0)
        if (sum % 10 === targetDigit) pushCandidate(num, 'TP')
      }
    }

    if (newToAdd.length === 0 && toUpdate.length === 0) {
      showAlert('No Matches', 'No numbers match the selected criteria.')
      return
    }

    // Apply updates: add new bids, and increment points for existing matching bids
    const addPoints = Number(points)
    // Update existing bids in-place
    if (toUpdate.length > 0) {
      const mapKey = (n: string, t: string, g: string) => `${n}|${t}|${g}`
      const updateSet = new Set(toUpdate.map((u) => mapKey(u.number, u.type, u.game)))
      bidsRef.current = bidsRef.current.map((b) => {
        const key = mapKey(b.number, b.type, b.game)
        if (updateSet.has(key)) {
          return { ...b, points: String(Number(b.points) + addPoints) }
        }
        return b
      })
    }

    // Add newly matched bids
    if (newToAdd.length > 0) {
      bidsRef.current = [...bidsRef.current, ...newToAdd]
    }

    // Update total and keys
    const addedTotal = (newToAdd.length + toUpdate.length) * addPoints
    totalPointsRef.current = totalPointsRef.current + addedTotal
    existingKeysRef.current = new Set(bidsRef.current.map((b) => `${b.number}|${b.type}|${b.game}`))
    setBids(bidsRef.current)
    setSingleNumber('')
    setPoints('')
    // refocus to number input for faster entry
    setTimeout(() => { numberInputRef.current?.focus() }, 120)
  }
  const onDelete = (idToDel: string) => setBids((p) => p.filter((b) => b.id !== idToDel))

  const totalPoints = bids.reduce((s, b) => s + Number(b.points), 0)

  useEffect(() => {
    bidsRef.current = bids
    existingKeysRef.current = new Set(bids.map((b) => `${b.number}|${b.type}|${b.game}`))
    totalPointsRef.current = bids.reduce((s, b) => s + Number(b.points), 0)
  }, [bids])

  const onPressSubmit = () => {
    const total = totalPointsRef.current
    if (total === 0) { showAlert('No Bets', 'Please add some bets before submitting.'); return }
    if (total > wallet) { showAlert('Insufficient Balance', `You need ₹${total} but only have ₹${wallet} in your wallet.`); return }
    const user = auth.currentUser
    if (!user) { showAlert('','Not signed in'); return }
    setConfirmVisible(true)
  }

  const performSubmit = async () => {
    const total = totalPointsRef.current
    const user = auth.currentUser
    if (!user) { showAlert('','Not signed in'); setConfirmVisible(false); return }
    setSubmitLoading(true)
    try {
      const idToken = await user.getIdToken()
      const byType: Record<string, Bid[]> = { SP: [], DP: [], TP: [] }
      for (let b of bidsRef.current) byType[b.type].push(b)
      // const base = `https://us-central1-${firebaseWebConfig.projectId}.cloudfunctions.net/`
      const endpoints: Record<string, string> = {
        SP: USER_BET_BASE_URL + 'singlepanadigitsbets',
        DP: USER_BET_BASE_URL + 'doublepanadigitsbets',
        TP: USER_BET_BASE_URL + 'triplepanadigitsbets',
      }

      triggerTodayMoneyRequest(total, user.uid, idToken)

      for (let t of ['SP', 'DP', 'TP']) {
        const list = byType[t]
        if (!list || list.length === 0) continue
        const payload: SubmitPayload = {
          uid: user.uid,
          code: t as 'SP' | 'DP' | 'TP',
          gameId: String(id),
          gameName: gameName ?? null,
          bets: list.map((x) => ({ number: String(x.number), points: Number(x.points), game: x.game })),
        }

        triggerChartRequest(payload, idToken)

        const res = await fetch(endpoints[t], { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify(payload) })
        const json = await res.json().catch(() => null)
        if (!res.ok) throw new Error(json?.error || `Failed ${t}`)
      }
      showAlert('Submitted', `Submitted ${bidsRef.current.length} bet(s).`)
      setBids([])
      bidsRef.current = []
      totalPointsRef.current = 0
      existingKeysRef.current = new Set()
    } catch (err: any) {
      showAlert('Submit failed', err?.message || String(err))
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

  

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        {/* Header (moved out of FlatList to keep inputs stable and preserve focus) */}
        <View>
          <View style={styles.radioRow}>
            {allowedOpen && (
              <TouchableOpacity style={styles.radioBtn} onPress={() => setSelectedSection('open')}>
                <View style={styles.radioOuter}>{selectedSection === 'open' && <View style={styles.radioInner} />}</View>
                <Text style={styles.radioLabel}>Open</Text>
              </TouchableOpacity>
            )}
            {allowedClose && (
              <TouchableOpacity style={styles.radioBtn} onPress={() => setSelectedSection('close')}>
                <View style={styles.radioOuter}>{selectedSection === 'close' && <View style={styles.radioInner} />}</View>
                <Text style={styles.radioLabel}>Close</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.headerCard}>
            <View style={styles.checkboxRow}>
              <TouchableOpacity style={styles.checkbox} onPress={() => toggleCheckbox('SP')}>
                <View style={[styles.checkOuter, useSP && styles.checkChecked]}>
                  {useSP && <MaterialCommunityIcons name="check" size={16} color="#ffffff" />}
                </View>
                <Text style={styles.checkboxLabel}>SP</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.checkbox} onPress={() => toggleCheckbox('DP')}>
                <View style={[styles.checkOuter, useDP && styles.checkChecked]}>
                  {useDP && <MaterialCommunityIcons name="check" size={16} color="#ffffff" />}
                </View>
                <Text style={styles.checkboxLabel}>DP</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.checkbox} onPress={() => toggleCheckbox('TP')}>
                <View style={[styles.checkOuter, useTP && styles.checkChecked]}>
                  {useTP && <MaterialCommunityIcons name="check" size={16} color="#ffffff" />}
                </View>
                <Text style={styles.checkboxLabel}>TP</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formCard}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>SP DP TP :</Text>
                <View style={styles.fieldInput}>
                  <TextInput
                    ref={numberInputRef}
                    value={singleNumber}
                    onChangeText={onSingleNumberChange}
                    style={styles.input}
                    keyboardType="numeric"
                    returnKeyType="next"
                    placeholder="Enter digit (0-9)"
                    placeholderTextColor="#9ca3af"
                    blurOnSubmit={false}
                    onSubmitEditing={() => { try { pointsRef.current?.focus() } catch (_) {} }}
                  />
                </View>
              </View>

              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Points :</Text>
                <View style={styles.fieldInput}>
                  <TextInput
                    ref={pointsRef}
                    value={points}
                    onChangeText={(t) => setPoints(t.replace(/[^0-9]/g, ''))}
                    style={styles.input}
                    keyboardType="numeric"
                    returnKeyType="done"
                    placeholder="Enter points"
                    placeholderTextColor="#9ca3af"
                    blurOnSubmit={false}
                  />
                </View>
              </View>
              <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
                <Text style={styles.addBtnText}>+ Add</Text>
              </TouchableOpacity>
            </View>

            {bids.length > 0 && <Text style={styles.listTitle}>Your Bids ({bids.length})</Text>}
          </View>
        </View>

        <FlatList
          data={bids}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.bidRow}>
              <View style={styles.bidInfo}>
                <Text style={styles.bidText}>Number: {item.number}</Text>
                <Text style={styles.bidText}>Points: {item.points}</Text>
                <Text style={styles.bidText}>Game: {item.game}</Text>
              </View>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(item.id)}>
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
          ListFooterComponent={() => <View style={{ height: 120 }} />}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="always"
          ListEmptyComponent={() => <View />}
        />

        {/* Fixed submit button */}
        <View style={[styles.submitWrapper, { bottom: 48 }]}>
          <TouchableOpacity
            style={[styles.submitBtnFixed, { opacity: bids.length === 0 ? 0.6 : 1 }]}
            disabled={submitLoading || bids.length === 0}
            onPress={onPressSubmit}
          >
            {submitLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>{`Submit · ${bids.length} bet(s) · ₹ ${totalPoints}`}</Text>}
          </TouchableOpacity>
        </View>

        {/* Confirmation popup before calling cloud functions */}
        <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
          <View style={styles.confirmOverlay}>
            <ScrollView contentContainerStyle={styles.confirmScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.confirmCard}>
                <Text style={styles.confirmTitle}>{`${gameName || 'Game'} ${selectedSection === 'open' ? 'Open' : 'Close'}`}</Text>

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
                    <Text style={styles.confirmValueSmall}>{(wallet - totalPoints).toFixed(2)}</Text>
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
       <CustomAlert
            visible={alert.visible}
            title={alert.title}
            message={alert.message}
            buttons={alert.buttons}
            onDismiss={() =>
              setAlert(prev => ({ ...prev, visible: false }))
            }
          />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { paddingTop: 10, paddingHorizontal: 16, paddingBottom: 90,},
  headerCard: { backgroundColor: '#f0f1f3', borderRadius: 12, padding: 19, marginBottom: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb' },
  title: { fontSize: 20, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 12 },
  radioRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 6, marginBottom: 12 },
  radioBtn: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 18 },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#111827', marginRight: 8, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#111827' },
  radioLabel: { fontSize: 16, fontWeight: '700', color: '#111827' },
  checkboxRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  checkbox: { flexDirection: 'row', alignItems: 'center' },
  checkOuter: { width: 22, height: 22, borderWidth: 2, borderColor: '#374151', marginRight: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 4 },
  checkChecked: { backgroundColor: '#059669', borderColor: '#059669' },
  checkboxLabel: { fontSize: 15, fontWeight: '600' },
  formCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb' },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  fieldLabel: { fontSize: 16, fontWeight: '700', color: '#111827', flex: 0.4 },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e6e9ee', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: '#111827' },
  fieldInput: { flex: 0.6 },
  addBtn: { backgroundColor: THEME.gold, borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  addBtnText: { color: 'Black', fontWeight: '700', fontSize: 16 },
  listCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb' },
  listTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  bidRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#fff', borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#e6e9ee', marginBottom: 8 },
  bidInfo: { flex: 1 },
  bidText: { fontSize: 14, color: '#374151' },
  deleteBtn: { backgroundColor: THEME.bg, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 12, marginLeft: 8 },
  deleteBtnText: { color: '#fff', fontWeight: '600' },
  submitWrapper: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  submitBtnFixed: { backgroundColor: THEME.gold, borderRadius: 10, paddingVertical: 10, alignItems: 'center', width: '100%' },
  submitBtnText: { color: 'Black', fontWeight: '800', fontSize: 16 },
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
  walletCard: { backgroundColor: '#fff', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: '#e6e9ee', marginBottom: 12 },
  walletLabel: { fontSize: 13, color: '#6b7280' },
  walletAmount: { fontSize: 20, fontWeight: '800', color: '#111827', marginTop: 4 },
  walletUsed: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  footer: { marginTop: 16, paddingBottom: 32 },
  walletTiny: { fontSize: 11, color: '#111827', fontWeight: '700' },
})

function triggerChartRequest(payload: SubmitPayload, token: string | null) {
  // Fire chart sync in parallel so main submits stay responsive
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
      console.debug('SP/DP/TP chart update skipped', err)
    }
  })()
}

function triggerTodayMoneyRequest(totalAmount: number, uid: string | null, token: string | null) {
  if (!Number.isFinite(totalAmount) || totalAmount <= 0 || !uid) return
  ;(async () => {
    try {
      const body = { uid, totalAmount }
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
      console.debug('SP/DP/TP today money sync failed', err)
    }
  })()
}

// Helpers: parse 12h and check if the provided time is not crossed in IST
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
  const utc = now.getTime() + now.getTimezoneOffset() * 60000
  const ist = new Date(utc + (5 * 60 + 30) * 60000)
  const target = new Date(ist)
  target.setHours(parsed.hours24, parsed.minutes, 0, 0)
  return ist.getTime() <= target.getTime()
}

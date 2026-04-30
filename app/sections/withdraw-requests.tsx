import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Animated, Switch } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from 'expo-router'
import { auth, db } from '../../firebaseConfig'
import AsyncStorage from '@react-native-async-storage/async-storage'

const toMillis = (value: any) => {
  if (!value) return 0
  if (typeof value?.toDate === 'function') {
    const d = value.toDate()
    return d instanceof Date ? d.getTime() : 0
  }
  if (typeof value?.seconds === 'number') return value.seconds * 1000
  if (typeof value === 'number') return value
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
}

const computeSummary = (arr: any[]) => {
  let pending = 0
  let approved = 0
  let rejected = 0
  let totalAmt = 0
  arr.forEach((it) => {
    const status = String((it?.status || it?.state || '').toLowerCase())
    if (status === 'completed' || status === 'approved') approved++
    else if (status === 'rejected' || status === 'declined') rejected++
    else pending++
    const amt = Number(it?.withdrawalammount ?? it?.withdrawalAmount ?? it?.amount ?? it?.withdrawal ?? it?.withdrawal_amount ?? 0) || 0
    totalAmt += amt
  })
  return {
    counts: { total: arr.length, pending, approved, rejected },
    totalAmount: totalAmt,
  }
}

export default function WithdrawRequests() {
  const [loadingToday, setLoadingToday] = useState(true)
  const [loadingUser, setLoadingUser] = useState(true)
  const [todayItems, setTodayItems] = useState<Array<any>>([])
  const [userItems, setUserItems] = useState<Array<any>>([])
  const [showTodayOnly, setShowTodayOnly] = useState(true)
  const [counts, setCounts] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 })
  const [totalAmount, setTotalAmount] = useState<number>(0)
  const animValues = useRef<Record<string, Animated.Value>>({})

  const [uid, setUid] = useState<string | null>(auth.currentUser ? auth.currentUser.uid : null)

  const navigation = useNavigation()

  useEffect(() => {
    navigation.setOptions({ title: 'Withdrawal Request' })
  }, [navigation])

  useEffect(() => {
    // Ensure we react when auth becomes ready (auth.currentUser can be null on first render)
    try {
      const unsub = (auth as any)?.onAuthStateChanged?.((u: any) => {
        setUid(u ? u.uid : null)
      })
      return () => {
        if (typeof unsub === 'function') unsub()
      }
    } catch {
      return
    }
  }, [])

  useEffect(() => {
    if (!uid) {
      setTodayItems([])
      setUserItems([])
      setLoadingToday(false)
      setLoadingUser(false)
      return
    }

    setLoadingToday(true)
    setLoadingUser(true)

    const cacheKeys = {
      today: `withdrawRequests:today:${uid}`,
      user: `withdrawRequests:user:${uid}`,
    }

    // hydrate cache immediately
    let cancelled = false
    ;(async () => {
      try {
        const [todayRaw, userRaw] = await Promise.all([
          AsyncStorage.getItem(cacheKeys.today),
          AsyncStorage.getItem(cacheKeys.user),
        ])
        if (cancelled) return

        if (todayRaw) {
          const parsed = JSON.parse(todayRaw)
          if (Array.isArray(parsed)) setTodayItems(parsed)
        }
        if (userRaw) {
          const parsed = JSON.parse(userRaw)
          if (Array.isArray(parsed)) setUserItems(parsed)
        }
      } catch {
        // ignore cache errors
      }
    })()

    const userRef = db.collection('users').doc(uid).collection('userWithdrawal').orderBy('createdAt', 'desc')
    const todayRefByUserId = db.collection('todaysWithdrawalReq').where('requestedByUid', '==', uid)
    const todayRefByUid = db.collection('todaysWithdrawalReq').where('requestedByUid', '==', uid)

    const unsubUser = userRef.onSnapshot(
      (snap) => {
        const arr: any[] = []
        snap.docs.forEach((d) => {
          const data = d.data() || {}
          arr.push({ id: d.id, ...data })
        })
        setUserItems(arr)
        void AsyncStorage.setItem(cacheKeys.user, JSON.stringify(arr)).catch(() => {})
        setLoadingUser(false)
      },
      (err) => {
        console.warn('withdraw requests listen error', err)
        setLoadingUser(false)
      }
    )

    let byUserIdArr: any[] | null = null
    let byUidArr: any[] | null = null
    const publishToday = () => {
      const merged = new Map<string, any>()
      ;(byUserIdArr || []).forEach((it) => merged.set(String(it.id), it))
      ;(byUidArr || []).forEach((it) => merged.set(String(it.id), it))
      const arr = Array.from(merged.values())
      arr.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
      setTodayItems(arr)
      void AsyncStorage.setItem(cacheKeys.today, JSON.stringify(arr)).catch(() => {})
      setLoadingToday(false)
    }

    const unsubTodayByUserId = todayRefByUserId.onSnapshot(
      (snap) => {
        const arr: any[] = []
        snap.docs.forEach((d) => {
          const data = d.data() || {}
          arr.push({ id: d.id, ...data })
        })
        byUserIdArr = arr
        publishToday()
      },
      (err) => {
        console.warn('todays withdrawal listen error (userId)', err)
        byUserIdArr = []
        publishToday()
      }
    )

    const unsubTodayByUid = todayRefByUid.onSnapshot(
      (snap) => {
        const arr: any[] = []
        snap.docs.forEach((d) => {
          const data = d.data() || {}
          arr.push({ id: d.id, ...data })
        })
        byUidArr = arr
        publishToday()
      },
      (err) => {
        console.warn('todays withdrawal listen error (uid)', err)
        byUidArr = []
        publishToday()
      }
    )

    return () => {
      cancelled = true
      unsubUser()
      unsubTodayByUserId()
      unsubTodayByUid()
    }
  }, [uid])

  const items = useMemo(() => (showTodayOnly ? todayItems : userItems), [showTodayOnly, todayItems, userItems])
  const loading = showTodayOnly ? loadingToday : loadingUser

  useEffect(() => {
    const { counts: c, totalAmount: t } = computeSummary(items)
    setCounts(c)
    setTotalAmount(t)

    // setup animations (same behavior, now based on displayed items)
    try {
      const animations: Animated.CompositeAnimation[] = []
      items.forEach((it) => {
        if (!animValues.current[it.id]) animValues.current[it.id] = new Animated.Value(0)
        else animValues.current[it.id].setValue(0)
        animations.push(Animated.timing(animValues.current[it.id], { toValue: 1, duration: 320, useNativeDriver: true }))
      })
      if (animations.length) Animated.stagger(60, animations).start()
    } catch (e) {}
  }, [items])

  const renderItem = ({ item }: { item: any }) => {
    const dateOfReq = item.DateofReq || item.dateOfReq || item.date || (item.createdAt && item.createdAt.toDate ? item.createdAt.toDate().toLocaleDateString() : '')
    const timeOfReq = item.TimeofReq || item.timeOfReq || (item.createdAt && item.createdAt.toDate ? item.createdAt.toDate().toLocaleTimeString() : '')
    const amount = Number(item.withdrawalammount ?? item.withdrawalAmount ?? item.amount ?? item.withdrawal ?? item.withdrawal_amount ?? 0) || 0
    const status = String(item.status ?? item.state ?? 'pending').toLowerCase()

    if (!animValues.current[item.id]) animValues.current[item.id] = new Animated.Value(1)
    const av = animValues.current[item.id]
    const aStyle = { opacity: av, transform: [{ translateY: av.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }

    return (
      <Animated.View style={[styles.card, aStyle]}>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={styles.amountText}>₹{amount.toFixed(2)}</Text>
            <Text style={styles.subTextSmall}>{item.requestNote || item.note || ''}</Text>
          </View>
          <View style={[styles.statusBadge, status === 'completed' || status === 'approved' ? styles.approvedBadge : status === 'rejected' || status === 'declined' ? styles.rejectedBadge : styles.pendingBadge]}>
            <Text style={styles.statusText}>{(item.status || item.state || 'pending').toString()}</Text>
          </View>
        </View>

        <View style={styles.rowSplit}>
          <View style={styles.col}>
            <Text style={styles.smallLabel}>Requested On</Text>
            <Text style={styles.smallValue}>{dateOfReq} </Text>
          </View>
         
        </View>
         <View style={styles.rowSplit}>
          <View style={styles.col}>
              <Text style={styles.smallLabel}>Requested Time</Text>
             <Text style={styles.smallValue}>{timeOfReq ? `${timeOfReq}` : ''}</Text>
          </View>
         
        </View>

        <View style={styles.rowSplit}>
          <View style={styles.col}>
            <Text style={styles.smallLabel}>Account</Text>
            <Text style={styles.smallValue}>{item.accountNo || item.account || item.accNo || '-'}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.smallLabel}>IFSC</Text>
            <Text style={styles.smallValue}>{item.ifsc || '-'}</Text>
          </View>
        </View>

        <View style={styles.rowSplit}>
          <View style={styles.col}>
            <Text style={styles.smallLabel}>Holder</Text>
            <Text style={styles.smallValue}>{item.holderName || item.holder || '-'}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.smallLabel}>Method</Text>
            <Text style={styles.smallValue}>{item.method || item.paymentMethod || '-'}</Text>
          </View>
        </View>

        <View style={styles.rowSplit}>
          <View style={styles.col}>
            <Text style={styles.smallLabel}>Phone</Text>
            <Text style={styles.smallValue}>{item.phone || item.mobile || item.msisdn || '-'}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.smallLabel}>Pre</Text>
            <Text style={styles.smallValue}>{String(item.prebalance ?? item.preBalance ?? item.pre ?? '-')}</Text>
          </View>
        </View>

        <View style={styles.rowSplitLast}>
          <View style={styles.col}>
            <Text style={styles.smallLabel}>Post</Text>
            <Text style={styles.smallValue}>{String(item.postbalance ?? item.postBalance ?? item.post ?? '-')}</Text>
          </View>
          <View style={styles.col} />
        </View>
      </Animated.View>
    )
  }

  if (loading && items.length === 0) return (
    <SafeAreaView style={styles.container} edges={['left','right','bottom']}><ActivityIndicator style={{ marginTop: 24 }} /></SafeAreaView>
  )

  const renderHeader = () => (
    // <View style={styles.summaryBar}>
    //   <Text style={styles.summaryTitle}>Withdrawal Requests</Text>
    //   <Text style={styles.summarySub}>Total: {counts.total} • Pending: {counts.pending} • Approved: {counts.approved} • Rejected: {counts.rejected}</Text>
    //   <Text style={styles.summaryAmount}>Total Amount: ₹{totalAmount.toFixed(2)}</Text>
    // </View>
    <View style={styles.topBar}>
      <View style={styles.toggleContainer}>
        <Text style={styles.toggleLabel}>Today</Text>
        <Switch
          value={showTodayOnly}
          onValueChange={setShowTodayOnly}
          trackColor={{ false: '#d1d5db', true: '#0b1f4c' }}
          thumbColor="#fff"
        />
      </View>
    </View>
  )

  return (
    <SafeAreaView style={styles.container} edges={['left','right','bottom']}>
      <FlatList
        data={items}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20, paddingTop: 12 }}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={() => (
          <View style={{ padding: 16 }}><Text>No withdraw requests found. .</Text></View>
        )}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f8fb' },
  topBar: { paddingHorizontal: 16, paddingBottom: 6 },
  toggleContainer: { flexDirection: 'row', alignItems: 'center' },
  toggleLabel: { marginRight: 6, fontWeight: '800', color: '#0f172a' },
  summaryBar: { padding: 12, backgroundColor: '#fff', margin: 12, borderRadius: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8 },
  summaryTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  summarySub: { marginTop: 4, color: '#475569', fontSize: 13 },
  summaryAmount: { marginTop: 8, fontWeight: '800', color: '#0b8457' },
  card: { backgroundColor: '#fff', padding: 14, borderRadius: 14, marginBottom: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#e6eef6', elevation: 3, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  amountText: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  subTextSmall: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  pendingBadge: { backgroundColor: '#f59e0b' },
  approvedBadge: { backgroundColor: '#10b981' },
  rejectedBadge: { backgroundColor: '#ef4444' },
  rowSplit: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  rowSplitLast: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  col: { flex: 1, paddingRight: 10 },
  smallLabel: { color: '#64748b', fontWeight: '700', fontSize: 12 },
  smallValue: { color: '#0f172a', fontWeight: '600', marginTop: 4, fontSize: 14 },
  approved: { color: '#16a34a' },
  rejected: { color: '#dc2626' },
})

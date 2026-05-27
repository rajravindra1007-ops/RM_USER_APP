import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Animated, Switch, TouchableOpacity } from 'react-native'
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

const formatDate = (value: any) => {
  if (!value) return ''
  if (typeof value?.toDate === 'function') {
    return value.toDate().toLocaleString()
  }
  if (typeof value?.seconds === 'number') {
    return new Date(value.seconds * 1000).toLocaleString()
  }
  if (typeof value === 'number') {
    return new Date(value).toLocaleString()
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleString()
}

export default function MoneyAdded() {
  const [loadingToday, setLoadingToday] = useState(true)
  const [loadingUser, setLoadingUser] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [todayItems, setTodayItems] = useState<Array<any>>([])
  const [userItems, setUserItems] = useState<Array<any>>([])
  const [lastDocToday, setLastDocToday] = useState<any>(null)
  const [lastDocUser, setLastDocUser] = useState<any>(null)
  const [hasMoreToday, setHasMoreToday] = useState(true)
  const [hasMoreUser, setHasMoreUser] = useState(true)
  const [showTodayOnly, setShowTodayOnly] = useState(true)
  const animValues = useRef<Record<string, Animated.Value>>({})

  const uid = auth.currentUser ? auth.currentUser.uid : null
  const navigation = useNavigation()

  useEffect(() => {
    navigation.setOptions({ title: 'Money Added' })
  }, [navigation])

  // Hydrate cache
  useEffect(() => {
    if (!uid) return
    const cacheKeys = {
      today: `moneyAdded:today:${uid}`,
    }
    let cancelled = false
    ;(async () => {
      try {
        const todayRaw = await AsyncStorage.getItem(cacheKeys.today)
        if (cancelled) return

        if (todayRaw) {
          const parsed = JSON.parse(todayRaw)
          if (Array.isArray(parsed)) setTodayItems(parsed)
        }
      } catch {
        // ignore cache errors
      }
    })()

    return () => {
      cancelled = true
    }
  }, [uid])

  const fetchTodayItems = async (isMore = false) => {
    if (!uid) return
    if (isMore && !hasMoreToday) return

    if (isMore) {
      setLoadingMore(true)
    } else {
      setLoadingToday(true)
    }
    setError(null)

    try {
      let query = db
        .collection('TodaysAddMoneyByGetway')
        .where('userId', '==', uid)
        .limit(5)

      if (isMore && lastDocToday) {
        query = query.startAfter(lastDocToday)
      }

      const snap = await query.get()
      const arr: any[] = []
      snap.forEach((doc: any) => {
        const data = doc.data() || {}
        arr.push({ ...data, id: doc.id })
      })

      let updatedList = arr
      if (isMore) {
        setTodayItems((prev) => {
          updatedList = [...prev, ...arr].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
          return updatedList
        })
      } else {
        updatedList = arr.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
        setTodayItems(updatedList)
      }

      if (snap.docs.length > 0) {
        setLastDocToday(snap.docs[snap.docs.length - 1])
      } else if (!isMore) {
        setLastDocToday(null)
      }

      if (snap.docs.length < 5) {
        setHasMoreToday(false)
      } else {
        setHasMoreToday(true)
      }

      const cacheKeys = {
        today: `moneyAdded:today:${uid}`,
        user: `moneyAdded:user:${uid}`,
      }
      void AsyncStorage.setItem(cacheKeys.today, JSON.stringify(updatedList)).catch(() => {})
    } catch (err: any) {
      console.error('Error fetching today money added:', err)
      setError(err.message || String(err))
    } finally {
      setLoadingToday(false)
      setLoadingMore(false)
    }
  }

  const fetchUserItems = async (isMore = false) => {
    if (!uid) return
    if (isMore && !hasMoreUser) return

    if (isMore) {
      setLoadingMore(true)
    } else {
      setLoadingUser(true)
    }
    setError(null)

    try {
      let query = db
        .collection('users')
        .doc(uid)
        .collection('AddMoneyByGetway')
        .orderBy('createdAt', 'desc')
        .limit(5)

      if (isMore && lastDocUser) {
        query = query.startAfter(lastDocUser)
      }

      const snap = await query.get()
      const arr: any[] = []
      snap.forEach((doc: any) => {
        const data = doc.data() || {}
        arr.push({ ...data, id: doc.id })
      })

      let updatedList = arr
      if (isMore) {
        setUserItems((prev) => {
          updatedList = [...prev, ...arr]
          return updatedList
        })
      } else {
        setUserItems(arr)
      }

      if (snap.docs.length > 0) {
        setLastDocUser(snap.docs[snap.docs.length - 1])
      } else if (!isMore) {
        setLastDocUser(null)
      }

      if (snap.docs.length < 5) {
        setHasMoreUser(false)
      } else {
        setHasMoreUser(true)
      }

      const cacheKeys = {
        today: `moneyAdded:today:${uid}`,
        user: `moneyAdded:user:${uid}`,
      }
      void AsyncStorage.setItem(cacheKeys.user, JSON.stringify(updatedList)).catch(() => {})
    } catch (err: any) {
      console.error('Error fetching user money added:', err)
      setError(err.message || String(err))
    } finally {
      setLoadingUser(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    if (!uid) {
      setTodayItems([])
      setUserItems([])
      setLoadingToday(false)
      setLoadingUser(false)
      return
    }

    if (showTodayOnly) {
      fetchTodayItems(false)
    } else {
      setUserItems([])
      fetchUserItems(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, showTodayOnly])

  const items = useMemo(() => (showTodayOnly ? todayItems : userItems), [showTodayOnly, todayItems, userItems])
  const loading = showTodayOnly ? loadingToday : loadingUser

  useEffect(() => {
    try {
      const animations: Animated.CompositeAnimation[] = []
      items.forEach((it) => {
        if (!animValues.current[it.id]) {
          animValues.current[it.id] = new Animated.Value(0)
        } else {
          animValues.current[it.id].setValue(0)
        }
        animations.push(
          Animated.timing(animValues.current[it.id], {
            toValue: 1,
            duration: 320,
            useNativeDriver: true,
          })
        )
      })
      if (animations.length) Animated.stagger(70, animations).start()
    } catch {}
  }, [items])

  const renderItem = ({ item }: { item: any }) => {
    const amount = Number(item.amount ?? item.amountPaid ?? 0) || 0
    const status = String(item.paymentstatus ?? item.paymentStatus ?? 'pending').toLowerCase()
    const createdAt = formatDate(item.createdAt)

    if (!animValues.current[item.id]) {
      animValues.current[item.id] = new Animated.Value(1)
    }
    const av = animValues.current[item.id]
    const animatedStyle = {
      opacity: av,
      transform: [{ translateY: av.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
    }

    return (
      <Animated.View style={[styles.cardWrap, animatedStyle]}>
        <View style={styles.cardTop}>
          {status === 'success' ? (
            <View style={styles.successIcon}><Text style={styles.successIconText}>✓</Text></View>
          ) : (
            <View style={styles.pendingIcon}><Text style={styles.pendingIconText}>!</Text></View>
          )}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.titleText}>{status === 'success' ? 'Payment Successful' : 'Payment Pending'}</Text>
            <Text style={styles.subText}>{createdAt}</Text>
          </View>
          <Text style={styles.amountBig}>₹{amount.toFixed(2)}</Text>
        </View>

        <View style={styles.detailBox}>
          <Row label="Client Txn" value={item.client_txn_id || item.clientTxnId || '-'} />
          <Row label="Customer" value={item.customer_name || '-'} />
          <Row label="Mobile" value={item.customer_mobile || '-'} />
          <Row label="Pre Balance" value={String(item.preBalance ?? item.prebalance ?? '-') } />
          {status === 'success' && <Row label="Post Balance" value={String(item.postBalance ?? item.postbalance ?? '-') } />}
          {status === 'success' && <Row label="UPI Txn" value={item.upi_txn_id || item.upiTxnId || '-'} />}
          {item.paymentReceivedDate && <Row label="Received Date" value={item.paymentReceivedDate} />}
          {item.paymentReceivedTime && <Row label="Received Time" value={item.paymentReceivedTime} />}
        </View>

        <View style={styles.cardActions}>
          {status !== 'success' && (
            <View style={styles.notCompletedSmall}><Text style={styles.notCompletedSmallText}>Not Completed</Text></View>
          )}
        </View>
      </Animated.View>
    )
  }

  const handleReadMore = () => {
    if (loadingMore) return
    if (showTodayOnly) {
      fetchTodayItems(true)
    } else {
      fetchUserItems(true)
    }
  }

  const renderFooter = () => {
    const hasMore = showTodayOnly ? hasMoreToday : hasMoreUser
    if (!hasMore) return null

    return (
      <TouchableOpacity
        style={[styles.readMoreBtn, loadingMore && styles.readMoreBtnDisabled]}
        onPress={handleReadMore}
        disabled={loadingMore}
      >
        {loadingMore ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.readMoreText}>Read More</Text>
        )}
      </TouchableOpacity>
    )
  }

  const renderHeader = () => (
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

  if (loading && items.length === 0) return (
    <SafeAreaView style={styles.container}><ActivityIndicator style={{ marginTop: 24 }} /></SafeAreaView>
  )
  if (error && items.length === 0) return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: 'red', textAlign: 'center' }}>{error}</Text>
      </View>
    </SafeAreaView>
  )

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <FlatList
        data={items}
        keyExtractor={i => i.id || String(Math.random())}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28, paddingTop: 12 }}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={() => (
          <View style={{ padding: 16, alignItems: 'center' }}><Text style={{ color: '#666', fontSize: 16 }}>No payment records found.</Text></View>
        )}
        ListFooterComponent={renderFooter}
      />
    </SafeAreaView>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f5fb' },
  cardWrap: { backgroundColor: '#fff', borderRadius: 14, marginBottom: 14, padding: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 3, borderWidth: StyleSheet.hairlineWidth, borderColor: '#e6eef6' },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  successIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center' },
  successIconText: { color: '#fff', fontWeight: '900', fontSize: 20 },
  pendingIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center' },
  pendingIconText: { color: '#fff', fontWeight: '900', fontSize: 20 },
  titleText: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  subText: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  amountBig: { fontSize: 19, fontWeight: '900', color: '#0f172a' },
  detailBox: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#e2e8f0' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eef2f7' },
  rowLabel: { color: '#64748b', fontSize: 12, fontWeight: '700' },
  rowValue: { color: '#0f172a', fontSize: 13, fontWeight: '700' },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  notCompletedSmall: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#fff7ed', borderWidth: StyleSheet.hairlineWidth, borderColor: '#fef3c7' },
  notCompletedSmallText: { color: '#b45309', fontWeight: '800', fontSize: 12 },
  topBar: { paddingHorizontal: 16, paddingBottom: 10 },
  toggleContainer: { flexDirection: 'row', alignItems: 'center' },
  toggleLabel: { marginRight: 6, fontWeight: '800', color: '#0f172a' },
  readMoreBtn: {
    backgroundColor: '#0b1f4c',
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    marginHorizontal: 20,
    shadowColor: '#0b1f4c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  readMoreBtnDisabled: {
    backgroundColor: '#cbd5e1',
    shadowOpacity: 0,
    elevation: 0,
  },
  readMoreText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
})

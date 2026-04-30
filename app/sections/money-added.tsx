import React, { useEffect, useRef, useState } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Animated } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from 'expo-router'
import { auth, db } from '../../firebaseConfig'

export default function MoneyAdded() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Array<any>>([])
  const animValues = useRef<Record<string, Animated.Value>>({})

  const navigation = useNavigation()

  useEffect(() => {
    navigation.setOptions({ title: 'Money Added' })
  }, [navigation])

  useEffect(() => {
    const user = auth.currentUser
    if (!user) {
      setItems([])
      setLoading(false)
      return
    }

    const ref = db.collection('users').doc(user.uid).collection('AddMoneyByGetway').orderBy('createdAt', 'desc')
    const unsub = ref.onSnapshot(snap => {
      const arr: any[] = []
      snap.docs.forEach(d => {
        const data = d.data() || {}
        arr.push({ id: d.id, ...data })
      })

      try {
        const animations: Animated.CompositeAnimation[] = []
        arr.forEach((it) => {
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

      setItems(arr)
      setLoading(false)
    }, err => {
      console.warn('money added listen error', err)
      setLoading(false)
    })

    return () => unsub()
  }, [])

  const renderItem = ({ item }: { item: any }) => {
    const amount = Number(item.amount ?? item.amountPaid ?? 0) || 0
    const status = String(item.paymentstatus ?? item.paymentStatus ?? 'pending').toLowerCase()
    const createdAt = item.createdAt && item.createdAt.toDate ? item.createdAt.toDate().toLocaleString() : (item.createdAt || '')

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

  if (loading) return (
    <SafeAreaView style={styles.container}><ActivityIndicator style={{ marginTop: 24 }} /></SafeAreaView>
  )

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <FlatList
        data={items}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28, paddingTop: 12 }}
        ListEmptyComponent={() => (
          <View style={{ padding: 16 }}><Text>No payment records found.</Text></View>
        )}
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
})

import React, { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native'
import { auth, db } from '../../firebaseConfig'
import BottomNav from '../components/BottomNav'

type Bet = {
  amount?: number
  gameId?: string
  gameName?: string | null
  gamecode?: string
  open?: boolean
  close?: boolean
  SDnumber?: string
  JDnumber?: string
  SPnumber?: string
  DPnumber?: string
  TPnumber?: string
  FSOpenPananumber?: string
  FSClosePananumber?: string
  HSOpenDigitnumber?: string
  HSClosePananumber?: string
  HSCloseDigitnumber?: string
  HSOpenPananumber?: string
  username?: string | null
  userId?: string
  mobile?: string | null
  resultstatus?: string
  createdAt?: any
}

const FILTERS: { key: string; label: string; code?: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'SD', label: 'Single Digit', code: 'SD' },
  { key: 'JD', label: 'Jodi Digit', code: 'JD' },
  { key: 'SP', label: 'Single Pana', code: 'SP' },
  { key: 'DP', label: 'Double Pana', code: 'DP' },
  { key: 'TP', label: 'Triple Pana', code: 'TP' },
  { key: 'HS', label: 'Half Sangam', code: 'HS' },
  { key: 'FS', label: 'Full Sangam', code: 'FS' },
]

const GAME_LABELS: { [code: string]: string } = {
  SD: 'Single Digit',
  JD: 'Jodi Digit',
  SP: 'Single Pana',
  DP: 'Double Pana',
  TP: 'Triple Pana',
  HS: 'Half Sangam',
  FS: 'Full Sangam',
}

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

export default function BidHistorySection() {
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [todayBets, setTodayBets] = useState<Bet[]>([])
  const [userBets, setUserBets] = useState<Bet[]>([])
  const [lastDocToday, setLastDocToday] = useState<any>(null)
  const [lastDocUser, setLastDocUser] = useState<any>(null)
  const [hasMoreToday, setHasMoreToday] = useState(true)
  const [hasMoreUser, setHasMoreUser] = useState(true)
  const [filter, setFilter] = useState<string>('ALL')
  const [showTodayOnly, setShowTodayOnly] = useState(true)

  const uid = auth.currentUser ? auth.currentUser.uid : null



  const fetchTodayBets = async (isMore = false) => {
    if (!uid) return
    if (isMore && !hasMoreToday) return

    if (isMore) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }
    setError(null)

    try {
      let query = db
        .collection('todaysBets')
        .where('userId', '==', uid)
        .limit(5)

      if (isMore && lastDocToday) {
        query = query.startAfter(lastDocToday)
      }

      const snap = await query.get()
      const arr: Bet[] = []
      snap.forEach((doc: any) => {
        arr.push({ ...(doc.data() || {}), id: doc.id })
      })

      let updatedList = arr
      if (isMore) {
        setTodayBets((prev) => {
          updatedList = [...prev, ...arr].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
          return updatedList
        })
      } else {
        updatedList = arr.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
        setTodayBets(updatedList)
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


    } catch (err: any) {
      console.error('Error fetching today bets:', err)
      setError(err.message || String(err))
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const fetchUserBets = async (isMore = false) => {
    if (!uid) return
    if (isMore && !hasMoreUser) return

    if (isMore) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }
    setError(null)

    try {
      let query = db
        .collection('users')
        .doc(uid)
        .collection('userbets')
        .orderBy('createdAt', 'desc')
        .limit(5)

      if (isMore && lastDocUser) {
        query = query.startAfter(lastDocUser)
      }

      const snap = await query.get()
      const arr: Bet[] = []
      snap.forEach((doc: any) => {
        arr.push({ ...(doc.data() || {}), id: doc.id })
      })

      let updatedList = arr
      if (isMore) {
        setUserBets((prev) => {
          updatedList = [...prev, ...arr]
          return updatedList
        })
      } else {
        setUserBets(arr)
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


    } catch (err: any) {
      console.error('Error fetching user bets:', err)
      setError(err.message || String(err))
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    if (!uid) {
      setError('Not signed in')
      setLoading(false)
      return
    }

    if (showTodayOnly) {
      setTodayBets([])
      fetchTodayBets(false)
    } else {
      setUserBets([])
      fetchUserBets(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, showTodayOnly])

  const handleReadMore = () => {
    if (loadingMore) return
    if (showTodayOnly) {
      fetchTodayBets(true)
    } else {
      fetchUserBets(true)
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

  const renderNumber = (item: Bet) => {
    // Handle Half Sangam fields (open/close variants)
    if (item.HSOpenDigitnumber || item.HSClosePananumber || item.HSCloseDigitnumber || item.HSOpenPananumber) {
      if (item.open || item.HSOpenDigitnumber) {
        const a = item.HSOpenDigitnumber || ''
        const b = item.HSClosePananumber || ''
        return `${a}-${b}`
      }
      if (item.close || item.HSCloseDigitnumber) {
        const a = item.HSCloseDigitnumber || ''
        const b = item.HSOpenPananumber || ''
        return `${a}-${b}`
      }
    }
    // Handle Full Sangam fields
    if (item.FSOpenPananumber || item.FSClosePananumber) {
      if (item.open || item.FSOpenPananumber) {
        const a = item.FSOpenPananumber || ''
        const b = item.FSClosePananumber || ''
        return `${a}-${b}`
      }
      if (item.close || item.FSClosePananumber) {
        const a = item.FSClosePananumber || ''
        const b = item.FSOpenPananumber || ''
        return `${a}-${b}`
      }
    }
    return (
      item.SDnumber ||
      item.JDnumber ||
      item.SPnumber ||
      item.DPnumber ||
      item.TPnumber ||
      // FS numbers (fallback)
      (item.FSOpenPananumber && item.FSClosePananumber ? `${item.FSOpenPananumber}-${item.FSClosePananumber}` : null) ||
      '-'
    )
  }

  const renderDirection = (item: Bet) => {
    if (item.open) return 'Open'
    if (item.close) return 'Close'
    if (item.HSOpenDigitnumber || item.HSOpenPananumber || item.FSOpenPananumber) return 'Open'
    if (item.HSCloseDigitnumber || item.HSClosePananumber || item.FSClosePananumber) return 'Close'
    return '-'
  }

  const renderItem = ({ item }: { item: Bet }) => {
    const date = item.createdAt && item.createdAt.toDate ? item.createdAt.toDate() : item.createdAt ? new Date(item.createdAt) : null
    return (
      <View style={styles.item}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{GAME_LABELS[item.gamecode || ''] || String(item.gamecode || 'Unknown')}</Text>
            </View>
            <Text style={[styles.gameName, { marginLeft: 10 }]}>{item.gameName || ''}</Text>
            <View style={{ marginLeft: 8 }}>
              <View style={[styles.directionBadge, (item.open ? styles.directionOpen : item.close ? styles.directionClose : null)]}>
                <Text style={[styles.directionText, item.open ? styles.directionTextOpen : item.close ? styles.directionTextClose : null]}>{renderDirection(item)}</Text>
              </View>
            </View>
          </View>
          <Text style={styles.amount}>₹{item.amount ?? 0}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          <Text style={styles.number}>Number: {renderNumber(item)}</Text>
          <Text style={styles.status}>{item.resultstatus || 'pending'}</Text>
        </View>
        {date ? <Text style={styles.date}>{date.toLocaleString()}</Text> : null}
      </View>
    )
  }

  // derive displayed bets from allBets to avoid Firestore compound query/index issues
  const sourceBets = useMemo(() => (showTodayOnly ? todayBets : userBets), [showTodayOnly, todayBets, userBets])

  const displayedBets = useMemo(() => {
    const list = sourceBets

    if (filter === 'ALL') return list

    return list.filter((b) => {
      switch (filter) {
        case 'SD':
          return !!b.SDnumber
        case 'JD':
          return !!b.JDnumber
        case 'SP':
          return !!b.SPnumber
        case 'DP':
          return !!b.DPnumber
        case 'TP':
          return !!b.TPnumber
        case 'HS':
          return !!(
            b.HSOpenDigitnumber ||
            b.HSCloseDigitnumber ||
            b.HSOpenPananumber ||
            b.HSClosePananumber
          )
        case 'FS':
          return !!(b.FSOpenPananumber || b.FSClosePananumber)
        default:
          return true
      }
    })
  }, [filter, sourceBets])

  const activeCount = useMemo(() => displayedBets.length, [displayedBets])

  if (loading && sourceBets.length === 0) return <View style={styles.center}><ActivityIndicator size="small" /></View>
  if (error && sourceBets.length === 0) return (
    <View style={styles.center}>
      <Text style={{ color: 'red' }}>{error}</Text>
    </View>
  )

  return (
    <>
      <View style={styles.container}>
        <View style={styles.filterBar}>
          <View style={styles.toggleContainer}>
            <Text style={styles.toggleLabel}>Today</Text>
            <Switch
              value={showTodayOnly}
              onValueChange={setShowTodayOnly}
              trackColor={{ false: '#d1d5db', true: '#0b1f4c' }}
              thumbColor="#fff"
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8 }} style={{ flex: 1 }}>
            {FILTERS.map((f) => (
              <TouchableOpacity
                key={f.key}
                onPress={() => setFilter(f.code || 'ALL')}
                style={[styles.filterBtn, filter === (f.code || 'ALL') ? styles.filterBtnActive : null]}
              >
                <Text style={[styles.filterText, filter === (f.code || 'ALL') ? styles.filterTextActive : null]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.countBox}>
            {/* <Text style={styles.countText}>{activeCount}</Text> */}
          </View>
        </View>

        <FlatList
          data={displayedBets}
          keyExtractor={(i: any, idx) => i.id || String(idx)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12 }}
          ListEmptyComponent={() => (
            <View style={[styles.center, { marginTop: 40 }]}>
              <Text style={{ color: '#666', fontSize: 16 }}>No bets found</Text>
            </View>
          )}
          ListFooterComponent={renderFooter}
        />
      </View>
      <BottomNav active="bid-history" />
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  filterBar: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#eee' },
  filterBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 18, backgroundColor: '#f4f4f4', marginHorizontal: 6 },
  filterBtnActive: { backgroundColor: '#0b1f4c' },
  filterText: { color: '#111' },
  filterTextActive: { color: '#fff' },
  toggleContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  toggleLabel: { marginRight: 6, fontWeight: '700', color: '#111' },
  countBox: { marginLeft: 'auto', paddingHorizontal: 12 },
  countText: { fontWeight: '700' },
  item: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
  gameName: { fontWeight: '700' },
  amount: { fontWeight: '700', color: '#111' },
  number: { color: '#444' },
  status: { color: '#666' },
  date: { color: '#999', fontSize: 12, marginTop: 6 },
  typeBadge: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  typeBadgeText: { color: '#3730a3', fontWeight: '700', fontSize: 12 },
  directionBadge: { marginLeft: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: '#f3f4f6' },
  directionOpen: { backgroundColor: '#dcfce7' },
  directionClose: { backgroundColor: '#fff7ed' },
  directionText: { fontSize: 12, fontWeight: '700' },
  directionTextOpen: { color: '#166534' },
  directionTextClose: { color: '#92400e' },
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

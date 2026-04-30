import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from 'expo-router'
import { db } from '../../firebaseConfig'
import { Animated } from 'react-native'

export default function ChartListScreen() {
  const [games, setGames] = useState<any[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigation = useNavigation()
  const animValues = React.useRef<Record<string, Animated.Value>>({})

  useEffect(() => {
    navigation.setOptions({
      title: 'Game charts',
      headerLeft: () => null,
      headerTitleAlign: 'left',
      headerStyle: { backgroundColor: '#0b1f4c', elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
      headerTitleStyle: { color: '#f4f6ff', fontWeight: '700', fontSize: 18 },
      headerTintColor: '#f4f6ff',
      
    })
  }, [navigation])

  useEffect(() => {
    const unsub = db.collection('games').onSnapshot(
      snap => {
        const list = snap.docs.map(d => {
          const data = d.data() as any
          return { id: d.id, gameId: data?.gameId ?? data?.gameID ?? null, ...data }
        })
        // prepare animation values for each item
        try {
          const anims: Animated.CompositeAnimation[] = []
          list.forEach((g, i) => {
            if (!animValues.current[g.id]) animValues.current[g.id] = new Animated.Value(0)
            else animValues.current[g.id].setValue(0)
            anims.push(Animated.timing(animValues.current[g.id], { toValue: 1, duration: 360, useNativeDriver: true }))
          })
          Animated.stagger(80, anims).start()
        } catch (e) { /* ignore animation errors */ }
        list.sort((a, b) => {
          const na = Number(a.gameId ?? a.id)
          const nb = Number(b.gameId ?? b.id)
          const va = Number.isFinite(na) ? na : Number.POSITIVE_INFINITY
          const vb = Number.isFinite(nb) ? nb : Number.POSITIVE_INFINITY
          return va - vb
        })
        setGames(list)
        setError(null)
      },
      err => {
        console.warn('Chart games fetch error', err)
        setError('Failed to load charts')
      }
    )
    return () => unsub()
  }, [])

  const onRefresh = async () => {
    setRefreshing(true)
    try {
      const snap = await db.collection('games').get()
      const list = snap.docs.map(d => {
        const data = d.data() as any
        return { id: d.id, gameId: data?.gameId ?? data?.gameID ?? null, ...data }
      })
      list.sort((a, b) => {
        const na = Number(a.gameId ?? a.id)
        const nb = Number(b.gameId ?? b.id)
        const va = Number.isFinite(na) ? na : Number.POSITIVE_INFINITY
        const vb = Number.isFinite(nb) ? nb : Number.POSITIVE_INFINITY
        return va - vb
      })
      setGames(list)
      setError(null)
      // animate refreshed items
      try {
        const anims: Animated.CompositeAnimation[] = []
        list.forEach((g) => {
          if (!animValues.current[g.id]) animValues.current[g.id] = new Animated.Value(0)
          else animValues.current[g.id].setValue(0)
          anims.push(Animated.timing(animValues.current[g.id], { toValue: 1, duration: 360, useNativeDriver: true }))
        })
        Animated.stagger(80, anims).start()
      } catch (e) { }
    } catch (e) {
      console.warn('Manual fetch error', e)
      setError('Failed to refresh')
    } finally {
      setRefreshing(false)
    }
  }

  const openChart = async (url?: string) => {
    if (!url) return
    try {
      const supported = await Linking.canOpenURL(url)
      if (supported) await Linking.openURL(url)
      else alert('Cannot open URL')
    } catch (e) {
      console.warn('Open chart error', e)
      alert('Failed to open chart')
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f7f8fb' }}>
      <ScrollView contentContainerStyle={{ padding: 1 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {/* <Text style={{ fontSize: 22, fontWeight: '700', marginBottom: 12 }}>Charts</Text>
        {error ? <Text style={{ color: '#b91c1c', marginBottom: 12 }}>{error}</Text> : null} */}

        {games.map(g => {
          if (!animValues.current[g.id]) animValues.current[g.id] = new Animated.Value(1)
          const av = animValues.current[g.id]
          const aStyle = { opacity: av, transform: [{ translateY: av.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }
          return (
            <Animated.View key={g.id} style={[aStyle, { marginHorizontal: 20 }] }>
              <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => openChart(g.chartLink)}>
                <View style={styles.rowTop}>
                  <Text style={styles.time}>{g.openTime ?? '—'}</Text>
                  <Text style={styles.time}>{g.closeTime ?? '—'}</Text>
                </View>
                <Text style={styles.name}>{g.name ?? g.id}</Text>
                <Text style={styles.result}>{String(g.result ?? '—')}</Text>
                <View style={styles.footerRow}>
                  <Text style={styles.linkLabel}>{g.chartLink ? 'Open chart' : 'No chart link'}</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  card: { marginBottom: 14, padding: 14, backgroundColor: '#fff', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb', elevation: 3, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  time: { fontSize: 13, color: '#334155', fontWeight: '600' },
  name: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  result: { textAlign: 'center', fontSize: 15, marginBottom: 8 },
  footerRow: { alignItems: 'center' },
  linkLabel: { color: '#2563eb', fontWeight: '700' },
})

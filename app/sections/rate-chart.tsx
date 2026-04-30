import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Image, SafeAreaView, StyleSheet, Text, View } from 'react-native'
import { db } from '../../firebaseConfig'
import useColors from '../../theme/colors'

type RateDoc = { id: string; data: Record<string, any> }

export default function RateChartSection() {
  const colors = useColors()
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [rates, setRates] = useState<RateDoc[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const extractPrimaryValue = useCallback((data: Record<string, any>) => {
    if (!data) return '—'
    const candidates = ['value', 'rate', 'price', 'amount']
    for (const key of candidates) {
      if (key in data && data[key] != null) {
        const v = data[key]
        return typeof v === 'object' ? JSON.stringify(v) : String(v)
      }
    }
    const firstPrimitive = Object.entries(data).find(([, v]) => v == null || ['string','number','boolean'].includes(typeof v))
    if (firstPrimitive) {
      const v = firstPrimitive[1]
      return v == null ? '—' : String(v)
    }
    try { return JSON.stringify(data) } catch { return '—' }
  }, [])

  const fetchRates = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      // Step 1: Fetch document IDs from the 'rates' collection
      const snapshot = await db.collection('rates').get()
      const ids = snapshot.docs.map((d) => d.id)

      // Step 2: For each ID, fetch the document's value
      const docs = await Promise.all(
        ids.map(async (id) => {
          const docSnap = await db.collection('rates').doc(id).get()
          return { id: docSnap.id, data: (docSnap.data() as Record<string, any>) ?? {} }
        })
      )

      // Sort by updated time: prefer data.updatedAt, then updated_at, then at
      const toMillis = (v: any): number => {
        if (!v && v !== 0) return 0
        try {
          if (v?.toDate) return v.toDate().getTime()
          if (typeof v === 'number') return v
          if (typeof v === 'string') {
            const n = Date.parse(v)
            return Number.isNaN(n) ? 0 : n
          }
          return 0
        } catch {
          return 0
        }
      }

      // Order by a fixed preferred sequence first, then append others sorted by updated time
      const preferred = ['SD','JD','SP','DP','TP','HS','FS']
      const byId = new Map(docs.map(d => [String(d.id).toUpperCase(), d]))
      const ordered: RateDoc[] = []
      for (const key of preferred) {
        const found = byId.get(key)
        if (found) ordered.push(found)
      }
      const remaining = docs.filter(d => !preferred.includes(String(d.id).toUpperCase()))
      remaining.sort((a, b) => {
        const au = a.data?.updatedAt ?? a.data?.updated_at ?? a.data?.at
        const bu = b.data?.updatedAt ?? b.data?.updated_at ?? b.data?.at
        return toMillis(bu) - toMillis(au)
      })
      setRates([...ordered, ...remaining])
    } catch (e: any) {
      setError(e?.message || 'Failed to load rate chart')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRates()
  }, [fetchRates])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await fetchRates()
    } finally {
      setRefreshing(false)
    }
  }, [fetchRates])

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }] }>
        <ActivityIndicator color={colors.primary} size="small" />
      </View>
    )
  }

  if (error) {
    return (
      <View style={[styles.center, { padding: 16, backgroundColor: colors.background }] }>
        <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
      </View>
    )
  }

  const renderItem = ({ item }: { item: RateDoc }) => {
    const valueText = extractPrimaryValue(item.data)
    const updated = item.data?.updatedAt ?? item.data?.updated_at ?? item.data?.at ?? null
    const updatedText = updated && updated.toDate ? new Date(updated.toDate()).toLocaleTimeString() : ''
    return (
      <View style={[styles.pill, { backgroundColor: colors.card, borderColor: colors.border }] }>
        <View style={styles.pillLeft} />
        <View style={styles.pillCenter}>
          <Text style={[styles.pillLabel, { color: colors.muted }]}>{String(item.id).toUpperCase()}</Text>
          <Text style={[styles.pillValue, { color: colors.primary }]}>{`10 → ${valueText}`}</Text>
        </View>
        <View style={styles.pillRight}>
          {updatedText ? <Text style={[styles.pillMeta, { color: colors.muted }]}>{updatedText}</Text> : null}
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }] }>
      <View style={styles.header}>
        <Image source={require('../../assets/images/icon.png')} style={styles.headerIcon} />
        <Text style={[styles.headerTitle, { color: colors.text }]}>Game Chart</Text>
      </View>

      <FlatList
        data={rates}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.listContent}
        renderItem={renderItem}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.muted }]}>—</Text>}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1 },
  header: { alignItems: 'center', justifyContent: 'center', paddingVertical: 18 },
  headerIcon: { width: 72, height: 72, borderRadius: 36, marginBottom: 10 },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  listContent: { padding: 24, gap: 14, alignItems: 'center' },
  pill: { width: 320, flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 18, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  pillLeft: { width: 8, height: 40, borderRadius: 8, backgroundColor: '#ffd6e0', marginRight: 12 },
  pillCenter: { flex: 1, alignItems: 'center' },
  pillLabel: { fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  pillValue: { fontSize: 20, fontWeight: '900', marginTop: 6 },
  pillRight: { width: 60, alignItems: 'flex-end' },
  pillMeta: { fontSize: 12 },
  errorText: { fontSize: 16, fontWeight: '700' },
  emptyText: { textAlign: 'center', marginTop: 24 },
})

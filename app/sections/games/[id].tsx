import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from '../../../firebaseConfig';

export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const navigation = useNavigation()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [game, setGame] = useState<any>(null)
  const [wallet, setWallet] = useState<number | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    const unsub = db.collection('games').doc(String(id)).onSnapshot(
      (snap) => {
        const data = snap.data()
        setGame(data)
        setLoading(false)
      },
      (e) => {
        setError(e?.message || 'Failed to load game')
        setLoading(false)
      }
    )
    return () => unsub()
  }, [id])

  useEffect(() => {
    let unsubUser: undefined | (() => void)
    const sub = auth.onAuthStateChanged(user => {
      if (!user) {
        if (unsubUser) unsubUser()
        setWallet(null)
        return
      }
      try {
        unsubUser = db.collection('users').doc(user.uid).onSnapshot(snap => {
          const data = snap.data() as any
          const raw = data?.wallet
          const num = typeof raw === 'number' ? raw : Number(raw ?? 0)
          setWallet(Number.isFinite(num) ? num : 0)
        })
      } catch (e) {
        // ignore
      }
    })
    return () => { sub(); if (unsubUser) unsubUser() }
  }, [])

  useLayoutEffect(() => {
    const title = (game?.name as string) || String(id || 'Game')
    navigation.setOptions({
      title,
      headerShown: false,
      headerStyle: { backgroundColor: '#0b1f4c' },
      headerTintColor: '#f4f6ff',
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
          <MaterialCommunityIcons name='currency-rupee' size={18} color="#facc15" style={{ marginRight: 8 }} />
          <Text style={{ color: '#facc15', fontWeight: '700' }}>{wallet != null && Number.isFinite(Number(wallet)) ? Number(wallet).toFixed(2) : '0.00'}</Text>
        </View>
      )
    })
  }, [navigation, game, id, wallet])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    )
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ color: 'red' }}>{error}</Text>
      </View>
    )
  }
  if (!game) {
    return (
      <View style={styles.center}>
        <Text>No game found.</Text>
      </View>
    )
  }

  const items = [
    { label: 'Single Digit', route: 'single-digit' },
    { label: 'Jodi Digits', route: 'jodi-digits' },
    { label: 'Single Pana', route: 'single-pana' },
    { label: 'Double Pana', route: 'double-pana' },
    { label: 'Triple Pana', route: 'triple-pana' },
    { label: 'SP Motor', route: 'sp-motor' },
    { label: 'DP Motor', route: 'dp-motor' },
    { label: 'SP DP TP', route: 'sp-dp-tp' },
    { label: 'Half Sangam', route: 'half-sangam' },
    { label: 'Full Sangam', route: 'full-sangam' },
  ]

const ICONS: Record<string, { icon: string; color?: string; betText: string; rateText: string }> = {
  'single-digit': { icon: 'hand-pointing-up', color: '#ff4d7a', betText: 'Bet on 0-9', rateText: 'Rate 10₹ →₹95' },
  'jodi-digits': { icon: 'hand-peace', color: '#e8df26', betText: 'Bet on 00-99', rateText: 'Rate 10₹ → ₹950' },
  'single-pana': { icon: 'leaf', color: '#7c3aed', betText: '3 digit combination', rateText: 'Rate 10₹ → ₹1500' },
  'double-pana': { icon: 'sprout', color: '#f97316', betText: '3 digit with 2 same', rateText: 'Rate 10₹ → ₹3000' },
  'triple-pana': { icon: 'leaf-maple', color: '#60a5fa', betText: '3 same digits', rateText: 'Rate 10₹ → ₹9000' },
  'sp-motor': { icon: 'cog-outline', color: '#10b959ff', betText: 'Bet on SP Motor', rateText: 'Rate 10₹ → ₹950' },
  'dp-motor': { icon: 'ferris-wheel', color: '#b91c1c', betText: 'Bet on DP Motor', rateText: 'Rate 10₹ → ₹3000' },
  'sp-dp-tp': { icon: 'vector-triangle', color: '#f472b6', betText: 'Bet on SP DP TP', rateText: 'Rate 10₹ → ₹1.5k / ₹3k / ₹9k' },
  'half-sangam': { icon: 'yin-yang', color: '#538cc6', betText: 'Open/Close combo', rateText: 'Rate 10₹ → ₹10000' },
  'full-sangam': { icon: 'clover', color: '#008080', betText: 'Panna + Panna', rateText: 'Rate 10₹ → ₹100000' },
}

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

  const isSangamAllowed = () => {
    const open = parseTime(game?.openTime)
    if (open == null) return false
    if (!game?.clear_result) return false
    return nowIst() <= open
  }

  const handlePress = (route: string) => {
    if ((route === 'half-sangam' || route === 'full-sangam') && !isSangamAllowed()) {
      Alert.alert('Time exceeded', 'Market closed or result not cleared')
      return
    }
    router.push({ pathname: `/sections/games/[id]/${route}`, params: { id: String(id) } })
  }

 return (
   <SafeAreaView style={{ flex: 1, backgroundColor: '#1e1f3f' }}>

  <ScrollView
    contentContainerStyle={{
      padding: 16,
      backgroundColor: '#1e1f3f',
    }}
  >
    {/* NEW HEADER STYLE LIKE IMAGE */}
   <View style={styles.topHeader}>
  <View style={styles.headerRow}>
    <TouchableOpacity
      onPress={() => router.back()}
      style={styles.backButton}
      activeOpacity={0.8}
    >
      <MaterialCommunityIcons
        name="chevron-left"
        size={24}
        color="#ffffff"
      />
    </TouchableOpacity>

    <View style={{ marginLeft: 10 }}>
      <Text style={styles.headerTitle}>
        {game?.name ?? 'Time Bazar'}
      </Text>

     <View style={styles.timeRow}>
  <MaterialCommunityIcons
    name="clock-outline"
    size={14}
    color="#facc15"
    style={{ marginRight: 6 }}
  />

  <Text style={styles.marketTime}>
    Open {game?.openTime ?? '--'} PM • Close {game?.closeTime ?? '--'} PM (IST)
  </Text>
</View>
    </View>
  </View>

  <View style={styles.infoBox}>
    <Text style={styles.infoText}>
      {game?.result ?? '—'}
    </Text>
  </View>

  <View style={styles.walletBar}>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <MaterialCommunityIcons
        name="wallet"
        size={18}
        color="#7CFC98"
        style={{ marginRight: 6 }}
      />
      <Text style={styles.walletBarText}>
        Wallet Balance: ₹{wallet ?? 0}
      </Text>
    </View>
  </View>
</View>

    {/* REMOVE OLD rowTop + result */}
    {/* OLD CODE DELETE THIS
    <View style={styles.rowTop}>
      <Text style={styles.time}>Open : {game?.openTime ?? '—'}</Text>
      <Text style={styles.time}>Close : {game?.closeTime ?? '—'}</Text>
    </View>
    <Text style={styles.result}>{game?.result ?? '—'}</Text>
    */}

   {/* REPLACE YOUR OLD GRID SECTION WITH THIS */}

<View style={styles.grid}>
  {items.map((it, index) => {
    return (
   <TouchableOpacity
  key={it.route}
  style={[
    styles.gridItem,
    { borderColor: ICONS[it.route]?.color || '#ff2d7a' }
  ]}
  activeOpacity={0.8}
  onPress={() => handlePress(it.route)}
>
  <View style={styles.cardInner}>
    
    <View
      style={[
        styles.numberBox,
        { backgroundColor: ICONS[it.route]?.color || '#ff2d7a' }
      ]}
    >
      <MaterialCommunityIcons
    name={
      (ICONS[it.route]?.icon as any) ||
      "help-circle-outline"
    }
    size={26}
    color="#ffffff"
  />
    </View>

    <Text style={styles.gridText}>{it.label}</Text>
<Text style={styles.betText}>
  {ICONS[it.route]?.betText}
</Text>

    <View
      style={[
        styles.rateBox,
        { borderColor: ICONS[it.route]?.color || '#ff2d7a' ,  backgroundColor: `${ICONS[it.route]?.color || '#ff2d7a'}20`,}
      ]}
    >
      <Text
        style={[
          styles.rateText,
          { color: ICONS[it.route]?.color || '#ff2d7a' }
        ]}
      >
       {ICONS[it.route]?.rateText}
      </Text>
    </View>

  </View>
</TouchableOpacity>
    )
  })}
</View>
    </ScrollView>
   </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  time: { fontSize: 14, color: '#334155', fontWeight: '600' },
  result: { textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 },
  name: { textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#1f2937' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignContent: 'space-between',
    paddingHorizontal: 0,
    paddingTop: 0,
    marginTop: 10,
  },
  gridItem: {
  width: '47%',
  borderRadius: 18,
  paddingVertical: 18,
  paddingHorizontal: 14,
  marginBottom: 18,
  backgroundColor: '#2b2d5a',
  borderWidth: 1,
  borderColor: '#ff2d7a',
  alignItems: 'center',
  justifyContent: 'center',
},
cardInner: {
  width: '100%',
  alignItems: 'center',
  justifyContent: 'center',
},
  iconWrapper: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridText: { fontWeight: '700', color: '#fff', fontSize: 16, textAlign: 'justify', paddingHorizontal: 8 },
  gridIcon: { marginBottom: 10 },
  topHeader: {
  marginBottom: 18,
},

gameName: {
  fontSize: 28,
  fontWeight: '800',
  color: '#ffffff',
  marginBottom: 8,
},
timeRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginTop: 2,
},
marketTime: {
  fontSize: 11,
  color: '#facc15',
  fontWeight: '600',
  flexShrink: 1,
},

infoBox: {
  borderWidth: 1,
  borderColor: '#facc15',
  borderRadius: 12,
  paddingVertical: 14,
  paddingHorizontal: 14,
  marginBottom: 14,
  backgroundColor: '#2a2d5a',
},

infoText: {
  color: '#ffffff',
  fontSize: 14,
  textAlign:'center',
  fontWeight: '500',
},
walletBar: {
  borderRadius: 10,
  paddingVertical: 8,
  paddingHorizontal: 12,
  alignItems: 'center',
  justifyContent: 'center',

  /* gradient-like dark green tones (use LinearGradient if needed) */
  backgroundColor: '#14532d',
},
walletBarText: {
  color: '#bbf7d0', // faint light green text
  fontSize: 15,
  fontWeight: '600',
},

numberBox: {
  width: 52,
  height: 52,
  borderRadius: 14,
  backgroundColor: '#ff2d7a',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 14,
},

numberText: {
  color: '#ffffff',
  fontSize: 24,
  fontWeight: '800',
},

gridText: {
  color: '#ffffff',
  fontSize: 18,
  fontWeight: '700',
  textAlign: 'center',
  marginBottom: 4,
},

betText: {
  color: '#9ca3af',
  fontSize: 12,
  marginBottom: 10,
},

rateBox: {
  borderWidth: 1,
  borderColor: '#ff2d7a',
  borderRadius: 20,
  paddingVertical: 5,
  paddingHorizontal: 14,
},

rateText: {
  color: '#ff2d7a',
  fontSize: 10,
  fontWeight: '600',
},
headerRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 14,
},

backButton: {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: '#2b2d5a',
  alignItems: 'center',
  justifyContent: 'center',
},

headerTitle: {
  fontSize: 28,
  fontWeight: '800',
  color: '#ffffff',
  marginBottom: 4,
},
})

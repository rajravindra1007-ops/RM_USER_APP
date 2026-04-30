// app/sections/profile.tsx

import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../../firebaseConfig';
import BottomNav from '../components/BottomNav';

type UserDoc = {
  name?: string
  phone?: string
  createdAt?: any
  wallet?: any
  [key: string]: any
}

const T = {
  bg: '#10112a',
  card: '#1e1f3f',
  cardAlt: '#252650',
  border: '#2a2d5a',
  gold: '#facc15',
  goldDim: '#d4a608',
  textPrimary: '#f4f6ff',
  textSub: '#a0aec0',
  red: '#ef4444',
};

function StatPill({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.statPill}>
      <Text style={[styles.statValue, highlight && styles.statValueHighlight]}>{value}</Text>
      <Text style={[styles.statLabel, highlight && styles.statLabelHighlight]}>{label}</Text>
    </View>
  );
}

export default function ProfileSection() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const heroAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(user => { setUid(user?.uid ?? null); });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    const unsub = db.collection('users').doc(uid).onSnapshot(
      snap => {
        setUserDoc((snap.data() as UserDoc) ?? null);
        setLoading(false);
        Animated.timing(heroAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      },
      err => { setError(err?.message || 'Failed to load profile'); setLoading(false); }
    );
    return () => unsub();
  }, [uid]);

  const initials = useMemo(() => {
    return (userDoc?.name || '').split(' ').map((s: string) => s[0]).join('').slice(0, 2).toUpperCase() || 'U';
  }, [userDoc]);

  const createdAtText = useMemo(() => {
    const ts = userDoc?.createdAt;
    if (!ts) return '—';
    try {
      const date = ts?.toDate ? ts.toDate() : new Date(ts);
      return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return '—'; }
  }, [userDoc]);

  const walletAmount = useMemo(
    () => `₹ ${Number(userDoc?.wallet ?? 0).toLocaleString('en-IN')}`,
    [userDoc]
  );

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centerFull}>
          <ActivityIndicator size="large" color={T.gold} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
        <BottomNav active="profile" />
      </>
    );
  }

  if (!uid) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centerFull}>
          <Text style={styles.emptyText}>Please login to view your profile</Text>
        </View>
        <BottomNav active="profile" />
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centerFull}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
        <BottomNav active="profile" />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.heroCard,
              {
                opacity: heroAnim,
                transform: [{
                  translateY: heroAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                }],
              },
            ]}
          >
            <View style={styles.profileTopRow}>
              <View style={styles.avatarRing}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              </View>
              <View style={styles.profileDetails}>
                <Text style={styles.heroName}>{userDoc?.name || 'Player'}</Text>
                <Text style={styles.heroPhone}>{userDoc?.phone || '—'}</Text>
                <Text style={styles.registeredText}>Registered: {createdAtText}</Text>
              </View>
            </View>

            <View style={styles.statsStrip}>
              <StatPill label="Wallet Balance" value={walletAmount} highlight />
              <View style={styles.statDivider} />
              <StatPill label="Member Since" value={createdAtText} />
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
      <BottomNav active="profile" />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  scrollContent: { padding: 16, paddingBottom: 40 },
  centerFull: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: T.bg,
    padding: 20,
  },
  loadingText: { marginTop: 10, color: T.textSub },
  emptyText: { color: T.textSub, textAlign: 'center' },
  errorText: { color: T.red, textAlign: 'center' },
  heroCard: {
    backgroundColor: T.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: T.border,
    borderTopWidth: 3,
    borderTopColor: T.gold,
  },
  profileTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatarRing: {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 2, borderColor: T.gold,
    justifyContent: 'center', alignItems: 'center',
  },
  avatar: {
    width: 74, height: 74, borderRadius: 37,
    backgroundColor: T.gold,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 28, fontWeight: 'bold', color: '#111' },
  profileDetails: { flex: 1, marginLeft: 16 },
  heroName: { fontSize: 22, fontWeight: '800', color: T.textPrimary, marginBottom: 6 },
  heroPhone: { fontSize: 14, color: T.textSub, marginBottom: 6 },
  registeredText: { fontSize: 13, color: T.gold, fontWeight: '600' },
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.cardAlt,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  statPill: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '700', color: T.textPrimary },
  statValueHighlight: { color: T.gold, fontSize: 20, fontWeight: '800' },
  statLabel: { marginTop: 4, fontSize: 11, color: T.textSub, textTransform: 'uppercase' },
  statLabelHighlight: { color: T.goldDim },
  statDivider: { width: 1, height: 36, backgroundColor: T.border, marginHorizontal: 10 },
});

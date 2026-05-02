// ============================================================
//  HomeScreen.tsx
//  Main home screen for RM Games app
//  Features: Drawer nav, wallet balance, live markets list,
//            animated full-height market expansion, bottom nav
// ============================================================

import {
  FontAwesome,
  MaterialIcons
} from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { Link, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  BackHandler,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../firebaseConfig';
import useColors from '../theme/colors';
import BottomNav from './components/BottomNav';
import ExitConfirm from './components/ExitConfirm';

// ─────────────────────────────────────────────
//  Color palette (dark navy / gold theme)
// ─────────────────────────────────────────────
const C = {
  appBg: '#10112a',
  headerBg: '#1e2050',
  cardBg: '#1e2044',
  border: '#2a2d5a',
  gold: '#f5c518',
  green: '#22c55e',
  red: '#ef4444',
  text: '#ffffff',
  subText: '#a0aec0',
};

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const drawerWidth = Math.floor(SCREEN_WIDTH * 0.75);

// ─────────────────────────────────────────────
//  Drawer navigation sections
// ─────────────────────────────────────────────
const sections = [
  // { title: 'Message', route: '/sections/message' as const },
  // { title: 'Chart', route: '/sections/chart' as const },
  { title: 'Profile', route: '/sections/profile' as const },
  { title: 'Bid History', route: '/sections/bid-history' as const },
  { title: 'My Winning', route: '/sections/my-winning' as const },
  // { title: 'Account Statement', route: '/sections/account-statement' as const },
  { title: 'Bank Details', route: '/sections/bank-details' as const },
  { title: 'Money Added', route: '/sections/money-added' as const },
  { title: 'Withdraw Requests', route: '/sections/withdraw-requests' as const },
  { title: 'Notice Board', route: '/sections/notice-board' as const },
  { title: 'Game Chart', route: '/sections/rate-chart' as const },
  { title: 'Share App', route: '/sections/share-app' as const },
  { title: 'How to Play', route: '/sections/how-to-play' as const },
  { title: 'Log Out', route: '/sections/logout' as const },
];

// ─────────────────────────────────────────────
//  Map section titles → MaterialIcons icon names
// ─────────────────────────────────────────────
const getSectionIcon = (title: string): React.ComponentProps<typeof MaterialIcons>['name'] => {
  switch (title) {
    case 'Message': return 'message';
    case 'Chart': return 'bar-chart';
    case 'Profile': return 'person';
    case 'Bid History': return 'receipt-long';
    case 'My Winning': return 'emoji-events';
    case 'Account Statement': return 'article';
    case 'Bank Details': return 'account-balance';
    case 'Money Added': return 'account-balance-wallet';
    case 'Withdraw Requests': return 'assignment-return';
    case 'Notice Board': return 'notifications';
    case 'Rate Chart': return 'show-chart';
    case 'Game Chart': return 'show-chart';
    case 'How to Play': return 'help-outline';
    case 'Share App': return 'share';
    case 'Log Out': return 'logout';
    default: return 'circle';
  }
};

// ============================================================
//  HomeScreen Component
// ============================================================
export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const isFocused = useIsFocused();
  const promptedResetRef = React.useRef(false);

  // ── Drawer animation state ──────────────────────────────
  const [drawerX] = useState(() => new Animated.Value(-drawerWidth));
  const [open, setOpen] = useState(false);

  // ── Wallet / games state ────────────────────────────────
  const [wallet, setWallet] = useState<number | null>(null);
  const [games, setGames] = useState<Array<{
    id: string;
    orderId?: any;
    gameId?: any;
    chartLink?: string;
    name?: string;
    openTime?: string;
    closeTime?: string;
    result?: string;
    clear_result?: boolean;
  }>>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [gamesError, setGamesError] = useState<string | null>(null);

  // ── Misc UI state ───────────────────────────────────────
  const curveScale = useRef(new Animated.Value(0.1)).current;
  const [exitVisible, setExitVisible] = useState(false);
  const [messageOptionsVisible, setMessageOptionsVisible] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState<string | null>(null);

  // ── Market expansion state ──────────────────────────────
  // Controls whether the Live Markets panel is in expanded (full-height) mode
  const [expandedMarkets, setExpandedMarkets] = useState(false);

  // Animated value drives the top-section slide-up / fade when markets expand
  // 0 = collapsed (normal), 1 = fully expanded (top section hidden)
  const expandAnim = useRef(new Animated.Value(0)).current;

  // ─────────────────────────────────────────────────────────
  //  Toggle market expansion with smooth animation
  //  When expanding  → slide top section up + fade out
  //  When collapsing → slide top section back down + fade in
  // ─────────────────────────────────────────────────────────
  const toggleMarkets = () => {
    const toValue = expandedMarkets ? 0 : 1;
    setExpandedMarkets(!expandedMarkets);
    Animated.timing(expandAnim, {
      toValue,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  // Derived animated styles for the top section
  // translateY moves it off-screen upward; opacity fades it out
  const topSectionStyle = {
    opacity: expandAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0],
    }),
    transform: [
      {
        translateY: expandAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -160], // shift up by ~160px (covers balance + action btns)
        }),
      },
    ],
  };

  // Bottom section grows to fill full remaining space when expanded
  const bottomSectionStyle = {
    flex: expandAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1], // flex stays 1 but absolute positioning takes over
    }),
  };

  // ─────────────────────────────────────────────────────────
  //  Firebase: auth → wallet subscription + games subscription
  // ─────────────────────────────────────────────────────────


  // ── Marquee notice state ────────────────────────────────
  const [noticeText, setNoticeText] = useState<string>('Welcome to RM Games! Play responsibly. Withdraw anytime. Good luck! 🎯');
  const marqueeX = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(marqueeX, {
        toValue: -SCREEN_WIDTH * 1.5,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [marqueeX]);

  useEffect(() => {
    let unsubUser: undefined | (() => void);

    const sub = auth.onAuthStateChanged(user => {
      if (!user) {
        if (unsubUser) unsubUser();
        promptedResetRef.current = false;
        router.push('/');
        return;
      }

      // Subscribe to user's wallet amount (real-time)
      try {
        unsubUser = db
          .collection('users')
          .doc(user.uid)
          .onSnapshot(async snap => {
            const data = snap.data() as any;
            const raw = data?.wallet;
            const num = typeof raw === 'number' ? raw : Number(raw ?? 0);
            setWallet(Number.isFinite(num) ? num : 0);

            // Prompt for password reset only once per login session
            try {
              if (data?.isResetpassword === true && !promptedResetRef.current) {
                promptedResetRef.current = true;
                Alert.alert(
                  'Reset password',
                  'Do you want to reset your password?',
                  [
                    {
                      text: 'No',
                      onPress: async () => {
                        try {
                          await db
                            .collection('users')
                            .doc(user.uid)
                            .set({ isResetpassword: false }, { merge: true });
                        } catch (e) {
                          console.warn('Failed setting isResetpassword=false', e);
                        }
                      },
                    },
                    {
                      text: 'Yes',
                      onPress: () => {
                        try { router.push('/forgot-password'); } catch (e) { console.warn('Navigation error', e); }
                      },
                    },
                  ],
                  { cancelable: false }
                );
              }
            } catch (e) {
              console.warn('Reset prompt error', e);
            }
          });
      } catch (err) {
        // ignore subscription errors silently
      }

      // Subscribe to games collection (real-time, sorted by orderId)
      try {
        const unsubGames = db.collection('games').onSnapshot(
          (snap) => {
            const list = snap.docs.map((d) => {
              const data = d.data() as any;
              return {
                id: d.id,
                orderId: data?.orderId ?? data?.orderID ?? null,
                chartLink: data?.chartLink ?? data?.chartlink ?? null,
                gameId: data?.gameId ?? data?.gameID ?? null,
                name: data?.name,
                openTime: data?.openTime,
                closeTime: data?.closeTime,
                result: data?.result,
                clear_result: data?.clear_result,
              };
            });

            // Sort by numeric orderId → gameId → id (ascending)
            list.sort((a, b) => {
              const na = Number(a.orderId ?? a.gameId ?? a.id);
              const nb = Number(b.orderId ?? b.gameId ?? b.id);
              const va = Number.isFinite(na) ? na : Number.POSITIVE_INFINITY;
              const vb = Number.isFinite(nb) ? nb : Number.POSITIVE_INFINITY;
              return va - vb;
            });

            setGames(list);
            setGamesError(null);
          },
          (error) => {
            console.warn('Games fetch error:', error);
            setGamesError('Failed to load games. Pull to refresh.');
          }
        );
        return () => unsubGames();
      } catch (err) {
        console.warn('Games subscription error:', err);
        setGamesError('Error subscribing to games.');
      }
    });

    return () => { sub(); if (unsubUser) unsubUser(); };
  }, [router]);

  // ─────────────────────────────────────────────────────────
  //  Fetch WhatsApp number from Firestore app settings
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const doc = await db.collection('appsetting').doc('app').get();
        if (!mounted) return;
        const data = doc.exists ? (doc.data() as any) : null;
        setWhatsappNumber(data?.phoneWhatsappNumber ?? null);
        if (data?.noticeText) setNoticeText(data.noticeText);
      } catch (e) {
        console.warn('Failed fetching whatsapp number', e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // ─────────────────────────────────────────────────────────
  //  Android hardware back press handler
  //  Priority: close drawer → collapse markets → show exit dialog
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isFocused) return;

    const onBackPress = () => {
      // 1. If drawer is open, close it first
      if (open) {
        closeDrawer();
        return true;
      }
      // 2. If markets are expanded, collapse them
      if (expandedMarkets) {
        toggleMarkets();
        return true;
      }
      // 3. Otherwise show exit confirmation
      setExitVisible(true);
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [open, isFocused, expandedMarkets]);

  // ─────────────────────────────────────────────────────────
  //  Curve scale-in animation on mount
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(curveScale, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [curveScale]);

  // ─────────────────────────────────────────────────────────
  //  Pull-to-refresh: manually fetch games from Firestore
  // ─────────────────────────────────────────────────────────
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const snap = await db.collection('games').get();
      const list = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          orderId: data?.orderId ?? data?.orderID ?? null,
          chartLink: data?.chartLink ?? data?.chartlink ?? null,
          gameId: data?.gameId ?? data?.gameID ?? null,
          name: data?.name,
          openTime: data?.openTime,
          closeTime: data?.closeTime,
          result: data?.result,
          clear_result: data?.clear_result,
        };
      });
      list.sort((a, b) => {
        const na = Number(a.orderId ?? a.gameId ?? a.id);
        const nb = Number(b.orderId ?? b.gameId ?? b.id);
        const va = Number.isFinite(na) ? na : Number.POSITIVE_INFINITY;
        const vb = Number.isFinite(nb) ? nb : Number.POSITIVE_INFINITY;
        return va - vb;
      });
      setGames(list);
      setGamesError(null);
    } catch (err) {
      console.warn('Manual games fetch error:', err);
      setGamesError('Failed to refresh games.');
    } finally {
      setRefreshing(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  //  Time helpers (IST-based)
  // ─────────────────────────────────────────────────────────

  /** Parse "HH:MM AM/PM" → total minutes since midnight */
  const parseTime12h = (t?: string | null) => {
    if (!t) return null;
    const m = ('' + t).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?$/);
    if (!m) return null;
    let hh = Number(m[1]);
    const mm = Number(m[2]);
    const ampm = (m[3] || '').toLowerCase();
    if (ampm === 'pm' && hh < 12) hh += 12;
    if (ampm === 'am' && hh === 12) hh = 0;
    return hh * 60 + mm;
  };

  /** Get current IST time in minutes since midnight */
  const nowIst = () => {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const ist = new Date(utc + 5.5 * 60 * 60000);
    return ist.getHours() * 60 + ist.getMinutes();
  };

  /** Determine if a game is closed for today (by flag or by time) */
  const isGameClosedForToday = (g: {
    id: string;
    name?: string;
    openTime?: string;
    closeTime?: string;
    result?: string;
    clear_result?: boolean;
  }) => {
    const byFlag = g.clear_result === false;
    const ct = parseTime12h(g.closeTime);
    if (ct === null) return byFlag;
    const byTime = nowIst() > ct;
    return byFlag || byTime;
  };

  /** Handle game card press; alert if game is closed */
  const handleGamePress = (g: {
    id: string;
    name?: string;
    openTime?: string;
    closeTime?: string;
    result?: string;
    clear_result?: boolean;
  }) => {
    if (isGameClosedForToday(g)) {
      Alert.alert('Game Closed', 'This game is closed for today.');
      return;
    }
    try { router.push(`/sections/games/${g.id}`); } catch (e) { console.warn('Navigation error', e); }
  };

  // ─────────────────────────────────────────────────────────
  //  Drawer open / close helpers
  // ─────────────────────────────────────────────────────────
  const openDrawer = () => {
    setOpen(true);
    Animated.timing(drawerX, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  };

  const closeDrawer = (cb?: () => void) => {
    Animated.timing(drawerX, { toValue: -drawerWidth, duration: 180, useNativeDriver: true }).start(() => {
      setOpen(false);
      if (cb) cb();
    });
  };

  /** Backdrop opacity tied to drawer X position */
  const backdropOpacity = drawerX.interpolate({
    inputRange: [-drawerWidth, 0],
    outputRange: [0, 0.7],
    extrapolate: 'clamp',
  });

  /** Handle section tap inside drawer (special case: Log Out) */
  const onPressSection = (s: typeof sections[number]) => {
    if (s.title === 'Log Out') {
      closeDrawer(async () => {
        try {
          await auth.signOut();
        } catch (err) {
          console.warn('Sign out error', err);
        } finally {
          router.push('/');
        }
      });
      return;
    }

    closeDrawer(() => {
      try {
        console.log(s.route);
        router.push(s.route);
      } catch (e) {
        console.warn('Navigation error', e);
      }
    });
  };

  // ============================================================
  //  RENDER
  // ============================================================
  return (
    <>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#1e1f3f' }} edges={['left', 'right', 'bottom']}>

        {/* ── HEADER ───────────────────────────────────────────── */}
        <View style={styles.headerShadow}>
          <View style={styles.header}>
            {/* Hamburger menu button */}
            <TouchableOpacity
              onPress={() => (open ? closeDrawer() : openDrawer())}
              style={styles.drawerButton}
            >
              <View style={styles.logoBox}>
                <Image
                  source={require("../assets/images/icon.png")}
                  style={styles.logoImg}
                  resizeMode="cover"
                />
              </View>
            </TouchableOpacity>

            <Text style={styles.title}>RM Games </Text>

            {/* Header right actions: notifications, WhatsApp, refresh */}
            <View style={styles.headerRight}>
              {/* Notification bell */}
              <TouchableOpacity onPress={() => router.push('/sections/notice-board')}>
                <View style={styles.iconCircle}>
                  <MaterialIcons name="notifications" size={22} color="#f4f6ff" />
                </View>
              </TouchableOpacity>

              {/* WhatsApp / message options */}
              <TouchableOpacity onPress={() => setMessageOptionsVisible(true)}>
                <View style={styles.iconCircle}>
                  <FontAwesome name="whatsapp" size={22} color="#25D366" />
                </View>
              </TouchableOpacity>

              {/* Refresh button */}
              <TouchableOpacity onPress={onRefresh}>
                <View style={styles.iconCircle}>
                  <MaterialIcons name="refresh" size={22} color="#f4f6ff" />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── MAIN CONTENT AREA ────────────────────────────────── */}
        <View style={styles.contentArea}>

          {/* ── TOP SECTION (balance card + quick actions) ──────
            Animates upward and fades out when markets are expanded
        ──────────────────────────────────────────────────── */}
          <Animated.View
            style={[
              styles.topSection,
              topSectionStyle,
              // Pointer events disabled when fully hidden so taps pass through
              expandedMarkets && { pointerEvents: 'none' as any },
            ]}
          >
            {/* Balance card */}
            {/* Marquee notice board */}
            <View style={styles.noticeBoard}>
              <MaterialIcons name="campaign" size={16} color="#facc15" style={{ marginRight: 6 }} />
              <View style={styles.noticeTrack}>
                <Animated.Text
                  style={[styles.noticeText, { transform: [{ translateX: marqueeX }] }]}
                  numberOfLines={1}
                >
                  {noticeText}
                </Animated.Text>
              </View>
            </View>

            {/* Balance card */}
            <View style={styles.balanceCard}>
              

              <View>
                <Text style={styles.balanceLabel}>Available Balance</Text>
                <Text style={styles.balanceAmount}>₹ {wallet}</Text>
              </View>

              <Link href="/sections/add-money" asChild>
                <TouchableOpacity style={styles.addMoneyBtn}>
                  <Text style={styles.addMoneyText}>+ Add Money</Text>
                </TouchableOpacity>
              </Link>
            </View>

            {/* Quick action buttons: Withdraw | Bid History */}
            <View style={styles.actions}>
              <Link href="/sections/withdraw-money" asChild>
                <TouchableOpacity style={styles.actionBtn}>
                  <MaterialIcons name="account-balance-wallet" size={20} color="#000" />
                  <Text style={styles.actionText}>Withdraw</Text>
                </TouchableOpacity>
              </Link>

              <Link href="/sections/bid-history" asChild>
                <TouchableOpacity style={styles.actionBtn}>
                  <MaterialIcons name="history" size={20} color="#000" />
                  <Text style={styles.actionText}>Bid History</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </Animated.View>

          {/* ── BOTTOM SECTION (Live Markets list) ──────────────
            When expanded: fills full height, hides top section
            When collapsed: normal flex layout below top section
        ──────────────────────────────────────────────────── */}
          <Animated.View
            style={[
              styles.bottomSection,
              // When expanded, use absolute positioning to cover the full content area
              expandedMarkets && styles.bottomSectionExpanded,
            ]}
          >
            {/* Error banner (shown if games fetch fails) */}
            {gamesError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{gamesError}</Text>
              </View>
            )}

            {/* Section header row: title | expand toggle | live badge */}
            <View style={styles.sectionHeader}>
              {/* "Live Markets" title with yellow left-line accent */}
              <View style={styles.sectionTitleWrap}>
                <View style={styles.yellowLine} />
                <Text style={styles.sectionTitle}>Live Markets</Text>
              </View>

              {/* ── Expand / Collapse toggle button ─────────────
                UP arrow   → panel is collapsed, tap to expand
                DOWN arrow → panel is expanded, tap to collapse
                On expand: top section slides away, markets go full height
            ───────────────────────────────────────────────── */}
              <TouchableOpacity
                style={styles.swipeArrowBtn}
                onPress={toggleMarkets}
                activeOpacity={0.85}
              >
                <MaterialIcons
                  name={expandedMarkets ? 'unfold-less' : 'unfold-more'}
                  size={24}
                  color="#ffffff"
                />
              </TouchableOpacity>

              {/* Live badge */}
              {/* <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.liveBadge}>
                <Text style={styles.liveText}>● Live</Text>
              </View>
            </View> */}
            </View>

            {/* ── Games FlatList ─────────────────────────────── */}
            <FlatList
              data={games}
              keyExtractor={(g) => g.id}
              showsVerticalScrollIndicator={false}
              scrollEnabled={true}
              contentContainerStyle={{
                // Extra bottom padding so last card clears the bottom nav
                // paddingBottom: expandedMarkets ? 16 : 30,
                paddingBottom: expandedMarkets ? 16 : 30,
                flexGrow: 1,
              }}
              refreshing={refreshing}
              onRefresh={onRefresh}
              renderItem={({ item, index }) => (
                <GameCard
                  game={item}
                  index={index}
                  onPress={() => handleGamePress(item)}
                  onChartPress={() => {
                    if (item.chartLink) {
                      router.push(item.chartLink);
                    }
                  }}
                  isClosedForToday={isGameClosedForToday(item)}
                />
              )}
            />
          </Animated.View>

        </View>
        {/* END MAIN CONTENT AREA */}

        {/* ── DRAWER BACKDROP ──────────────────────────────────── */}
        {/* Dark overlay that fades in when the side drawer opens   */}
        <TouchableWithoutFeedback onPress={() => closeDrawer()}>
          <Animated.View
            pointerEvents={open ? 'auto' : 'none'}
            style={[
              styles.backdrop,
              { backgroundColor: '#383839ff', opacity: backdropOpacity },
            ]}
          />
        </TouchableWithoutFeedback>

        {/* ── SIDE DRAWER ──────────────────────────────────────── */}
        <Animated.View style={[styles.drawer, { transform: [{ translateX: drawerX }] }]}>
          {/* Drawer header with app icon */}
          <View style={styles.drawerHeader}>
            <View style={styles.drawerIconWrap}>
              <Image
                source={require('../assets/images/icon.png')}
                style={styles.drawerIcon}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* Scrollable section list */}
          <ScrollView style={styles.drawerScroll} contentContainerStyle={styles.drawerScrollContent}>
            {sections.map((s, idx) => (
              <TouchableOpacity
                key={s.title}
                style={[styles.sectionRow, idx === 0 && styles.itemFirst]}
                activeOpacity={0.7}
                onPress={() => onPressSection(s)}
              >
                <MaterialIcons name={getSectionIcon(s.title)} style={styles.sectionIcon} size={25} />
                <Text style={styles.sectionText}>{s.title}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>

        {/* ── EXIT CONFIRMATION MODAL ───────────────────────────── */}
        {/* Reusable component shown when Android back pressed on home */}
        <ExitConfirm
          visible={exitVisible}
          onCancel={() => setExitVisible(false)}
          onConfirm={() => BackHandler.exitApp()}
        />

        {/* ── WHATSAPP / MESSAGE OPTIONS MODAL (slide-up sheet) ── */}
        <Modal
          visible={messageOptionsVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setMessageOptionsVisible(false)}
        >
          {/* Tap outside to dismiss */}
          <TouchableWithoutFeedback onPress={() => setMessageOptionsVisible(false)}>
            <View style={styles.modalOverlay} />
          </TouchableWithoutFeedback>

          <View style={[
            styles.messageModal,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              minHeight: Math.floor(SCREEN_HEIGHT * 0.25),
            },
          ]}>
            {/* Admin chat option */}
            <TouchableOpacity
              style={styles.messageOption}
              onPress={() => {
                setMessageOptionsVisible(false);
                try { router.push('/sections/message'); } catch (e) { console.warn('Navigation error', e); }
              }}
            >
              <MaterialIcons name="chat" size={24} color={colors.text} />
              <Text style={[styles.messageOptionText, { color: colors.text }]}>Admin Chat</Text>
            </TouchableOpacity>

            {/* WhatsApp option */}
            <TouchableOpacity
              style={styles.messageOption}
              onPress={async () => {
                if (!whatsappNumber) {
                  Alert.alert('Not available', 'WhatsApp number not configured');
                  return;
                }
                const num = String(whatsappNumber).replace(/\D/g, '');
                const url = `https://wa.me/${num}`;
                try {
                  await Linking.openURL(url);
                } catch (e) {
                  console.warn('Open WhatsApp error', e);
                  Alert.alert('Unable to open WhatsApp');
                }
              }}
            >
              <FontAwesome name="whatsapp" size={24} color="#25D366" />
              <Text style={styles.messageOptionText}>WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </Modal>


      </SafeAreaView>
      <BottomNav active="home" />
    </>
  );
}

// ============================================================
//  GameCard Component
//  Renders a single game entry in the Live Markets list
// ============================================================
function GameCard({
  game,
  index,
  onPress,
  isClosedForToday,
  onChartPress,
}: {
  game: {
    id: string;
    chartLink?: string;
    name?: string;
    openTime?: string;
    closeTime?: string;
    result?: string;
    clear_result?: boolean;
  };
  index: number;
  onPress: () => void;
  isClosedForToday: boolean;
  onChartPress?: () => void;
}) {
  // ── Subtle shake animation for the card ──────────────────
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 100, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => { t.stopAnimation(); };
  }, [t]);

  const rotation = t.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] });

  // ── Status helpers ───────────────────────────────────────
  const isRunningToday = !isClosedForToday && game.clear_result === true;

  const statusText = isClosedForToday ? 'Closed' : isRunningToday ? 'Running' : 'Open';
  const statusColor = isClosedForToday ? '#ef4444' : isRunningToday ? '#22c55e' : '#facc15';

  return (
    <TouchableOpacity
      style={styles.newGameCard}
      activeOpacity={isClosedForToday ? 1 : 0.9}
      onPress={onPress}
    >
      {/* Card header: game name + live pill */}
      <View style={styles.newHeader}>
        <Text style={styles.newTitle}>{game.name}</Text>
        <Text
          style={[
            styles.livePillText,
            {
              color: isClosedForToday ? '#ef4444' : '#22c55e',
              backgroundColor: isClosedForToday
                ? 'rgba(239, 68, 68, 0.15)'
                : 'rgba(34, 197, 94, 0.15)',
              paddingHorizontal: 10,
              paddingVertical: 1,
              borderRadius: 999,
              overflow: 'hidden',
              fontWeight: '700',
            },
          ]}
        >
          {isClosedForToday ? '● Closed' : '● Live'}
        </Text>
      </View>

      {/* Top info box: open/close times + play button */}
      <View style={styles.newTopBox}>
        <View>
          <Text style={styles.newTimeText}>
            Open {game.openTime ?? '--'}  Close {game.closeTime ?? '--'}
          </Text>
        </View>
        <TouchableOpacity style={styles.playBtnSmall} onPress={onPress}>
          <Text style={styles.playBtnText}>Play ▶</Text>
        </TouchableOpacity>
      </View>

      {/* Result row: Open | Jodi | Close */}
      <View style={styles.newResultBox}>
        <View style={styles.resultCol}>
          <Text style={styles.resultLabel}>Open</Text>
          <Text style={styles.resultValue}>{game.result?.split('-')[0] ?? '--'}</Text>
        </View>

        <Text style={styles.resultDash}>-</Text>

        <View style={styles.resultCol}>
          <Text style={styles.resultLabel}>Jodi</Text>
          <Text style={styles.resultValue}>{game.result?.split('-')[1] ?? '--'}</Text>
        </View>

        <Text style={styles.resultDash}>-</Text>

        <View style={styles.resultCol}>
          <Text style={styles.resultLabel}>Close</Text>
          <Text style={styles.resultValue}>{game.result?.split('-')[2] ?? '--'}</Text>
        </View>
      </View>

      {/* Bottom status tag */}
      {/* <View style={styles.bottomTag}>
        <Text style={styles.bottomTagText}>Open: {game.result?.split('-')[1][0] ?? '--'}</Text>
      </View> */}
    </TouchableOpacity>
  );
}

// ============================================================
//  StyleSheet
// ============================================================
const styles = StyleSheet.create({

  // ── Header ─────────────────────────────────────────────
  headerShadow: {
    backgroundColor: '#0b1f4c',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  header: {
    height: 82,
    paddingTop: 40,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  logoBox: {
    width: 42,
    height: 42,
    borderRadius: 10,                 // softer, modern rounded corners
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',

    // subtle professional shadow
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,

    borderWidth: 1,
    borderColor: '#e5e7eb',          // light neutral border (not harsh)

  },



  logoImg: {
    width: '88%',                    // prevents edge touching
    height: '88%',
    borderRadius: 8,
  },
  drawerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hamburger: {
    width: 20,
    height: 2,
    backgroundColor: '#f4f6ff',
    marginVertical: 2.5,
    borderRadius: 2,
  },
  title: {
    fontStyle:'italic',
    flex: 1,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 18,
    color: '#f4f6ff',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0f2a63',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  // ── Content area (flex container for top + bottom sections)
  contentArea: {
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 10,
    flex: 1,
  },

  // ── Top section: balance card + quick action buttons ────
  topSection: {
    marginBottom: 10,
  },
  balanceCard: {
    backgroundColor: C.gold,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  balanceLabel: {
    fontSize: 12,
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: '900',
  },
  addMoneyBtn: {
    backgroundColor: '#000',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 1,
  },
  addMoneyText: {
    fontWeight: '800',
    fontSize: 14,
    color: '#fff',
    letterSpacing: 0.3,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionText: {
    marginTop: 4,
    fontWeight: '600',
  },

  // ── Bottom section: Live Markets panel ──────────────────
  // Normal (collapsed) state — sits below the top section
  bottomSection: {
    flex: 1,
    backgroundColor: '#f1f2f6ff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 10,
    minHeight: SCREEN_HEIGHT * 0.52,
  },
  // Expanded state — covers full content area (top section hidden behind)
  bottomSectionExpanded: {
    position: 'absolute',
    top: 0,          // starts from very top of contentArea (below header)
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
    backgroundColor: '#f1f2f6ff',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    elevation: 10,
  },

  // ── Section header row ──────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Yellow accent line to the left of "Live Markets" title
  yellowLine: {
    width: 4,
    height: 22,
    backgroundColor: '#facc15',
    borderRadius: 2,
    marginRight: 10,
  },
  sectionTitle: {
    color: 'Black',
    fontWeight: '800',
  },
  swipeArrowBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1e1f3f',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2f3263',
    marginHorizontal: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: {
      width: 0,
      height: 2,
    },
  },
  // Live badge (green dot + text)
  liveBadge: {
    backgroundColor: '#0f2a63',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1f3b7a',
  },
  liveText: {
    color: '#22c55e',
    fontWeight: '600',
    fontSize: 13,
  },

  // ── Error banner ────────────────────────────────────────
  errorBanner: {
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    color: '#991b1b',
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Game card ───────────────────────────────────────────
  newGameCard: {
    backgroundColor: '#1e1f3f',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f5c518',
    minHeight: 170,
  },
  newHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  newTitle: {
    color: '#facc15',
    fontWeight: '800',
    fontSize: 16,
  },
  livePill: {
    backgroundColor: '#052e16',
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  livePillText: {
    color: '#22c55e',
    fontSize: 12,
  },
  newTopBox: {
    backgroundColor: '#2a2d5a',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  newSmallLabel: {
    color: '#a0aec0',
    fontSize: 12,
  },
  newClosedText: {
    color: '#facc15',
    fontWeight: '700',
  },
  newTimeText: {
    color: '#cbd5f5',
    fontSize: 12,
  },
  playBtnSmall: {
    backgroundColor: '#facc15',
    paddingVertical: 3,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  playBtnText: {
    fontWeight: '700',
  },
  newResultBox: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f5c518',
    borderRadius: 10,
    paddingVertical: 10,
  },
  resultCol: {
    alignItems: 'center',
  },
  resultLabel: {
    color: '#a0aec0',
    fontSize: 12,
  },
  resultValue: {
    color: '#facc15',
    fontSize: 18,
    fontWeight: '800',
  },
  resultDash: {
    color: '#fff',
    fontSize: 18,
  },
  bottomTag: {
    alignSelf: 'center',
    marginTop: 8,
    backgroundColor: '#facc15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bottomTagText: {
    fontWeight: '700',
    fontSize: 12,
  },

  // ── Drawer ──────────────────────────────────────────────
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: drawerWidth,
    backgroundColor: '#ffffff',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 2, height: 0 },
    zIndex: 200,
    elevation: 20,        // ← CHANGE from 10 to 20
  },
  drawerHeader: {
    paddingHorizontal: 16,
    paddingVertical: 60,
    paddingBottom: 40,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b1f4c',
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e2633',
    flex: 1,
  },
  drawerCloseBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#ef4444',
  },
  drawerCloseText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  drawerScroll: { flex: 1 },
  drawerScrollContent: { paddingVertical: 8 },
  drawerIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    flex: 1,
  },
  drawerIcon: {
    width: 104,
    height: 104,
    borderRadius: 12,
    backgroundColor: '#0b1f4c',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#96989a',
  },
  sectionIcon: {
    fontSize: 24,
    width: 49,
  },
  sectionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  item: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eef2f7',
  },
  itemFirst: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eef2f7',
  },
  itemText: {
    fontSize: 14,
    color: '#1f2937',
  },

  // ── Backdrop (behind drawer) ────────────────────────────
  backdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 100,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },

  // ── Exit dialog ─────────────────────────────────────────
  exitOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  exitCard: {
    width: '100%',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderWidth: 1,
  },
  exitTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  exitMessage: { fontSize: 14, marginBottom: 16 },
  exitButtonsRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  exitButton: {
    minWidth: 80,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    marginLeft: 10,
  },
  exitButtonNo: { backgroundColor: 'transparent', borderWidth: 1 },
  exitButtonYes: {},
  exitButtonTextNo: { fontWeight: '600' },
  exitButtonTextYes: { fontWeight: '600', color: '#ffffff' },

  // ── Message / WhatsApp modal ────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  messageModal: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  messageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  messageOptionText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '700',
  },

  // ── Legacy / unused styles kept for reference ───────────
  bellBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#0f2a63',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellIcon: { fontSize: 14 },
  walletBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0b1f4c',
  },
  walletIcon: { marginRight: 8 },
  walletText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  content: { flex: 1 },
  scrollContent: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 10 },
  listWrapper: {
    backgroundColor: '#f1f2f6ff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingBottom: 2,
    marginTop: 4,
    paddingTop: 4,
    overflow: 'hidden',
    flex: 1,
  },
  curveBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 68,
    bottom: 0,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
  },
  cardsContainer: { paddingTop: 15, paddingBottom: 6, flex: 1 },
  gameCard: {
    alignSelf: 'center',
    width: '100%',
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ffff',
    borderTopColor: '#fff',
    borderBottomColor: '#cfcfcf',
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  gameCardDisabled: { opacity: 1 },
  gameRowTop: { flexDirection: 'row', justifyContent: 'center', marginBottom: 6 },
  timeText: { fontSize: 13, color: '#374151', fontWeight: '600', marginHorizontal: 8 },
  resultText: { textAlign: 'center', fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 2 },
  resultRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  nameText: { textAlign: 'center', fontSize: 20, fontWeight: '800', color: '#f0156d', marginTop: 0 },
  closedText: { textAlign: 'center', paddingTop: 1, fontSize: 13, color: '#f31e1eff', fontWeight: '700' },
  runningText: { textAlign: 'center', paddingTop: 1, fontSize: 13, color: '#28b04f', fontWeight: '700' },
  leftIconWrap: {
    position: 'absolute',
    left: 16,
    top: 58,
    width: 40,
    height: 40,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#babcbfff',
    zIndex: 3,
    elevation: 6,
  },
  leftIcon: { fontSize: 24, color: '#262c39', fontWeight: '600' },
  playButton: {
    position: 'absolute',
    right: 12,
    top: 52,
    width: 52,
    height: 55,
    borderRadius: 28,
    backgroundColor: '#f0156d',
    borderWidth: 1.5,
    borderColor: '#d78398',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#FFB300',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  playIcon: { color: '#fff', fontSize: 22, fontWeight: '800' },
  actionsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  addMoneyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: '#168408',
  },
  withdrawButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 15,
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: '#e71511',
  },
  messageButton: {
    width: 40,
    height: 40,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d1d5db',
  },
  moneySymbol: { color: '#ffffff', fontSize: 15, fontWeight: '700', marginRight: 6 },
  withdrawIcon: { color: '#ffffff', fontSize: 15, fontWeight: '700', marginRight: 6 },
  addMoneyLabel: { color: '#ffffff', fontSize: 15, fontWeight: '800', letterSpacing: 0.1 },
  withdrawLabel: { color: '#ffffff', fontSize: 15, fontWeight: '800', letterSpacing: 0.1 },
  welcomeTitle: { fontSize: 26, fontWeight: '700', color: '#1e2633' },
  welcomeSub: { marginTop: 6, color: '#6b7280' },

  // ── Bottom navigation bar ───────────────────────────────
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#14162f',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#2a2d5a',
  },
  activeTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#facc15',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 6,
  },
  activeTabText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  navTab: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircle: {
    width: 50,
    height: 50,

    backgroundColor: '#0b1f4c',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',


  },
  logoCircleImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  // ── Notice board (marquee) ──────────────────────────────
noticeBoard: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#0b1f4c',
  borderRadius: 8,
  paddingVertical: 7,
  paddingHorizontal: 10,
  marginBottom: 8,
  borderWidth: 1,
  borderColor: '#facc1540',
  overflow: 'hidden',
},
noticeTrack: {
  flex: 1,
  overflow: 'hidden',
},
noticeText: {
  color: '#facc15',
  fontSize: 13,
  fontWeight: '600',
  width: SCREEN_WIDTH * 2,
},

// ── Balance card corner decorations ────────────────────
balanceCornerTL: {
  position: 'absolute',
  top: 0,
  left: 0,
  width: 22,
  height: 22,
  backgroundColor: 'rgba(0,0,0,0.15)',
  borderTopLeftRadius: 12,
  borderBottomRightRadius: 10,
},
balanceCornerTR: {
  position: 'absolute',
  top: 0,
  right: 0,
  width: 22,
  height: 22,
  backgroundColor: 'rgba(0,0,0,0.15)',
  borderTopRightRadius: 12,
  borderBottomLeftRadius: 10,
},

  // ── Unused / legacy (kept for safety) ───────────────────
  // bottomSectionExpanded was previously absolute from top:180
  // Now replaced above with top:0 for true full-height cover
});

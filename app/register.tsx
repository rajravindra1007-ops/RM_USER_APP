import { MaterialIcons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import firestoreModule from '@react-native-firebase/firestore'
import messaging from '@react-native-firebase/messaging'
import * as Device from 'expo-device'
import { useRouter } from 'expo-router'
import React, { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { auth, db, phoneToEmail } from '../firebaseConfig'

const COLORS = {
  bg: '#11132d',
  card: '#1c1e3a',
  yellow: '#facc15',
  yellowDark: '#eab308',
  subText: '#8b90b8',
  inputBg: '#25284d',
  inputBorder: '#343766',
  white: '#ffffff',
  black: '#000000',
  accent: '#facc15',
  accentGlow: 'rgba(250,204,21,0.18)',
  divider: '#2a2e5a',
  errorRed: '#f87171',
  inputFocus: '#facc15',
  deepBg: '#0d0f26',
}

// ── Floating Label Input ──────────────────────────────────────────────────────
function FloatingInput({
  label,
  value,
  onChangeText,
  keyboardType,
  secureTextEntry,
  maxLength,
  icon,
}: {
  label: string
  value: string
  onChangeText: (t: string) => void
  keyboardType?: any
  secureTextEntry?: boolean
  maxLength?: number
  icon: React.ComponentProps<typeof MaterialIcons>['name']
}) {
  const [focused, setFocused] = useState(false)
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current

  useEffect(() => {
    Animated.timing(anim, {
      toValue: focused || value ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start()
  }, [focused, value])

  const labelTop = anim.interpolate({ inputRange: [0, 1], outputRange: [18, 6] })
  const labelSize = anim.interpolate({ inputRange: [0, 1], outputRange: [16, 11] })
  const labelColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.subText, COLORS.yellow],
  })

  return (
    <View style={[styles.floatWrap, focused && styles.floatWrapFocused]}>
      {/* Left icon stripe */}
      <View style={styles.iconStripe}>
        <MaterialIcons
          name={icon}
          size={22}
          color={focused ? COLORS.yellow : COLORS.subText}
        />
      </View>

      <View style={{ flex: 1 }}>
        <Animated.Text
          style={[
            styles.floatLabel,
            { top: labelTop, fontSize: labelSize, color: labelColor },
          ]}
        >
          {label}
        </Animated.Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          maxLength={maxLength}
          style={styles.floatInput}
          placeholderTextColor="transparent"
          selectionColor={COLORS.yellow}
        />
      </View>
    </View>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function RegisterScreen() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [deviceId, setDeviceId] = useState<string>('')
  const [registering, setRegistering] = useState(false)

  // Entrance animation
  const cardAnim = useRef(new Animated.Value(0)).current
  const logoAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.sequence([
      Animated.timing(logoAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(cardAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
    ]).start()
  }, [])

  useEffect(() => {
    const id = Device.osInternalBuildId || Device.deviceName || 'unknown-device'
    setDeviceId(String(id))
  }, [])

  const handleRegister = async () => {
    if (!password || password.length < 6) {
      Alert.alert('Invalid password', 'Password must be at least 6 characters')
      return
    }
    if (!name || name.trim().length === 0) {
      Alert.alert('Invalid name', 'Please enter your full name')
      return
    }
    if (!phone || phone.trim().length < 10) {
      Alert.alert('Invalid phone', 'Please enter a valid phone number')
      return
    }

    try {
      setRegistering(true)
      const email = phoneToEmail(phone)

      try {
        const userCred = await auth.createUserWithEmailAndPassword(email, password)
        const uid = userCred?.user?.uid || auth.currentUser?.uid

        await db.collection('users').doc(uid!).set({
          name,
          phone,
          email,
          deviceId,
          createdAt: firestoreModule.FieldValue.serverTimestamp(),
          updatedAt: firestoreModule.FieldValue.serverTimestamp(),
        })

        await incrementUserCollectionStats()

        try {
          await saveFcmTokenForUser(uid!)
        } catch (e) {
          console.warn('Failed to save FCM token during register', e)
        }

        Alert.alert('Registered', 'Account created successfully')

        try {
          await AsyncStorage.setItem('savedPhone', String(phone))
          await AsyncStorage.setItem('savedPassword', String(password))
          await AsyncStorage.setItem('lastPhone', String(phone))
        } catch (e) {
          console.warn('Failed saving credentials locally', e)
        }

        router.replace('/home')
      } catch (e: any) {
        if (
          e?.code === 'auth/email-already-in-use' ||
          e?.message?.includes('email-already-in-use')
        ) {
          Alert.alert(
            'Account exists',
            'An account with this phone number already exists. Please login.',
          )
          return
        }
        throw e
      }
    } catch (e: any) {
      Alert.alert('Registration failed', e?.message || 'Unknown error')
    } finally {
      setRegistering(false)
    }
  }

  const cardTranslate = cardAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] })
  const logoScale = logoAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] })

  return (
    <SafeAreaView style={styles.container}>
      {/* Background decorative orbs */}
      <View style={styles.orbTop} />
      <View style={styles.orbBottom} />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>

          {/* Logo + Brand */}
          <Animated.View style={[styles.logoWrap, { opacity: logoAnim, transform: [{ scale: logoScale }] }]}>
            <View style={styles.logoRing}>
              <Image
                source={require('../assets/images/icon.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.brandName}>RM GAMES</Text>
            <Text style={styles.brandTagline}>Play Smart. Win Big.</Text>
          </Animated.View>

          {/* Card */}
          <Animated.View
            style={[
              styles.card,
              {
                opacity: cardAnim,
                transform: [{ translateY: cardTranslate }],
              },
            ]}
          >
            {/* Card header */}
            <View style={styles.cardHeader}>
              <View style={styles.goldPill}>
                <Text style={styles.goldPillText}>NEW ACCOUNT</Text>
              </View>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Join thousands of winners today</Text>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Inputs */}
            <View style={styles.fields}>
              <FloatingInput
                label="Full Name"
                value={name}
                onChangeText={setName}
                icon="person"
              />
              <FloatingInput
                label="Phone Number"
                value={phone}
                onChangeText={setPhone}
                keyboardType="number-pad"
                maxLength={10}
                icon="phone"
              />
              <FloatingInput
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                icon="lock"
              />
            </View>

            {/* Register Button */}
            <TouchableOpacity
              style={[styles.registerBtn, registering && { opacity: 0.75 }]}
              onPress={handleRegister}
              disabled={registering}
              activeOpacity={0.88}
            >
              <View style={styles.registerBtnInner}>
                {registering ? (
                  <ActivityIndicator color={COLORS.black} />
                ) : (
                  <>
                    <Text style={styles.registerBtnText}>Create Account</Text>
                    <Text style={styles.registerBtnArrow}>→</Text>
                  </>
                )}
              </View>
            </TouchableOpacity>

            {/* Login link */}
            <TouchableOpacity
              style={styles.loginLink}
              onPress={() => router.replace('/')}
              activeOpacity={0.8}
            >
              <Text style={styles.loginLinkText}>
                Already a member?{' '}
                <Text style={styles.loginLinkAccent}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Footer */}
          <Text style={styles.footerText}>
            By registering you agree to our Terms & Privacy Policy
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ── Firebase Helpers (unchanged) ──────────────────────────────────────────────
const incrementUserCollectionStats = async () => {
  try {
    const snapshot = await db.collection('userData').limit(1).get()
    const docRef = snapshot.empty
      ? db.collection('userData').doc('stats')
      : snapshot.docs[0].ref
    await docRef.set(
      {
        Totaluser: firestoreModule.FieldValue.increment(1),
        ZeroAmmount: firestoreModule.FieldValue.increment(1),
        updatedAt: firestoreModule.FieldValue.serverTimestamp(),
        ...(snapshot.empty ? { createdAt: firestoreModule.FieldValue.serverTimestamp() } : {}),
      },
      { merge: true },
    )
  } catch (err) {
    console.warn('incrementUserCollectionStats failed', err)
  }
}

const saveFcmTokenForUser = async (uid: string) => {
  try {
    try { await messaging().registerDeviceForRemoteMessages() } catch {}
    try {
      const authStatus = await messaging().requestPermission()
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL
      if (!enabled) return
    } catch {}
    const token = await messaging().getToken()
    if (!token) return
    await db.collection('users').doc(uid).set({ fcmToken: String(token) }, { merge: true })
  } catch (err) {
    console.warn('Error obtaining/saving FCM token', err)
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  // Decorative orbs
  orbTop: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(250,204,21,0.07)',
  },
  orbBottom: {
    position: 'absolute',
    bottom: -100,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(250,204,21,0.05)',
  },

  keyboard: { flex: 1 },

  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingBottom: 10,
  },

  // Logo
  logoWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2.5,
    borderColor: COLORS.yellow,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    shadowColor: COLORS.yellow,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
    marginBottom: 10,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 28,
  },
  brandName: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.yellow,
    letterSpacing: 4,
  },
  brandTagline: {
    fontSize: 12,
    color: COLORS.subText,
    letterSpacing: 1.5,
    marginTop: 2,
  },

  // Card
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 22,
    borderWidth: 1,
    borderColor: COLORS.divider,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },

  cardHeader: { alignItems: 'center', marginBottom: 14 },

  goldPill: {
    backgroundColor: COLORS.accentGlow,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.35)',
    borderRadius: 50,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 10,
  },
  goldPillText: {
    color: COLORS.yellow,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.5,
  },

  title: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.white,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.subText,
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: 0.2,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: 16,
  },

  fields: { gap: 12 },

  // Floating label input
  floatWrap: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: COLORS.inputBg,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    minHeight: 60,
    overflow: 'hidden',
  },
  floatWrapFocused: {
    borderColor: COLORS.yellow,
    shadowColor: COLORS.yellow,
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  iconStripe: {
    width: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.inputBorder,
  },

  floatLabel: {
    position: 'absolute',
    left: 14,
    color: COLORS.subText,
    zIndex: 1,
  },
  floatInput: {
    paddingHorizontal: 14,
    paddingTop: 24,
    paddingBottom: 8,
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },

  // Register Button
  registerBtn: {
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: COLORS.yellow,
    shadowColor: COLORS.yellow,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  registerBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  registerBtnText: {
    color: COLORS.black,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  registerBtnArrow: {
    color: COLORS.black,
    fontSize: 20,
    fontWeight: '700',
  },

  // Login link
  loginLink: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 4,
  },
  loginLinkText: {
    color: COLORS.subText,
    fontSize: 14,
  },
  loginLinkAccent: {
    color: COLORS.yellow,
    fontWeight: '800',
  },

  // Footer
  footerText: {
    textAlign: 'center',
    color: 'rgba(139,144,184,0.5)',
    fontSize: 11,
    marginTop: 18,
    letterSpacing: 0.2,
  },
})

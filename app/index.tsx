import { MaterialIcons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Device from 'expo-device'
import { useRouter } from 'expo-router'
import React, { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated, Easing, Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { auth, db, phoneToEmail } from '../firebaseConfig'
import CustomAlert from './components/CustomAlert'

// ─── Floating particle component ───────────────────────────────────────────────
function Particle({ delay, x, size, color, duration }: {
  delay: number; x: number; size: number; color: string; duration: number
}) {
  const translateY = useRef(new Animated.Value(0)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -700,
            duration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(opacity, { toValue: 0.7, duration: duration * 0.2, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0.3, duration: duration * 0.6, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: duration * 0.2, useNativeDriver: true }),
          ]),
        ]),
      ])
    )
    anim.start()
    return () => anim.stop()
  }, [])

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        bottom: -10,
        left: `${x}%` as any,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        transform: [{ translateY }],
        opacity,
      }}
    />
  )
}

const PARTICLES = [
  { delay: 0,    x: 10, size: 6, color: '#F4C430', duration: 7000 },
  { delay: 1000, x: 25, size: 4, color: '#FF3B30', duration: 9000 },
  { delay: 2000, x: 60, size: 5, color: '#F4C430', duration: 6000 },
  { delay: 500,  x: 80, size: 3, color: '#FFFFFF', duration: 8000 },
  { delay: 3000, x: 45, size: 6, color: '#FF3B30', duration: 10000},
  { delay: 1500, x: 70, size: 4, color: '#F4C430', duration: 7500 },
]

// ─── Pulse ring around logo ─────────────────────────────────────────────────
function PulseRing({ delay }: { delay: number }) {
  const scale = useRef(new Animated.Value(1)).current
  const opacity = useRef(new Animated.Value(0.7)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale,   { toValue: 1.55, duration: 2500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0,    duration: 2500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale,   { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.7, duration: 0, useNativeDriver: true }),
        ]),
      ])
    ).start()
  }, [])

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: 110,
        height: 110,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: '#F4C430',
        transform: [{ scale }],
        opacity,
      }}
    />
  )
}

export default function LoginScreen() {
  const router = useRouter()

  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const [alert, setAlert] = useState({
    visible: false,
    title: '',
    message: '',
  })

  // ── existing anims ──────────────────────────────────────────────────────────
  const logoScale = useRef(new Animated.Value(0.8)).current
  const loaderTranslate = useRef(new Animated.Value(0)).current
  const shineAnim = useRef(new Animated.Value(-220)).current

  // ── new anims ───────────────────────────────────────────────────────────────
  const headerSlide   = useRef(new Animated.Value(-40)).current
  const headerOpacity = useRef(new Animated.Value(0)).current
  const input1Slide   = useRef(new Animated.Value(-30)).current
  const input1Opacity = useRef(new Animated.Value(0)).current
  const input2Slide   = useRef(new Animated.Value(-30)).current
  const input2Opacity = useRef(new Animated.Value(0)).current
  const btnSlide      = useRef(new Animated.Value(30)).current
  const btnOpacity    = useRef(new Animated.Value(0)).current
  const regSlide      = useRef(new Animated.Value(30)).current
  const regOpacity    = useRef(new Animated.Value(0)).current

  // accent bar glow pulse
  const accentGlow = useRef(new Animated.Value(0)).current

  useEffect(() => {
    setDeviceId(String(Device.deviceName || 'unknown-device'))

    // logo bounce in
    Animated.spring(logoScale, {
      toValue: 1,
      useNativeDriver: true,
      damping: 8,
      stiffness: 100,
    }).start()

    // staggered entrance
    Animated.stagger(100, [
      Animated.parallel([
        Animated.timing(headerSlide,   { toValue: 0, duration: 400, easing: Easing.out(Easing.exp), useNativeDriver: true }),
        Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(input1Slide,   { toValue: 0, duration: 350, easing: Easing.out(Easing.exp), useNativeDriver: true }),
        Animated.timing(input1Opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(input2Slide,   { toValue: 0, duration: 350, easing: Easing.out(Easing.exp), useNativeDriver: true }),
        Animated.timing(input2Opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(btnSlide,   { toValue: 0, duration: 350, easing: Easing.out(Easing.exp), useNativeDriver: true }),
        Animated.timing(btnOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(regSlide,   { toValue: 0, duration: 350, easing: Easing.out(Easing.exp), useNativeDriver: true }),
        Animated.timing(regOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]),
    ]).start()

    // accent bar pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(accentGlow, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(accentGlow, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    ).start()

    // shine loop
    Animated.loop(
      Animated.timing(shineAnim, {
        toValue: 220,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start()

    loadSavedLogin()
  }, [])

  const loadSavedLogin = async () => {
    try {
      const savedPhone    = await AsyncStorage.getItem('savedPhone')
      const savedPassword = await AsyncStorage.getItem('savedPassword')
      if (savedPhone)    setPhone(savedPhone)
      if (savedPassword) setPassword(savedPassword)
    } catch (error) {
      console.log('Error loading saved login:', error)
    }
  }

  const showAlert = (title: string, message: string) => {
    setAlert({ visible: true, title, message })
  }

  const handlePhoneChange = (text: string) => {
    if (text === '') { setPhone(''); return }
    let cleaned = text.replace(/[^\d+]/g, '')
    if (cleaned.includes('+')) cleaned = '+' + cleaned.replace(/\+/g, '')
    setPhone(cleaned)
  }

  const login = async () => {
    if (phone.length !== 10) {
      showAlert('Invalid Mobile Number', 'Please enter a valid 10-digit mobile number.')
      return
    }
    if (!password.trim()) {
      showAlert('Password Required', 'Please enter your password.')
      return
    }

    setLoggingIn(true)
    Animated.loop(
      Animated.timing(loaderTranslate, { toValue: 1, duration: 900, useNativeDriver: true })
    ).start()

    try {
      const email = phoneToEmail(`${phone}`)
      const cred  = await auth.signInWithEmailAndPassword(email, password)
      const uid   = cred.user.uid
      await db.collection('users').doc(uid).set({ deviceId }, { merge: true })
      await AsyncStorage.setItem('savedPhone', phone)
      await AsyncStorage.setItem('savedPassword', password)
      router.replace('/home')
    } catch (e: any) {
      showAlert('Login Failed', e?.message || 'Something went wrong.')
    } finally {
      setLoggingIn(false)
    }
  }

  const accentOpacity = accentGlow.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] })

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B1020" />

      {/* ── floating particles ── */}
      {PARTICLES.map((p, i) => <Particle key={i} {...p} />)}

      <CustomAlert
        visible={alert.visible}
        title={alert.title}
        message={alert.message}
        onDismiss={() => setAlert(prev => ({ ...prev, visible: false }))}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── HEADER ── */}
          <Animated.View
            style={[styles.headerRow, { opacity: headerOpacity, transform: [{ translateX: headerSlide }] }]}
          >
            <Animated.View style={[styles.headerAccent, { opacity: accentOpacity }]} />
            <View>
              <Text style={styles.welcome}>WELCOME TO</Text>
              <Text style={styles.appName}>
                <Text style={{ color: '#FFFFFF' }}>R</Text>
                <Text style={{ color: '#FF3B30' }}>M</Text>
                <Text style={{ color: '#FFFFFF' }}> Games</Text>
              </Text>
            </View>
          </Animated.View>

          {/* ── LOGO with pulse rings ── */}
          <Animated.View style={[styles.logoWrap, { transform: [{ scale: logoScale }] }]}>
            <PulseRing delay={0} />
            <PulseRing delay={800} />
            <PulseRing delay={1600} />
            <Image source={require('../assets/images/icon.png')} style={styles.logo} />
          </Animated.View>

          {/* ── PHONE INPUT ── */}
          <Animated.View style={{ opacity: input1Opacity, transform: [{ translateX: input1Slide }] }}>
            <View style={styles.inputRow}>
              <MaterialIcons name="phone" size={22} style={styles.icon} />
              <TextInput
                value={phone}
                onChangeText={handlePhoneChange}
                keyboardType="phone-pad"
                maxLength={10}
                placeholder="Enter 10 digit mobile number"
                placeholderTextColor="#777"
                style={styles.input}
                autoComplete="off"
                importantForAutofill="no"
                textContentType="none"
                selectionColor="#F4C430"
              />
            </View>
          </Animated.View>

          {/* ── PASSWORD INPUT ── */}
          <Animated.View style={{ opacity: input2Opacity, transform: [{ translateX: input2Slide }] }}>
            <View style={styles.inputRow}>
              <MaterialIcons name="lock" size={22} style={styles.icon} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder="Enter Password"
                placeholderTextColor="#777"
                style={styles.input}
                autoComplete="off"
                importantForAutofill="no"
                textContentType="none"
                selectionColor="#F4C430"
              />
              <TouchableOpacity activeOpacity={0.7} onPress={() => setShowPassword(!showPassword)}>
                <MaterialIcons
                  name={showPassword ? 'visibility' : 'visibility-off'}
                  size={22}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>
          </Animated.View>

          <TouchableOpacity onPress={() => router.push('/contact')}>
            <Text style={styles.forgot}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* ── LOGIN BUTTON ── */}
          <Animated.View style={{ opacity: btnOpacity, transform: [{ translateY: btnSlide }] }}>
            <TouchableOpacity
              style={styles.loginBtn}
              onPress={login}
              disabled={loggingIn}
              activeOpacity={0.9}
            >
              {/* animated conic border wrapper */}
              <Animated.View
                pointerEvents="none"
                style={styles.spinBorderWrap}
              >
                <View style={styles.spinBorderInner} />
              </Animated.View>

              {/* shine */}
              <Animated.View
                pointerEvents="none"
                style={[styles.shine, { transform: [{ translateX: shineAnim }, { rotate: '25deg' }] }]}
              />

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                {loggingIn
                  ? <ActivityIndicator color="#000000" />
                  : <Text style={styles.loginText}>LOGIN...</Text>
                }
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* ── REGISTER BUTTON ── */}
          <Animated.View style={{ opacity: regOpacity, transform: [{ translateY: regSlide }] }}>
            <TouchableOpacity
              style={styles.registerBtn}
              onPress={() => router.push('/register')}
              activeOpacity={0.8}
            >
              <MaterialIcons name="person-add" size={18} color="#F4C430" style={{ marginRight: 6 }} />
              <Text style={styles.registerText}>Register New User</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1020',
    paddingHorizontal: 22,
    overflow: 'hidden',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 30,
  },
  headerAccent: {
    width: 4,
    height: 60,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    marginRight: 14,
  },
  welcome: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  appName: {
    fontSize: 34,
    fontWeight: '900',
    marginTop: 4,
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 28,
  },
  logo: {
    width: 110,
    height: 110,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    zIndex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A2342',
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    height: 56,
    borderWidth: 1.5,
    borderColor: '#1A2342',
  },
  icon: {
    color: '#F4C430',
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
  },
  forgot: {
    color: '#fff',
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 1,
  },
  shine: {
    position: 'absolute',
    top: -20,
    left: 0,
    width: 70,
    height: 120,
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderRadius: 20,
  },
  loginBtn: {
    backgroundColor: '#F4C430',
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    overflow: 'hidden',
    elevation: 8,
  },
  // spinning border ring sits behind the button face
  spinBorderWrap: {
    position: 'absolute',
    inset: 0,
    borderRadius: 14,
    overflow: 'hidden',
  },
  spinBorderInner: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  loginText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  registerBtn: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#F4C430',
    paddingVertical: 12,
    borderRadius: 12,
  },
  registerText: {
    color: '#F4C430',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
})
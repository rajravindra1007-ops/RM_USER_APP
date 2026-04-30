import { MaterialIcons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import messaging from '@react-native-firebase/messaging'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { useRouter } from 'expo-router'
import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Animated, AppState, Easing, Image, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { auth, db, phoneToEmail } from '../firebaseConfig'

export default function LoginScreen() {
  const router = useRouter()
  const [phone, setPhone] = useState('+91')
  const [password, setPassword] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [confirmation, setConfirmation] = useState<any | null>(null)
  const [code, setCode] = useState('')
  const [deviceId, setDeviceId] = useState<string>('')
  const [sendingOtp, setSendingOtp] = useState(false)
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const timerRef = useRef<any>(null)
  const [showPassword, setShowPassword] = useState(false)

  const headerAnim = useRef(new Animated.Value(0)).current
  const formAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const id = Device.osInternalBuildId || Device.deviceName || 'unknown-device'
    setDeviceId(String(id))
  }, [])

  useEffect(() => {
    let mounted = true
    const requestPermission = async () => {
      try {
        try { await messaging().registerDeviceForRemoteMessages() } catch (_) {}
        const authStatus = await messaging().requestPermission()
        const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED || authStatus === messaging.AuthorizationStatus.PROVISIONAL
        if (Platform.OS === 'android') {
          try {
            const existing = await Notifications.getPermissionsAsync()
            if (!existing.granted) {
              await Notifications.requestPermissionsAsync()
            }
          } catch (err) {}
        }
        if (!enabled) {
          return
        }
        if (Platform.OS === 'android') {
          try {
            await Notifications.setNotificationChannelAsync('default', {
              name: 'Default',
              importance: Notifications.AndroidImportance.MAX,
              sound: 'default',
            })
          } catch (err) {}
        }
      } catch (err) {}
    }
    requestPermission()
    const sub = AppState.addEventListener('change', state => {
      if (!mounted) return
      if (state === 'active') requestPermission()
    })
    return () => { mounted = false; try { sub.remove() } catch (_) {} }
  }, [])

  useEffect(() => {
    const unsub = messaging().onMessage(async msg => {
      try {
        const title = msg?.notification?.title || msg?.data?.title || 'Notification'
        const body = msg?.notification?.body || msg?.data?.body || ''
        await Notifications.scheduleNotificationAsync({ content: { title, body, sound: 'default' }, trigger: null })
      } catch (err) {}
    })
    return () => { try { unsub(); } catch (_) {} }
  }, [])

  useEffect(() => {
    // When component mounts, restore any existing otpRequestedAt
    ;(async () => {
      try {
        const t = await AsyncStorage.getItem('otpRequestedAt')
        if (t) {
          const ts = Number(t)
          if (!Number.isNaN(ts)) startTimerFrom(ts)
          setOtpSent(true)
        }
        // restore saved credentials for autofill
        try {
          const savedPhone = await AsyncStorage.getItem('savedPhone')
          const savedPass = await AsyncStorage.getItem('savedPassword')
          if (savedPhone) setPhone(savedPhone)
          if (savedPass) setPassword(savedPass)
        } catch (e) {
          // ignore
        }
      } catch (e) {
        // ignore
      }
    })()

    // start entrance animations after mount
    Animated.sequence([
      Animated.timing(headerAnim, { toValue: 1, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(formAnim, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start()

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // Persist last entered phone so Forgot Password can reuse it
  useEffect(() => {
    try {
      AsyncStorage.setItem('lastPhone', phone).catch(() => {})
    } catch (e) {
      // ignore
    }
  }, [phone])

  const startTimerFrom = (timestamp: number) => {
    if (timerRef.current) clearInterval(timerRef.current)
    const update = () => {
      const elapsed = Date.now() - timestamp
      const remainingMs = Math.max(0, 60000 - elapsed)
      const secs = Math.ceil(remainingMs / 1000)
      setSecondsLeft(secs)
      if (remainingMs <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
        // timer expired: clear saved OTP timestamp and reset OTP UI
        AsyncStorage.removeItem('otpRequestedAt').catch(() => {})
        setOtpSent(false)
        setConfirmation(null)
        setSecondsLeft(0)
      }
    }
    update()
    timerRef.current = setInterval(update, 1000)
  }

  const OTP_SERVER_BASE = 'https://serverotp-iepk.onrender.com'

  const login = async () => {
    setLoggingIn(true)
    try {
      // basic validation before attempting login
      if (!phone || phone.trim().length < 6) {
        Alert.alert('Invalid phone', 'Please enter a valid phone number')
        return
      }
      if (!password || password.length < 6) {
        Alert.alert('Invalid password', 'Password must be at least 6 characters')
        return
      }

      const email = phoneToEmail(phone)
      let cred
      try {
        cred = await auth.signInWithEmailAndPassword(email, password)
      } catch (err: any) {
        Alert.alert('Login failed', 'Phone number or password is incorrect')
        return
      }
      const uid = cred.user.uid

      const userDoc = await db.collection('users').doc(uid).get()
      const userData = userDoc.exists ? (userDoc.data() as any) : {}

      // If the account is blocked, prevent login and show server-provided message
      if (userData?.isBlock) {
        const blockMsg = userData?.Blockmessage || 'Your account has been blocked'
        Alert.alert('Account blocked', String(blockMsg))
        try { await auth.signOut() } catch (e) { /* ignore */ }
        return
      }

      const existingDeviceId = userData?.deviceId

      if (!existingDeviceId || existingDeviceId !== deviceId) {
        // Credentials are valid; require OTP on new device (use backend send-otp)
        try {
          setSendingOtp(true)
          const resp = await fetch(`${OTP_SERVER_BASE}/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: String(phone) }),
          })

          const j = await resp.json().catch(() => ({}))
          if (!resp.ok) {
            throw new Error(j?.error || 'Failed to request OTP')
          }

          setOtpSent(true)
          const ts = Date.now() 
          await AsyncStorage.setItem('otpRequestedAt', String(ts))
          startTimerFrom(ts)
          Alert.alert('OTP required', 'We sent an OTP to your phone')
        } finally {
          setSendingOtp(false)
        }
        return
      }

      // Save FCM token for this user (only the token) on regular login
      try {
        await saveFcmTokenForUser(uid)
      } catch (e) {
        console.warn('Failed saving FCM token', e)
      }

      // save credentials locally for autofill next time
      try {
        await AsyncStorage.setItem('savedPhone', String(phone))
        await AsyncStorage.setItem('savedPassword', String(password))
      } catch (e) {
        console.warn('Failed saving credentials locally', e)
      }

      router.replace('/home')
    } catch (e: any) {
      Alert.alert('Login failed', e?.message || 'Unknown error')
    }
    finally {
      setLoggingIn(false)
    }
  }

  const confirmOtpAndFinalize = async () => {
    try {
      setVerifyingOtp(true)
      // verify via backend
      const resp = await fetch(`${OTP_SERVER_BASE}/verify-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: String(phone), otp: String(code) })
      })
      const j = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        throw new Error(j?.error || 'OTP verification failed')
      }

      // After verification, update user's deviceId
      const email = phoneToEmail(phone)
      const cred = await auth.signInWithEmailAndPassword(email, password)
      const uid = cred.user.uid

      // Check if user is blocked after signing in via OTP flow
      const userDoc = await db.collection('users').doc(uid).get()
      const userData = userDoc.exists ? (userDoc.data() as any) : {}
      if (userData?.isBlock) {
        const blockMsg = userData?.Blockmessage || 'Your account has been blocked'
        Alert.alert('Account blocked', String(blockMsg))
        try { await auth.signOut() } catch (e) { /* ignore */ }
        return
      }

      await db.collection('users').doc(uid).set({ deviceId }, { merge: true })

      // Listener to sign out if device changes elsewhere
      db.collection('users').doc(uid).onSnapshot(snap => {
        const latest = snap.data() as any
        if (latest?.deviceId && latest.deviceId !== deviceId) {
          auth.signOut()
        }
      })

      // clear saved otp timestamp
      try { await AsyncStorage.removeItem('otpRequestedAt') } catch (_) {}

      // Save FCM token for this user (only the token). Force refresh because device changed.
      try {
        await saveFcmTokenForUser(uid, true)
      } catch (e) {
        console.warn('Failed saving FCM token', e)
      }

      // save credentials locally for autofill next time
      try {
        await AsyncStorage.setItem('savedPhone', String(phone))
        await AsyncStorage.setItem('savedPassword', String(password))
      } catch (e) {
        console.warn('Failed saving credentials locally', e)
      }

      router.replace('/home')
    } catch (e: any) {
      Alert.alert('OTP verification failed', e?.message || 'Unknown error')
    } finally {
      setVerifyingOtp(false)
    }
  }

  // Request permission + register for remote messages and obtain real FCM token via react-native-firebase/messaging
  const saveFcmTokenForUser = async (uid: string, forceRefresh = false) => {
    try {
      // Register the device for remote messages (required on Android)
      try {
        await messaging().registerDeviceForRemoteMessages()
      } catch (e) {
        // ignore if already registered or running on unsupported env
      }

      // Request permission (iOS). On Android this resolves immediately.
      try {
        const authStatus = await messaging().requestPermission()
        const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED || authStatus === messaging.AuthorizationStatus.PROVISIONAL
        if (!enabled) {
          console.warn('FCM permission not granted')
          return
        }
      } catch (e) {
        // permission request may throw on older RN versions; continue
      }

      if (forceRefresh) {
        try {
          await messaging().deleteToken()
        } catch (e) {
          // ignore delete errors
        }
      }

      const token = await messaging().getToken()
      if (!token) {
        console.warn('No FCM token obtained')
        return
      }

      // Store ONLY the token under users/{uid}/fcmToken
      await db.collection('users').doc(uid).set({ fcmToken: String(token) }, { merge: true })
    } catch (err) {
      console.warn('Error obtaining/saving FCM token', err)
    }
  }

  const resendOtp = async () => {
    try {
      setSendingOtp(true)
      const resp = await fetch(`${OTP_SERVER_BASE}/send-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: String(phone) }) })
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}))
        throw new Error(j?.error || 'Failed to request OTP')
      }
      setOtpSent(true)
      const ts = Date.now(); await AsyncStorage.setItem('otpRequestedAt', String(ts)); startTimerFrom(ts)
      Alert.alert('OTP resent', 'A new OTP was sent to your phone')
    } catch (e: any) {
      Alert.alert('Resend failed', e?.message || 'Unknown error')
    } finally { setSendingOtp(false) }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
            <View style={styles.headerRow}>
              <View style={styles.headerAccent} />
              <View>
                <Text style={styles.welcome}>WELCOME TO</Text>
                <Text style={styles.appName}>Majestic Games</Text>
              </View>
            </View>

            <View style={[styles.logoWrap]}>
              <Image source={require('../assets/images/icon.png')} style={styles.logoSmall} resizeMode="contain" />
            </View>
          </Animated.View>

          <Animated.View style={[styles.formArea, { width: '92%', alignSelf: 'center', marginTop: 18, opacity: formAnim, transform: [{ translateY: formAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
            <View style={[styles.inputRow, { borderBottomColor: '#ffffff33' }]}>
              <MaterialIcons name="person" style={styles.inputIcon} size={22} />
              <View style={styles.phoneInputWrap}>
                <Text style={styles.countryCode}>+91</Text>
                <TextInput
                  placeholder="9579531855"
                  placeholderTextColor="#d1d5db"
                  value={phone && phone.startsWith('+91') ? phone.slice(3) : (phone || '')}
                  onChangeText={(t) => {
                    const digits = String(t).replace(/\D/g, '')
                    setPhone('+91' + digits)
                  }}
                  keyboardType="number-pad"
                  style={styles.input}
                />
              </View>
            </View>

            <View style={[styles.inputRow, { borderBottomColor: '#ffffff33' }]}>
              <MaterialIcons name="lock" style={styles.inputIcon} size={22} />
              <View style={styles.inputInner}>
                <TextInput
                  placeholder="Password"
                  placeholderTextColor="#d1d5db"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  style={styles.inputInnerInput}
                />
                <TouchableOpacity onPress={() => setShowPassword(s => !s)} style={styles.eyeButton}>
                  <MaterialIcons name={showPassword ? 'visibility' : 'visibility-off'} size={22} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity onPress={() => router.push('/forgot-password')} style={styles.forgotWrap}>
              <Text style={styles.forgotText}>Forgot your password ?</Text>
            </TouchableOpacity>

            {!otpSent ? (
              <>
                <TouchableOpacity
                  onPress={login}
                  disabled={sendingOtp || loggingIn}
                  style={[styles.loginBtnSmall, (sendingOtp || loggingIn) ? styles.btnDisabled : null]}
                >
                  {loggingIn ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.loginBtnTextSmall}>LOGIN</Text>
                  )}
                </TouchableOpacity>
                {sendingOtp ? <ActivityIndicator style={{ marginTop: 8 }} /> : null}
              </>
            ) : (
              <>
                <TextInput placeholder="Enter OTP" value={code} onChangeText={setCode} keyboardType="number-pad" style={styles.otpInput} />
                <TouchableOpacity onPress={confirmOtpAndFinalize} style={styles.loginBtn}><Text style={styles.loginBtnText}>Verify OTP</Text></TouchableOpacity>
                {verifyingOtp ? <ActivityIndicator style={{ marginTop: 8 }} /> : null}

                {secondsLeft > 0 ? (
                  <Text style={{ marginTop: 8, color: '#fff' }}>Resend available in {secondsLeft}s</Text>
                ) : (
                  <View style={{ marginTop: 8 }}>
                    <TouchableOpacity onPress={resendOtp}><Text style={{ color: '#fff' }}>Resend OTP</Text></TouchableOpacity>
                  </View>
                )}
              </>
            )}

            <TouchableOpacity style={[styles.registerWrap, { width: '70%' }]} onPress={() => router.replace('/register')}>
              <Text style={styles.registerText}>New user? Register</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1530', paddingHorizontal: 20, paddingTop: 42 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  headerAccent: { width: 6, height: 70, backgroundColor: '#ff4d7a', marginRight: 12, borderRadius: 3 },
  welcome: { color: '#ffffff', fontSize: 30, fontWeight: '800', letterSpacing: 1 },
  appName: { color: '#ff4d7a', fontSize: 30, fontWeight: '800', marginTop: 4, letterSpacing: 1 },
  logoWrap: { alignItems: 'center', marginTop: 80, marginBottom: 60 },
  logoSmall: { width: 130, height: 130, borderRadius: 75, backgroundColor: '#0b1f4c' },
  formArea: { marginTop: 10, paddingHorizontal: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e5e7eb44', paddingVertical: 2, marginBottom: 6 },
  inputIcon: { marginRight: 10, color: '#fff' },
  input: { flex: 1, color: '#fff', paddingVertical: 12, fontSize: 18, letterSpacing: 0.5 },
  inputInner: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  inputInnerInput: { flex: 1, color: '#fff', paddingVertical: 12, fontSize: 18 },
  eyeButton: { padding: 8, marginLeft: 6 },
  otpInput: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 8, color: '#fff', marginTop: 8},
  phoneInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  countryCode: { color: '#fff', marginRight: 2, fontWeight: '700', fontSize: 18, width: 44, textAlign: 'center' },
  forgotWrap: { alignItems: 'flex-end', marginVertical: 6 },
  forgotText: { color: '#FBBF24', fontWeight: '600', fontSize: 13 },
  loginBtn: { backgroundColor: '#ff4d7a', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 22, width: '100%' },
  loginBtnSmall: { backgroundColor: '#ff4d7a', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 26, width: '100%' },
  loginBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  loginBtnTextSmall: { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnDisabled: { opacity: 0.7 },
  registerWrap: { marginTop: 34, alignItems: 'center', backgroundColor: '#d1d5db', paddingVertical: 8, borderRadius: 6, alignSelf: 'center' },
  registerText: { color: '#ff4d7a', fontWeight: '700' },
})

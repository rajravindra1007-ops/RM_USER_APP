import AsyncStorage from '@react-native-async-storage/async-storage'
import firestoreModule from '@react-native-firebase/firestore'
import * as Device from 'expo-device'
import { useRouter } from 'expo-router'
import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { auth, db, phoneToEmail } from '../firebaseConfig'

export default function RegisterScreen() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('+91')
  const [password, setPassword] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [confirmation, setConfirmation] = useState<any | null>(null)
  const [code, setCode] = useState('')
  const [deviceId, setDeviceId] = useState<string>('')
  const [sendingOtp, setSendingOtp] = useState(false)
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const timerRef = useRef<any>(null)

  useEffect(() => {
    const id = Device.osInternalBuildId || Device.deviceName || 'unknown-device'
    setDeviceId(String(id))
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const t = await AsyncStorage.getItem('otpRequestedAt')
        if (t) {
          const ts = Number(t)
          if (!Number.isNaN(ts)) startTimerFrom(ts)
          setOtpSent(true)
        }
      } catch (e) {
        // ignore
      }
    })()

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

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

  const startPhoneVerification = async () => {
    try {
      // validate inputs before sending OTP
      if (!password || password.length < 6) {
        Alert.alert('Invalid password', 'Password must be at least 6 characters')
        return
      }
      if (!name || name.trim().length === 0) {
        Alert.alert('Invalid name', 'Please enter your full name')
        return
      }
      if (!phone || phone.trim().length < 6) {
        Alert.alert('Invalid phone', 'Please enter a valid phone number')
        return
      }

      setSendingOtp(true)
      try {
        const resp = await fetch(`${OTP_SERVER_BASE}/send-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: String(phone) }),
        })
        if (!resp.ok) {
          const json = await resp.json().catch(() => ({}))
          throw new Error(json?.error || 'Failed to request OTP')
        }
        setOtpSent(true)
        const ts = Date.now()
        await AsyncStorage.setItem('otpRequestedAt', String(ts))
        startTimerFrom(ts)
        Alert.alert('OTP sent', 'Please check your SMS for the code')
      } finally {
        setSendingOtp(false)
      }
    } catch (e: any) {
      Alert.alert('Failed to send OTP', e?.message || 'Unknown error')
    }
  }

  const completeRegistration = async () => {
    try {
      setVerifyingOtp(true)
      // call verify endpoint on backend
      const verifyResp = await fetch(`${OTP_SERVER_BASE}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: String(phone), otp: String(code) }),
      })
      const verifyJson = await verifyResp.json().catch(() => ({}))
      if (!verifyResp.ok) {
        throw new Error(verifyJson?.error || 'OTP verification failed')
      }
    } catch (e: any) {
      Alert.alert('Verification failed', e?.message || 'OTP verification failed')
      setVerifyingOtp(false)
      return
    } finally {
      setVerifyingOtp(false)
    }

    // OTP verified by backend; create email/password account using phone->email mapping
    try {
      const email = phoneToEmail(phone)
      // attempt to create new account
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

        // clear saved otp timestamp
        try { await AsyncStorage.removeItem('otpRequestedAt') } catch (_) {}

        Alert.alert('Registered', 'Account created successfully')
        router.replace('/home')
      } catch (e: any) {
        // handle email already exists
        if (e && (e.code === 'auth/email-already-in-use' || e.message?.includes('email-already-in-use'))) {
          Alert.alert('Account exists', 'An account with this phone/email already exists. Please login.')
          return
        }
        throw e
      }
    } catch (e: any) {
      Alert.alert('Registration failed', e?.message || 'Unknown error')
    }
  }

  const resendOtp = async () => {
    try {
      setSendingOtp(true)
      const resp = await fetch(`${OTP_SERVER_BASE}/send-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: String(phone) }),
      })
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
        style={styles.avoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
      >
        <View style={styles.inner}>
          <View style={styles.logoWrap}>
            <Image source={require('../assets/images/icon.png')} style={styles.logo} resizeMode="contain" />
          </View>

          <View style={styles.card}>
        <Text style={styles.title}>Register</Text>
        <Text style={styles.subtitle}>Create your RM Games account</Text>

        <TextInput
          placeholder="Full Name"
          placeholderTextColor="#9ca3af"
          value={name}
          onChangeText={setName}
          style={styles.input}
        />
        <TextInput
          placeholder="Phone (+91...)"
          placeholderTextColor="#9ca3af"
          value={phone}
          onChangeText={setPhone}
          keyboardType="number-pad"
          style={styles.input}
        />
        <TextInput
          placeholder="Password"
          placeholderTextColor="#9ca3af"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
        />

        {!otpSent ? (
          <>
            <TouchableOpacity
              style={[styles.primaryBtn, sendingOtp && styles.btnDisabled]}
              onPress={startPhoneVerification}
              disabled={sendingOtp}
              activeOpacity={0.85}
            >
              {sendingOtp ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Send OTP</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TextInput
              placeholder="Enter OTP"
              placeholderTextColor="#9ca3af"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              style={styles.input}
            />
            <TouchableOpacity
              style={[styles.primaryBtn, verifyingOtp && styles.btnDisabled, { marginTop: 14 }]}
              onPress={completeRegistration}
              disabled={verifyingOtp}
              activeOpacity={0.85}
            >
              {verifyingOtp ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Verify & Register</Text>
              )}
            </TouchableOpacity>

            {secondsLeft > 0 ? (
              <Text style={styles.resendInfo}>Resend available in {secondsLeft}s</Text>
            ) : (
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={resendOtp}
                disabled={sendingOtp}
                activeOpacity={0.85}
              >
                <Text style={styles.secondaryBtnText}>Resend OTP</Text>
              </TouchableOpacity>
            )}
          </>
        )}

          <TouchableOpacity style={styles.backToLogin} onPress={() => router.replace('/')} activeOpacity={0.85}>
            <Text style={styles.backToLoginText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1530',
  },
  avoiding: {
    flex: 1,
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 22,
  },
  logo: {
    width: 130,
    height: 130,
    borderRadius: 72,
    backgroundColor: '#0b1f4c',
  },
  card: {
    width: '92%',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 18,
    backgroundColor: '#111827',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
    marginBottom: 18,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#4b5563',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#f9fafb',
    marginTop: 10,
    fontSize: 16,
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: '#ff4d7a',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  resendInfo: {
    marginTop: 12,
    color: '#e5e7eb',
    fontSize: 14,
  },
  secondaryBtn: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#9ca3af',
  },
  secondaryBtnText: {
    color: '#e5e7eb',
    fontSize: 13,
    fontWeight: '600',
  },
  backToLogin: {
    marginTop: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
  },
  backToLoginText: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 15,
  },
})

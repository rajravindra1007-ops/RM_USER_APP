import AsyncStorage from '@react-native-async-storage/async-storage'
import firestoreModule from '@react-native-firebase/firestore'
import messaging from '@react-native-firebase/messaging'
import * as Device from 'expo-device'
import { useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { auth, db, phoneToEmail } from '../firebaseConfig'

export default function RegisterScreen() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('+91')
  const [password, setPassword] = useState('')
  const [deviceId, setDeviceId] = useState<string>('')
  const [registering, setRegistering] = useState(false)

  useEffect(() => {
    const id = Device.osInternalBuildId || Device.deviceName || 'unknown-device'
    setDeviceId(String(id))
  }, [])

  useEffect(() => {
    // no-op for now; kept if we need future side effects
  }, [])
  const handleRegister = async () => {
    // basic validation
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

        // attempt to obtain and save FCM token for this user
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
        if (e && (e.code === 'auth/email-already-in-use' || e.message?.includes('email-already-in-use'))) {
          Alert.alert('Account exists', 'An account with this phone/email already exists. Please login.')
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
        <Text style={styles.subtitle}>Create your Majestic Games account</Text>

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
          maxLength={13}
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

        <TouchableOpacity
          style={[styles.primaryBtn, registering && styles.btnDisabled]}
          onPress={handleRegister}
          disabled={registering}
          activeOpacity={0.85}
        >
          {registering ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Register</Text>
          )}
        </TouchableOpacity>

          <TouchableOpacity style={styles.backToLogin} onPress={() => router.replace('/')} activeOpacity={0.85}>
            <Text style={styles.backToLoginText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const incrementUserCollectionStats = async () => {
  try {
    const snapshot = await db.collection('userData').limit(1).get()
    const docRef = snapshot.empty ? db.collection('userData').doc('stats') : snapshot.docs[0].ref
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

// Save FCM token under users/{uid}/fcmToken (non-blocking)
const saveFcmTokenForUser = async (uid: string) => {
    try {
      try { await messaging().registerDeviceForRemoteMessages() } catch (_) {}

      try {
        const authStatus = await messaging().requestPermission()
        const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED || authStatus === messaging.AuthorizationStatus.PROVISIONAL
        if (!enabled) {
          console.warn('FCM permission not granted')
          return
        }
      } catch (_) {
        // ignore permission request errors
      }

      const token = await messaging().getToken()
      if (!token) {
        console.warn('No FCM token obtained')
        return
      }

      await db.collection('users').doc(uid).set({ fcmToken: String(token) }, { merge: true })
    } catch (err) {
      console.warn('Error obtaining/saving FCM token', err)
    }
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
    backgroundColor: '#f0156d',
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

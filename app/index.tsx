import { MaterialIcons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Device from 'expo-device'
import { useRouter } from 'expo-router'
import React, { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { auth, db, phoneToEmail } from '../firebaseConfig'
import CustomAlert from './components/CustomAlert'

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

  const logoScale = useRef(new Animated.Value(0.8)).current

  useEffect(() => {
    setDeviceId(String(Device.deviceName || 'unknown-device'))

    Animated.spring(logoScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start()
  }, [])

  const showAlert = (title: string, message: string) => {
    setAlert({
      visible: true,
      title,
      message,
    })
  }

const handlePhoneChange = (text: string) => {
  // Allow empty field
  if (text === '') {
    setPhone('')
    return
  }

  // Remove invalid characters, but preserve leading +
  let cleaned = text.replace(/[^\d+]/g, '')

  // Ensure only one + at the beginning
  if (cleaned.includes('+')) {
    cleaned = '+' + cleaned.replace(/\+/g, '')
  }

  // Limit total length (+91 + 10 digits = 13 chars)
  // if (cleaned.startsWith('+')) {
  //   cleaned = cleaned.slice(0, 13)
  // } else {
  //   cleaned = cleaned.slice(0, 12)
  // }

  setPhone(cleaned)
}

  const login = async () => {
    if (loggingIn) return

    if (phone.length !== 10) {
      showAlert(
        'Invalid Number',
        'Please enter a valid mobile number.'
      )
      return
    }

     if (phone.length < 10) {
      showAlert(
        'Invalid Number',
        'Please enter a valid mobile number.'
      )
      return
    }

    if (!password.trim()) {
      showAlert(
        'Missing Password',
        'Please enter your password.'
      )
      return
    }

    try {
      setLoggingIn(true)

      const email = phoneToEmail(phone)

      const cred = await auth.signInWithEmailAndPassword(
        email,
        password.trim()
      )

      const uid = cred.user.uid

      await Promise.all([
        db.collection('users').doc(uid).set(
          { deviceId },
          { merge: true }
        ),
        AsyncStorage.setItem('savedPhone', phone),
        AsyncStorage.setItem('savedPassword', password),
      ])

      router.replace('/home')
    } catch (e: any) {
      showAlert(
        'Login Failed',
        e?.message || 'Something went wrong. Please try again.'
      )
    } finally {
      setLoggingIn(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#0B1020"
      />

      <CustomAlert
        visible={alert.visible}
        title={alert.title}
        message={alert.message}
        onDismiss={() =>
          setAlert(prev => ({
            ...prev,
            visible: false,
          }))
        }
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <View style={styles.headerAccent} />

            <View>
              <Text style={styles.welcome}>WELCOME TO</Text>

              <Text style={styles.appName}>
                <Text style={{ color: '#FFFFFF' }}>R</Text>
                <Text style={{ color: '#FF3B30' }}>M</Text>
                <Text style={{ color: '#FFFFFF' }}> Games</Text>
              </Text>
            </View>
          </View>

          <Animated.View
            style={[
              styles.logoWrap,
              {
                transform: [{ scale: logoScale }],
              },
            ]}
          >
            <Image
              source={require('../assets/images/icon.png')}
              style={styles.logo}
            />
          </Animated.View>

          <View style={styles.inputRow}>
            <MaterialIcons
              name="phone"
              size={22}
              style={styles.icon}
            />

            <TextInput
              value={phone}
              onChangeText={handlePhoneChange}
              keyboardType="phone-pad"
              maxLength={10}
              placeholder="XXXXXXXXXX"
              placeholderTextColor="#777"
              style={styles.input}
              autoComplete="off"
              importantForAutofill="no"
              textContentType="none"
              selectionColor="#F4C430"
            />
          </View>

          <View style={styles.inputRow}>
            <MaterialIcons
              name="lock"
              size={22}
              style={styles.icon}
            />

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

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() =>
                setShowPassword(!showPassword)
              }
            >
              <MaterialIcons
                name={
                  showPassword
                    ? 'visibility'
                    : 'visibility-off'
                }
                size={22}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.loginBtn}
            onPress={login}
            disabled={loggingIn}
            activeOpacity={0.85}
          >
            {loggingIn ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text style={styles.loginText}>
                LOGIN
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.registerBtn}
            onPress={() =>
              router.push('/register')
            }
            activeOpacity={0.8}
          >
            <Text style={styles.registerText}>
              New user?{' '}
              <Text
                style={styles.registerHighlight}
              >
                Register
              </Text>
            </Text>
          </TouchableOpacity>
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
    marginVertical: 28,
  },

  logo: {
    width: 110,
    height: 110,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A2342',
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    height: 56,
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

  loginBtn: {
    backgroundColor: '#F4C430',
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },

  loginText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  registerBtn: {
    marginTop: 22,
    alignItems: 'center',
  },

  registerText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },

  registerHighlight: {
    color: '#F4C430',
    fontWeight: '900',
  },
})
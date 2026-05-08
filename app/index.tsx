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

    loadSavedLogin()
  }, [])

  // LOAD SAVED LOGIN DETAILS
  const loadSavedLogin = async () => {
    try {
      const savedPhone = await AsyncStorage.getItem('savedPhone')
      const savedPassword = await AsyncStorage.getItem('savedPassword')

      if (savedPhone) {
        setPhone(savedPhone)
      }

      if (savedPassword) {
        setPassword(savedPassword)
      }
    } catch (error) {
      console.log('Error loading saved login:', error)
    }
  }

  const showAlert = (title: string, message: string) => {
    setAlert({
      visible: true,
      title,
      message,
    })
  }

  const handlePhoneChange = (text: string) => {
    if (text === '') {
      setPhone('')
      return
    }

    let cleaned = text.replace(/[^\d+]/g, '')

    if (cleaned.includes('+')) {
      cleaned = '+' + cleaned.replace(/\+/g, '')
    }

    setPhone(cleaned)
  }

  const login = async () => {
    if (phone.length !== 10) {
      showAlert(
        'Invalid Mobile Number',
        'Please enter a valid 10-digit mobile number.'
      )
      return
    }

    if (!password.trim()) {
      showAlert(
        'Password Required',
        'Please enter your password.'
      )
      return
    }

    setLoggingIn(true)

    Animated.loop(
      Animated.timing(loaderTranslate, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      })
    ).start()

    try {
      const fullPhone = `${phone}`
      const email = phoneToEmail(fullPhone)

      const cred = await auth.signInWithEmailAndPassword(
        email,
        password
      )

      const uid = cred.user.uid

      await db.collection('users').doc(uid).set(
        { deviceId },
        { merge: true }
      )

      // SAVE LOGIN DETAILS
      await AsyncStorage.setItem('savedPhone', phone)
      await AsyncStorage.setItem('savedPassword', password)

      router.replace('/home')
    } catch (e: any) {
      showAlert(
        'Login Failed',
        e?.message || 'Something went wrong.'
      )
    } finally {
      setLoggingIn(false)
    }
  }

  const loaderTranslate = useRef(new Animated.Value(0)).current

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
              placeholder="Enter 10 digit mobile number"
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
            onPress={() => router.push('/contact')}
          >
            <Text style={styles.forgot}>
              Forgot Password?
            </Text>
          </TouchableOpacity>

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
                LOGIN...
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              marginTop: 22,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1.5,
              borderColor: '#F4C430',
              paddingVertical: 12,
              borderRadius: 12,
            }}
            onPress={() => router.push('/register')}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name="person-add"
              size={18}
              color="#F4C430"
              style={{ marginRight: 6 }}
            />

            <Text
              style={{
                color: '#F4C430',
                fontSize: 15,
                fontWeight: '900',
                letterSpacing: 0.6,
              }}
            >
              Register New User
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

  forgot: {
    color: '#fff',
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 1,
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
})
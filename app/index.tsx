
import { MaterialIcons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Device from 'expo-device'
import { useRouter } from 'expo-router'
import React, { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView, Platform, ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { auth, db, phoneToEmail } from '../firebaseConfig'


export default function LoginScreen() {
  const router = useRouter()
  const [phone, setPhone] = useState('+91')
  const [password, setPassword] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const headerAnim = useRef(new Animated.Value(0)).current
  const formAnim = useRef(new Animated.Value(0)).current
  const logoScale = useRef(new Animated.Value(0.8)).current
  const buttonScale = useRef(new Animated.Value(1)).current

  useEffect(() => {
    setDeviceId(String(Device.deviceName || 'device'))
  }, [])

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(formAnim, {
        toValue: 1,
        duration: 500,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  const login = async () => {
    setLoggingIn(true)
    try {
      const email = phoneToEmail(phone)
      const cred = await auth.signInWithEmailAndPassword(email, password)
      const uid = cred.user.uid

      await db.collection('users').doc(uid).set({ deviceId }, { merge: true })

      await AsyncStorage.setItem('savedPhone', phone)
      await AsyncStorage.setItem('savedPassword', password)

      router.replace('/home')
    } catch (e: any) {
      Alert.alert('Login failed', e?.message || '')
    } finally {
      setLoggingIn(false)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.bg} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: 40,
          }}
        >
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

            {/* HEADER */}
            <Animated.View style={{
              marginTop: 10,
              opacity: headerAnim,
              transform: [{
                translateY: headerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0]
                })
              }]
            }}>
              <View style={styles.headerRow}>
                <View style={styles.headerAccent} />
                <View>
                  <Text style={styles.welcome}>WELCOME TO</Text>
                  <Text style={styles.appName}>
                    <Text style={styles.appNameR}>R</Text>
                    <Text style={styles.appNameM}>M</Text>
                    <Text style={styles.appNameGames}> Games</Text>
                  </Text>
                </View>
              </View>
            </Animated.View>

            {/* LOGO */}
            <Animated.View style={[
              styles.logoWrap,
              { transform: [{ scale: logoScale }] }
            ]}>
              <Image
                source={require('../assets/images/icon.png')}
                style={styles.logo}
              />
            </Animated.View>

            {/* FORM */}
            <Animated.View style={{
              opacity: formAnim,
              transform: [{
                translateY: formAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0]
                })
              }]
            }}>

              {/* PHONE */}
              <View style={styles.inputRow}>
                <MaterialIcons name="person" size={22} style={styles.icon} />
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Phone Number"
                  placeholderTextColor="#aaa"
                  style={styles.input}
                />
              </View>

              {/* PASSWORD */}
              <View style={styles.inputRow}>
                <MaterialIcons name="lock" size={22} style={styles.icon} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholder="Password"
                  placeholderTextColor="#aaa"
                  style={styles.input}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <MaterialIcons
                    name={showPassword ? 'visibility' : 'visibility-off'}
                    size={22}
                    color="#fff"
                  />
                </TouchableOpacity>
              </View>

              {/* FORGOT */}
              <TouchableOpacity onPress={() => router.push('/contact')}>
                <Text style={styles.forgot}>Forgot Password?</Text>
              </TouchableOpacity>

              {/* LOGIN BUTTON */}
              <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                <TouchableOpacity
                  onPressIn={() => Animated.spring(buttonScale, { toValue: 0.95, useNativeDriver: true }).start()}
                  onPressOut={() => Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true }).start()}
                  onPress={login}
                  style={styles.loginBtn}
                >
                  {
                    loggingIn ? (
                      <View style={styles.row}>
                        <Text style={styles.loginText}>Please Wait</Text>
                        <ActivityIndicator color="#000" style={{ marginLeft: 8 }} />
                      </View>
                    ) : (
                      <Text style={styles.loginText}>LOGIN</Text>
                    )
                  }
                </TouchableOpacity>
              </Animated.View>

              <View style={styles.dividerContainer}>
                <View style={styles.divider} />
              </View>

              {/* REGISTER */}
              <TouchableOpacity
                onPress={() => router.replace('/register')}
                style={styles.registerBtn}
              >
                <MaterialIcons
                  name="person-add-alt-1"
                  size={20}
                  color={THEME.gold}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.registerText}>
                  New User? <Text style={styles.registerHighlight}>Register</Text>
                </Text>
              </TouchableOpacity>


            </Animated.View>

          </ScrollView>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}



const THEME = {
  bg: '#0B1020',
  card: '#151C36',
  gold: '#F4C430',
  goldDark: '#D4A017',
  red: '#FF3B30',
  text: '#FFFFFF',
  subText: '#9CA3AF',
  inputBg: '#1A2342',
  border: '#2A3660',
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
    paddingHorizontal: 22,
  },

  /* Header */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },

  headerAccent: {
    width: 4,
    height: 58,
    backgroundColor: THEME.red,
    borderRadius: 10,
    marginRight: 14,
  },

  welcome: {
    color: THEME.text,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  appName: {
    marginTop: 4,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 1,
  },

  appNameR: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
  },

  appNameM: {
    color: THEME.red,
    fontSize: 34,
    fontWeight: '900',
  },

  appNameGames: {
    color: THEME.text,
    fontSize: 34,
    fontWeight: '900',
  },

  /* Logo */
  logoWrap: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 35,
  },

  logo: {
    width: 105,
    height: 105,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: THEME.gold,
  },

  /* Inputs */
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.inputBg,
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    height: 54,
  },

  icon: {
    color: THEME.gold,
    marginRight: 10,
  },

  input: {
    flex: 1,
    color: THEME.text,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 0,
  },

  /* Forgot Password */
  forgot: {
    color: THEME.gold,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 24,
    marginTop: 2,
  },

  /* Login Button */
  loginBtn: {
    backgroundColor: THEME.gold,
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loginText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },

  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 26,
    marginBottom: 12,
  },

  divider: {
    flex: 1,
    height: 1,
    backgroundColor: THEME.border,
  },

  registerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 12,
  },

  registerText: {
    color: THEME.text,
    fontSize: 15,
    fontWeight: '700',
  },

  registerHighlight: {
    color: THEME.gold,
    fontWeight: '900',
  },
})


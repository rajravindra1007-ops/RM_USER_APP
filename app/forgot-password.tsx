import React, { useEffect, useState } from 'react'
import { View, Text, Alert, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'

export default function ForgotPasswordScreen() {
  const router = useRouter()
  const [phone, setPhone] = useState('+91')
  const [newPassword, setNewPassword] = useState('')
  const [resetting, setResetting] = useState(false)

  const OTP_SERVER_BASE = 'https://serverotp-iepk.onrender.com'

  useEffect(() => {
    ;(async () => {
      try {
        const last = await AsyncStorage.getItem('lastPhone')
        if (last) setPhone(last)
      } catch (e) {
        // ignore
      }
    })()
  }, [])

  // Submit new password directly (no OTP) to the same endpoint
  const resetPassword = async () => {
    try {
      setResetting(true)
      if (!phone || phone.trim().length < 6) {
        Alert.alert('Invalid phone', 'Please provide a valid phone number')
        return
      }
      if (!newPassword || newPassword.length < 6) {
        Alert.alert('Invalid password', 'Password must be at least 6 characters')
        return
      }

      const resp = await fetch(`${OTP_SERVER_BASE}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: String(phone), newPassword: String(newPassword) }),
      })

      const j = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(j?.error || 'Password reset failed')

      try {
        await AsyncStorage.setItem('savedPassword', String(newPassword))
      } catch (e) {
        // ignore storage errors
      }

      Alert.alert('Password updated', 'You can login with the new password now')
      router.replace('/')
    } catch (e: any) {
      Alert.alert('Reset failed', e?.message || 'Unknown error')
    } finally {
      setResetting(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Forgot Password</Text>
        <Text style={styles.subtitle}>Reset your password</Text>

        <View style={styles.phoneRow}>
          <Text style={styles.phoneLabel}>Phone</Text>
          <Text style={styles.phoneValue}>{phone || 'Not set (enter on Login screen)'}</Text>
        </View>

        <TextInput
          placeholder="New Password"
          placeholderTextColor="#9ca3af"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          style={styles.input}
        />
        <TouchableOpacity
          style={[styles.primaryBtn, { marginTop: 18, opacity: resetting ? 0.7 : 1 }]}
          onPress={resetPassword}
          activeOpacity={0.85}
          disabled={resetting}
        >
          {resetting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Reset Password</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.backToLogin} onPress={() => router.replace('/login')} activeOpacity={0.85}>
          <Text style={styles.backToLoginText}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1530',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '92%',
    paddingVertical: 28,
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
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 18,
    textAlign: 'center',
  },
  phoneRow: {
    width: '100%',
    marginBottom: 18,
  },
  phoneLabel: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 4,
  },
  phoneValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f9fafb',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#4b5563',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f9fafb',
    marginTop: 10,
    fontSize: 15,
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: '#ff4d7a',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  backToLogin: {
    marginTop: 22,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
  },
  backToLoginText: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 14,
  },
})

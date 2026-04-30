import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { db } from '../firebaseConfig'
import { FontAwesome, MaterialIcons } from '@expo/vector-icons'

export default function ContactScreen() {
  const [loading, setLoading] = useState(true)
  const [phoneCallNumber, setPhoneCallNumber] = useState<string | null>(null)
  const [phoneWhatsappNumber, setPhoneWhatsappNumber] = useState<string | null>(null)
  const [userPhone, setUserPhone] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const doc = await db.collection('appsetting').doc('app').get()
        if (!mounted) return
        const data = doc.exists ? (doc.data() as any) : {}
        setPhoneCallNumber(data?.phonecallNumber || null)
        setPhoneWhatsappNumber(data?.phoneWhatsappNumber || null)

        try {
          const last = await AsyncStorage.getItem('lastPhone')
          setUserPhone(last || null)
        } catch (_) {
          setUserPhone(null)
        }
      } catch (err) {
        Alert.alert('Error', 'Failed to load contact numbers')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const onCall = async () => {
    if (!phoneCallNumber) {
      Alert.alert('No number', 'Call number not configured')
      return
    }
    // keep leading + if present, remove other non-digit characters
    const sanitized = String(phoneCallNumber).replace(/[^\d+]/g, '')
    const telUrl = `tel:${sanitized}`
    try {
      await Linking.openURL(telUrl)
    } catch (err) {
      // iOS sometimes supports telprompt:
      if (Platform.OS === 'ios') {
        try {
          await Linking.openURL(`telprompt:${sanitized}`)
          return
        } catch (_) {}
      }
      Alert.alert('Error', 'Failed to start call')
    }
  }

  const onWhatsApp = async () => {
    if (!phoneWhatsappNumber) {
      Alert.alert('No number', 'WhatsApp number not configured')
      return
    }
    const numberOnly = String(phoneWhatsappNumber).replace(/\D/g, '')
    const userPart = userPhone || ''
    const message = `I want to reset my password With my phone number ${userPart}`.trim()
    const encoded = encodeURIComponent(message)

    const appUrl = `whatsapp://send?phone=${numberOnly}&text=${encoded}`
    const webUrl = `https://wa.me/${numberOnly}?text=${encoded}`

    try {
      const can = await Linking.canOpenURL(appUrl)
      if (can) {
        await Linking.openURL(appUrl)
      } else {
        await Linking.openURL(webUrl)
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to open WhatsApp')
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#ff4d7a" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <TouchableOpacity style={styles.iconWrap} onPress={onCall} activeOpacity={0.8}>
          <MaterialIcons name="call" size={48} color="#fff" />
          <Text style={styles.iconLabel}>Call</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconWrap} onPress={onWhatsApp} activeOpacity={0.8}>
          <FontAwesome name="whatsapp" size={48} color="#25D366" />
          <Text style={styles.iconLabel}>WhatsApp</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1530' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 32 },
  iconWrap: { alignItems: 'center', justifyContent: 'center', marginHorizontal: 20 },
  iconLabel: { color: '#fff', marginTop: 8, fontWeight: '700' },
})

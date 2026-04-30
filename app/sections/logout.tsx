import React, { useEffect } from 'react'
import { View, Text } from 'react-native'
import { useRouter } from 'expo-router'
import { auth } from '../../firebaseConfig'

export default function LogoutSection() {
  const router = useRouter()
  useEffect(() => {
    (async () => {
      await auth.signOut()
      router.replace('/login')
    })()
  }, [router])
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Signing out...</Text>
    </View>
  )
}

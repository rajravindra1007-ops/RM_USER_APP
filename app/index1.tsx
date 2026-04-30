import React, { useEffect } from 'react'
import { Text, View, Button, AppState, Platform } from "react-native";
import { useRouter } from "expo-router";
import messaging from '@react-native-firebase/messaging'
import * as Notifications from 'expo-notifications'

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true

    const requestPermission = async () => {
      try {
        // Ensure device is registered for remote messages
        try { await messaging().registerDeviceForRemoteMessages() } catch (_) {}

        const authStatus = await messaging().requestPermission()
        const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED || authStatus === messaging.AuthorizationStatus.PROVISIONAL
        // On Android, also ensure expo-notifications permission is requested (Android 13+)
        if (Platform.OS === 'android') {
          try {
            const existing = await Notifications.getPermissionsAsync()
            if (!existing.granted) {
              await Notifications.requestPermissionsAsync()
            }
          } catch (err) {
            // ignore expo-notifications permission errors
          }
        }

        if (!enabled) {
          console.warn('FCM permission not granted')
          return
        }

        // Create Android channel for expo-notifications so local notifications are visible
        if (Platform.OS === 'android') {
          try {
            await Notifications.setNotificationChannelAsync('default', {
              name: 'Default',
              importance: Notifications.AndroidImportance.MAX,
              sound: 'default',
            })
          } catch (err) {
            console.warn('Failed to create expo notification channel', err)
          }
        }
      } catch (err) {
        console.warn('FCM permission request failed', err)
      }
    }

    // initial attempt
    requestPermission()

    const sub = AppState.addEventListener('change', state => {
      if (!mounted) return
      if (state === 'active') requestPermission()
    })

    return () => {
      mounted = false
      try { sub.remove() } catch (_) {}
    }
  }, [])

  // Foreground message handler: runs when app is in foreground
  useEffect(() => {
    const unsub = messaging().onMessage(async msg => {
      try {
        console.log('Foreground notification:', msg)
        // Schedule a visible local notification via expo-notifications
        const title = msg?.notification?.title || msg?.data?.title || 'Notification'
        const body = msg?.notification?.body || msg?.data?.body || ''
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            sound: 'default',
          },
          trigger: null,
        })
      } catch (err) {
        console.warn('onMessage handler error', err)
      }
    })

    return () => {
      try { unsub(); } catch (_) {}
    }
  }, [])
  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: "bold" }}>Welcome</Text>
      <Button title="Register" onPress={() => router.push('/register')} />
      <Button title="Login" onPress={() => router.push('/login')} />
    </View>
  );
}
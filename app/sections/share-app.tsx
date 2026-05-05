import React, { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { db } from '../../firebaseConfig'
import useColors from '../../theme/colors'
import CustomAlert from '../components/CustomAlert'

const COLORS = {
  bg: '#11132d',
  card: '#1c1e3a',
  yellow: '#facc15',
  subText: '#8b90b8',
  white: '#ffffff',
  black: '#000000',
}

export default function ShareAppSection() {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [loading, setLoading] = useState(true)
  const [apkUrl, setApkUrl] = useState('')

  const [alertVisible, setAlertVisible] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const doc = await db.collection('appsetting').doc('app').get()
        if (!mounted) return

        if (doc.exists) {
          const data: any = doc.data()
          setApkUrl(String(data?.apkUrl ?? ''))
        }
      } catch (e) {
        console.error(e)
        setAlertVisible(true)
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    return () => { mounted = false }
  }, [])

  const normalizedUrl = (u: string) => {
    const s = (u || '').trim()
    if (!s) return ''
    if (/^https?:\/\//i.test(s)) return s.replace(/^http:\/\//i, 'https://')
    return `https://${s}`
  }

  const onShare = async () => {
    const url = normalizedUrl(apkUrl)

    if (!url) {
      setAlertVisible(true)
      return
    }

    try {
      await Share.share({ message: url, url })
    } catch (e) {
      setAlertVisible(true)
    }
  }

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color={COLORS.yellow} />
      ) : (
        <View style={styles.card}>
          <Text style={styles.title}>Share App</Text>

          <Text style={styles.subtitle}>
            Invite your friends and earn rewards
          </Text>

          <TouchableOpacity style={styles.shareBtn} onPress={onShare}>
            <Text style={styles.shareText}>Share Now</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ✅ Custom Alert */}
      <CustomAlert
        visible={alertVisible}
        title="Share Error"
        message="Unable to share or URL not available."
        onDismiss={() => setAlertVisible(false)}
        buttons={[
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setAlertVisible(false),
          },
          {
            text: 'Retry',
            style: 'confirm',
            onPress: () => {
              setAlertVisible(false)
              onShare()
            },
          },
        ]}
      />
    </View>
  )
}

const makeStyles = (_colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.bg,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },

    card: {
      width: '100%',
      backgroundColor: COLORS.card,
      borderRadius: 28,
      paddingVertical: 30,
      paddingHorizontal: 24,
      alignItems: 'center',
    },

    title: {
      fontSize: 26,
      fontWeight: '900',
      color: COLORS.white,
      marginBottom: 6,
    },

    subtitle: {
      fontSize: 14,
      color: COLORS.subText,
      textAlign: 'center',
      marginBottom: 24,
    },

    shareBtn: {
      width: '100%',
      backgroundColor: COLORS.yellow,
      paddingVertical: 16,
      borderRadius: 18,
      alignItems: 'center',
    },

    shareText: {
      color: COLORS.black,
      fontWeight: '900',
      fontSize: 16,
    },
  })
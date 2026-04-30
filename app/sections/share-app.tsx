import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Share } from 'react-native'
import useColors from '../../theme/colors'
import { db } from '../../firebaseConfig'

export default function ShareAppSection() {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [loading, setLoading] = useState(true)
  const [apkUrl, setApkUrl] = useState<string>('')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const doc = await db.collection('appsetting').doc('app').get()
        if (!mounted) return
        if (doc && doc.exists) {
          const data: any = doc.data()
          setApkUrl(String(data?.apkUrl ?? ''))
        }
      } catch (e:any) {
        console.error('share-app fetch error', e)
        Alert.alert('Error', 'Failed to load share URL')
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
    try {
      const url = normalizedUrl(apkUrl)
      if (!url) { Alert.alert('No URL', 'No apkUrl configured'); return }
      await Share.share({ message: url, url })
    } catch (e:any) {
      console.error('share error', e)
      Alert.alert('Error', 'Failed to share URL')
    }
  }

  return (
    <View style={styles.container}>
      {loading ? <ActivityIndicator color={colors.primary} /> : (
        <>
          {/* <Text style={styles.title}>Share App</Text> */}
          {/* <Text style={styles.hint}>URL:</Text> */}
          {/* <Text style={styles.urlText}>{normalizedUrl(apkUrl) || '-'}</Text> */}

          <TouchableOpacity style={styles.shareBtn} onPress={onShare}>
            <Text style={styles.shareText}>Share</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  )
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 10 },
  hint: { color: colors.muted, fontSize: 12 },
  urlText: { color: colors.primary, marginTop: 8, textAlign: 'center' },
  shareBtn: { marginTop: 20, backgroundColor: '#191b80', paddingVertical: 12, paddingHorizontal: 28, borderRadius: 8 },
  shareText: { color: '#fff', fontWeight: '800' },
})

import React, { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Modal,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import useColors from '../theme/colors'

import { getApp } from '@react-native-firebase/app'
import remoteConfig from '@react-native-firebase/remote-config'
import * as Application from 'expo-application'
import * as FileSystem from 'expo-file-system/legacy'
import * as IntentLauncher from 'expo-intent-launcher'

/**
 * Compare semantic versions (1.2.3)
 */
const compareVersion = (a: string, b: string) => {
  const pa = a.split('.').map((x) => parseInt(x, 10) || 0)
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0)

  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0
    const nb = pb[i] || 0
    if (na > nb) return 1
    if (na < nb) return -1
  }
  return 0
}

export default function UpdateManager() {
  const colors = useColors()
  const [checking, setChecking] = useState(true)
  const [show, setShow] = useState(false)
  const [apkUrl, setApkUrl] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [forced, setForced] = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    let mounted = true

    ;(async () => {
      try {
        const rc = remoteConfig(getApp())

        await rc.setConfigSettings({
          minimumFetchIntervalMillis: 60 * 1000,
        })

        await rc.setDefaults({
          minAppVersion: '0.0.0',
          minVersionCode: '1',
          apkUrl: '',
          forceUpdate: 'true',
        })

        await rc.fetchAndActivate()

        const minAppVersion = rc.getValue('minAppVersion').asString()
        const minVersionCode = Number(
          rc.getValue('minVersionCode').asString() || '0'
        )
        const url = rc.getValue('apkUrl').asString()
        const forceVal = rc.getValue('forceUpdate').asString()

        const currentVersion =
          (Application.nativeApplicationVersion as string) ||
          (Application.applicationVersion as string) ||
          '0.0.0'

        const currentVersionCode = Number(
          Application.nativeBuildVersion || 0
        )

        const needsUpdate =
          compareVersion(currentVersion, minAppVersion) < 0 ||
          currentVersionCode < minVersionCode

        if (mounted && url && needsUpdate) {
          setApkUrl(url)
          setForced(forceVal.toLowerCase() === 'true')
          setShow(true)
        }
      } catch (e) {
        console.warn('UpdateManager error:', e)
      } finally {
        if (mounted) setChecking(false)
      }
    })()

    return () => {
      mounted = false
    }
  }, [])

  const startDownload = async () => {
    if (!apkUrl || downloading) return

    try {
      setDownloading(true)
      setProgress(0)

      const dest = FileSystem.cacheDirectory + 'update.apk'

      const downloadResumable = FileSystem.createDownloadResumable(
        apkUrl,
        dest,
        {},
        (dp) => {
          if (dp.totalBytesExpectedToWrite) {
            setProgress(
              Math.round(
                (dp.totalBytesWritten / dp.totalBytesExpectedToWrite) * 100
              )
            )
          }
        }
      )

      const { uri } = await downloadResumable.downloadAsync()
      setProgress(100)

      const contentUri = await FileSystem.getContentUriAsync(uri)

      if (Platform.OS === 'android') {
        await IntentLauncher.startActivityAsync(
          'android.intent.action.VIEW',
          {
            data: contentUri,
            flags: 1,
            type: 'application/vnd.android.package-archive',
          }
        )
      } else {
        Alert.alert('Update', 'Please update from the App Store')
      }
    } catch (err) {
      console.error('Update failed:', err)
      Alert.alert('Update failed', 'Download failed. Please retry.')
      setProgress(0)
    } finally {
      setDownloading(false)
    }
  }

  if (checking || !show) return null

  return (
    <Modal visible={show} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.card }] }>
          <Text style={[styles.title, { color: colors.text }]}>Update Required</Text>
          <Text style={[styles.sub, { color: colors.muted }] }>
            A newer version of the RM Games is available now Plese Download.
          </Text>

          <View style={{ height: 16 }} />

          {!downloading ? (
            <Button title="Download & Install" onPress={startDownload} />
          ) : (
            <View style={{ width: '100%', alignItems: 'center' }}>
              <View style={[styles.progressContainer, { backgroundColor: colors.border }]}>
                <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: '#f0156d' }]} />
              </View>
              <Text style={[styles.progressText, { color: colors.text }]}>{progress}%</Text>
            </View>
          )}

          {!forced && !downloading && (
            <View style={{ marginTop: 12 }}>
              <Button title="Skip for now" onPress={() => setShow(false)} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '88%',
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
  },
  title: { fontSize: 18, fontWeight: '700' },
  sub: { marginTop: 8, color: '#444', textAlign: 'center' },
  progressContainer: {
    width: '100%',
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#eee',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressText: { marginTop: 8, fontWeight: '700' },
})

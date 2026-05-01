import { useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Image, Linking, Modal, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native'
import { WebView } from 'react-native-webview'
import { auth, db } from '../../firebaseConfig'

const CREATE_ORDER_URL = 'https://rmgames.live/api/add-money/create-add-money-order'

export default function AddMoneySection() {
  const router = useRouter()
  const [amount, setAmount] = useState('')
  const [wallet, setWallet] = useState<number>(0)
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showSuccessPopup, setShowSuccessPopup] = useState(false)

  useEffect(() => {
    const sub = auth.onAuthStateChanged(user => {
      if (!user) router.replace('/')
    })
    return () => sub()
  }, [router])

  useEffect(() => {
    const user = auth.currentUser
    if (!user) return
    try {
      const unsub = db.collection('users').doc(user.uid).onSnapshot(snap => {
        if (!snap.exists) return
        const data: any = snap.data() || {}
        const w = typeof data.wallet === 'number' ? data.wallet : Number(data.wallet || 0)
        setWallet(Number.isFinite(w) ? w : 0)
      }, err => {
        console.warn('wallet snapshot error', err)
      })
      return () => unsub()
    } catch (err) {
      console.warn('wallet listener error', err)
    }
  }, [])
const openUpiAppSafely = async (url: string, appName: string) => {
  try {
    const supported = await Linking.canOpenURL(url)

    if (!supported) {
      Alert.alert(
        `${appName} not installed`,
        `Please install ${appName} to continue payment.`
      )
      return
    }

    await Linking.openURL(url)
  } catch (err) {
    console.log('UPI open error:', err)
    Alert.alert('Unable to open payment app')
  }
}

  const startPayment = async () => {
    const amt = Number(amount)
    if (!amt || isNaN(amt) || amt <=1) {
      Alert.alert('Invalid amount', 'Minimum add amount is ₹ 1')
      return
    }
    const user = auth.currentUser
    if (!user) {
      Alert.alert('Not signed in')
      router.replace('/')
      return
    }

    try {
      setLoading(true)
      // sanitize mobile: prefer users/{uid}.phone from Firestore, strip non-digits and send last 10 digits (no +91)
      let rawMobile = user.phoneNumber || ''
      try {
        const userDoc = await db.collection('users').doc(user.uid).get()
        if (userDoc.exists) {
          const udata: any = userDoc.data() || {}
          rawMobile = String(udata.phone || udata.mobile || rawMobile)
        }
      } catch (e) {
        console.warn('failed to read user phone from firestore', e)
      }
      const digits = ('' + rawMobile).replace(/\D/g, '')
      const mobile10 = digits.length > 10 ? digits.slice(-10) : digits

      // build request payload: include mobile only when we have a 10-digit number
      const payload: any = {
        userId: user.uid,
        amount: amt,
        customer_name: user.displayName || 'User',
      }
      if (mobile10 && mobile10.length === 10) {
        payload.customer_mobile = mobile10
        payload.customer_email = user.email || `${mobile10}@userapp.com` 
      } else {
        // Avoid sending empty mobile; use email or uid-based fallback
        payload.customer_email = user.email || `${user.uid}@userapp.com`
      }

      const resp = await fetch(CREATE_ORDER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await resp.json().catch(() => ({}))

      // EKQR API returns payment_url inside data.data
      const pUrl = data?.data?.payment_url || data?.payment_url || null
      if (!pUrl) {
        console.warn('create order response', data)
        throw new Error('Failed to create payment session')
      }

      setPaymentUrl(String(pUrl))
    } catch (err: any) {
      Alert.alert('Payment error', err?.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  // WebView payment view
  if (paymentUrl) {
    return (
      <WebView
        source={{ uri: paymentUrl }}
      javaScriptEnabled
  domStorageEnabled
  originWhitelist={['*']}
  setSupportMultipleWindows={true}

  onNavigationStateChange={(navState) => {
    const url = navState.url
    if (!url) return

    console.log('Navigation change:', url)

    if (
      url.startsWith('tez://upi') ||
      url.startsWith('intent://') ||
      url.startsWith('paytmmp://') ||
      url.startsWith('phonepe://')
    ) {
      Linking.openURL(url).catch(err =>
        console.log('Failed to open UPI app', err)
      )
    }
  }}

  onShouldStartLoadWithRequest={(request) => {
  const url = request.url
  console.log('Should load:', url)

  // Paytm
  if (url.startsWith('paytmmp://')) {
    openUpiAppSafely(url, 'Paytm')
    return false
  }

  // Google Pay (tez:// is deprecated ❌)
  if (url.startsWith('tez://upi/') || url.startsWith('upi://pay')) {
    openUpiAppSafely(url, 'Google Pay')
    return false
  }

  // PhonePe / others
  if (url.startsWith('phonepe://pay') || url.startsWith('upi://')) {
    openUpiAppSafely(url, 'UPI App')
    return false
  }

  return true
}}

        onMessage={(event) => {
          try {
            const msg = JSON.parse(event.nativeEvent.data)
            setPaymentUrl(null)
            setAmount('')
            if (msg.status === 'success') {
              // show verified green tick popup instead of native alert
              setShowSuccessPopup(true)
              setTimeout(() => setShowSuccessPopup(false), 1800)
            } else if (msg.status === 'cancelled') {
              Alert.alert('Payment cancelled')
            } else {
              Alert.alert('Payment failed')
            }
          } catch (e) {
            console.warn('webview message parse error', e)
            setPaymentUrl(null)
          }
        }}
      />
    )
  }

  return (
    <View style={styles.container}>
      <Image source={require('../../assets/images/icon.png')} style={styles.logo} resizeMode="contain" />
      <Modal visible={showSuccessPopup} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setShowSuccessPopup(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.successIcon}><Text style={styles.successIconText}>✓</Text></View>
              <Text style={styles.modalTitle}>Payment successful</Text>
              <Text style={styles.modalSub}>Wallet will update shortly.</Text>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      <Text style={styles.title}>Wallet Balance</Text>
            <Text style={styles.title2}>Adding Time is 24 Hrs Open</Text>
                        <Text style={styles.title2}>Min Ammount 1 RS</Text>


      <Text style={styles.balance}>₹ {wallet}</Text>

      <TextInput
        placeholder="Enter amount"
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
        style={styles.input}
      />

      <TouchableOpacity onPress={startPayment} disabled={loading} style={styles.payButton}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.payText}>Add Money</Text>}
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#10112a', // dark theme background
  },

  logo: {
    width: 96,
    height: 96,
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 12,
  },

  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f4f6ff',
    textAlign: 'center',
    marginTop: 10,
    letterSpacing: 0.5,
  },

  title2: {
    fontSize: 15,
    fontWeight: '700',
    color: '#facc15',
    textAlign: 'center',
    marginTop: 8,
    letterSpacing: 0.3,
  },

  balance: {
    fontSize: 30,
    fontWeight: '900',
    color: '#22c55e',
    textAlign: 'center',
    marginVertical: 20,
  },

  input: {
    borderWidth: 1,
    borderColor: '#2a2d5a',
    backgroundColor: '#1e2044',
    color: '#ffffff',
    padding: 14,
    borderRadius: 12,
    fontSize: 16,
    marginTop: 10,
  },

  payButton: {
    marginTop: 20,
    backgroundColor: '#facc15',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 4,
  },

  payText: {
    color: '#111827',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.4,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalCard: {
    width: '80%',
    backgroundColor: '#1e2044',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2d5a',
  },

  successIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  successIconText: {
    color: '#ffffff',
    fontSize: 38,
    fontWeight: '900',
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f4f6ff',
    marginBottom: 8,
  },

  modalSub: {
    fontSize: 14,
    color: '#cbd5e1',
    textAlign: 'center',
  },
})

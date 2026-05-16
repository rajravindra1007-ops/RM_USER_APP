import { useRouter } from 'expo-router'
import React, { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native'

import { auth, db } from '../../firebaseConfig'
import CustomAlert from '../components/CustomAlert'

const CREATE_ORDER_URL =
  'https://api.rmgames.live/api/add-money/create-add-money-order'

function PaytmLogo() {
  return (
    <Text style={{ color: '#00BAF2', fontWeight: '900', fontSize: 15 }}>
      Paytm
    </Text>
  )
}

function ProceedLogo() {
  return (
    <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>
      Proceed To Pay
    </Text>
  )
}

function useAlert() {
  const [alertState, setAlertState] = useState<any>({
    visible: false,
  })

  const showAlert = (
    title: string,
    message?: string,
    buttons?: any[],
  ) => {
    setAlertState({
      visible: true,
      title,
      message,
      buttons,
    })
  }

  const dismiss = () => {
    setAlertState((prev: any) => ({
      ...prev,
      visible: false,
    }))
  }

  return {
    alertState,
    showAlert,
    dismiss,
  }
}

export default function AddMoneySection() {
  const router = useRouter()

  const [amount, setAmount] = useState('')
  const [wallet, setWallet] = useState<number>(0)
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showSuccessPopup, setShowSuccessPopup] = useState(false)
  const [showFailedPopup, setShowFailedPopup] = useState(false)
  const [upiLinks, setUpiLinks] = useState<any>(null)

  const pulseAnim = useRef(new Animated.Value(1)).current
  const shineAnim = useRef(new Animated.Value(-160)).current

  const { alertState, showAlert, dismiss } = useAlert()

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.04,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start()

    Animated.loop(
      Animated.sequence([
        Animated.timing(shineAnim, {
          toValue: 380,
          duration: 2400,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    ).start()
  }, [])

  useEffect(() => {
    const sub = auth.onAuthStateChanged((user) => {
      if (!user) router.replace('/')
    })
    return () => sub()
  }, [router])

  // ── Real-time wallet balance via Firestore onSnapshot ──────────────────────
  useEffect(() => {
    const user = auth.currentUser
    if (!user) return

    const unsub = db
      .collection('users')
      .doc(user.uid)
      .onSnapshot(
        (snap) => {
          if (!snap.exists) return
          const data: any = snap.data() || {}
          const w =
            typeof data.wallet === 'number'
              ? data.wallet
              : Number(data.wallet || 0)
          setWallet(Number.isFinite(w) ? w : 0)
        },
        (error) => {
          console.error('Wallet snapshot error:', error)
        }
      )

    return () => unsub()
  }, [])

  const quickAmounts = [300, 500, 1000, 2000]

  const resetPayment = () => {
    setPaymentUrl(null)
    setUpiLinks(null)
  }

  const startPayment = async () => {
    const amt = Number(amount)

    if (!amt || isNaN(amt) || amt < 300) {
      showAlert(
        'Invalid Amount',
        'Minimum add amount is ₹300',
        [{ text: 'OK', style: 'confirm', onPress: dismiss }]
      )
      return
    }

    const user = auth.currentUser
    if (!user) { router.replace('/'); return }

    try {
      setLoading(true)

      let rawMobile = ''
      try {
        const userDoc = await db.collection('users').doc(user.uid).get()
        if (userDoc.exists) {
          const udata: any = userDoc.data() || {}
          rawMobile = String(udata.phone || udata.mobile || '')
        }
      } catch { }

      const digits = ('' + rawMobile).replace(/\D/g, '')
      const mobile10 = digits.length > 10 ? digits.slice(-10) : digits

      const payload: any = {
        userId: user.uid,
        amount: amt,
        customer_name: user.displayName || 'User',
      }

      if (mobile10.length === 10) {
        payload.customer_mobile = mobile10
        payload.customer_email = user.email || `${mobile10}@userapp.com`
      } else {
        payload.customer_email = user.email || `${user.uid}@userapp.com`
      }

      console.log('CREATE ORDER PAYLOAD', JSON.stringify(payload, null, 2))

      const resp = await fetch(CREATE_ORDER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await resp.json()

      console.log('PAYMENT RESPONSE', JSON.stringify(data, null, 2))

      if (!data?.status) {
        throw new Error(data?.message || 'Failed to create order')
      }

      const result = data?.result || {}
      const pUrl = result?.payment_url || null

      if (!pUrl) throw new Error('Payment URL not found')

      setPaymentUrl(pUrl)
      setUpiLinks({
        paytm: result?.paytm_link || '',
        orderId: result?.orderId || '',
      })

    } catch (err: any) {
      showAlert(
        'Payment Error',
        err?.message || 'Failed',
        [{ text: 'OK', style: 'confirm', onPress: dismiss }]
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: '#0e0f26' }}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        <CustomAlert
          visible={alertState.visible}
          title={alertState.title}
          message={alertState.message}
          onDismiss={dismiss}
          buttons={alertState.buttons}
        />

        <View style={styles.walletCard}>
          <Image
            source={require('../../assets/images/icon.png')}
            style={styles.logo}
          />
          <Text style={styles.walletLabel}>WALLET BALANCE</Text>
          <Animated.Text
            style={[styles.balance, { transform: [{ scale: pulseAnim }] }]}
          >
            ₹ {wallet}
          </Animated.Text>
        </View>

        <View style={styles.inputWrap}>
          <Text style={styles.inputPrefix}>₹</Text>
          <TextInput
            placeholder="Enter amount"
            placeholderTextColor="#4a5068"
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
            style={styles.input}
          />
        </View>

        <View style={styles.chipContainer}>
          {quickAmounts.map(val => (
            <TouchableOpacity
              key={val}
              style={styles.chip}
              onPress={() => setAmount(String(val))}
            >
              <Text style={styles.chipText}>₹ {val}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Add Money button OR payment buttons — never both */}
        {!paymentUrl ? (
          <TouchableOpacity
            onPress={startPayment}
            disabled={loading}
            style={styles.payButton}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                styles.btnShine,
                { transform: [{ translateX: shineAnim }] },
              ]}
            />
            {loading ? (
              <ActivityIndicator color="#111827" />
            ) : (
              <Text style={styles.payText}>Add Money</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.upiButtonsContainer}>

            {!!upiLinks?.paytm && (
              <TouchableOpacity
                style={styles.upiBtn}
                onPress={() => Linking.openURL(upiLinks.paytm)}
              >
                <PaytmLogo />
              </TouchableOpacity>
            )}

            {!!paymentUrl && (
              <TouchableOpacity
                style={styles.upiBtn}
                onPress={() => Linking.openURL(paymentUrl)}
              >
                <ProceedLogo />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.upiBtn, { width: '100%' }]}
              onPress={resetPayment}
            >
              <Text style={{ color: '#6b7498', fontWeight: '700', fontSize: 14 }}>
                ← Change Amount
              </Text>
            </TouchableOpacity>

          </View>
        )}

        {/* SUCCESS POPUP */}
        <Modal visible={showSuccessPopup} transparent animationType="fade">
          <TouchableWithoutFeedback onPress={() => setShowSuccessPopup(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <Text style={styles.successText}>Payment Successful</Text>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* FAILED POPUP */}
        <Modal visible={showFailedPopup} transparent animationType="fade">
          <TouchableWithoutFeedback onPress={() => setShowFailedPopup(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <Text style={styles.failedText}>Payment Failed</Text>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({

  container: {
    padding: 20,
    paddingBottom: 40,
  },

  chipContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },

  chip: {
    backgroundColor: '#1f2937',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },

  chipText: {
    color: '#fff',
    fontWeight: '700',
  },

  walletCard: {
    backgroundColor: '#13152c',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },

  logo: {
    width: 70,
    height: 70,
    marginBottom: 10,
  },

  walletLabel: {
    color: '#6b7498',
    fontWeight: '700',
    fontSize: 12,
  },

  balance: {
    color: '#22c55e',
    fontSize: 34,
    fontWeight: '900',
    marginTop: 6,
  },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#13152c',
    borderRadius: 14,
    paddingHorizontal: 18,
    marginBottom: 18,
  },

  inputPrefix: {
    color: '#facc15',
    fontSize: 22,
    fontWeight: '900',
    marginRight: 10,
  },

  input: {
    flex: 1,
    color: '#fff',
    fontSize: 20,
    paddingVertical: 16,
  },

  payButton: {
    backgroundColor: '#facc15',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    overflow: 'hidden',
  },

  btnShine: {
    position: 'absolute',
    width: 60,
    height: 100,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  payText: {
    color: '#111827',
    fontWeight: '900',
    fontSize: 18,
  },

  upiButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },

  upiBtn: {
    width: '48%',
    height: 56,
    borderRadius: 14,
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalCard: {
    width: '75%',
    backgroundColor: '#13152c',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },

  successText: {
    color: '#22c55e',
    fontSize: 22,
    fontWeight: '900',
  },

  failedText: {
    color: '#ef4444',
    fontSize: 22,
    fontWeight: '900',
  },
})

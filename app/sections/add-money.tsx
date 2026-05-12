import { useRouter } from 'expo-router'
import React, { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native'

import Svg, { Path, Rect } from 'react-native-svg'
import { WebView } from 'react-native-webview'
import { auth, db } from '../../firebaseConfig'
import CustomAlert from '../components/CustomAlert'

const CREATE_ORDER_URL =
  'https://api.rmgames.live/api/add-money/create-add-money-order'

function GPayLogo() {
  return (
    <Svg width={58} height={24} viewBox="0 0 58 24">
      <Path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0Z" fill="#fff" />
      <Path d="M12 4.8A7.2 7.2 0 1 0 12 19.2 7.2 7.2 0 0 0 12 4.8Z" fill="#fff" />
      <Path d="M19.6 12.2c0-.5 0-.9-.1-1.3H12v2.5h4.3a3.7 3.7 0 0 1-1.6 2.4v2h2.6c1.5-1.4 2.3-3.4 2.3-5.6Z" fill="#4285F4" />
      <Path d="M12 20c2.2 0 4-.7 5.3-2l-2.6-2a4.5 4.5 0 0 1-6.7-2.4H5.4v2C6.7 18.1 9.2 20 12 20Z" fill="#34A853" />
      <Path d="M8 13.6A4.6 4.6 0 0 1 8 10.4V8.4H5.4A8 8 0 0 0 4 12c0 1.3.3 2.5.8 3.6L8 13.6Z" fill="#FBBC04" />
      <Path d="M12 7.6c1.2 0 2.3.4 3.2 1.2l2.4-2.4A8 8 0 0 0 5.4 8.4L8 10.4A4.7 4.7 0 0 1 12 7.6Z" fill="#EA4335" />
    </Svg>
  )
}

function PhonePeLogo() {
  return (
    <Svg width={24} height={24} viewBox="0 0 100 100">
      <Rect width="100" height="100" rx="20" fill="#5f259f" />
      <Path d="M28 18h26c13 0 21 8.5 21 20s-8 20-21 20H44v18l-16 7V18Zm16 11v18h10c6 0 9-3.6 9-9s-3-9-9-9H44Z" fill="#fff" />
    </Svg>
  )
}

function PaytmLogo() {
  return (
    <Text style={{ color: '#00BAF2', fontWeight: '900', fontSize: 15 }}>
      Paytm
    </Text>
  )
}

function BhimLogo() {
  return (
    <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>
      BHIM
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

  const [paymentUrl, setPaymentUrl] =
    useState<string | null>(null)

  const [loading, setLoading] = useState(false)

  const [showSuccessPopup, setShowSuccessPopup] =
    useState(false)

  const [showFailedPopup, setShowFailedPopup] =
    useState(false)

  const [upiLinks, setUpiLinks] = useState<any>(null)

  const pulseAnim = useRef(
    new Animated.Value(1)
  ).current

  const shineAnim = useRef(
    new Animated.Value(-160)
  ).current

  const { alertState, showAlert, dismiss } =
    useAlert()

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
    const sub = auth.onAuthStateChanged(
      (user) => {
        if (!user) router.replace('/')
      }
    )

    return () => sub()
  }, [router])

  useEffect(() => {
    const user = auth.currentUser

    if (!user) return

    const unsub = db
      .collection('users')
      .doc(user.uid)
      .onSnapshot((snap) => {
        if (!snap.exists) return

        const data: any = snap.data() || {}

        const w =
          typeof data.wallet === 'number'
            ? data.wallet
            : Number(data.wallet || 0)

        setWallet(
          Number.isFinite(w) ? w : 0
        )
      })

    return () => unsub()
  }, [])

  const openUpiAppSafely = async (
    url: string,
    appName: string
  ) => {
    try {
      const supported =
        await Linking.canOpenURL(url)

      if (!supported) {
        showAlert(
          `${appName} not installed`,
          `Please install ${appName}`,
          [
            {
              text: 'OK',
              style: 'confirm',
              onPress: dismiss,
            },
          ]
        )
        return
      }

      await Linking.openURL(url)
    } catch {
      showAlert(
        'Error',
        'Unable to open payment app',
        [
          {
            text: 'OK',
            style: 'confirm',
            onPress: dismiss,
          },
        ]
      )
    }
  }
 const quickAmounts = [300, 500, 1000, 2000]
  const startPayment = async () => {
    const amt = Number(amount)

    if (!amt || isNaN(amt) || amt < 1) {
      showAlert(
        'Invalid Amount',
        'Minimum add amount is ₹300',
        [
          {
            text: 'OK',
            style: 'confirm',
            onPress: dismiss,
          },
        ]
      )

      return
    }

    const user = auth.currentUser

    if (!user) {
      router.replace('/')
      return
    }

    try {
      setLoading(true)

      let rawMobile = ''

      try {
        const userDoc = await db
          .collection('users')
          .doc(user.uid)
          .get()

        if (userDoc.exists) {
          const udata: any =
            userDoc.data() || {}

          rawMobile = String(
            udata.phone ||
              udata.mobile ||
              ''
          )
        }
      } catch {}

      const digits = (
        '' + rawMobile
      ).replace(/\D/g, '')

      const mobile10 =
        digits.length > 10
          ? digits.slice(-10)
          : digits

      const payload: any = {
        userId: user.uid,
        amount: amt,
        customer_name:
          user.displayName || 'User',
      }

      if (mobile10.length === 10) {
        payload.customer_mobile =
          mobile10

        payload.customer_email =
          user.email ||
          `${mobile10}@userapp.com`
      } else {
        payload.customer_email =
          user.email ||
          `${user.uid}@userapp.com`
      }

      const resp = await fetch(
        CREATE_ORDER_URL,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify(payload),
        }
      )

      const data = await resp.json()

      console.log(
        'PAYMENT RESPONSE',
        JSON.stringify(data, null, 2)
      )

      const pUrl =
        data?.data?.payment_url ||
        null

      const intents =
        data?.data?.upi_intent || {}

      if (!pUrl) {
        throw new Error(
          'Payment URL not found'
        )
      }

      setPaymentUrl(pUrl)

      setUpiLinks({
        gpay:
          intents?.gpay_link || '',
        phonepe:
          intents?.phonepe_link || '',
        paytm:
          intents?.paytm_link || '',
        bhim:
          intents?.bhim_link || '',
      })
    } catch (err: any) {
      showAlert(
        'Payment Error',
        err?.message || 'Failed',
        [
          {
            text: 'OK',
            style: 'confirm',
            onPress: dismiss,
          },
        ]
      )
    } finally {
      setLoading(false)
    }
  }

  if (paymentUrl) {
    return (
      <View style={{ flex: 1 }}>

        <WebView
          source={{ uri: paymentUrl }}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
          setSupportMultipleWindows={true}
          style={{ flex: 1 }}
        />

        <View style={styles.upiButtonsContainer}>

          {!!upiLinks?.gpay && (
            <TouchableOpacity
              style={styles.upiBtn}
              onPress={() =>
                openUpiAppSafely(
                  upiLinks.gpay,
                  'Google Pay'
                )
              }
            >
              <GPayLogo />
            </TouchableOpacity>
          )}

          {!!upiLinks?.phonepe && (
            <TouchableOpacity
              style={styles.upiBtn}
              onPress={() =>
                openUpiAppSafely(
                  upiLinks.phonepe,
                  'PhonePe'
                )
              }
            >
              <PhonePeLogo />
            </TouchableOpacity>
          )}

          {!!upiLinks?.paytm && (
            <TouchableOpacity
              style={styles.upiBtn}
              onPress={() =>
                openUpiAppSafely(
                  upiLinks.paytm,
                  'Paytm'
                )
              }
            >
              <PaytmLogo />
            </TouchableOpacity>
          )}

          {!!upiLinks?.bhim && (
            <TouchableOpacity
              style={styles.upiBtn}
              onPress={() =>
                openUpiAppSafely(
                  upiLinks.bhim,
                  'BHIM'
                )
              }
            >
              <BhimLogo />
            </TouchableOpacity>
          )}
        </View>

        {/* SUCCESS POPUP */}
        <Modal
          visible={showSuccessPopup}
          transparent
          animationType="fade"
        >
          <TouchableWithoutFeedback
            onPress={() =>
              setShowSuccessPopup(false)
            }
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <Text style={styles.successText}>
                  Payment Successful
                </Text>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* FAILED POPUP */}
        <Modal
          visible={showFailedPopup}
          transparent
          animationType="fade"
        >
          <TouchableWithoutFeedback
            onPress={() =>
              setShowFailedPopup(false)
            }
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <Text style={styles.failedText}>
                  Payment Failed
                </Text>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </View>
    )
  }

  return (
    <View style={styles.container}>

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

        <Text style={styles.walletLabel}>
          WALLET BALANCE
        </Text>

        <Animated.Text
          style={[
            styles.balance,
            {
              transform: [
                { scale: pulseAnim },
              ],
            },
          ]}
        >
          ₹ {wallet}
        </Animated.Text>
      </View>

      <View style={styles.inputWrap}>
        <Text style={styles.inputPrefix}>
          ₹
        </Text>

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

      <TouchableOpacity
        onPress={startPayment}
        disabled={loading}
        style={styles.payButton}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.btnShine,
            {
              transform: [
                {
                  translateX:
                    shineAnim,
                },
              ],
            },
          ]}
        />

        

        {loading ? (
          <ActivityIndicator color="#111827" />
        ) : (
          <Text style={styles.payText}>
            Add Money
          </Text>
        )}
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({

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
  container: {
    flex: 1,
    backgroundColor: '#0e0f26',
    padding: 20,
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
    backgroundColor:
      'rgba(255,255,255,0.2)',
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
    padding: 14,
    backgroundColor: '#111827',
  },

  upiBtn: {
    width: '48%',
    height: 56,
    borderRadius: 14,
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor:
      'rgba(0,0,0,0.7)',
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
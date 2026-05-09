import { useRouter } from 'expo-router'
import React, { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
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

const CREATE_ORDER_URL = 'https://api.rmgames.live/api/add-money/create-add-money-order'

// ─── Google Pay SVG logo (official brand colours) ─────────────────────────────
function GPayLogo() {
  return (
    <Svg width={58} height={24} viewBox="0 0 58 24">
      {/* "G" lettermark */}
      <Path
        d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0Z"
        fill="#fff"
      />
      <Path
        d="M12 4.8A7.2 7.2 0 1 0 12 19.2 7.2 7.2 0 0 0 12 4.8Z"
        fill="#fff"
      />
      {/* G shape */}
      <Path
        d="M19.6 12.2c0-.5 0-.9-.1-1.3H12v2.5h4.3a3.7 3.7 0 0 1-1.6 2.4v2h2.6c1.5-1.4 2.3-3.4 2.3-5.6Z"
        fill="#4285F4"
      />
      <Path
        d="M12 20c2.2 0 4-.7 5.3-2l-2.6-2a4.5 4.5 0 0 1-6.7-2.4H5.4v2C6.7 18.1 9.2 20 12 20Z"
        fill="#34A853"
      />
      <Path
        d="M8 13.6A4.6 4.6 0 0 1 8 10.4V8.4H5.4A8 8 0 0 0 4 12c0 1.3.3 2.5.8 3.6L8 13.6Z"
        fill="#FBBC04"
      />
      <Path
        d="M12 7.6c1.2 0 2.3.4 3.2 1.2l2.4-2.4A8 8 0 0 0 5.4 8.4L8 10.4A4.7 4.7 0 0 1 12 7.6Z"
        fill="#EA4335"
      />
      {/* "Pay" wordmark */}
      <Path
        d="M26.4 7.2h3.2c1.9 0 3 1 3 2.7 0 1.7-1.1 2.7-3 2.7h-1.7v3H26.4V7.2Zm1.5 4.1h1.5c1 0 1.6-.5 1.6-1.4 0-.9-.6-1.4-1.6-1.4h-1.5v2.8Z"
        fill="#fff"
      />
      <Path
        d="M35.2 9.4c1.6 0 2.8.9 2.8 2.9v3.4H36.6v-.8c-.4.6-1 1-1.9 1-1.2 0-2.1-.7-2.1-1.8 0-1.1.9-1.8 2.3-1.8.6 0 1.1.1 1.5.4v-.3c0-.8-.5-1.3-1.4-1.3-.6 0-1.1.2-1.5.5l-.5-1c.6-.5 1.4-.8 2.2-.8Zm.3 4.8c.7 0 1.2-.5 1.2-1.1-.3-.2-.8-.3-1.3-.3-.8 0-1.2.3-1.2.8s.4.6 1.3.6Z"
        fill="#fff"
      />
      <Path
        d="M39 9.5h1.6l1.6 4.4 1.6-4.4H45.4l-2.8 7.4c-.4 1.1-1.1 1.7-2.1 1.7-.4 0-.8-.1-1.1-.2l.3-1.2c.2.1.4.1.6.1.5 0 .8-.2 1-.7l.2-.5L39 9.5Z"
        fill="#fff"
      />
    </Svg>
  )
}

// ─── PhonePe SVG logo (official purple + P mark) ─────────────────────────────
function PhonePeLogo() {
  return (
    <Svg width={24} height={24} viewBox="0 0 100 100">
      <Rect width="100" height="100" rx="20" fill="#5f259f" />
      {/* P letterform */}
      <Path
        d="M28 18h26c13 0 21 8.5 21 20s-8 20-21 20H44v18l-16 7V18Zm16 11v18h10c6 0 9-3.6 9-9s-3-9-9-9H44Z"
        fill="#fff"
      />
    </Svg>
  )
}

// ─── UPI official logo ────────────────────────────────────────────────────────
function UpiLogo() {
  return (
    <Svg width={44} height={20} viewBox="0 0 110 44">
      <Rect width="110" height="44" rx="6" fill="#fff" />
      {/* left arrow */}
      <Path d="M12 8l9 26M21 8l-9 26" stroke="#097939" strokeWidth="5.5" strokeLinecap="round" />
      {/* right arrow */}
      <Path d="M32 8l9 26M41 8l-9 26" stroke="#ed752e" strokeWidth="5.5" strokeLinecap="round" />
      {/* U */}
      <Path d="M52 8v18c0 6 4 10 10 10s10-4 10-10V8" stroke="#097939" strokeWidth="5" strokeLinecap="round" fill="none" />
      {/* P */}
      <Path d="M76 8h11c4 0 7 3 7 7s-3 7-7 7H79v14" stroke="#097939" strokeWidth="5" strokeLinecap="round" fill="none" />
      <Path d="M79 15h8c1.5 0 2.5.9 2.5 2.5S88.5 20 87 20h-8" stroke="#097939" strokeWidth="4" strokeLinecap="round" fill="none" />
      {/* I */}
      <Path d="M100 8v28" stroke="#097939" strokeWidth="5" strokeLinecap="round" />
    </Svg>
  )
}

// ─── Custom alert hook ────────────────────────────────────────────────────────
function useAlert() {
  const [alertState, setAlertState] = useState<{
    visible: boolean
    title?: string
    message?: string
    buttons?: { text: string; style?: 'cancel' | 'confirm'; onPress?: () => void }[]
  }>({ visible: false })

  const showAlert = (
    title: string,
    message?: string,
    buttons?: { text: string; style?: 'cancel' | 'confirm'; onPress?: () => void }[],
  ) => setAlertState({ visible: true, title, message, buttons })

  const dismiss = () => setAlertState(prev => ({ ...prev, visible: false }))

  return { alertState, showAlert, dismiss }
}

// ─── Quick-add chip ────────────────────────────────────────────────────────────
function QuickChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.chip} onPress={onPress} activeOpacity={0.72}>
      <Text style={styles.chipText}>{label}</Text>
    </TouchableOpacity>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function AddMoneySection() {
  const router = useRouter()
  const [amount, setAmount] = useState('')
  const [wallet, setWallet] = useState<number>(0)
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showSuccessPopup, setShowSuccessPopup] = useState(false)
  const pulseAnim = useRef(new Animated.Value(1)).current
  const { alertState, showAlert, dismiss } = useAlert()

  // gentle balance pulse
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.045, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
      ]),
    ).start()
  }, [])

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
      const unsub = db.collection('users').doc(user.uid).onSnapshot(
        snap => {
          if (!snap.exists) return
          const data: any = snap.data() || {}
          const w = typeof data.wallet === 'number' ? data.wallet : Number(data.wallet || 0)
          setWallet(Number.isFinite(w) ? w : 0)
        },
        err => console.warn('wallet snapshot error', err),
      )
      return () => unsub()
    } catch (err) {
      console.warn('wallet listener error', err)
    }
  }, [])

  const openUpiAppSafely = async (url: string, appName: string) => {
    try {
      const supported = await Linking.canOpenURL(url)
      if (!supported) {
        showAlert(`${appName} not installed`, `Please install ${appName} to continue.`, [
          { text: 'OK', style: 'confirm', onPress: dismiss },
        ])
        return
      }
      await Linking.openURL(url)
    } catch (err) {
      console.log('UPI open error:', err)
      showAlert('Error', 'Unable to open payment app', [
        { text: 'OK', style: 'confirm', onPress: dismiss },
      ])
    }
  }

  const startPayment = async () => {
    const amt = Number(amount)
    if (!amt || isNaN(amt) || amt <= 1) {
      showAlert('Invalid Amount', 'Minimum add amount is ₹ 1', [
        { text: 'OK', style: 'confirm', onPress: dismiss },
      ])
      return
    }
    const user = auth.currentUser
    if (!user) {
      showAlert('Not Signed In', undefined, [
        {
          text: 'OK', style: 'confirm',
          onPress: () => { dismiss(); router.replace('/') },
        },
      ])
      return
    }

    try {
      setLoading(true)
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

      const payload: any = {
        userId: user.uid,
        amount: amt,
        customer_name: user.displayName || 'User',
      }
      if (mobile10 && mobile10.length === 10) {
        payload.customer_mobile = mobile10
        payload.customer_email = user.email || `${mobile10}@userapp.com`
      } else {
        payload.customer_email = user.email || `${user.uid}@userapp.com`
      }

      const resp = await fetch(CREATE_ORDER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await resp.json().catch(() => ({}))
      const pUrl = data?.data?.payment_url || data?.payment_url || null
      if (!pUrl) {
        console.warn('create order response', data)
        throw new Error('Failed to create payment session')
      }
      setPaymentUrl(String(pUrl))
    } catch (err: any) {
      showAlert('Payment Error', err?.message || String(err), [
        { text: 'OK', style: 'confirm', onPress: dismiss },
      ])
    } finally {
      setLoading(false)
    }
  }

  // ─── WebView ───────────────────────────────────────────────────────────────
  if (paymentUrl) {
    return (
      <WebView
        source={{ uri: paymentUrl }}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        setSupportMultipleWindows={true}
        onNavigationStateChange={navState => {
          const url = navState.url
          if (!url) return
          if (
            url.startsWith('tez://upi') ||
            url.startsWith('intent://') ||
            url.startsWith('paytmmp://') ||
            url.startsWith('phonepe://')
          ) {
            Linking.openURL(url).catch(err => console.log('Failed to open UPI app', err))
          }
        }}
        onShouldStartLoadWithRequest={request => {
          const url = request.url
          if (url.startsWith('paytmmp://')) { openUpiAppSafely(url, 'Paytm'); return false }
          if (url.startsWith('tez://upi/') || url.startsWith('upi://pay')) { openUpiAppSafely(url, 'Google Pay'); return false }
          if (url.startsWith('phonepe://pay') || url.startsWith('upi://')) { openUpiAppSafely(url, 'UPI App'); return false }
          return true
        }}
        onMessage={event => {
          try {
            const msg = JSON.parse(event.nativeEvent.data)
            setPaymentUrl(null)
            setAmount('')
            if (msg.status === 'success') {
              setShowSuccessPopup(true)
              setTimeout(() => setShowSuccessPopup(false), 1800)
            } else if (msg.status === 'cancelled') {
              showAlert('Payment Cancelled', undefined, [{ text: 'OK', style: 'confirm', onPress: dismiss }])
            } else {
              showAlert('Payment Failed', undefined, [{ text: 'OK', style: 'confirm', onPress: dismiss }])
            }
          } catch (e) {
            console.warn('webview message parse error', e)
            setPaymentUrl(null)
          }
        }}
      />
    )
  }

  // ─── Main UI ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      <CustomAlert
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        onDismiss={dismiss}
        buttons={alertState.buttons}
      />

      {/* Success modal */}
      <Modal visible={showSuccessPopup} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setShowSuccessPopup(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.successRing}>
                <View style={styles.successIcon}>
                  <Text style={styles.successIconText}>✓</Text>
                </View>
              </View>
              <Text style={styles.modalTitle}>Payment Successful!</Text>
              <Text style={styles.modalSub}>Your wallet will be updated shortly.</Text>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Logo */}
      <View style={styles.logoWrap}>
        <View style={styles.logoShadow}>
          <Image
            source={require('../../assets/images/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
      </View>

      {/* Wallet card */}
      <View style={styles.walletCard}>
        <View  />
        <Text style={styles.walletLabel}>WALLET BALANCE</Text>
        <Animated.Text style={[styles.balance, { transform: [{ scale: pulseAnim }] }]}>
          ₹ {wallet.toLocaleString('en-IN')}
        </Animated.Text>
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>🕐  24 Hrs Open</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Min ₹ 1</Text>
          </View>
        </View>
      </View>

      {/* Amount input */}
      <View style={styles.inputWrap}>
        <Text style={styles.inputPrefix}>₹</Text>
        <TextInput
          placeholder="Enter amount"
          placeholderTextColor="#fff"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
          style={styles.input}
        />
      </View>

      {/* Quick-add chips */}
      <View style={styles.chipRow}>
        {['100', '200', '500', '1000'].map(v => (
          <QuickChip key={v} label={`+₹${v}`} onPress={() => setAmount(v)} />
        ))}
      </View>

      {/* Add Money button */}
      <TouchableOpacity
        onPress={startPayment}
        disabled={loading}
        style={[styles.payButton, loading && styles.payButtonDisabled]}
        activeOpacity={0.85}
      >
        {loading ? (
          <View style={styles.btnInner}>
            <ActivityIndicator color="#111827" size="small" style={{ marginRight: 8 }} />
            <Text style={styles.payText}>Processing…</Text>
          </View>
        ) : (
          <Text style={styles.payText}>Add Money</Text>
        )}
      </TouchableOpacity>

      {/* Secure badge */}
      <Text style={styles.secureNote}>🔒  Payments are 100% secure & encrypted</Text>

      {/* Accepted via divider */}
      <View style={styles.acceptedSection}>
        <View style={styles.dividerLine} />
        <Text style={styles.acceptedLabel}>ACCEPTED VIA</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* UPI logo row */}
      <View style={styles.upiRow}>
        {/* GPay chip */}
        <View style={[styles.upiChip, styles.gpayChip]}>
          <GPayLogo />
        </View>

        {/* PhonePe chip */}
        <View style={[styles.upiChip, styles.phonePeChip]}>
          <PhonePeLogo />
          <Text style={styles.ppLabel}>PhonePe</Text>
        </View>

       
      </View>

    </View>
  )
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const CARD_BG = '#14162e'
const BORDER = '#22264a'
const PRIMARY = '#facc15'
const GREEN = '#22c55e'
const MUTED = '#505580'

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#10112a',
    paddingHorizontal: 18,
    paddingBottom: 28,
  },

  logoWrap: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 4,
  },
  logoShadow: {
    borderRadius: 18,
    shadowColor: PRIMARY,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 18,
  },

  walletCard: {
    marginTop: 18,
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
    shadowColor: GREEN,
    shadowOpacity: 0.07,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  glowBlob: {
    position: 'absolute',
    width: 220,
    height: 90,
    borderRadius: 110,
    backgroundColor: '#fff',
    top: -30,
    alignSelf: 'center',
  },
  walletLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 2,
    marginBottom: 10,
  },
  balance: {
    fontSize: 44,
    fontWeight: '900',
    color: GREEN,
    letterSpacing: -1.5,
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    backgroundColor: '#1c1f40',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: BORDER,
  },
  badgeText: {
    color: PRIMARY,
    fontSize: 11,
    fontWeight: '700',
  },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: CARD_BG,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  inputPrefix: {
    color: PRIMARY,
    fontSize: 22,
    fontWeight: '900',
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    paddingVertical: 14,
  },

  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  chip: {
    flex: 1,
    backgroundColor: '#1c1f40',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  chipText: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: '800',
  },

  payButton: {
    marginTop: 18,
    backgroundColor: PRIMARY,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: PRIMARY,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  payButtonDisabled: { opacity: 0.7 },
  btnInner: { flexDirection: 'row', alignItems: 'center' },
  payText: {
    color: '#111827',
    fontWeight: '900',
    fontSize: 17,
    letterSpacing: 0.3,
  },

  secureNote: {
    textAlign: 'center',
    color: '#fff',
    fontSize: 11,
    marginTop: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  acceptedSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: BORDER,
  },
  acceptedLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },

  upiRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    gap: 10,
  },
  upiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  gpayChip: {
    backgroundColor: '#1c1f3e',
  },
  phonePeChip: {
    backgroundColor: '#3a1660',
    gap: 8,
  },
  ppLabel: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  upiGenChip: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderColor: '#ddd',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    width: '82%',
    backgroundColor: CARD_BG,
    borderRadius: 22,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  successRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#22c55e1a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  successIcon: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIconText: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '900',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f4f6ff',
    marginBottom: 6,
  },
  modalSub: {
    fontSize: 13,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 20,
  },
})

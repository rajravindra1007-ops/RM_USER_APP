import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path, Rect } from 'react-native-svg'
import { auth, db } from '../../firebaseConfig'
import CustomAlert from '../components/CustomAlert'; // adjust path if needed

// ─── Theme ────────────────────────────────────────────────────────────────────
const T = {
  bg: '#11132d',
  card: '#1c1e3a',
  border: '#2a2e5a',
  borderFocus: '#facc15',

  primary: '#facc15',
  primaryText: '#000',

  text: '#ffffff',          // ✅ FIX: pure white
  label: '#fff',         // ✅ FIX: brighter label
  placeholder: '#fff',   // ✅ FIX: visible placeholder
  muted: '#8b90b8',

  inputBg: '#25284d',
  subtext: '#b4b9e6',
}

// ─── Google Pay SVG logo ───────────────────────────────────────────────────────
function GPayLogo({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size * 2.6} height={size} viewBox="0 0 60 24">
      <Path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0Z" fill="#fff" />
      <Path d="M19.6 12.2c0-.5 0-.9-.1-1.3H12v2.5h4.3a3.7 3.7 0 0 1-1.6 2.4v2h2.6c1.5-1.4 2.3-3.4 2.3-5.6Z" fill="#4285F4" />
      <Path d="M12 20c2.2 0 4-.7 5.3-2l-2.6-2a4.5 4.5 0 0 1-6.7-2.4H5.4v2C6.7 18.1 9.2 20 12 20Z" fill="#34A853" />
      <Path d="M8 13.6A4.6 4.6 0 0 1 8 10.4V8.4H5.4A8 8 0 0 0 4 12c0 1.3.3 2.5.8 3.6L8 13.6Z" fill="#FBBC04" />
      <Path d="M12 7.6c1.2 0 2.3.4 3.2 1.2l2.4-2.4A8 8 0 0 0 5.4 8.4L8 10.4A4.7 4.7 0 0 1 12 7.6Z" fill="#EA4335" />
      <Path d="M26.4 7.2h3.2c1.9 0 3 1 3 2.7 0 1.7-1.1 2.7-3 2.7h-1.7v3H26.4V7.2Zm1.5 4.1h1.5c1 0 1.6-.5 1.6-1.4 0-.9-.6-1.4-1.6-1.4h-1.5v2.8Z" fill="#fff" />
      <Path d="M35.2 9.4c1.6 0 2.8.9 2.8 2.9v3.4H36.6v-.8c-.4.6-1 1-1.9 1-1.2 0-2.1-.7-2.1-1.8 0-1.1.9-1.8 2.3-1.8.6 0 1.1.1 1.5.4v-.3c0-.8-.5-1.3-1.4-1.3-.6 0-1.1.2-1.5.5l-.5-1c.6-.5 1.4-.8 2.2-.8Zm.3 4.8c.7 0 1.2-.5 1.2-1.1-.3-.2-.8-.3-1.3-.3-.8 0-1.2.3-1.2.8s.4.6 1.3.6Z" fill="#fff" />
      <Path d="M39 9.5h1.6l1.6 4.4 1.6-4.4H45.4l-2.8 7.4c-.4 1.1-1.1 1.7-2.1 1.7-.4 0-.8-.1-1.1-.2l.3-1.2c.2.1.4.1.6.1.5 0 .8-.2 1-.7l.2-.5L39 9.5Z" fill="#fff" />
    </Svg>
  )
}

// ─── PhonePe SVG logo ──────────────────────────────────────────────────────────
function PhonePeLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Rect width="100" height="100" rx="20" fill="#5f259f" />
      <Path d="M28 18h26c13 0 21 8.5 21 20s-8 20-21 20H44v18l-16 7V18Zm16 11v18h10c6 0 9-3.6 9-9s-3-9-9-9H44Z" fill="#fff" />
    </Svg>
  )
}

// ─── Paytm logo ───────────────────────────────────────────────────────────────
function PaytmLogo({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size * 2.8} height={size} viewBox="0 0 70 25">
      <Rect width="70" height="25" rx="5" fill="#00BAF2" />
      <Path d="M8 5h4c2.5 0 4 1.3 4 3.5S14.5 12 12 12H10v5H8V5Zm2 5h1.8c1.2 0 2-.6 2-1.5S13 7 11.8 7H10v3Z" fill="#fff" />
      <Path d="M18 5h2v12h-2V5Z" fill="#fff" />
      <Path d="M22 5h7v2h-2.5v10h-2V7H22V5Z" fill="#fff" />
      <Path d="M30 5h2.5l2 8 2-8H39l-3.2 12h-2.6L30 5Z" fill="#fff" />
      <Path d="M40 5h6c1.8 0 3 1 3 2.6 0 1-.5 1.8-1.3 2.2.9.4 1.5 1.2 1.5 2.3 0 1.8-1.3 3-3.2 3H40V5Zm2 4.2h3.5c.7 0 1.1-.4 1.1-1s-.4-1-1.1-1H42v2Zm0 4.6h3.8c.8 0 1.2-.4 1.2-1.1s-.4-1.1-1.2-1.1H42v2.2Z" fill="#fff" />
      <Path d="M51 5h7v2h-5v2.8h4.5v2H53V15h5v2h-7V5Z" fill="#fff" />
    </Svg>
  )
}

// ─── useAlert hook ────────────────────────────────────────────────────────────
function useAlert() {
  const [state, setState] = useState<{
    visible: boolean
    title?: string
    message?: string
    buttons?: { text: string; style?: 'cancel' | 'confirm'; onPress?: () => void }[]
  }>({ visible: false })
  const show = (title: string, message?: string, buttons?: any[]) =>
    setState({ visible: true, title, message, buttons })
  const dismiss = () => setState(prev => ({ ...prev, visible: false }))
  return { alertState: state, show, dismiss }
}

type PaymentMethod = 'gpay' | 'phonepe' | 'paytm'

const METHOD_META: Record<PaymentMethod, {
  label: string
  logo: JSX.Element
  activeBg: string
  activeBorder: string
  activeLabel: string
}> = {
  gpay: {
    label: 'GPay',
    logo: <GPayLogo size={18} />,
    activeBg: '#1a2d52',
    activeBorder: '#4285F4',
    activeLabel: '#7ab4ff',
  },
  phonepe: {
    label: 'PhonePe',
    logo: <PhonePeLogo size={20} />,
    activeBg: '#26124a',
    activeBorder: '#8b5cf6',
    activeLabel: '#c4a0ff',
  },
  paytm: {
    label: 'Paytm',
    logo: <PaytmLogo size={15} />,
    activeBg: '#003d52',
    activeBorder: '#00BAF2',
    activeLabel: '#67d9ff',
  },
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function BankDetailsSection() {
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null)
  const [holderName, setHolderName] = useState('')
  const [accountNo, setAccountNo] = useState('')
  const [ifsc, setIfsc] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('gpay')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exists, setExists] = useState(false)
  const [editing, setEditing] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const { alertState, show, dismiss } = useAlert()

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(u => setUid(u?.uid ?? null))
    return () => unsubAuth()
  }, [])

  useEffect(() => {
    if (!uid) { setLoading(false); return }
    setLoading(true)
    const ref = db.collection('users').doc(uid).collection('bank').doc('details')
    const unsub = ref.onSnapshot(snap => {
      const data = snap.data() as any
      if (data) {
        setExists(true); setEditing(false)
        setHolderName(data.holderName ?? '')
        setAccountNo(data.accountNo ?? '')
        setIfsc(data.ifsc ?? '')
        setMethod((data.method as PaymentMethod) ?? 'gpay')
        setPhone(data.phone ?? '')
      } else {
        setExists(false); setEditing(true)
      }
      setLoading(false)
    }, () => setLoading(false))
    return () => unsub()
  }, [uid])

  const save = async () => {
    if (!uid) return
    if (!holderName.trim() || !accountNo.trim() || !ifsc.trim()) {
      show('Missing Details', 'Please fill account name, account number and IFSC code.', [
        { text: 'OK', style: 'confirm', onPress: dismiss },
      ]); return
    }
    if (!phone.trim()) {
      show('Missing Phone', 'Please enter the registered phone number.', [
        { text: 'OK', style: 'confirm', onPress: dismiss },
      ]); return
    }
    try {
      setSaving(true)
      const payload: any = { holderName, accountNo, ifsc, method, updatedAt: new Date() }
      payload.phone = phone
      await db.collection('users').doc(uid).collection('bank').doc('details').set(payload, { merge: true })
      setExists(true); setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const actionLabel = exists ? (editing ? 'Save Changes' : 'Edit Details') : 'Save Details'

  // input style helper
  const inp = (field: string): any[] => [
    styles.input,
    focusedField === field && styles.inputFocused,
    !editing && styles.inputReadonly,
  ]

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={T.primary} size="large" />
        <Text style={styles.loadingTxt}>Loading…</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }} edges={['left', 'right', 'bottom']}>
      <CustomAlert
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        onDismiss={dismiss}
        buttons={alertState.buttons}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Top status strip ── */}
          {/* <View style={styles.statusStrip}>
            <View style={styles.statusLeft}>
              <Text style={styles.statusIcon}>🏦</Text>
              <View>
                <Text style={styles.statusTitle}>Bank & UPI Details</Text>
                <Text style={styles.statusSub}>
                  {exists && !editing ? '✓ Details saved — tap Edit to update' : 'Fill your payout info below'}
                </Text>
              </View>
            </View>
            {exists && !editing && (
              <View style={styles.savedDot} />
            )}
          </View> */}

          {/* ─────────────── BANK ACCOUNT ─────────────── */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderAccent} />
              <Text style={styles.cardTitle}>Bank Account</Text>
            </View>

            {/* Account holder name */}
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Account Holder Name</Text>
              <TextInput
                value={holderName}
                onChangeText={setHolderName}
                style={inp('name')}
                placeholder="Full name as per bank"
                placeholderTextColor={T.placeholder}
                editable={editing}
                onFocus={() => setFocusedField('name')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            {/* Account number */}
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Account Number</Text>
              <TextInput
                value={accountNo}
                onChangeText={setAccountNo}
                keyboardType="number-pad"
                style={inp('acc')}
                placeholder="Your bank account number"
                placeholderTextColor={T.placeholder}
                editable={editing}
                onFocus={() => setFocusedField('acc')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            {/* IFSC */}
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>IFSC Code</Text>
              <TextInput
                value={ifsc}
                onChangeText={setIfsc}
                autoCapitalize="characters"
                style={inp('ifsc')}
                placeholder="e.g. SBIN0001234"
                placeholderTextColor={T.placeholder}
                editable={editing}
                onFocus={() => setFocusedField('ifsc')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>

          {/* ─────────────── PAYMENT METHOD ─────────────── */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardHeaderAccent, { backgroundColor: '#8b5cf6' }]} />
              <Text style={styles.cardTitle}>UPI Payment Method</Text>
            </View>

            <Text style={styles.fieldLabel}>Select UPI App</Text>
            <View style={styles.methodsRow}>
              {(['gpay', 'phonepe', 'paytm'] as PaymentMethod[]).map(m => {
                const meta = METHOD_META[m]
                const active = method === m
                return (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.methodBtn,
                      active && {
                        backgroundColor: meta.activeBg,
                        borderColor: meta.activeBorder,
                        borderWidth: 2,
                      },
                    ]}
                    onPress={() => editing && setMethod(m)}
                    disabled={!editing}
                    activeOpacity={0.72}
                  >
                    {/* Active indicator dot */}
                    {active && (
                      <View style={[styles.activeDot, { backgroundColor: meta.activeBorder }]} />
                    )}
                    {meta.logo}
                    <Text style={[
                      styles.methodLabel,
                      active && { color: meta.activeLabel, fontWeight: '800' },
                    ]}>
                      {meta.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {/* Phone */}
            <View style={[styles.fieldWrap, { marginTop: 6 }]}>
              <Text style={styles.fieldLabel}>Registered Phone Number</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                style={inp('phone')}
                placeholder="10-digit mobile number"
                placeholderTextColor={T.placeholder}
                editable={editing}
                onFocus={() => setFocusedField('phone')}
                onBlur={() => setFocusedField(null)}
                maxLength={10}
              />
            </View>
          </View>

          {/* ── Secure note ── */}
          <Text style={styles.secureNote}>🔒  Your details are encrypted & stored securely</Text>

          {/* ── CTA ── */}
          <TouchableOpacity
            onPress={async () => {
              if (exists && !editing) { setEditing(true); return }
              await save()
            }}
            style={[styles.cta, saving && { opacity: 0.7 }]}
            activeOpacity={0.85}
            disabled={saving}
          >
            {saving ? (
              <View style={styles.ctaInner}>
                <ActivityIndicator color={T.primaryText} size="small" style={{ marginRight: 8 }} />
                <Text style={styles.ctaText}>Saving…</Text>
              </View>
            ) : (
              <Text style={styles.ctaText}>{actionLabel}</Text>
            )}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  centered: { flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingTxt: { color: T.muted, fontSize: 14, fontWeight: '600' },

  scroll: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
    flexGrow: 1,
  },

  // status strip
  statusStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: T.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: T.border,
  },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  statusIcon: { fontSize: 28 },
  statusTitle: { fontSize: 15, fontWeight: '800', color: T.text, letterSpacing: 0.2 },
  statusSub: { fontSize: 11, color: T.muted, marginTop: 2 },
  savedDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#22c55e',
    shadowColor: '#22c55e', shadowOpacity: 0.8, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
  },

  // cards
  card: {
    backgroundColor: T.card,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: T.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: -4 },
  cardHeaderAccent: { width: 4, height: 16, borderRadius: 2, backgroundColor: T.primary },
  cardTitle: { fontSize: 13, fontWeight: '800', color: T.text, letterSpacing: 0.4 },

  // field
  fieldWrap: { gap: 6 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: T.label,       // bright enough to read clearly
    letterSpacing: 0.3,
  },

  // input
  input: {
    backgroundColor: T.inputBg,
    borderWidth: 1.5,
    borderColor: T.border,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: T.text,        // bright white input text
    fontSize: 14,
    fontWeight: '600',
  },
  inputFocused: {
    borderColor: T.primary,
    backgroundColor: '#222550',
  },
  inputReadonly: {
    color: T.subtext,
    borderColor: '#252848',
  },

  // method buttons
  methodsRow: { flexDirection: 'row', gap: 10 },
  methodBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: T.border,
    backgroundColor: T.inputBg,
    gap: 5,
    position: 'relative',
    overflow: 'hidden',
  },
  activeDot: {
    position: 'absolute',
    top: 6, right: 6,
    width: 7, height: 7,
    borderRadius: 4,
  },
  methodLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: T.muted,
    letterSpacing: 0.2,
  },

  secureNote: {
    textAlign: 'center',
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },

  // CTA
  cta: {
    backgroundColor: T.primary,
    paddingVertical: 15,
    borderRadius: 13,
    alignItems: 'center',
    shadowColor: T.primary,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  ctaInner: { flexDirection: 'row', alignItems: 'center' },
  ctaText: { color: T.primaryText, fontWeight: '900', fontSize: 16, letterSpacing: 0.3 },
})

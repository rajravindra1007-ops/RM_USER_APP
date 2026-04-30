import React, { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { auth, db } from '../../firebaseConfig'

type PaymentMethod = 'gpay' | 'phonepe' | 'paytm'

export default function BankDetailsSection() {
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null)
  const [holderName, setHolderName] = useState('')
  const [accountNo, setAccountNo] = useState('')
  const [ifsc, setIfsc] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('gpay')
  const [phone, setPhone] = useState('')
  const [upiId, setUpiId] = useState('')
  const [loading, setLoading] = useState(true)
  const [exists, setExists] = useState(false)
  const [editing, setEditing] = useState(false)

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
        setExists(true)
        setEditing(false)
        setHolderName(data.holderName ?? '')
        setAccountNo(data.accountNo ?? '')
        setIfsc(data.ifsc ?? '')
        const m = (data.method as PaymentMethod) ?? 'gpay'
        setMethod(m)
        setPhone(data.phone ?? '')
        setUpiId(data.upiId ?? '')
      } else {
        setExists(false)
        setEditing(true)
      }
      setLoading(false)
    }, () => setLoading(false))
    return () => unsub()
  }, [uid])

  const save = async () => {
    if (!uid) return
    // basic validation – require UPI ID and core fields
    if (!holderName.trim() || !accountNo.trim() || !ifsc.trim() || !upiId.trim()) {
      Alert.alert('Missing details', 'Please fill account name, number, IFSC and UPI ID.');
      return;
    }
    if ((method === 'gpay' || method === 'phonepe' || method === 'paytm') && !phone.trim()) {
      Alert.alert('Missing phone', 'Please enter the phone number for the selected payment method.');
      return;
    }

    const payload: any = { holderName, accountNo, ifsc, method, updatedAt: new Date(), upiId }
    payload.phone = (method === 'gpay' || method === 'phonepe' || method === 'paytm') ? phone : null
    await db.collection('users').doc(uid).collection('bank').doc('details').set(payload, { merge: true })
    setExists(true)
    setEditing(false)
  }

  const actionLabel = exists ? (editing ? 'Save' : 'Edit') : 'Add'

  const showPhone = method === 'gpay' || method === 'phonepe' || method === 'paytm'

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f7f8fb' }} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >

      <View style={styles.field}>
        <Text style={styles.label}>Account holder name</Text>
        <TextInput value={holderName} onChangeText={setHolderName} style={styles.input} placeholder="e.g. User name surname" editable={editing} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Account No</Text>
        <TextInput value={accountNo} onChangeText={setAccountNo} keyboardType="number-pad" style={styles.input} placeholder="e.g. Account no" editable={editing} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>IFSC Code</Text>
        <TextInput value={ifsc} onChangeText={setIfsc} autoCapitalize="characters" style={styles.input} placeholder="e.g. IFSC code" editable={editing} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Select payment method</Text>
        <View style={styles.methodsRow}>
          {(['gpay','phonepe','paytm'] as PaymentMethod[]).map(m => (
            <TouchableOpacity key={m} style={[styles.methodBtn, method === m && styles.methodBtnActive]} onPress={() => editing && setMethod(m)} disabled={!editing}>
              <Text style={[styles.methodText, method === m && styles.methodTextActive]}>{m.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {showPhone && (
        <View style={styles.field}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} placeholder="e.g. Phone number" editable={editing} />
        </View>
      )}

      <View style={styles.field}>
        <Text style={styles.label}>UPI ID</Text>
        <TextInput value={upiId} onChangeText={setUpiId} autoCapitalize="none" style={styles.input} placeholder="e.g. UPI ID" editable={editing} />
      </View>

      <TouchableOpacity
        onPress={async () => {
          if (exists && !editing) {
            // switch to edit mode
            setEditing(true);
            return;
          }
          // otherwise save (for Add or Save)
          await save();
        }}
        style={styles.saveBtn}
        activeOpacity={0.8}
      >
        <Text style={styles.saveText}>{actionLabel}</Text>
      </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 32, gap: 14, flexGrow: 1 },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  field: { gap: 6 },
  label: { fontWeight: '600', color: '#374151' },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10 },
  methodsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  methodBtnActive: { backgroundColor: '#32dfa6ff', borderColor: '#32dfa6ff' },
  methodText: { fontWeight: '700', color: '#1f2937' },
  methodTextActive: { color: '#0c0c0c' },
  saveBtn: { marginTop: 8, backgroundColor: '#1f2937', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700' },
})

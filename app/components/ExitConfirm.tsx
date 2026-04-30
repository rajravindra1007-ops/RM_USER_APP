import React from 'react'
import { Modal, View, Text, TouchableOpacity, StyleSheet, BackHandler } from 'react-native'
import useColors from '../../theme/colors'

type Props = {
  visible: boolean
  title?: string
  message?: string
  onCancel: () => void
  onConfirm: () => void
}

export default function ExitConfirm({ visible, title = 'Exit App', message = 'Do you want to exit?', onCancel, onConfirm }: Props) {
  const colors = useColors()

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.muted }]}>{message}</Text>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.btnNo, { borderColor: colors.border }]} onPress={onCancel}>
              <Text style={[styles.btnTextNo, { color: colors.primary }]}>No</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnYes, { backgroundColor: colors.primary }]} onPress={onConfirm}>
              <Text style={styles.btnTextYes}>Yes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderWidth: 1,
  },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  message: { fontSize: 14, marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'flex-end' },
  btn: { minWidth: 80, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, alignItems: 'center', marginLeft: 10 },
  btnNo: { backgroundColor: 'transparent', borderWidth: 1 },
  btnYes: {},
  btnTextNo: { fontWeight: '600' },
  btnTextYes: { fontWeight: '600', color: '#fff' },
})

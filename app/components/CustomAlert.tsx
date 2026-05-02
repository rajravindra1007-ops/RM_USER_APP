import React from 'react'
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import useColors from '../../theme/colors'

type AlertButton = {
  text: string
  onPress?: () => void
  style?: 'cancel' | 'confirm'
}

type Props = {
  visible: boolean
  title?: string
  message?: string
  onDismiss?: () => void
  buttons?: AlertButton[]
}

export default function CustomAlert({
  visible,
  title = 'Alert',
  message,
  onDismiss,
  buttons,
}: Props) {
  const colors = useColors()

  const resolvedButtons: AlertButton[] = buttons ?? [
    { text: 'OK', style: 'confirm', onPress: onDismiss },
  ]

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>

          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <View style={[styles.divider, { backgroundColor: '#ffffff30' }]} />

          {message ? (
            <Text style={[styles.message, { color: colors.muted }]}>{message}</Text>
          ) : null}


          <View style={styles.row}>
            {resolvedButtons.map((btn, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.btn,
                  btn.style === 'cancel'
                    ? [styles.btnNo, { borderColor: colors.border }]
                    : [styles.btnYes, { backgroundColor: colors.primary }],
                ]}
                onPress={btn.onPress}
              >
                <Text
                  style={
                    btn.style === 'cancel'
                      ? [styles.btnTextNo, { color: colors.primary }]
                      : styles.btnTextYes
                  }
                >
                  {btn.text}
                </Text>
              </TouchableOpacity>
            ))}
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
  btn: {
    minWidth: 80,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    marginLeft: 10,
  },
  btnNo: { backgroundColor: 'transparent', borderWidth: 1 },
  btnYes: {},
  btnTextNo: { fontWeight: '600' },
  btnTextYes: { fontWeight: '600', color: '#fff' },
  divider: {
    height: 1,
    backgroundColor: 'white',  // ← won't work in StyleSheet, see below
    marginBottom: 12,
  },
})
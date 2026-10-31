import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useMessages } from '@/features/i18n/LocaleProvider';
import { useTheme } from '@/features/theme/ThemeProvider';

/**
 * Confirmation dialog (§7.6, ADR-12): our own modal, never `Alert.alert`.
 *
 * Why not `Alert.alert`: it cannot be themed, its button order is not
 * controllable on Android, and it exposes no modal accessibility semantics we
 * control. Here the focus order is simply the render order — title, message,
 * then the buttons — and `accessibilityViewIsModal` keeps VoiceOver inside the
 * card instead of walking the screen behind it.
 *
 * `onRequestClose` maps the Android back button to **Cancelar**: the safe
 * option always wins. Tapping the backdrop deliberately does nothing, so a
 * stray thumb can never confirm a destructive action.
 *
 * Every §7.6 dialog is destructive, so the confirm button is red by default.
 */
export type ConfirmDialogProps = {
  readonly visible: boolean;
  /** Question, e.g. "¿Reiniciar la partida?" */
  readonly title: string;
  /** Consequence, with the exact numbers already substituted. */
  readonly message: string;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
};

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const theme = useTheme();
  const t = useMessages();
  const { colors } = theme;
  // The safe option is always present; without a label it comes from the catalog.
  const cancel = cancelLabel ?? t.common.cancel;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
      testID="confirm-modal"
    >
      <View style={styles.backdrop}>
        <View
          testID="confirm-dialog"
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityViewIsModal
          importantForAccessibility="yes"
        >
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
            {title}
          </Text>
          <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>

          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel={cancel}
              testID="confirm-cancel"
              style={({ pressed }) => [
                styles.button,
                styles.cancel,
                { borderColor: colors.border },
                pressed && { backgroundColor: colors.surfaceStrong },
              ]}
            >
              <Text style={[styles.cancelLabel, { color: colors.text }]}>{cancel}</Text>
            </Pressable>

            <Pressable
              onPress={onConfirm}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              testID="confirm-confirm"
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: colors.dangerStrong },
                pressed && styles.confirmPressed,
              ]}
            >
              <Text style={[styles.confirmLabel, { color: colors.onDanger }]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    alignSelf: 'stretch',
    borderRadius: 16,
    padding: 20,
    gap: 12,
    borderWidth: 1,
  },
  title: { fontSize: 19, fontWeight: '800' },
  message: { fontSize: 16, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: 8, paddingTop: 8 },
  button: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  cancel: { borderWidth: 1 },
  cancelLabel: { fontSize: 16, fontWeight: '700' },
  // Destructive confirm (§7.6): red, but never hidden or smaller than Cancel.
  confirmPressed: { opacity: 0.85 },
  confirmLabel: { fontSize: 16, fontWeight: '800' },
});

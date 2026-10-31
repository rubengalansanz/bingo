import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ThemeTokens } from '@/core/theme/tokens';
import { useMessages } from '@/features/i18n/LocaleProvider';
import { useTheme } from '@/features/theme/ThemeProvider';

/**
 * Privacy policy inside the app (plan §9.3).
 *
 * The store listing still needs a public URL, but the text belongs in the app
 * too: it is the "Acerca de → Privacidad" row, and it says exactly what the
 * binary does. Same sheet pattern as the other settings screens (ADR-12).
 */

export function PrivacySheet({
  visible,
  onClose,
}: {
  readonly visible: boolean;
  readonly onClose: () => void;
}) {
  const theme = useTheme();
  const t = useMessages();
  const styles = makeStyles(theme);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      testID="privacy-modal"
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet} accessibilityViewIsModal testID="privacy-sheet">
          <Text style={styles.title} accessibilityRole="header">
            {t.privacy.title}
          </Text>

          <ScrollView style={styles.scroll}>
            {t.privacy.points.map((point) => (
              <Text key={point} style={styles.point}>
                · {point}
              </Text>
            ))}
            <Text style={styles.footer}>{t.privacy.footer}</Text>
          </ScrollView>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t.privacy.close}
            testID="privacy-close"
            style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
          >
            <Text style={styles.closeLabel}>{t.privacy.close}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(theme: ThemeTokens) {
  const { colors } = theme;

  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
    },
    sheet: {
      maxHeight: '85%',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 20,
      gap: 12,
    },
    title: { color: colors.text, fontSize: 20, fontWeight: '800' },
    scroll: { flexGrow: 0 },
    point: { color: colors.text, fontSize: 15, lineHeight: 22, paddingBottom: 8 },
    footer: { color: colors.textMuted, fontSize: 14, paddingTop: 4 },
    close: {
      minHeight: 52,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
    },
    closePressed: { opacity: 0.85 },
    closeLabel: { color: colors.onAccent, fontSize: 17, fontWeight: '800' },
  });
}

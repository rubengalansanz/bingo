import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useMessages } from '@/features/i18n/LocaleProvider';
import { useTheme } from '@/features/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';

/**
 * Bottom-sheet picker (plan §7.5): every row with a value opens one of these.
 *
 * Changes apply **live** — the sheet stays open showing the new state — and
 * `Listo` closes it. Each option is a radio with its label and an optional
 * detail line, so the current value is announced, not just coloured.
 *
 * Own component, no sheet library (ADR-12).
 */

export type ChoiceOption<T extends string | number> = {
  readonly value: T;
  readonly label: string;
  readonly detail?: string;
};

export type ChoiceSheetProps<T extends string | number> = {
  readonly visible: boolean;
  readonly title: string;
  readonly options: readonly ChoiceOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly onClose: () => void;
  /** Optional live sample (the theme sheet shows a ball in the new palette). */
  readonly preview?: ReactNode;
  /** Prefix for the test ids: `${testID}-option-${value}`, `${testID}-done`. */
  readonly testID: string;
};

export function ChoiceSheet<T extends string | number>({
  visible,
  title,
  options,
  value,
  onChange,
  onClose,
  preview,
  testID,
}: ChoiceSheetProps<T>) {
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
      testID={`${testID}-modal`}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet} accessibilityViewIsModal testID={testID}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>

          {preview !== undefined && <View style={styles.preview}>{preview}</View>}

          <ScrollView accessibilityRole="radiogroup" style={styles.list}>
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => onChange(option.value)}
                  accessibilityRole="radio"
                  accessibilityLabel={
                    option.detail === undefined ? option.label : `${option.label}. ${option.detail}`
                  }
                  accessibilityState={{ checked: selected, selected }}
                  testID={`${testID}-option-${option.value}`}
                  style={({ pressed }) => [
                    styles.option,
                    selected && styles.optionSelected,
                    pressed && styles.optionPressed,
                  ]}
                >
                  <View style={styles.optionText}>
                    <Text style={styles.optionLabel}>{option.label}</Text>
                    {option.detail !== undefined && (
                      <Text style={styles.optionDetail}>{option.detail}</Text>
                    )}
                  </View>
                  {selected && <Text style={styles.check}>✓</Text>}
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t.common.done}
            testID={`${testID}-done`}
            style={({ pressed }) => [styles.done, pressed && styles.donePressed]}
          >
            <Text style={styles.doneLabel}>{t.common.done}</Text>
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
    preview: { alignItems: 'center', paddingVertical: 4 },
    list: { flexGrow: 0 },
    option: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8,
    },
    optionSelected: { backgroundColor: colors.surfaceStrong, borderColor: colors.accent },
    optionPressed: { backgroundColor: colors.surfaceStrong },
    optionText: { flexShrink: 1, gap: 2 },
    optionLabel: { color: colors.text, fontSize: 16, fontWeight: '700' },
    optionDetail: { color: colors.textMuted, fontSize: 13 },
    check: { color: colors.accent, fontSize: 18, fontWeight: '900' },
    done: {
      minHeight: 52,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
    },
    donePressed: { opacity: 0.85 },
    doneLabel: { color: colors.onAccent, fontSize: 17, fontWeight: '800' },
  });
}

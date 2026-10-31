import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  PRESETS,
  RANGE_PRESETS,
  RANGE_WARNING_TOTAL,
  customRange,
  rangeForPreset,
  validateRange,
} from '@/core/engine/range';
import type { LabelMode, RangeConfig, RangePreset } from '@/core/engine/types';
import type { Messages } from '@/core/i18n/messages';
import { useMessages } from '@/features/i18n/LocaleProvider';
import { useTheme } from '@/features/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';

/**
 * Range form (plan §3.1-3.3, U-Fase 3).
 *
 * Presets are one tap; `Personalizado` opens two integer fields. Validation is
 * the **domain's** (`validateRange`): the form only maps the typed error to the
 * exact §3.2 message and disables the action. The total is shown live ("Serán
 * 64 bolas") and a range below ten balls gets a non-blocking warning.
 *
 * Applying a different range while a game is running is destructive, so the
 * screen closes this sheet and asks through `ConfirmDialog` (§3.3, §7.6).
 * That decision belongs to Ajustes, not to the form.
 */

export type RangeSheetProps = {
  readonly visible: boolean;
  readonly initial: RangeConfig;
  readonly labelMode: LabelMode;
  readonly onClose: () => void;
  /** The range is valid by construction when this fires. */
  readonly onApply: (range: RangeConfig) => void;
};

export function RangeSheet(props: RangeSheetProps) {
  // Unmounting while hidden resets the fields on every open, so the form always
  // starts from the stored draft instead of the last failed edit.
  if (!props.visible) {
    return null;
  }
  return <RangeSheetBody {...props} />;
}

function RangeSheetBody({ initial, labelMode, onClose, onApply }: RangeSheetProps) {
  const theme = useTheme();
  const t = useMessages();
  const styles = makeStyles(theme);

  const [preset, setPreset] = useState<RangePreset>(initial.preset);
  const [minText, setMinText] = useState(String(initial.min));
  const [maxText, setMaxText] = useState(String(initial.max));

  const draft = draftRange(preset, minText, maxText, labelMode, t.range);
  const canApply = draft.error === null;
  const total = draft.total;
  // A fixed preset owns its bounds: the fields show what will be applied, not
  // the numbers left over from a previous custom edit (which stay in state,
  // so going back to `Personalizado` restores them).
  const fixed = preset === 'custom' ? null : rangeForPreset(preset, labelMode);
  const shownMin = fixed === null ? minText : String(fixed.min);
  const shownMax = fixed === null ? maxText : String(fixed.max);

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      testID="range-modal"
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet} accessibilityViewIsModal testID="range-sheet">
          <Text style={styles.title} accessibilityRole="header">
            {t.range.title}
          </Text>
          <Text style={styles.subtitle}>{t.settings.sections.game}</Text>

          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
            <View accessibilityRole="radiogroup" style={styles.presets}>
              {RANGE_PRESETS.map((value) => {
                const selected = value === preset;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setPreset(value)}
                    accessibilityRole="radio"
                    accessibilityLabel={t.range.presets[value]}
                    accessibilityState={{ checked: selected, selected }}
                    testID={`range-preset-${value}`}
                    style={({ pressed }) => [
                      styles.preset,
                      selected && styles.presetSelected,
                      pressed && styles.presetPressed,
                    ]}
                  >
                    <Text style={styles.presetLabel}>{t.range.presets[value]}</Text>
                    <Text style={styles.presetDetail}>{presetDetail(value, t.range)}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.fields}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t.range.min}</Text>
                <TextInput
                  value={shownMin}
                  onChangeText={setMinText}
                  editable={preset === 'custom'}
                  keyboardType="number-pad"
                  maxLength={3}
                  accessibilityLabel={t.range.minLabel}
                  testID="range-min"
                  style={[styles.input, preset !== 'custom' && styles.inputDisabled]}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t.range.max}</Text>
                <TextInput
                  value={shownMax}
                  onChangeText={setMaxText}
                  editable={preset === 'custom'}
                  keyboardType="number-pad"
                  maxLength={3}
                  accessibilityLabel={t.range.maxLabel}
                  testID="range-max"
                  style={[styles.input, preset !== 'custom' && styles.inputDisabled]}
                />
              </View>
            </View>

            {draft.error === null && total !== null ? (
              <Text style={styles.total} testID="range-total">
                {t.range.total(total)}
              </Text>
            ) : (
              <Text style={styles.error} accessibilityRole="alert" testID="range-error">
                {draft.error}
              </Text>
            )}

            {total !== null && total < RANGE_WARNING_TOTAL && (
              <Text style={styles.warning} testID="range-warning">
                {t.range.shortWarning}
              </Text>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t.common.cancel}
              testID="range-cancel"
              style={({ pressed }) => [
                styles.button,
                styles.cancel,
                pressed && styles.cancelPressed,
              ]}
            >
              <Text style={styles.cancelLabel}>{t.common.cancel}</Text>
            </Pressable>

            <Pressable
              onPress={() => onApply(draft.range)}
              disabled={!canApply}
              accessibilityRole="button"
              accessibilityLabel={t.range.applyLabel}
              accessibilityState={{ disabled: !canApply }}
              testID="range-apply"
              style={({ pressed }) => [
                styles.button,
                styles.apply,
                !canApply && styles.applyDisabled,
                pressed && canApply && styles.applyPressed,
              ]}
            >
              <Text style={styles.applyLabel}>{t.range.apply}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

type Draft = {
  readonly range: RangeConfig;
  /** `null` when the fields are empty or invalid. */
  readonly total: number | null;
  readonly error: string | null;
};

/** Presets are always valid; custom fields go through the domain validator. */
function draftRange(
  preset: RangePreset,
  minText: string,
  maxText: string,
  labelMode: LabelMode,
  copy: Messages['range'],
): Draft {
  if (preset !== 'custom') {
    const range = rangeForPreset(preset, labelMode);
    return { range, total: PRESETS[preset].max - PRESETS[preset].min + 1, error: null };
  }

  if (minText.trim() === '' || maxText.trim() === '') {
    return { range: customRange(0, 0, labelMode), total: null, error: copy.empty };
  }

  const min = Number(minText);
  const max = Number(maxText);
  const result = validateRange(min, max);
  const range = customRange(min, max, labelMode);

  return result.ok
    ? { range, total: result.value, error: null }
    : { range, total: null, error: copy.errors[result.error] };
}

/** `1–90` style detail under each preset name (§3.1). */
function presetDetail(preset: RangePreset, copy: Messages['range']): string {
  if (preset === 'custom') {
    return copy.customDetail;
  }
  const fixed = PRESETS[preset];
  return copy.presetDetail(fixed.min, fixed.max, fixed.max - fixed.min + 1);
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
      maxHeight: '90%',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 20,
      gap: 10,
    },
    title: { color: colors.text, fontSize: 20, fontWeight: '800' },
    subtitle: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1,
    },
    scroll: { flexGrow: 0 },
    presets: { gap: 8, paddingVertical: 4 },
    preset: {
      minHeight: 56,
      justifyContent: 'center',
      gap: 2,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    presetSelected: { backgroundColor: colors.surfaceStrong, borderColor: colors.accent },
    presetPressed: { backgroundColor: colors.surfaceStrong },
    presetLabel: { color: colors.text, fontSize: 16, fontWeight: '700' },
    presetDetail: { color: colors.textMuted, fontSize: 13 },
    fields: { flexDirection: 'row', gap: 12, paddingTop: 8 },
    field: { flex: 1, gap: 6 },
    fieldLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
    input: {
      minHeight: 52,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
      fontSize: 18,
      fontWeight: '700',
      paddingHorizontal: 14,
      fontVariant: ['tabular-nums'],
    },
    inputDisabled: { opacity: 0.4 },
    total: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '700',
      paddingTop: 12,
    },
    error: { color: colors.danger, fontSize: 15, paddingTop: 12 },
    warning: { color: colors.accent, fontSize: 14, paddingTop: 6 },
    actions: { flexDirection: 'row', gap: 8, paddingTop: 8 },
    button: {
      flex: 1,
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
    },
    cancel: { borderWidth: 1, borderColor: colors.border },
    cancelPressed: { backgroundColor: colors.surfaceStrong },
    cancelLabel: { color: colors.text, fontSize: 16, fontWeight: '700' },
    apply: { backgroundColor: colors.accent },
    applyDisabled: { opacity: 0.4 },
    applyPressed: { opacity: 0.85 },
    applyLabel: { color: colors.onAccent, fontSize: 16, fontWeight: '800' },
  });
}

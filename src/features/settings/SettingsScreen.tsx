import Constants from 'expo-constants';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatRangeSpan, rangeTotal } from '@/core/engine/range';
import type { RangeConfig } from '@/core/engine/types';
import { LANGUAGES, type Language } from '@/core/i18n/messages';
import {
  ANIMATION_SPEEDS,
  REDUCE_MOTION_PREFERENCES,
  type AnimationSpeed,
  type NumberSize,
  type ReduceMotionPreference,
} from '@/core/settings/settings';
import type { ThemeId, ThemeTokens } from '@/core/theme/tokens';
import { useGame } from '@/features/game/useGame';
import { useMessages } from '@/features/i18n/LocaleProvider';
import { useTheme } from '@/features/theme/ThemeProvider';
import { ChoiceSheet, type ChoiceOption } from '@/ui/ChoiceSheet';
import { ConfirmDialog } from '@/ui/ConfirmDialog';

import { PrivacySheet } from './PrivacySheet';
import { RangeSheet } from './RangeSheet';
import { useSettings } from './useSettings';

/**
 * `/settings` — full screen (plan §7.5).
 *
 * Sections:
 * - PARTIDA: the range draft (which opens the form) and the destructive restart.
 * - APARIENCIA: theme, colour mode, number size and labels — all applied live,
 *   and none of them touches the game (§4.3, DoD §11.2.3).
 * - FEEDBACK: sound, haptics, animation speed, reduced motion and keep-awake.
 * - IDIOMA: the language of the whole UI, applied live to this very screen.
 * - ACERCA DE: version and the offline/privacy statement.
 *
 * Every sentence comes from `@/core/i18n`; the screen only picks labels and
 * values. A range change with a running game is destructive: the form closes, a
 * `ConfirmDialog` asks with the §7.6 copy and the ranges involved, and only
 * `Reiniciar y aplicar` creates the new game (§3.3).
 */

const THEME_IDS: readonly ThemeId[] = ['classic', 'minimal', 'neon', 'festive'];
const APPEARANCES = ['auto', 'light', 'dark'] as const;
const SIZES: readonly NumberSize[] = ['normal', 'large', 'xlarge'];
const LABEL_MODES = ['letter-number', 'number'] as const;

type ChoiceKind = 'theme' | 'appearance' | 'size' | 'labels' | 'speed' | 'motion' | 'language';

export default function SettingsScreen() {
  const theme = useTheme();
  const t = useMessages();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { settings, persistenceError, update, setRange } = useSettings();
  const { phase, game, banner, busy, drawn, onNewGame } = useGame();

  const [choice, setChoice] = useState<ChoiceKind | null>(null);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [pendingRange, setPendingRange] = useState<RangeConfig | null>(null);
  const [confirmingRestart, setConfirmingRestart] = useState(false);

  // Option lists are derived from the catalog, so they follow the language.
  const themeOptions = useMemo<readonly ChoiceOption<ThemeId>[]>(
    () =>
      THEME_IDS.map((id) => ({
        value: id,
        label: t.settings.themes[id].label,
        detail: t.settings.themes[id].detail,
      })),
    [t],
  );
  const appearanceOptions = useMemo<readonly ChoiceOption<(typeof APPEARANCES)[number]>[]>(
    () =>
      APPEARANCES.map((value) => ({
        value,
        label: t.settings.appearances[value].label,
        detail: t.settings.appearances[value].detail,
      })),
    [t],
  );
  const sizeOptions = useMemo<readonly ChoiceOption<NumberSize>[]>(
    () =>
      SIZES.map((value) => ({
        value,
        label: t.settings.sizes[value].label,
        detail: t.settings.sizes[value].detail,
      })),
    [t],
  );
  const labelOptions = useMemo<readonly ChoiceOption<(typeof LABEL_MODES)[number]>[]>(
    () =>
      LABEL_MODES.map((value) => ({
        value,
        label: t.settings.labels[value].label,
        detail: t.settings.labels[value].detail,
      })),
    [t],
  );
  const speedOptions = useMemo<readonly ChoiceOption<AnimationSpeed>[]>(
    () =>
      ANIMATION_SPEEDS.map((value) => ({
        value,
        label: t.settings.speeds[value].label,
        detail: t.settings.speeds[value].detail,
      })),
    [t],
  );
  const motionOptions = useMemo<readonly ChoiceOption<ReduceMotionPreference>[]>(
    () =>
      REDUCE_MOTION_PREFERENCES.map((value) => ({
        value,
        label: t.settings.motions[value].label,
        detail: t.settings.motions[value].detail,
      })),
    [t],
  );
  const languageOptions = useMemo<readonly ChoiceOption<Language>[]>(
    () => LANGUAGES.map((value) => ({ value, label: t.settings.languages[value] })),
    [t],
  );

  const hasGame = phase === 'ready' && game !== null;
  const canRestart = hasGame && !busy;
  const version = Constants.expoConfig?.version ?? '—';
  const rangeValue = `${t.range.presets[settings.rangeDraft.preset]} ${formatRangeSpan(
    settings.rangeDraft,
  )}`;

  /** Preference first, then a new game only when the range actually changes. */
  const applyRange = (range: RangeConfig): void => {
    setRange(range);
    if (hasGame && game !== null && !sameRange(game.range, range)) {
      onNewGame(range);
    }
  };

  const requestRange = (range: RangeConfig): void => {
    setRangeOpen(false);
    if (hasGame && game !== null && !sameRange(game.range, range)) {
      setPendingRange(range);
      return;
    }
    applyRange(range);
  };

  const confirmRange = (): void => {
    if (pendingRange !== null) {
      applyRange(pendingRange);
    }
    setPendingRange(null);
  };

  const confirmRestart = (): void => {
    setConfirmingRestart(false);
    onNewGame();
  };

  return (
    <SafeAreaView style={styles.root} testID="settings-screen" edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} accessibilityRole="header">
          {t.settings.title}
        </Text>

        {banner !== null && (
          <Text
            accessibilityRole="alert"
            style={[
              styles.banner,
              banner.tone === 'error' ? styles.bannerError : styles.bannerInfo,
            ]}
          >
            {t.banners[banner.code]}
          </Text>
        )}

        {persistenceError && (
          <Text accessibilityRole="alert" style={[styles.banner, styles.bannerError]}>
            {t.settings.saveFailed}
          </Text>
        )}

        <Text style={styles.section} accessibilityRole="header">
          {t.settings.sections.game}
        </Text>

        <Row
          label={t.settings.rows.range}
          value={rangeValue}
          onPress={() => setRangeOpen(true)}
          testID="settings-range"
        />

        {hasGame ? (
          <Row
            label={t.settings.rows.restart}
            value=""
            danger
            disabled={!canRestart}
            onPress={() => setConfirmingRestart(true)}
            testID="settings-restart"
          />
        ) : (
          <Text style={styles.hint}>
            {phase === 'loading' ? t.settings.loading : t.settings.noGame}
          </Text>
        )}

        <Text style={styles.section} accessibilityRole="header">
          {t.settings.sections.appearance}
        </Text>

        <Row
          label={t.settings.rows.theme}
          value={t.settings.themes[settings.themeId].label}
          onPress={() => setChoice('theme')}
          testID="settings-theme"
        />
        <Row
          label={t.settings.rows.appearance}
          value={t.settings.appearances[settings.appearance].label}
          onPress={() => setChoice('appearance')}
          testID="settings-appearance"
        />
        <Row
          label={t.settings.rows.size}
          value={t.settings.sizes[settings.numberSize].label}
          onPress={() => setChoice('size')}
          testID="settings-size"
        />
        <Row
          label={t.settings.rows.labels}
          value={t.settings.labels[settings.labelMode].label}
          onPress={() => setChoice('labels')}
          testID="settings-labels"
        />

        <Text style={styles.section} accessibilityRole="header">
          {t.settings.sections.feedback}
        </Text>

        <SwitchRow
          label={t.settings.rows.sound}
          value={settings.sound}
          hint={settings.sound ? null : t.settings.soundOffHint}
          onValueChange={(sound) => update({ sound })}
          testID="settings-sound"
        />
        <SwitchRow
          label={t.settings.rows.haptics}
          value={settings.haptics}
          hint={settings.haptics ? null : t.settings.hapticsOffHint}
          onValueChange={(haptics) => update({ haptics })}
          testID="settings-haptics"
        />
        <Row
          label={t.settings.rows.speed}
          value={t.settings.speeds[settings.animationSpeed].label}
          onPress={() => setChoice('speed')}
          testID="settings-speed"
        />
        <Row
          label={t.settings.rows.motion}
          value={t.settings.motions[settings.reduceMotion].label}
          onPress={() => setChoice('motion')}
          testID="settings-motion"
        />
        <SwitchRow
          label={t.settings.rows.keepAwake}
          value={settings.keepAwake}
          hint={null}
          onValueChange={(keepAwake) => update({ keepAwake })}
          testID="settings-keep-awake"
        />

        <Text style={styles.section} accessibilityRole="header">
          {t.settings.sections.language}
        </Text>
        <Row
          label={t.settings.rows.language}
          value={t.settings.languages[settings.language]}
          onPress={() => setChoice('language')}
          testID="settings-language"
        />

        <Text style={styles.section} accessibilityRole="header">
          {t.settings.sections.about}
        </Text>
        <Row
          label={t.settings.rows.privacy}
          value=""
          onPress={() => setPrivacyOpen(true)}
          testID="settings-privacy"
        />
        <Text style={styles.about}>{t.settings.offlineNote}</Text>
        <Text style={styles.about}>{t.settings.version(version)}</Text>
      </ScrollView>

      <ConfirmDialog
        visible={confirmingRestart && canRestart}
        title={t.settings.restartTitle}
        message={t.settings.restartMessage(drawn)}
        confirmLabel={t.settings.restartConfirm}
        onCancel={() => setConfirmingRestart(false)}
        onConfirm={confirmRestart}
      />

      <ConfirmDialog
        visible={pendingRange !== null}
        title={t.settings.rangeTitle}
        message={
          pendingRange === null || game === null
            ? ''
            : t.settings.rangeMessage(rangeTotal(game.range), rangeTotal(pendingRange), drawn)
        }
        confirmLabel={t.settings.rangeConfirm}
        onCancel={() => setPendingRange(null)}
        onConfirm={confirmRange}
      />

      <PrivacySheet visible={privacyOpen} onClose={() => setPrivacyOpen(false)} />

      <RangeSheet
        visible={rangeOpen}
        initial={settings.rangeDraft}
        labelMode={settings.labelMode}
        onClose={() => setRangeOpen(false)}
        onApply={requestRange}
      />

      <ChoiceSheet
        visible={choice === 'theme'}
        title={t.settings.rows.theme}
        options={themeOptions}
        value={settings.themeId}
        onChange={(id) => update({ themeId: id })}
        onClose={() => setChoice(null)}
        preview={<ThemeSample />}
        testID="choice-theme"
      />

      <ChoiceSheet
        visible={choice === 'appearance'}
        title={t.settings.rows.appearance}
        options={appearanceOptions}
        value={settings.appearance}
        onChange={(appearance) => update({ appearance })}
        onClose={() => setChoice(null)}
        testID="choice-appearance"
      />

      <ChoiceSheet
        visible={choice === 'size'}
        title={t.settings.rows.size}
        options={sizeOptions}
        value={settings.numberSize}
        onChange={(numberSize) => update({ numberSize })}
        onClose={() => setChoice(null)}
        testID="choice-size"
      />

      <ChoiceSheet
        visible={choice === 'labels'}
        title={t.settings.rows.labels}
        options={labelOptions}
        value={settings.labelMode}
        onChange={(labelMode) => update({ labelMode })}
        onClose={() => setChoice(null)}
        testID="choice-labels"
      />

      <ChoiceSheet
        visible={choice === 'speed'}
        title={t.settings.rows.speed}
        options={speedOptions}
        value={settings.animationSpeed}
        onChange={(animationSpeed) => update({ animationSpeed })}
        onClose={() => setChoice(null)}
        testID="choice-speed"
      />

      <ChoiceSheet
        visible={choice === 'motion'}
        title={t.settings.rows.motion}
        options={motionOptions}
        value={settings.reduceMotion}
        onChange={(reduceMotion) => update({ reduceMotion })}
        onClose={() => setChoice(null)}
        testID="choice-motion"
      />

      <ChoiceSheet
        visible={choice === 'language'}
        title={t.settings.rows.language}
        options={languageOptions}
        value={settings.language}
        onChange={(language) => update({ language })}
        onClose={() => setChoice(null)}
        testID="choice-language"
      />
    </SafeAreaView>
  );
}

/** A 42-ball in the active palette: the live preview of §4.3. */
function ThemeSample() {
  const theme = useTheme();
  const t = useMessages();
  const size = 72;

  return (
    <View
      accessible
      accessibilityLabel={t.settings.themeSample}
      testID="theme-sample"
      style={{
        width: size,
        height: size,
        borderRadius: size * theme.ball.radius,
        backgroundColor: theme.colors.ballFrom,
        borderWidth: theme.ball.ringWidth,
        borderColor: theme.colors.ballRing,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: theme.colors.ballText, fontSize: 26, fontWeight: '800' }}>42</Text>
    </View>
  );
}

type RowProps = {
  readonly label: string;
  readonly value: string;
  readonly onPress: () => void;
  readonly testID: string;
  readonly danger?: boolean;
  readonly disabled?: boolean;
};

/** One settings row: label left, current value and chevron right (§7.5). */
function Row({ label, value, onPress, testID, danger = false, disabled = false }: RowProps) {
  const theme = useTheme();
  const t = useMessages();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={t.settings.rowLabel(label, value)}
      accessibilityState={{ disabled }}
      testID={testID}
      style={({ pressed }) => [
        rowStyles.row,
        {
          backgroundColor: pressed ? theme.colors.surfaceStrong : theme.colors.surface,
          borderColor: theme.colors.border,
        },
        disabled && rowStyles.disabled,
      ]}
    >
      <Text style={[rowStyles.label, { color: danger ? theme.colors.danger : theme.colors.text }]}>
        {label}
      </Text>
      <View style={rowStyles.right}>
        {value !== '' && (
          <Text style={[rowStyles.value, { color: theme.colors.textMuted }]}>{value}</Text>
        )}
        <Text
          style={[rowStyles.chevron, { color: theme.colors.textMuted }]}
          importantForAccessibility="no"
        >
          ›
        </Text>
      </View>
    </Pressable>
  );
}

type SwitchRowProps = {
  readonly label: string;
  readonly value: boolean;
  /** One line under the label when the switch is off, so it is never a dead end. */
  readonly hint: string | null;
  readonly onValueChange: (value: boolean) => void;
  readonly testID: string;
};

/** One switch row (§7.5, §4.4): label, optional hint and the themed switch. */
function SwitchRow({ label, value, hint, onValueChange, testID }: SwitchRowProps) {
  const theme = useTheme();
  const t = useMessages();

  return (
    <View
      style={[
        rowStyles.row,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      <View style={rowStyles.switchText}>
        <Text style={[rowStyles.label, { color: theme.colors.text }]}>{label}</Text>
        {hint !== null && (
          <Text style={[rowStyles.hint, { color: theme.colors.textMuted }]}>{hint}</Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={t.settings.switchLabel(label, value)}
        testID={testID}
        trackColor={{ false: theme.colors.surfaceStrong, true: theme.colors.accent }}
        thumbColor={theme.colors.onAccent}
      />
    </View>
  );
}

/** The ranges are the same game when preset and bounds match (§3.3). */
function sameRange(a: RangeConfig, b: RangeConfig): boolean {
  return a.preset === b.preset && a.min === b.min && a.max === b.max;
}

const rowStyles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  // Visible but inert, same rule as every disabled control (§7.2).
  disabled: { opacity: 0.4 },
  label: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  switchText: { flexShrink: 1, gap: 2 },
  hint: { fontSize: 13 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  value: { fontSize: 15, flexShrink: 1 },
  chevron: { fontSize: 20 },
});

function makeStyles(theme: ThemeTokens) {
  const { colors } = theme;

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    content: { paddingHorizontal: 24, paddingBottom: 32, gap: 8 },
    title: { color: colors.text, fontSize: 20, fontWeight: '700', paddingTop: 8 },
    section: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 1,
      marginTop: 12,
    },
    hint: { color: colors.textMuted, fontSize: 15, paddingBottom: 8 },
    about: { color: colors.textMuted, fontSize: 15 },
    banner: {
      fontSize: 14,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      overflow: 'hidden',
    },
    bannerInfo: { color: colors.text, backgroundColor: colors.surface },
    bannerError: { color: colors.danger, backgroundColor: colors.surface },
  });
}

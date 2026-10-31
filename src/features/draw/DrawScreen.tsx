import { router } from 'expo-router';
import { useMemo } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DEFAULT_RANGE, formatLabel, formatRangeSpan, rangeTotal } from '@/core/engine/range';
import type { ThemeTokens } from '@/core/theme/tokens';
import { KeepAwakeWhen } from '@/features/feedback/KeepAwakeWhen';
import { useDrawFeedback } from '@/features/feedback/useDrawFeedback';
import { useMotionPlan } from '@/features/feedback/useMotionPlan';
import { gameStore, useGame } from '@/features/game/useGame';
import { useMessages } from '@/features/i18n/LocaleProvider';
import { useNumberScale, useSettingsSelector } from '@/features/settings/useSettings';
import { useTheme } from '@/features/theme/ThemeProvider';
import { Toast, useToast } from '@/ui/Toast';

import { Ball } from './Ball';
import { CompactBoard } from './CompactBoard';

/**
 * Draw screen, Phase 4 cut (plan §7.2, §7.8): header, ball, counter, primary
 * action and the secondary row (undo · history · board). The game lives in the
 * shared store (`@/features/game/useGame`), so every tab shows the same match.
 *
 * Beyond 600 pt the stage and the actions stay on the left and a compact board
 * joins them on the right, so a tablet or a proyector shows the whole range
 * without leaving Sorteo (§7.8). The ball keeps its size: the board is the
 * extra information, not a replacement.
 *
 * Appearance only: the palette comes from the active theme (§4.1), the size of
 * the number from the size preference (§4.3) and the copy from the language
 * catalog. None of them can touch the game.
 *
 * Phase 4 adds the senses around the same state: the ball animates on the UI
 * thread, sound and haptics fire after the draw is committed (§2.5), and the
 * screen stays awake only while this tab is focused and the game is running
 * (§7.9).
 */

/** From here up, the layout has room for two columns (§7.8). */
export const TABLET_BREAKPOINT = 600;

type DrawScreenProps = {
  /**
   * Whether this tab is the visible one. The route wrapper supplies it from the
   * navigator, so keep-awake follows focus and not just mounting (§7.9); the
   * default keeps component tests (and a standalone render) fully awake.
   */
  readonly focused?: boolean;
};

export function DrawScreen({ focused = true }: DrawScreenProps = {}) {
  const {
    phase,
    game,
    banner,
    busy,
    drawn,
    total,
    currentBall,
    previousBall,
    exhausted,
    onDraw,
    onUndo,
    onNewGame,
  } = useGame();
  const { width } = useWindowDimensions();
  const toast = useToast();
  const theme = useTheme();
  const t = useMessages();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const numberScale = useNumberScale();
  const labelMode = useSettingsSelector((state) => state.settings.labelMode);
  const keepAwake = useSettingsSelector((state) => state.settings.keepAwake);
  const motion = useMotionPlan(theme.motion.drawDurationMs);
  const notifyDraw = useDrawFeedback();

  // Small phones get a smaller ball instead of a squeezed layout (§7.8).
  const isTablet = width >= TABLET_BREAKPOINT;
  const ballSize = isTablet ? 300 : width < 380 ? 200 : 264;
  const range = game?.range ?? DEFAULT_RANGE;
  const ready = phase === 'ready';
  // One label function for ball, board and history, with the live preference (§3.4).
  const label = (ball: number): string => formatLabel(ball, { ...range, labelMode });
  const ballLabel = currentBall === null ? '—' : label(currentBall);
  const disabled = !ready || busy;
  const percent = total > 0 ? Math.round((drawn / total) * 100) : 0;
  // Undo is a no-op without history, so the button is disabled rather than
  // hidden: the row keeps its shape and the state stays predictable (§2.6).
  const undoDisabled = disabled || drawn === 0;
  // First launch hint, the "previous ball" chip, or nothing (§7.2).
  const hint =
    currentBall !== null
      ? previousBall === null
        ? null
        : t.draw.previous(label(previousBall))
      : ready
        ? t.draw.startHint
        : null;

  const handleUndo = (): void => {
    const undone = onUndo();
    // Only a real undo is announced: a failed or empty undo keeps its banner.
    if (undone !== null) {
      toast.show(t.draw.undoToast(label(undone)));
    }
  };

  /**
   * Draw, then feel it. The store commits synchronously, so the history length
   * after `onDraw()` tells us whether a ball actually came out: a rejected draw
   * (busy, exhausted, failed write) stays silent and still (§4.4).
   */
  const handleDraw = (): void => {
    onDraw();
    const after = gameStore.getState().game;
    if (after === null || after.history.length <= drawn) {
      return;
    }

    notifyDraw(after.status === 'exhausted');
    // The information never depends on the animation (§4.5): a screen reader
    // hears the ball and what is left even with motion reduced.
    const remaining = rangeTotal(after.range) - after.history.length;
    AccessibilityInfo.announceForAccessibility(
      t.draw.announce(label(after.history[after.history.length - 1]!.number), remaining),
    );
  };

  const body = (
    <View style={styles.main}>
      <View style={styles.stage}>
        <KeepAwakeWhen active={keepAwake && ready && !exhausted && focused} />
        <Ball
          value={ballLabel}
          size={ballSize}
          fontSize={Math.round(ballSize * 0.4 * numberScale)}
          drawKey={drawn}
          durationMs={motion.durationMs}
          fadeMs={motion.fadeMs}
          reduced={motion.reduced}
          accessibilityLabel={currentBall === null ? t.draw.emptyBall : t.draw.lastBall(ballLabel)}
        />

        <Text style={styles.counter}>{t.draw.counter(drawn, total)}</Text>
        <View
          style={styles.track}
          accessible
          accessibilityRole="progressbar"
          accessibilityLiveRegion="polite"
          accessibilityValue={{ min: 0, max: total, now: drawn }}
          accessibilityLabel={t.draw.counterLabel(drawn, total)}
        >
          <View style={[styles.fill, { width: `${percent}%` }]} />
        </View>

        {hint !== null && (
          <Text style={currentBall === null ? styles.hint : styles.previous}>{hint}</Text>
        )}

        {exhausted && <Text style={styles.complete}>{t.draw.complete(drawn, total)}</Text>}

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
      </View>

      <Pressable
        onPress={exhausted ? () => onNewGame() : handleDraw}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={exhausted ? t.draw.ctaNew : t.draw.ctaDraw}
        accessibilityState={{ disabled }}
        style={({ pressed }) => [
          styles.cta,
          disabled && styles.ctaDisabled,
          pressed && !disabled && styles.ctaPressed,
        ]}
      >
        <Text style={styles.ctaLabel}>{exhausted ? t.draw.ctaNew : t.draw.ctaDraw}</Text>
      </Pressable>

      <View style={styles.secondary}>
        <Pressable
          onPress={handleUndo}
          disabled={undoDisabled}
          accessibilityRole="button"
          accessibilityLabel={t.draw.undoLabel}
          accessibilityState={{ disabled: undoDisabled }}
          testID="draw-undo"
          style={({ pressed }) => [
            styles.secondaryButton,
            undoDisabled && styles.secondaryDisabled,
            pressed && !undoDisabled && styles.secondaryPressed,
          ]}
        >
          <Text style={styles.secondaryLabel}>{t.draw.undo}</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/history')}
          accessibilityRole="button"
          accessibilityLabel={t.draw.historyLabel}
          testID="draw-history"
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryPressed]}
        >
          <Text style={styles.secondaryLabel}>{t.tabs.history}</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/board')}
          accessibilityRole="button"
          accessibilityLabel={t.draw.boardLabel}
          testID="draw-board"
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryPressed]}
        >
          <Text style={styles.secondaryLabel}>{t.tabs.board}</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.root} testID="draw-screen">
      <View style={styles.header}>
        <Text style={styles.headerTitle} accessibilityRole="header">
          {t.draw.title}
        </Text>
        <Text style={styles.headerRange}>{formatRangeSpan(range)}</Text>
        <View style={[styles.chip, exhausted ? styles.chipDone : styles.chipLive]}>
          <Text style={[styles.chipText, exhausted && styles.chipTextDone]}>
            {exhausted ? t.draw.statusDone : t.draw.statusLive}
          </Text>
        </View>
      </View>

      <View style={[styles.body, isTablet && styles.bodyWide]}>
        {body}
        {isTablet && <CompactBoard />}
      </View>

      <Toast message={toast.message} />
    </SafeAreaView>
  );
}

function makeStyles(theme: ThemeTokens) {
  const { colors } = theme;

  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.bg,
      paddingHorizontal: 24,
      gap: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingTop: 8,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '700',
    },
    headerRange: {
      color: colors.textMuted,
      fontSize: 16,
      flexShrink: 1,
    },
    chip: {
      marginLeft: 'auto',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    chipLive: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipDone: {
      backgroundColor: colors.accent,
    },
    chipText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    chipTextDone: {
      color: colors.onAccent,
    },
    body: {
      flex: 1,
    },
    // Two columns from 600 pt: stage and actions left, compact board right (§7.8).
    bodyWide: {
      flexDirection: 'row',
      gap: 24,
    },
    main: {
      flex: 1,
      gap: 16,
    },
    stage: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
    },
    counter: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    track: {
      alignSelf: 'stretch',
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      backgroundColor: colors.accent,
    },
    hint: {
      color: colors.textMuted,
      fontSize: 16,
      textAlign: 'center',
    },
    previous: {
      color: colors.textMuted,
      fontSize: 16,
      textAlign: 'center',
    },
    complete: {
      color: colors.accent,
      fontSize: 17,
      fontWeight: '700',
      textAlign: 'center',
    },
    banner: {
      fontSize: 15,
      textAlign: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      overflow: 'hidden',
    },
    bannerInfo: {
      color: colors.text,
      backgroundColor: colors.surface,
    },
    bannerError: {
      color: colors.danger,
      backgroundColor: colors.surface,
    },
    cta: {
      minHeight: 64,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
      marginBottom: 16,
    },
    ctaDisabled: {
      // Visible but inert: opacity, never `display: none` (§7.2).
      opacity: 0.4,
    },
    ctaPressed: {
      opacity: 0.85,
    },
    ctaLabel: {
      color: colors.onAccent,
      fontSize: 20,
      fontWeight: '800',
    },
    secondary: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    secondaryButton: {
      flex: 1,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    secondaryDisabled: {
      // Same rule as the primary action: visible but inert (§7.2).
      opacity: 0.4,
    },
    secondaryPressed: {
      backgroundColor: colors.surfaceStrong,
    },
    secondaryLabel: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
    },
  });
}

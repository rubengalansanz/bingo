import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DEFAULT_RANGE, formatRangeSpan } from '@/core/engine/range';

import { useGame } from './useGame';

/**
 * Draw screen, Phase 1 cut (plan §7.2): header, ball, counter, primary action.
 * No themes (Phase 3), no animation or sound (Phase 4), no board/history/settings
 * tabs yet (Phase 2/3) — this is the screen that has to make `INV-1` visible.
 */

const COLORS = {
  background: '#0E2A1E',
  surface: '#16382A',
  line: '#23573F',
  text: '#F5F1E6',
  muted: '#9DB8A8',
  accent: '#E8C547',
  danger: '#F2A6A6',
};

/**
 * Copy under the ball (§7.2): the first-launch hint while the board is empty,
 * the "previous ball" chip once there is one, and nothing while loading or
 * after a boot failure (the banner carries that message).
 */
function stageHint(
  currentBall: number | null,
  previousBall: number | null,
  ready: boolean,
): string | null {
  if (currentBall === null) {
    return ready ? 'Tocá «Sacar bola» para empezar.' : null;
  }
  return previousBall === null ? null : `Anterior: ${previousBall}`;
}

export function DrawScreen() {
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
    onNewGame,
  } = useGame();
  const { width } = useWindowDimensions();

  // Small phones get a smaller ball instead of a squeezed layout (§7.8).
  const ballSize = width < 380 ? 200 : 264;
  const range = game?.range ?? DEFAULT_RANGE;
  const ready = phase === 'ready';
  const disabled = !ready || busy;
  const percent = total > 0 ? Math.round((drawn / total) * 100) : 0;

  return (
    <SafeAreaView style={styles.root} testID="draw-screen">
      <View style={styles.header}>
        <Text style={styles.headerTitle} accessibilityRole="header">
          Partida
        </Text>
        <Text style={styles.headerRange}>{formatRangeSpan(range)}</Text>
        <View style={[styles.chip, exhausted ? styles.chipDone : styles.chipLive]}>
          <Text style={styles.chipText}>{exhausted ? 'Completa' : 'En juego'}</Text>
        </View>
      </View>

      <View style={styles.stage}>
        <View
          style={[styles.ball, { width: ballSize, height: ballSize, borderRadius: ballSize / 2 }]}
          accessible
          accessibilityRole="image"
          accessibilityLabel={
            currentBall === null ? 'Bombo sin bolas extraídas' : `Última bola: ${currentBall}`
          }
        >
          <Text style={[styles.ballValue, { fontSize: Math.round(ballSize * 0.4) }]}>
            {currentBall === null ? '—' : currentBall}
          </Text>
        </View>

        <Text style={styles.counter}>
          {drawn} de {total}
        </Text>
        <View
          style={styles.track}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: total, now: drawn }}
          accessibilityLabel={`${drawn} de ${total} bolas extraídas`}
        >
          <View style={[styles.fill, { width: `${percent}%` }]} />
        </View>

        {stageHint(currentBall, previousBall, ready) !== null && (
          <Text style={previousBall === null ? styles.hint : styles.previous}>
            {stageHint(currentBall, previousBall, ready)}
          </Text>
        )}

        {exhausted && (
          <Text style={styles.complete}>
            Partida completa · {drawn} de {total}
          </Text>
        )}

        {banner !== null && (
          <Text
            accessibilityRole="alert"
            style={[
              styles.banner,
              banner.tone === 'error' ? styles.bannerError : styles.bannerInfo,
            ]}
          >
            {banner.text}
          </Text>
        )}
      </View>

      <Pressable
        onPress={exhausted ? onNewGame : onDraw}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={exhausted ? 'Nueva partida' : 'Sacar bola'}
        accessibilityState={{ disabled }}
        style={({ pressed }) => [
          styles.cta,
          disabled && styles.ctaDisabled,
          pressed && !disabled && styles.ctaPressed,
        ]}
      >
        <Text style={styles.ctaLabel}>{exhausted ? 'Nueva partida' : 'Sacar bola'}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
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
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
  },
  headerRange: {
    color: COLORS.muted,
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
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  chipDone: {
    backgroundColor: COLORS.accent,
  },
  chipText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  ball: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.text,
  },
  ballValue: {
    color: COLORS.background,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  counter: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  track: {
    alignSelf: 'stretch',
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: COLORS.accent,
  },
  hint: {
    color: COLORS.muted,
    fontSize: 16,
    textAlign: 'center',
  },
  previous: {
    color: COLORS.muted,
    fontSize: 16,
    textAlign: 'center',
  },
  complete: {
    color: COLORS.accent,
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
    color: COLORS.text,
    backgroundColor: COLORS.surface,
  },
  bannerError: {
    color: COLORS.danger,
    backgroundColor: COLORS.surface,
  },
  cta: {
    minHeight: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
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
    color: COLORS.background,
    fontSize: 20,
    fontWeight: '800',
  },
});

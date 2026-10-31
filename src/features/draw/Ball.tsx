import { Canvas, Circle, RadialGradient, vec } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { ThemeTokens } from '@/core/theme/tokens';
import { useTheme } from '@/features/theme/ThemeProvider';

/**
 * The ball (plan §7.2, §5.3): the protagonist of the screen.
 *
 * - The gradient and the specular highlight are drawn once by Skia from theme
 *   tokens, so a theme change is a token change, not a new asset (§4.1).
 * - The entrance runs on Reanimated's UI thread and animates **only** opacity
 *   and transform (§5.3 rule 1). It is driven by `drawKey`, the number of draws,
 *   so the animation follows the state that was already committed to SQLite:
 *   a killed process never animates a ball that was not saved.
 * - With reduced motion there is no scale and no translation, only a short
 *   cross-fade; the number is always readable (§4.5).
 * - The number keeps tabular figures so it does not change width between 1 and
 *   8 while animating (§4.6).
 */

export type BallProps = {
  /** `—` before the first draw, otherwise the ball label (e.g. `B-12`). */
  readonly value: string;
  readonly size: number;
  readonly fontSize: number;
  /** Drawing count; `0` means the empty ball, which never animates. */
  readonly drawKey: number;
  readonly durationMs: number;
  readonly fadeMs: number;
  readonly reduced: boolean;
  readonly accessibilityLabel: string;
};

/** Cross-fade used when motion is reduced (§4.4). */
function entranceDuration(durationMs: number, fadeMs: number, reduced: boolean): number {
  if (reduced) {
    return fadeMs;
  }
  return durationMs;
}

export function Ball(props: BallProps) {
  const theme = useTheme();
  const { value, size, fontSize, drawKey, durationMs, fadeMs, reduced, accessibilityLabel } = props;
  const progress = useSharedValue(1);

  useEffect(() => {
    if (drawKey === 0) {
      // The empty ball is static: nothing to announce, nothing to animate.
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: entranceDuration(durationMs, fadeMs, reduced),
      easing: Easing.out(Easing.cubic),
    });
  }, [drawKey, durationMs, fadeMs, reduced, progress]);

  const animated = useAnimatedStyle(() => {
    const value = progress.value;
    return {
      opacity: Math.min(1, 0.35 + 0.65 * value),
      transform: [{ scale: reduced ? 1 : 0.9 + 0.1 * value }],
    };
  });

  return (
    <Animated.View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[{ width: size, height: size }, animated]}
    >
      <BallSurface theme={theme} size={size} fontSize={fontSize} value={value} />
    </Animated.View>
  );
}

function BallSurface({
  theme,
  size,
  fontSize,
  value,
}: {
  readonly theme: ThemeTokens;
  readonly size: number;
  readonly fontSize: number;
  readonly value: string;
}) {
  const ring = theme.ball.ringWidth;

  return (
    <View
      style={[
        styles.surface,
        {
          width: size,
          height: size,
          borderRadius: size * theme.ball.radius,
          borderWidth: ring,
          borderColor: theme.colors.ballRing,
          backgroundColor: theme.colors.ballFrom,
        },
      ]}
    >
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Circle cx={size / 2} cy={size / 2} r={size / 2}>
          <RadialGradient
            c={vec(size * 0.34, size * 0.3)}
            r={size * 0.8}
            colors={[theme.colors.ballFrom, theme.colors.ballTo]}
            positions={[0, 1]}
          />
        </Circle>
        {/* Specular highlight: keeps the ball from looking like a flat disc. */}
        <Circle cx={size * 0.33} cy={size * 0.27} r={size * 0.1} color="rgba(255,255,255,0.42)" />
      </Canvas>

      <Text
        testID="draw-ball"
        numberOfLines={1}
        adjustsFontSizeToFit
        allowFontScaling={false}
        style={[styles.value, { color: theme.colors.ballText, fontSize }]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 12,
  },
  value: {
    width: '100%',
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});

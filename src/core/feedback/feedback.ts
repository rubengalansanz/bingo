import type { AnimationSpeed, ReduceMotionPreference } from '../settings/settings';

/**
 * Sensory feedback and motion policy (plan §4.4, §5.3, §7.9).
 *
 * Pure on purpose: the same rules decide the sound, the haptic and the exact
 * duration of the ball animation, so the screen only executes the plan and the
 * 100 % branch gate covers every combination without a device.
 *
 * Rules that come straight from the plan:
 * - sound and haptics are *fire-and-forget*: if the platform refuses, the draw
 *   still happens and nothing blocks (§4.4);
 * - `reduceMotion: auto` follows `AccessibilityInfo.isReduceMotionEnabled()`;
 * - with reduced motion there is no movement at all, only a short cross-fade,
 *   because the information must never depend on the animation (§4.5).
 */

/** Cross-fade used instead of the entrance when motion is reduced (§4.4). */
export const REDUCED_MOTION_FADE_MS = 120;

export type HapticCue = 'impact' | 'success';

export type FeedbackPlan = {
  readonly sound: boolean;
  /** `impact` on a draw, `success` when the pool is exhausted, `null` off. */
  readonly haptic: HapticCue | null;
};

export type FeedbackPreferences = {
  readonly sound: boolean;
  readonly haptics: boolean;
};

/**
 * What to play/feel after a committed draw. `exhausted` is the state of the
 * game *after* the draw, so the success haptic lands on the last ball.
 */
export function feedbackFor(preferences: FeedbackPreferences, exhausted: boolean): FeedbackPlan {
  return {
    sound: preferences.sound,
    haptic: preferences.haptics ? (exhausted ? 'success' : 'impact') : null,
  };
}

/** `auto` follows the system; `on`/`off` are explicit and win (§4.4). */
export function resolvesReduceMotion(
  preference: ReduceMotionPreference,
  systemReduced: boolean,
): boolean {
  return preference === 'auto' ? systemReduced : preference === 'on';
}

/**
 * Duration of the ball entrance. Reduced motion ⇒ `0` (the screen swaps it for
 * `REDUCED_MOTION_FADE_MS` of opacity); otherwise the theme's base time divided
 * by the speed multiplier, never negative.
 */
export function motionDuration(baseMs: number, speed: AnimationSpeed, reduced: boolean): number {
  if (reduced) {
    return 0;
  }
  return Math.max(0, Math.round(baseMs / speed));
}

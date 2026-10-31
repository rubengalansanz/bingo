import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import {
  REDUCED_MOTION_FADE_MS,
  motionDuration,
  resolvesReduceMotion,
} from '@/core/feedback/feedback';
import { useSettingsSelector } from '@/features/settings/useSettings';

/**
 * Motion plan of the ball (plan §4.4, §4.5).
 *
 * The system preference is read once and then listened to, because the user can
 * turn "remove animations" on while the app is open. A theme supplies the base
 * duration; the user's speed divides it and reduced motion removes the movement
 * entirely, leaving only the cross-fade the plan requires.
 */

export function useSystemReduceMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive) {
        setReduced(value);
      }
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}

export type MotionPlan = {
  /** Entrance duration; `0` means "no movement, only the cross-fade". */
  readonly durationMs: number;
  /** Cross-fade used when motion is reduced (§4.4). */
  readonly fadeMs: number;
  /** `true` when the ball must not scale or translate at all. */
  readonly reduced: boolean;
};

export function useMotionPlan(baseMs: number): MotionPlan {
  const preference = useSettingsSelector((state) => state.settings.reduceMotion);
  const speed = useSettingsSelector((state) => state.settings.animationSpeed);
  const systemReduced = useSystemReduceMotion();
  const reduced = resolvesReduceMotion(preference, systemReduced);

  return {
    durationMs: motionDuration(baseMs, speed, reduced),
    fadeMs: REDUCED_MOTION_FADE_MS,
    reduced,
  };
}

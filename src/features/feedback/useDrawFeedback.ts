import { useCallback } from 'react';

import { feedbackFor } from '@/core/feedback/feedback';
import { useSettingsSelector } from '@/features/settings/useSettings';
import { nativeFeedback, type FeedbackPort } from '@/shared/feedback/native';

/**
 * Sound and haptics after a committed draw (plan §4.4).
 *
 * The hook only executes the plan from `@/core/feedback`; it never decides by
 * itself. The port is injected so a component test can assert what was played
 * without a native module, and so a platform without audio simply does nothing.
 *
 * Called with the state *after* the draw, which is what makes the last ball
 * play the completion cue and the success haptic.
 */
export function useDrawFeedback(port: FeedbackPort = nativeFeedback): (exhausted: boolean) => void {
  const sound = useSettingsSelector((state) => state.settings.sound);
  const haptics = useSettingsSelector((state) => state.settings.haptics);

  return useCallback(
    (exhausted: boolean) => {
      const plan = feedbackFor({ sound, haptics }, exhausted);
      if (plan.sound) {
        if (exhausted) {
          port.playComplete();
        } else {
          port.playBall();
        }
      }
      if (plan.haptic === 'impact') {
        port.impact();
      } else if (plan.haptic === 'success') {
        port.success();
      }
    },
    [sound, haptics, port],
  );
}

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

/**
 * Sound and haptics adapter (plan §4.4).
 *
 * Everything here is **fire-and-forget**: a missing audio route, a broken clip
 * or a device without a Taptic Engine must never delay or block a draw. Every
 * call swallows its error and returns immediately; the policy that decides
 * *whether* to play lives in `@/core/feedback`, not here.
 *
 * The clips are bundled (the app is offline) and the players are created lazily
 * on the first draw, so opening the app never touches audio.
 */

/** Adapter surface; tests inject a fake instead of mocking the native modules. */
export type FeedbackPort = {
  playBall(): void;
  playComplete(): void;
  impact(): void;
  success(): void;
};

const BALL_CLIP = require('../../../assets/sounds/ball.wav');
const COMPLETE_CLIP = require('../../../assets/sounds/complete.wav');

let ballPlayer: AudioPlayer | null = null;
let completePlayer: AudioPlayer | null = null;
let audioModeRequested = false;

/**
 * Play even with the iOS mute switch on: the phone is the bombo, and a caller
 * who turned sound on expects to hear the ball (§4.4). The setting itself is
 * the user's switch, not the hardware button.
 */
function ensureAudioMode(): void {
  if (audioModeRequested) {
    return;
  }
  audioModeRequested = true;
  void setAudioModeAsync({ playsInSilentMode: true }).catch(() => {
    // Silent mode not applied: the cue still plays, or fails quietly.
  });
}

function playClip(
  clip: number,
  current: () => AudioPlayer | null,
  store: (player: AudioPlayer) => void,
): void {
  try {
    ensureAudioMode();
    let player = current();
    if (player === null) {
      player = createAudioPlayer(clip);
      store(player);
    }
    // Rewind synchronously so a repeated tap retriggers instead of being a
    // no-op at the end of the clip (`seekTo` is async and would race the tap).
    player.currentTime = 0;
    player.play();
  } catch {
    // Fire-and-forget by contract (§4.4): never block the draw.
  }
}

export const nativeFeedback: FeedbackPort = {
  playBall() {
    playClip(
      BALL_CLIP,
      () => ballPlayer,
      (player) => {
        ballPlayer = player;
      },
    );
  },
  playComplete() {
    playClip(
      COMPLETE_CLIP,
      () => completePlayer,
      (player) => {
        completePlayer = player;
      },
    );
  },
  impact() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },
  success() {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
};

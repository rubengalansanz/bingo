import {
  REDUCED_MOTION_FADE_MS,
  feedbackFor,
  motionDuration,
  resolvesReduceMotion,
} from '../feedback';

/**
 * Feedback and motion policy (plan §4.4, §5.3). Data assertions only: the
 * screens must never hard-code a duration or decide by themselves whether the
 * sound plays.
 */

describe('feedbackFor (§4.4)', () => {
  it('plays the ball and an impact haptic on a normal draw', () => {
    expect(feedbackFor({ sound: true, haptics: true }, false)).toEqual({
      sound: true,
      haptic: 'impact',
    });
  });

  it('celebrates the last ball with the success haptic', () => {
    expect(feedbackFor({ sound: true, haptics: true }, true)).toEqual({
      sound: true,
      haptic: 'success',
    });
  });

  it('honours each switch independently', () => {
    expect(feedbackFor({ sound: false, haptics: true }, false)).toEqual({
      sound: false,
      haptic: 'impact',
    });
    expect(feedbackFor({ sound: true, haptics: false }, false)).toEqual({
      sound: true,
      haptic: null,
    });
  });

  it('stays silent and still with both off', () => {
    expect(feedbackFor({ sound: false, haptics: false }, true)).toEqual({
      sound: false,
      haptic: null,
    });
  });
});

describe('resolvesReduceMotion (§4.4)', () => {
  it('follows the system in auto', () => {
    expect(resolvesReduceMotion('auto', true)).toBe(true);
    expect(resolvesReduceMotion('auto', false)).toBe(false);
  });

  it('lets an explicit choice win over the system', () => {
    expect(resolvesReduceMotion('on', false)).toBe(true);
    expect(resolvesReduceMotion('off', true)).toBe(false);
  });
});

describe('motionDuration (§4.4, §5.3)', () => {
  it('uses the theme base time at 1×', () => {
    expect(motionDuration(400, 1, false)).toBe(400);
  });

  it('divides by the speed multiplier', () => {
    expect(motionDuration(400, 0.5, false)).toBe(800);
    expect(motionDuration(400, 1.5, false)).toBe(267);
  });

  it('removes the movement entirely when motion is reduced', () => {
    expect(motionDuration(400, 1, true)).toBe(0);
    expect(REDUCED_MOTION_FADE_MS).toBe(120);
  });

  it('never returns a negative duration', () => {
    expect(motionDuration(-10, 1, false)).toBe(0);
  });
});

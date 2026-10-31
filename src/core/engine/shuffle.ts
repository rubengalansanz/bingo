import { randomInt, type Rng } from './rng';

/**
 * Fisher-Yates (plan §2.2, ADR-02).
 *
 * The shuffled copy is consumed with `pop()`, so a drawn number *leaves* the
 * array: non-repetition is structural, not defensive. It also runs in O(1) per
 * draw with no retry loop, which keeps the animation latency flat until the very
 * last ball.
 *
 * Does not mutate `input`.
 */
export function shuffle<T>(input: readonly T[], rng: Rng): T[] {
  const a = input.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    // `!` is safe: 0 <= j <= i < a.length.
    const current = a[i]!;
    a[i] = a[j]!;
    a[j] = current;
  }
  return a;
}

/**
 * Randomness (plan §2.8).
 *
 * Contract: a Rng returns a float in [0, 1) with exactly 32 bits of resolution,
 * so `Math.floor(rng() * 2^32)` is uniform over [0, 2^32).
 *
 * This module has no native imports: the platform CSPRNG is injected as a
 * Uint32Source port (see src/shared/random/expoCryptoSource.ts). That keeps
 * `core` testable in Node, as required by plan §5.2.
 */

/** Uniform float in [0, 1) with 32 bits of resolution. */
export type Rng = () => number;

/** Uniform unsigned 32-bit integer in [0, 2^32). */
export type Uint32Source = () => number;

export const UINT32_SPACE = 0x1_0000_0000;

/**
 * Upper bound on rejection-sampling retries. With a uniformly distributed rng the
 * rejection probability is at most (k-1)/2^32, so a sane rng never reaches this.
 * It exists so that a broken rng fails loudly instead of hanging the draw screen.
 */
const MAX_REJECTION_ATTEMPTS = 64;

/** Wraps a platform CSPRNG port (SecureRandom / SecRandomCopyBytes) as a Rng. */
export function cryptoRng(next32: Uint32Source): Rng {
  return () => (next32() >>> 0) / UINT32_SPACE;
}

/**
 * Seeded PRNG. Deterministic and fast, but NOT secure: only for tests and the
 * dev/demo reproducible mode. Never for a real draw (plan §2.8).
 */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / UINT32_SPACE;
  };
}

/**
 * Unbiased integer in [0, maxExclusive) via rejection sampling on 32 bits.
 * `value % maxExclusive` alone would bias the low values; rejecting the tail
 * above `floor(2^32 / k) * k` removes that bias exactly (plan §2.8).
 */
export function randomInt(rng: Rng, maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > UINT32_SPACE) {
    throw new RangeError(
      `randomInt: maxExclusive must be an integer in [1, 2^32], received ${maxExclusive}`,
    );
  }

  const limit = Math.floor(UINT32_SPACE / maxExclusive) * maxExclusive;

  for (let attempt = 0; attempt < MAX_REJECTION_ATTEMPTS; attempt++) {
    const value = Math.floor(rng() * UINT32_SPACE);
    if (value < limit) {
      return value % maxExclusive;
    }
  }

  throw new RangeError('randomInt: rng() did not behave like a uniform source in [0, 1)');
}

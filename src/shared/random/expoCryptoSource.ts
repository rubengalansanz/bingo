import { getRandomValues } from 'expo-crypto';

import type { Uint32Source } from '@/core/engine/rng';

/**
 * Platform CSPRNG adapter (plan §2.8): `SecRandomCopyBytes` on iOS,
 * `java.security.SecureRandom` on Android.
 *
 * This is the only place where the DOM-free core touches a native module, which is
 * why it lives in `shared/` and not in `core/engine/`.
 */
export function expoCryptoSource(): Uint32Source {
  const buffer = new Uint32Array(1);
  return () => {
    getRandomValues(buffer);
    // Contract: getRandomValues fills every element of the buffer.
    return buffer[0]!;
  };
}

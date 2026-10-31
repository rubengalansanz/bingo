import { createMMKV } from 'react-native-mmkv';

import type { KeyValueStorage } from '@/core/settings/settings';

/**
 * MMKV adapter for preferences (plan §5.4, ADR-05).
 *
 * The only module that touches the native key-value store; the domain only
 * knows the `KeyValueStorage` port, and the store receives it by injection.
 * MMKV v4 needs `react-native-nitro-modules`, so adding it requires rebuilding
 * the development client once (README, Fase 3).
 */

const mmkv = createMMKV({ id: 'bingo.preferences' });

export const mmkvStorage: KeyValueStorage = {
  get: (key) => mmkv.getString(key) ?? null,
  set: (key, value) => {
    mmkv.set(key, value);
  },
};

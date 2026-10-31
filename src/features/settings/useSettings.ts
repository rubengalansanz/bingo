import { useStore } from 'zustand';

import { numberScale } from '@/core/settings/settings';
import { mmkvStorage } from '@/shared/kv/mmkv';

import { createSettingsStore, type SettingsStore } from './settingsStore';

/**
 * App binding for preferences: the only place where the settings store meets
 * MMKV. Screens subscribe through the selectors below, so a size change does
 * not re-render the board and a theme change does not touch the game.
 */

export const settingsStore = createSettingsStore(mmkvStorage);

/** Granular subscription; re-renders only when the selected slice changes. */
export function useSettingsSelector<T>(selector: (state: SettingsStore) => T): T {
  return useStore(settingsStore, selector);
}

/** The whole preference state plus its actions (for the Ajustes screen). */
export function useSettings(): SettingsStore {
  return useSettingsSelector((state) => state);
}

/** Font multiplier of the number-size preference (§4.3). */
export function useNumberScale(): number {
  return numberScale(useSettingsSelector((state) => state.settings.numberSize));
}

import { createStore, type StoreApi } from 'zustand/vanilla';

import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  parseSettings,
  serializeSettings,
  type KeyValueStorage,
  type Settings,
} from '@/core/settings/settings';
import type { RangeConfig } from '@/core/engine/types';

/**
 * Preferences in memory (plan §4.7, §5.4).
 *
 * Mirrors `gameStore`: the source of truth is the persisted value, this store
 * is a read cache with the same dependency injection, so it imports no native
 * code and is tested against a `Map`. A write failure never blocks the start:
 * the choice still applies for the session and `persistenceError` tells the
 * screen the value will not survive a restart.
 */

export type SettingsState = {
  readonly settings: Settings;
  /** `true` when the last read or write of the storage failed. */
  readonly persistenceError: boolean;
};

export type SettingsActions = {
  /** Reads storage once at boot; safe to call twice. */
  load: () => void;
  /** Applies and persists a subset of the preferences. */
  update: (patch: Partial<Omit<Settings, 'schemaVersion' | 'rangeDraft'>>) => void;
  /** Stores the range for the next game (§3.3); it never touches the game. */
  setRange: (range: RangeConfig) => void;
};

export type SettingsStore = SettingsState & SettingsActions;

export const SETTINGS_SAVE_FAILED = 'No se pudieron guardar los ajustes.';

export function createSettingsStore(storage: KeyValueStorage): StoreApi<SettingsStore> {
  return createStore<SettingsStore>()((set, get) => {
    /** State first, then storage: the UI never waits for a disk write. */
    const commit = (next: Settings): void => {
      try {
        storage.set(SETTINGS_STORAGE_KEY, serializeSettings(next));
        set({ settings: next, persistenceError: false });
      } catch {
        set({ settings: next, persistenceError: true });
      }
    };

    return {
      settings: DEFAULT_SETTINGS,
      persistenceError: false,

      load: () => {
        try {
          set({
            settings: parseSettings(storage.get(SETTINGS_STORAGE_KEY)),
            persistenceError: false,
          });
        } catch {
          // An unreadable store is not fatal: keep the defaults (§4.7).
          set({ persistenceError: true });
        }
      },

      update: (patch) => {
        const current = get().settings;
        const labelMode = patch.labelMode ?? current.labelMode;
        commit({
          ...current,
          ...patch,
          // The draft always carries the current label preference, so the next
          // game is materialised with the same labels the board will print.
          rangeDraft: { ...current.rangeDraft, labelMode },
        });
      },

      setRange: (range) => {
        commit({ ...get().settings, rangeDraft: range });
      },
    };
  });
}

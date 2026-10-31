import { PRESETS, customRange } from '@/core/engine/range';
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  parseSettings,
  type KeyValueStorage,
} from '@/core/settings/settings';

import { createSettingsStore } from '../settingsStore';

/**
 * Preference persistence (plan §4.7, §5.4): the store is a cache over
 * key-value storage, injected as a port. A failed read leaves the defaults; a
 * failed write still applies the choice but sets `persistenceError`, so Ajustes
 * can say it will not survive a restart.
 */

type Harness = {
  readonly store: ReturnType<typeof createSettingsStore>;
  readonly storage: KeyValueStorage & { readonly data: Map<string, string>; fail: boolean };
};

function harness(initial?: Record<string, string>): Harness {
  const data = new Map(Object.entries(initial ?? {}));
  const storage = {
    data,
    fail: false,
    get: (key: string): string | null => {
      if (storage.fail) {
        throw new Error('read failed');
      }
      return data.get(key) ?? null;
    },
    set: (key: string, value: string): void => {
      if (storage.fail) {
        throw new Error('write failed');
      }
      data.set(key, value);
    },
  };

  return { storage, store: createSettingsStore(storage) };
}

describe('settingsStore — load (§4.7)', () => {
  it('starts from the defaults before loading', () => {
    const { store } = harness();

    expect(store.getState().settings).toEqual(DEFAULT_SETTINGS);
    expect(store.getState().persistenceError).toBe(false);
  });

  it('loads a valid stored blob', () => {
    const { store, storage } = harness({
      [SETTINGS_STORAGE_KEY]: JSON.stringify({
        ...DEFAULT_SETTINGS,
        themeId: 'neon',
        appearance: 'light',
      }),
    });

    store.getState().load();

    expect(store.getState().settings.themeId).toBe('neon');
    expect(store.getState().settings.appearance).toBe('light');
    expect(storage.data.size).toBe(1);
  });

  it('keeps the defaults for a corrupt blob', () => {
    const { store } = harness({ [SETTINGS_STORAGE_KEY]: 'not json' });

    store.getState().load();

    expect(store.getState().settings).toEqual(DEFAULT_SETTINGS);
    expect(store.getState().persistenceError).toBe(false);
  });

  it('reports a read failure without losing the defaults', () => {
    const { store, storage } = harness({
      [SETTINGS_STORAGE_KEY]: JSON.stringify({ ...DEFAULT_SETTINGS, themeId: 'festive' }),
    });
    storage.fail = true;

    store.getState().load();

    expect(store.getState().settings).toEqual(DEFAULT_SETTINGS);
    expect(store.getState().persistenceError).toBe(true);
  });
});

describe('settingsStore — update (§4.3)', () => {
  it('applies and persists a preference', () => {
    const { store, storage } = harness();

    store.getState().update({ themeId: 'minimal', numberSize: 'xlarge' });

    expect(store.getState().settings.themeId).toBe('minimal');
    expect(store.getState().settings.numberSize).toBe('xlarge');
    const stored = parseSettings(storage.data.get(SETTINGS_STORAGE_KEY) ?? null);
    expect(stored.themeId).toBe('minimal');
    expect(store.getState().persistenceError).toBe(false);
  });

  it('keeps the draft label mode in sync with the preference (§3.4)', () => {
    const { store } = harness();

    store.getState().update({ labelMode: 'number' });

    expect(store.getState().settings.labelMode).toBe('number');
    expect(store.getState().settings.rangeDraft.labelMode).toBe('number');
    // The rest of the draft is untouched.
    expect(store.getState().settings.rangeDraft.min).toBe(DEFAULT_SETTINGS.rangeDraft.min);
  });

  it('applies the choice even when the write fails, and flags it', () => {
    const { store, storage } = harness();
    storage.fail = true;

    store.getState().update({ appearance: 'dark' });

    expect(store.getState().settings.appearance).toBe('dark');
    expect(store.getState().persistenceError).toBe(true);
  });

  it('clears the error after a successful write', () => {
    const { store, storage } = harness();
    storage.fail = true;
    store.getState().update({ appearance: 'dark' });
    expect(store.getState().persistenceError).toBe(true);

    storage.fail = false;
    store.getState().update({ appearance: 'light' });

    expect(store.getState().persistenceError).toBe(false);
  });
});

describe('settingsStore — range draft (§3.3)', () => {
  it('stores the range for the next game without touching the current one', () => {
    const { store, storage } = harness();
    const range = customRange(1, 5, 'number');

    store.getState().setRange(range);

    expect(store.getState().settings.rangeDraft).toEqual(range);
    const stored = parseSettings(storage.data.get(SETTINGS_STORAGE_KEY) ?? null);
    // On reload the draft takes the label preference, which is the display truth.
    expect(stored.rangeDraft).toEqual({ ...range, labelMode: DEFAULT_SETTINGS.labelMode });
    // The preset label preference is not silently rewritten.
    expect(store.getState().settings.labelMode).toBe(DEFAULT_SETTINGS.labelMode);
  });

  it('persists a preset draft with its labels', () => {
    const { store } = harness();

    store.getState().setRange({ ...PRESETS.us75, labelMode: 'number' });

    expect(store.getState().settings.rangeDraft).toEqual({ ...PRESETS.us75, labelMode: 'number' });
  });
});

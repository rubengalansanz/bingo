import { createStore, type StoreApi } from 'zustand/vanilla';

import type { GameRepository } from '@/core/db/repositories/game.repository';
import { createGame, draw, integrityCheck, undo } from '@/core/engine/game';
import { DEFAULT_RANGE, rangeTotal } from '@/core/engine/range';
import type { Rng } from '@/core/engine/rng';
import type { Game, RangeConfig } from '@/core/engine/types';
import type { BannerCode } from '@/core/i18n/messages';

/**
 * The one game in memory (plan §5.4, ADR-07).
 *
 * The store is a **read cache**: the source of truth is the engine plus SQLite.
 * Every mutation follows the same order that protects `INV-1` (§2.5):
 *
 *   engine (pure) → GameRepository (one transaction) → set(state)
 *
 * The React state only ever learns about a change *after* SQLite committed it,
 * so a crash leaves the UI one step behind, never one ahead.
 *
 * No `persist` middleware on purpose (§5.4): it rewrites a whole blob without
 * transactions. Persistence is explicit, through the repository.
 *
 * Dependencies are injected (`openRepository`, `now`, `rng`) so this module
 * imports no native code and is testable against a real SQLite in Node.
 */

/**
 * A message for the UI, held as a **code** plus its tone.
 *
 * The store never formats a sentence: the copy belongs to the language
 * catalog, so the same failure reads correctly in Spanish and in English.
 */
export type Banner = {
  readonly tone: 'info' | 'error';
  readonly code: BannerCode;
};

export type GameState = {
  readonly phase: 'loading' | 'ready' | 'error';
  readonly game: Game | null;
  readonly banner: Banner | null;
  /** Anti double-tap lock after a committed draw (§7.9). */
  readonly busy: boolean;
};

export type GameActions = {
  /** Loads the stored game (or creates the first one). Idempotent. */
  boot: () => Promise<void>;
  drawBall: () => void;
  /**
   * Undoes one draw and returns the ball that went back to the bombo, or
   * `null` when nothing happened (empty history, busy or a failed write).
   * The screen uses that number to announce the undo; the toast is transient
   * UI state and never lives in the store (§5.4).
   */
  undoBall: () => number | null;
  /** Fresh game; without a range it keeps the current one (restart, §7.6). */
  startNewGame: (range?: RangeConfig) => void;
};

export type GameStore = GameState & GameActions;

export type GameStoreDeps = {
  /**
   * Repository factory. Throwing here (a failed migration) is a boot failure,
   * not a crash: boot turns it into the `error` phase (§7.7).
   */
  openRepository: () => GameRepository;
  /** Injected clock: the engine never reads the system time itself (§6.3). */
  now: () => number;
  /** Injected randomness (§2.8). */
  rng: () => Rng;
  /**
   * Range persisted as a preference (§3.3). Injected so the store keeps no
   * dependency on the settings store: the app binding wires both.
   */
  readRange: () => RangeConfig;
};

/** How long the primary action stays disabled after a commit (§7.9). */
export const BUSY_MS = 300;

export function createGameStore(deps: GameStoreDeps): StoreApi<GameStore> {
  let booted: Promise<void> | null = null;

  return createStore<GameStore>()((set, get) => {
    /** Shared guard: only a ready, idle store accepts a mutation. */
    const canMutate = (): Game | null => {
      const { phase, busy, game } = get();
      return phase === 'ready' && !busy ? game : null;
    };

    return {
      phase: 'loading',
      game: null,
      banner: null,
      busy: false,

      boot: () => {
        // Idempotent: a second mount (React strict mode, Fast Refresh) reuses
        // the in-flight boot instead of loading the game twice (§5.4).
        if (booted !== null) {
          return booted;
        }

        booted = Promise.resolve().then(() => {
          try {
            const repo = deps.openRepository();
            let game = repo.loadCurrent();
            let banner: Banner | null = null;

            if (game === null) {
              game = createGame(deps.readRange(), deps.rng(), deps.now());
              repo.saveNew(game);
            } else {
              const report = integrityCheck(game, deps.rng());
              if (!report.ok) {
                // Persisted immediately: the next boot is already clean (§2.5).
                repo.save(report.repaired);
                game = report.repaired;
                banner = { tone: 'info', code: 'repair' };
              }
            }

            set({ phase: 'ready', game, banner, busy: false });
          } catch {
            set({
              phase: 'error',
              game: null,
              banner: { tone: 'error', code: 'bootFailed' },
              busy: false,
            });
          }
        });

        return booted;
      },

      drawBall: () => {
        const game = canMutate();
        if (game === null) {
          return;
        }

        const result = draw(game, deps.now());
        if (!result.ok) {
          // EXHAUSTED: the screen offers "Nueva partida" instead (§2.4).
          return;
        }

        try {
          // Commit first, show later: the ball exists before it is displayed.
          deps.openRepository().commitDraw(result.value.game, result.value.record);
        } catch {
          // Rollback is implicit: the in-memory game was never updated.
          set({ banner: { tone: 'error', code: 'drawFailed' } });
          return;
        }

        set({ game: result.value.game, banner: null, busy: true });
        // No handle is kept on purpose: a pending release after unmount is
        // harmless, and a second mutation cannot start while `busy` is true.
        setTimeout(() => set({ busy: false }), BUSY_MS);
      },

      undoBall: () => {
        const game = canMutate();
        if (game === null) {
          return null;
        }

        const result = undo(game);
        if (!result.ok) {
          // EMPTY_HISTORY: nothing to undo is a no-op, never an error (§2.6).
          return null;
        }

        try {
          // `save` replaces the draw log and the pool in one transaction, so
          // there is no instant where history and pool disagree (INV-1).
          deps.openRepository().save(result.value.game);
        } catch {
          set({ banner: { tone: 'error', code: 'undoFailed' } });
          return null;
        }

        set({ game: result.value.game, banner: null });
        return result.value.undone.number;
      },

      startNewGame: (range) => {
        const game = canMutate();
        if (game === null) {
          return;
        }

        try {
          // Same range by default, fresh id: the previous game stays archived
          // (§2.4). A range comes from the Ajustes form after its dialog (§3.3).
          const fresh = createGame(range ?? game.range, deps.rng(), deps.now());
          deps.openRepository().saveNew(fresh);
          set({ game: fresh, banner: null, busy: false });
        } catch {
          set({ banner: { tone: 'error', code: 'newGameFailed' } });
        }
      },
    };
  });
}

/** Balls already out, and how many the range holds. */
export function progressOf(game: Game | null): { drawn: number; total: number } {
  return {
    drawn: game === null ? 0 : game.history.length,
    total: game === null ? rangeTotal(DEFAULT_RANGE) : rangeTotal(game.range),
  };
}

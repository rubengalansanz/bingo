import { createStore, type StoreApi } from 'zustand/vanilla';

import type { GameRepository } from '@/core/db/repositories/game.repository';
import { createGame, draw, integrityCheck, undo } from '@/core/engine/game';
import { DEFAULT_RANGE, rangeTotal } from '@/core/engine/range';
import type { Rng } from '@/core/engine/rng';
import type { Game } from '@/core/engine/types';

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

export type Banner = {
  readonly tone: 'info' | 'error';
  readonly text: string;
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
  undoBall: () => void;
  startNewGame: () => void;
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
};

/** How long the primary action stays disabled after a commit (§7.9). */
export const BUSY_MS = 300;

const MESSAGES = {
  bootFailed: 'No se pudo cargar la partida guardada.',
  repair: 'Se reparó el estado de la partida.',
  drawFailed: 'No se pudo guardar la extracción.',
  undoFailed: 'No se pudo deshacer la extracción.',
  newGameFailed: 'No se pudo crear la partida.',
} as const;

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
              game = createGame(DEFAULT_RANGE, deps.rng(), deps.now());
              repo.saveNew(game);
            } else {
              const report = integrityCheck(game, deps.rng());
              if (!report.ok) {
                // Persisted immediately: the next boot is already clean (§2.5).
                repo.save(report.repaired);
                game = report.repaired;
                banner = { tone: 'info', text: MESSAGES.repair };
              }
            }

            set({ phase: 'ready', game, banner, busy: false });
          } catch {
            set({
              phase: 'error',
              game: null,
              banner: { tone: 'error', text: MESSAGES.bootFailed },
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
          set({ banner: { tone: 'error', text: MESSAGES.drawFailed } });
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
          return;
        }

        const result = undo(game);
        if (!result.ok) {
          // EMPTY_HISTORY: nothing to undo is a no-op, never an error (§2.6).
          return;
        }

        try {
          // `save` replaces the draw log and the pool in one transaction, so
          // there is no instant where history and pool disagree (INV-1).
          deps.openRepository().save(result.value.game);
        } catch {
          set({ banner: { tone: 'error', text: MESSAGES.undoFailed } });
          return;
        }

        set({ game: result.value.game, banner: null });
      },

      startNewGame: () => {
        const game = canMutate();
        if (game === null) {
          return;
        }

        try {
          // Same range, fresh id: the previous game stays archived (§2.4).
          const fresh = createGame(game.range, deps.rng(), deps.now());
          deps.openRepository().saveNew(fresh);
          set({ game: fresh, banner: null, busy: false });
        } catch {
          set({ banner: { tone: 'error', text: MESSAGES.newGameFailed } });
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

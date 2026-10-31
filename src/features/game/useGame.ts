import { useStore } from 'zustand';

import { cryptoRng } from '@/core/engine/rng';
import type { RangeConfig } from '@/core/engine/types';
import { settingsStore } from '@/features/settings/useSettings';
import { gameRepository } from '@/shared/db/client';
import { expoCryptoSource } from '@/shared/random/expoCryptoSource';

import { createGameStore, progressOf, type GameState, type GameStore } from './gameStore';

/**
 * App binding + screen view model.
 *
 * This is the only module where the store meets native code: the repository
 * singleton (expo-sqlite) and the platform CSPRNG adapter. Keeping the binding
 * separate is what lets `gameStore.ts` be tested against plain SQLite (§5.2).
 */

/** The app-wide game: one per process, shared by every tab (§5.4). */
export const gameStore = createGameStore({
  openRepository: gameRepository,
  now: () => Date.now(),
  rng: () => cryptoRng(expoCryptoSource()),
  // The first game and every "Nueva partida" materialise the saved range (§3.3).
  readRange: () => settingsStore.getState().settings.rangeDraft,
});

/** Granular subscription: a screen re-renders only for what it selects. */
export function useGameStore<T>(selector: (state: GameStore) => T): T {
  return useStore(gameStore, selector);
}

export type GameViewModel = GameState & {
  readonly drawn: number;
  readonly total: number;
  readonly currentBall: number | null;
  readonly previousBall: number | null;
  readonly exhausted: boolean;
  readonly onDraw: () => void;
  /** Returns the ball sent back to the bombo, or `null` if nothing happened. */
  readonly onUndo: () => number | null;
  /** Fresh game; an explicit range is what the Ajustes form applies (§3.3). */
  readonly onNewGame: (range?: RangeConfig) => void;
};

/**
 * Everything a screen needs to present the current game, with the same shape
 * the Phase 1 hook had so screens stay presentation-only.
 */
export function useGame(): GameViewModel {
  const state = useGameStore((s) => s);
  const game = state.game;
  const { drawn, total } = progressOf(game);
  const history = game?.history ?? [];

  return {
    ...state,
    drawn,
    total,
    currentBall: history.length > 0 ? history[history.length - 1]!.number : null,
    previousBall: history.length > 1 ? history[history.length - 2]!.number : null,
    exhausted: game !== null && game.status === 'exhausted',
    onDraw: state.drawBall,
    onUndo: state.undoBall,
    onNewGame: state.startNewGame,
  };
}

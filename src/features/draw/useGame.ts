import { useCallback, useEffect, useRef, useState } from 'react';

import { createGame, draw, integrityCheck } from '@/core/engine/game';
import { cryptoRng } from '@/core/engine/rng';
import { DEFAULT_RANGE, rangeTotal } from '@/core/engine/range';
import type { Game } from '@/core/engine/types';
import { gameRepository } from '@/shared/db/client';
import { expoCryptoSource } from '@/shared/random/expoCryptoSource';

/**
 * Draw-screen state (plan §7.2, §6.5).
 *
 * The ordering this hook enforces is the one that protects `INV-1` in
 * production (§2.5, "commit antes de animar"):
 *
 *   engine → persistence → state → (animation, Phase 4)
 *
 * The React state only ever learns about a draw *after* SQLite has committed
 * it. A crash between the two leaves the UI one ball behind — never one ahead,
 * which is the direction that would let the user draw a duplicate.
 */

export type Banner = {
  readonly tone: 'info' | 'error';
  readonly text: string;
};

export type DrawState = {
  readonly phase: 'loading' | 'ready' | 'error';
  readonly game: Game | null;
  readonly banner: Banner | null;
  /** Anti double-tap lock held for 300 ms after a committed draw (§7.9). */
  readonly busy: boolean;
};

export type DrawViewModel = DrawState & {
  readonly drawn: number;
  readonly total: number;
  readonly currentBall: number | null;
  readonly previousBall: number | null;
  readonly exhausted: boolean;
  readonly onDraw: () => void;
  readonly onNewGame: () => void;
};

/** Production randomness: system CSPRNG behind the injected port (§2.8). */
function rng() {
  return cryptoRng(expoCryptoSource());
}

/**
 * One-time boot state (§7.7): recover the stored game, run the integrity
 * check, and repair it on the spot when storage came back damaged. Never
 * rejects — an unusable database becomes the `error` phase, not a crash.
 */
async function loadGame(): Promise<DrawState> {
  try {
    const repo = gameRepository();
    let game = repo.loadCurrent();
    let banner: Banner | null = null;

    if (game === null) {
      game = createGame(DEFAULT_RANGE, rng(), Date.now());
      repo.saveNew(game);
    } else {
      const report = integrityCheck(game, rng());
      if (!report.ok) {
        // Repair is persisted immediately so the next boot is already clean (§2.5).
        repo.save(report.repaired);
        game = report.repaired;
        banner = { tone: 'info', text: 'Se reparó el estado de la partida.' };
      }
    }

    return { phase: 'ready', game, banner, busy: false };
  } catch {
    return {
      phase: 'error',
      game: null,
      banner: { tone: 'error', text: 'No se pudo cargar la partida guardada.' },
      busy: false,
    };
  }
}

const LOCK_MS = 300;

export function useGame(): DrawViewModel {
  const [state, setState] = useState<DrawState>({
    phase: 'loading',
    game: null,
    banner: null,
    busy: false,
  });
  const lock = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (lock.current !== null) {
        clearTimeout(lock.current);
      }
    };
  }, []);

  // Boot: load the stored game, or create the first one (§7.7).
  // The database is an external system, so its result arrives in a callback.
  useEffect(() => {
    let cancelled = false;

    void loadGame().then((next) => {
      if (!cancelled) {
        setState(next);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const onDraw = useCallback(() => {
    const { phase, busy, game } = state;
    if (phase !== 'ready' || busy || game === null) {
      return;
    }

    const result = draw(game, Date.now());
    if (!result.ok) {
      // EXHAUSTED: the screen offers "Nueva partida" instead (§2.4).
      return;
    }

    try {
      // Commit first, animate later: the ball exists before it is ever shown.
      gameRepository().commitDraw(result.value.game, result.value.record);
    } catch {
      setState((current) => ({
        ...current,
        banner: { tone: 'error', text: 'No se pudo guardar la extracción.' },
      }));
      return;
    }

    setState((current) => ({ ...current, game: result.value.game, banner: null, busy: true }));
    lock.current = setTimeout(() => {
      lock.current = null;
      setState((current) => ({ ...current, busy: false }));
    }, LOCK_MS);
  }, [state]);

  const onNewGame = useCallback(() => {
    const { phase, busy, game } = state;
    if (phase !== 'ready' || busy || game === null) {
      return;
    }

    try {
      const fresh = createGame(game.range, rng(), Date.now());
      gameRepository().saveNew(fresh);
      setState((current) => ({ ...current, game: fresh, banner: null, busy: false }));
    } catch {
      setState((current) => ({
        ...current,
        banner: { tone: 'error', text: 'No se pudo crear la partida.' },
      }));
    }
  }, [state]);

  const game = state.game;
  const drawn = game === null ? 0 : game.history.length;
  const total = game === null ? rangeTotal(DEFAULT_RANGE) : rangeTotal(game.range);
  const history = game?.history ?? [];
  const currentBall = history.length > 0 ? history[history.length - 1]!.number : null;
  const previousBall = history.length > 1 ? history[history.length - 2]!.number : null;

  return {
    ...state,
    drawn,
    total,
    currentBall,
    previousBall,
    exhausted: game !== null && game.status === 'exhausted',
    onDraw,
    onNewGame,
  };
}

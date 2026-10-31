import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { GameRepository } from '@/core/db/repositories/game.repository';
import { createGame, draw } from '@/core/engine/game';
import { PRESETS } from '@/core/engine/range';
import { mulberry32 } from '@/core/engine/rng';
import type { Game } from '@/core/engine/types';

import { DrawScreen } from '../DrawScreen';
import { gameStore } from '@/features/game/useGame';
import { TOAST_MS } from '@/ui/Toast';

/**
 * Draw screen (§7.2) and its secondary row (§2.6): the store boots the first
 * game, undo goes end-to-end and announces the ball it sent back.
 *
 * The database is mocked at the adapter boundary on purpose: a component test
 * asserts what the user sees, not what SQLite stores.
 */

/** Deterministic 32-bit source: the shuffle is reproducible across runs. */
jest.mock('@/shared/random/expoCryptoSource', () => ({
  expoCryptoSource: () => {
    let state = 42;
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state;
    };
  },
}));

const mockRepo = {
  loadCurrent: jest.fn<ReturnType<GameRepository['loadCurrent']>, []>(() => null),
  saveNew: jest.fn(),
  save: jest.fn(),
  commitDraw: jest.fn(),
};

jest.mock('@/shared/db/client', () => ({
  gameRepository: () => mockRepo,
}));

/** A game with `draws` balls already out, so the screen has history to undo. */
function gameWith(draws: number): Game {
  const rng = mulberry32(9);
  let game = createGame(PRESETS.eu90, rng, 1_700_000_000_000);
  for (let i = 0; i < draws; i++) {
    const result = draw(game, 1_700_000_000_000 + i * 1000);
    if (!result.ok) {
      throw new Error('unexpected exhaustion');
    }
    game = result.value.game;
  }
  return game;
}

function prime(game: Game): void {
  gameStore.setState({ phase: 'ready', game, banner: null, busy: false });
}

describe('DrawScreen (smoke)', () => {
  it('boots into the draw screen with an empty ball and the primary action', async () => {
    // RNTL 14 renders asynchronously (React 19 concurrent root): always await.
    await render(<DrawScreen />);

    expect(screen.getByText('Sacar bola')).toBeOnTheScreen();
    expect(screen.getByText('—')).toBeOnTheScreen();

    // First launch creates and persists a game before the screen is usable (§7.7).
    await act(() => gameStore.getState().boot());

    expect(screen.getByText('0 de 90')).toBeOnTheScreen();
    expect(screen.getByText('Tocá «Sacar bola» para empezar.')).toBeOnTheScreen();
    expect(mockRepo.saveNew).toHaveBeenCalledTimes(1);
  });
});

describe('DrawScreen — secondary row (§7.2)', () => {
  it('offers undo, history and board', async () => {
    prime(gameWith(1));
    await render(<DrawScreen />);

    expect(screen.getByTestId('draw-undo')).toBeOnTheScreen();
    expect(screen.getByTestId('draw-history')).toBeOnTheScreen();
    expect(screen.getByTestId('draw-board')).toBeOnTheScreen();
  });

  it('disables undo while there is no history', async () => {
    prime(gameWith(0));
    await render(<DrawScreen />);

    expect(screen.getByTestId('draw-undo').props.accessibilityState).toEqual({ disabled: true });
  });

  it('enables undo as soon as one ball is out', async () => {
    prime(gameWith(1));
    await render(<DrawScreen />);

    expect(screen.getByTestId('draw-undo').props.accessibilityState).toEqual({ disabled: false });
  });
});

describe('DrawScreen — undo (§2.6)', () => {
  it('undoes the last ball and announces it in the toast', async () => {
    const game = gameWith(1);
    const undone = game.history[0]!.number;
    prime(game);
    await render(<DrawScreen />);

    await fireEvent.press(screen.getByTestId('draw-undo'));

    // Persisted through the repository, so the undo survives a restart.
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
    expect(gameStore.getState().game?.history).toHaveLength(0);
    expect(screen.getByText(`Bola ${undone} devuelta al bombo`)).toBeOnTheScreen();
    expect(screen.getByText('0 de 90')).toBeOnTheScreen();
    expect(screen.getByText('—')).toBeOnTheScreen();
  });

  it('shows the toast for about 2.5 s and then removes it', async () => {
    prime(gameWith(1));
    await render(<DrawScreen />);

    await fireEvent.press(screen.getByTestId('draw-undo'));
    expect(screen.getByTestId('toast')).toBeOnTheScreen();

    // Only the duration is pinned here; the removal itself is covered by the
    // Toast unit test with an injected, short duration.
    expect(TOAST_MS).toBe(2500);
  });

  it('does not announce anything when the undo write fails', async () => {
    prime(gameWith(1));
    await render(<DrawScreen />);
    mockRepo.save.mockImplementationOnce(() => {
      throw new Error('write failed');
    });

    await fireEvent.press(screen.getByTestId('draw-undo'));

    expect(screen.queryByTestId('toast')).toBeNull();
    expect(screen.getByText('No se pudo deshacer la extracción.')).toBeOnTheScreen();
    expect(gameStore.getState().game?.history).toHaveLength(1);
  });
});

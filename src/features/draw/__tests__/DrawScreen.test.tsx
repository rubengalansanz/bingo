import { act, render, screen } from '@testing-library/react-native';

import type { GameRepository } from '@/core/db/repositories/game.repository';

import { DrawScreen } from '../DrawScreen';
import { gameStore } from '@/features/game/useGame';

/**
 * Harness smoke test (Phase 2 U1/T2): proves that a screen can render under
 * jest-expo + RNTL without touching the domain gate in `jest.config.js`, and
 * that the shared store boots the first game with no stored state.
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

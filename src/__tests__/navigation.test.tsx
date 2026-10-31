import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import type { GameRepository } from '@/core/db/repositories/game.repository';

/**
 * The real routing tree (plan §7.1): four tabs, Sorteo first, each one reachable.
 *
 * This runs the actual `app/` directory, so a broken route file, a missing icon
 * or a renamed tab fails here instead of only in Maestro.
 */

jest.mock('@/shared/random/expoCryptoSource', () => ({
  expoCryptoSource: () => {
    let state = 7;
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

describe('tab navigation (§7.1)', () => {
  it('starts on Sorteo and exposes the four tabs', async () => {
    const router = await renderRouter('app', { initialUrl: '/' });

    expect(router.getPathname()).toBe('/');
    for (const label of ['Sorteo', 'Tablero', 'Historial', 'Ajustes']) {
      expect(screen.getByText(label)).toBeOnTheScreen();
    }
    expect(screen.getByTestId('draw-screen')).toBeOnTheScreen();
  });

  it('reaches every tab from the bar', async () => {
    const router = await renderRouter('app', { initialUrl: '/' });

    for (const [label, path] of [
      ['Tablero', '/board'],
      ['Historial', '/history'],
      ['Ajustes', '/settings'],
      ['Sorteo', '/'],
    ] as const) {
      await fireEvent.press(screen.getByText(label));
      expect(router.getPathname()).toBe(path);
    }
  });
});

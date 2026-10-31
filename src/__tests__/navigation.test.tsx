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
    // The bar labels each tab; "Tablero"/"Historial" also label the secondary
    // row, so the bar is asserted through its buttons.
    for (const [testID, label] of [
      ['tab-sorteo', 'Sorteo'],
      ['tab-tablero', 'Tablero'],
      ['tab-historial', 'Historial'],
      ['tab-ajustes', 'Ajustes'],
    ] as const) {
      expect(screen.getByTestId(testID)).toBeOnTheScreen();
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByTestId('draw-screen')).toBeOnTheScreen();
  });

  it('reaches every tab from the bar', async () => {
    const router = await renderRouter('app', { initialUrl: '/' });

    // Pressed by testID: "Tablero" and "Historial" also label the secondary row
    // of the draw screen, so a text query would be ambiguous (§7.2).
    for (const [testID, path] of [
      ['tab-tablero', '/board'],
      ['tab-historial', '/history'],
      ['tab-ajustes', '/settings'],
      ['tab-sorteo', '/'],
    ] as const) {
      await fireEvent.press(screen.getByTestId(testID));
      expect(router.getPathname()).toBe(path);
    }
  });

  it('navigates from the draw screen secondary row', async () => {
    const router = await renderRouter('app', { initialUrl: '/' });

    await fireEvent.press(screen.getByTestId('draw-history'));
    expect(router.getPathname()).toBe('/history');

    await fireEvent.press(screen.getByTestId('tab-sorteo'));
    await fireEvent.press(screen.getByTestId('draw-board'));
    expect(router.getPathname()).toBe('/board');
  });
});

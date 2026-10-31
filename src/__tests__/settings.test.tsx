import { fireEvent, render, screen } from '@testing-library/react-native';

import type { GameRepository } from '@/core/db/repositories/game.repository';
import { createGame, draw } from '@/core/engine/game';
import { PRESETS } from '@/core/engine/range';
import { mulberry32 } from '@/core/engine/rng';
import type { Game } from '@/core/engine/types';
import { MESSAGES } from '@/core/i18n/messages';
import { BoardScreen } from '@/features/board/BoardScreen';
import { DrawScreen } from '@/features/draw/DrawScreen';
import { gameStore } from '@/features/game/useGame';

import SettingsRoute from '../../app/(tabs)/settings';

/**
 * Ajustes mounted through its route (`app/(tabs)/settings.tsx`), so this file
 * checks the real entry point rather than the feature in isolation. It covers
 * the destructive row (§7.5) and restart: `ConfirmDialog` with the exact §7.6
 * copy, then the *shared* game resets so the draw counter and the board follow
 * — that is the whole point of the store (§5.4). Appearance and the range form
 * live in `features/settings/__tests__/SettingsScreen.test.tsx`.
 */

const mockRepo = {
  loadCurrent: jest.fn<ReturnType<GameRepository['loadCurrent']>, []>(() => null),
  saveNew: jest.fn(),
  save: jest.fn(),
  commitDraw: jest.fn(),
};

jest.mock('@/shared/db/client', () => ({
  gameRepository: () => mockRepo,
}));

/** A game with `draws` balls already out. */
function gameWith(draws: number): Game {
  const rng = mulberry32(3);
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

function prime(game: Game | null, phase: 'loading' | 'ready' | 'error' = 'ready'): void {
  gameStore.setState({ phase, game, banner: null, busy: false });
}

beforeEach(() => {
  prime(null, 'loading');
});

describe('Settings — PARTIDA stub (§4.6)', () => {
  it('offers the destructive row while a game is active', async () => {
    prime(gameWith(5));
    await render(<SettingsRoute />);

    expect(screen.getByTestId('settings-screen')).toBeOnTheScreen();
    expect(screen.getByTestId('settings-restart')).toBeOnTheScreen();
    expect(screen.getByText('PARTIDA')).toBeOnTheScreen();
  });

  it('shows no destructive row before boot finishes', async () => {
    prime(null, 'loading');
    await render(<SettingsRoute />);

    expect(screen.queryByTestId('settings-restart')).toBeNull();
    expect(screen.getByText('Cargando…')).toBeOnTheScreen();
  });

  it('shows no destructive row when there is no game to restart', async () => {
    prime(null, 'ready');
    await render(<SettingsRoute />);

    expect(screen.queryByTestId('settings-restart')).toBeNull();
    expect(screen.getByText(MESSAGES.es.settings.noGame)).toBeOnTheScreen();
  });
});

describe('Settings — restart with confirmation (§7.6, flujo 5)', () => {
  it('asks with the exact §7.6 copy and the real number of extractions', async () => {
    prime(gameWith(5));
    await render(<SettingsRoute />);

    await fireEvent.press(screen.getByTestId('settings-restart'));

    expect(screen.getByText('¿Reiniciar la partida?')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Se perderán las 5 extracciones. El historial de esta partida se archivará.',
      ),
    ).toBeOnTheScreen();
  });

  it('cancels without touching the game', async () => {
    const game = gameWith(5);
    prime(game);
    await render(<SettingsRoute />);

    await fireEvent.press(screen.getByTestId('settings-restart'));
    await fireEvent.press(screen.getByTestId('confirm-cancel'));

    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
    expect(gameStore.getState().game?.id).toBe(game.id);
    expect(gameStore.getState().game?.history).toHaveLength(5);
    expect(mockRepo.saveNew).not.toHaveBeenCalled();
  });

  it('creates a fresh game and resets every screen that shares the store', async () => {
    const game = gameWith(5);
    prime(game);
    await render(
      <>
        <SettingsRoute />
        <DrawScreen />
        <BoardScreen />
      </>,
    );

    // The three screens start in agreement: 5 balls out of 90.
    expect(screen.getByText('5 de 90')).toBeOnTheScreen();
    expect(screen.getByTestId('board-counter')).toHaveTextContent('5 extraídas · 85 pendientes');

    await fireEvent.press(screen.getByTestId('settings-restart'));
    await fireEvent.press(screen.getByTestId('confirm-confirm'));

    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
    expect(mockRepo.saveNew).toHaveBeenCalledTimes(1);
    expect(gameStore.getState().game?.history).toHaveLength(0);
    expect(gameStore.getState().game?.id).not.toBe(game.id);
    // Counter back to zero and a clean board, without leaving Ajustes.
    expect(screen.getByText('0 de 90')).toBeOnTheScreen();
    expect(screen.getByTestId('board-counter')).toHaveTextContent('0 extraídas · 90 pendientes');
  });
});

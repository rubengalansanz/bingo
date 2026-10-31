import { fireEvent, render, screen } from '@testing-library/react-native';

import { createGame, draw } from '@/core/engine/game';
import { PRESETS } from '@/core/engine/range';
import { mulberry32 } from '@/core/engine/rng';
import type { Game, RangeConfig } from '@/core/engine/types';
import type { GameRepository } from '@/core/db/repositories/game.repository';

import { gameStore } from '@/features/game/useGame';
import { formatClock, HISTORY_EMPTY } from '../useHistory';
import { HistoryScreen } from '../HistoryScreen';

/**
 * History presentation (§7.4). Rows are primed through the store; undo goes
 * through the real store action against a fake repository.
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

function gameWith(cfg: RangeConfig, draws: number): Game {
  const rng = mulberry32(5);
  let game = createGame(cfg, rng, new Date(2026, 0, 15, 9, 5).getTime());
  for (let i = 0; i < draws; i++) {
    const result = draw(game, new Date(2026, 0, 15, 9, 5 + i).getTime());
    if (!result.ok) {
      throw new Error('unexpected exhaustion');
    }
    game = result.value.game;
  }
  return game;
}

function prime(game: Game | null): void {
  gameStore.setState({
    phase: game === null ? 'loading' : 'ready',
    game,
    banner: null,
    busy: false,
  });
}

beforeEach(() => {
  prime(null);
});

describe('HistoryScreen — order and format (§7.4)', () => {
  it('shows the newest draw first', async () => {
    prime(gameWith(PRESETS.eu90, 3));
    await render(<HistoryScreen />);

    const rows = screen.getAllByTestId(/^history-row-/);
    expect(rows.map((row) => row.props.testID)).toEqual([
      'history-row-3',
      'history-row-2',
      'history-row-1',
    ]);
  });

  it('prints position, number and time on every row', async () => {
    const game = gameWith(PRESETS.eu90, 1);
    prime(game);
    await render(<HistoryScreen />);

    const number = game.history[0]!.number;
    expect(screen.getByText(`#1`)).toBeOnTheScreen();
    expect(screen.getByText(String(number))).toBeOnTheScreen();
    // The first draw happened at 09:05 local time.
    expect(screen.getByText('09:05')).toBeOnTheScreen();
  });

  it('marks only the newest row as Última', async () => {
    prime(gameWith(PRESETS.eu90, 3));
    await render(<HistoryScreen />);

    expect(screen.getAllByText('Última')).toHaveLength(1);
  });

  it('counts extractions in the header', async () => {
    prime(gameWith(PRESETS.eu90, 1));
    await render(<HistoryScreen />);
    expect(screen.getByTestId('history-counter')).toHaveTextContent('1 extracción');

    prime(gameWith(PRESETS.eu90, 3));
    await render(<HistoryScreen />);
    expect(screen.getByTestId('history-counter')).toHaveTextContent('3 extracciones');
  });

  it('formats the clock as HH:mm', () => {
    expect(formatClock(new Date(2026, 0, 15, 9, 5).getTime())).toBe('09:05');
    expect(formatClock(new Date(2026, 0, 15, 23, 59).getTime())).toBe('23:59');
  });
});

describe('HistoryScreen — empty state (§7.7)', () => {
  it('explains that nothing was drawn yet and offers no undo', async () => {
    prime(gameWith(PRESETS.eu90, 0));
    await render(<HistoryScreen />);

    expect(screen.getByText(HISTORY_EMPTY)).toBeOnTheScreen();
    expect(screen.queryByTestId('history-undo')).toBeNull();
  });
});

describe('HistoryScreen — undo (§2.6, §7.4)', () => {
  it('undoes the newest ball through the store', async () => {
    prime(gameWith(PRESETS.eu90, 3));
    await render(<HistoryScreen />);

    await fireEvent.press(screen.getByTestId('history-undo'));

    expect(mockRepo.save).toHaveBeenCalledTimes(1);
    expect(gameStore.getState().game?.history).toHaveLength(2);
    expect(screen.getAllByTestId(/^history-row-/)).toHaveLength(2);
  });

  it('labels the undo button with the newest ball', async () => {
    const game = gameWith(PRESETS.eu90, 2);
    prime(game);
    await render(<HistoryScreen />);

    const newest = game.history.at(-1)!.number;
    expect(screen.getByTestId('history-undo').props.accessibilityLabel).toBe(
      `Deshacer la bola ${newest}`,
    );
  });
});

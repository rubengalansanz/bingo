import { fireEvent, render, screen } from '@testing-library/react-native';

import { createGame, draw } from '@/core/engine/game';
import { PRESETS } from '@/core/engine/range';
import { mulberry32 } from '@/core/engine/rng';
import type { Game, RangeConfig } from '@/core/engine/types';

import { gameStore } from '@/features/game/useGame';
import { MESSAGES } from '@/core/i18n/messages';
import { BoardScreen } from '../BoardScreen';

/**
 * Board presentation (§7.3). The store is primed directly: these tests are
 * about what the screen renders for a given game, not about loading one.
 */

function gameWith(cfg: RangeConfig, draws: number): Game {
  const rng = mulberry32(5);
  let game = createGame(cfg, rng, 1_700_000_000_000);
  for (let i = 0; i < draws; i++) {
    const result = draw(game, 1_700_000_000_000 + i + 1);
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

beforeEach(() => {
  gameStore.setState({ phase: 'loading', game: null, banner: null, busy: false });
});

describe('BoardScreen — layout (§7.3)', () => {
  it('renders every number of the range and the counter', async () => {
    prime(gameWith(PRESETS.eu90, 23));
    await render(<BoardScreen />);

    expect(screen.getByTestId('board-counter')).toHaveTextContent('23 extraídas · 67 pendientes');
    expect(screen.getByTestId('board-cell-1')).toBeOnTheScreen();
    expect(screen.getByTestId('board-cell-90')).toBeOnTheScreen();
  });

  it('explains the empty board instead of showing a blank grid', async () => {
    prime(gameWith(PRESETS.eu90, 0));
    await render(<BoardScreen />);

    expect(screen.getByText(MESSAGES.es.board.empty)).toBeOnTheScreen();
    expect(screen.getByTestId('board-counter')).toHaveTextContent('0 extraídas · 90 pendientes');
  });

  it('shows B-I-N-G-O headers only on the US75 board', async () => {
    prime(gameWith(PRESETS.us75, 3));
    await render(<BoardScreen />);

    // The headers are decorative for a screen reader (each cell already speaks
    // its letter), so they are hidden from the accessibility tree on purpose.
    for (const letter of ['B', 'I', 'N', 'G', 'O']) {
      expect(screen.getByText(letter, { includeHiddenElements: true })).toBeOnTheScreen();
    }
  });

  it('omits the letter headers on a 90 board', async () => {
    prime(gameWith(PRESETS.eu90, 3));
    await render(<BoardScreen />);

    expect(screen.queryByText('B', { includeHiddenElements: true })).toBeNull();
  });
});

describe('BoardScreen — complete and error states (§7.7)', () => {
  it('marks a finished game instead of leaving 90 pending cells silent', async () => {
    prime(gameWith(PRESETS.eu90, 90));
    await render(<BoardScreen />);

    expect(screen.getByText(MESSAGES.es.board.complete)).toBeOnTheScreen();
    expect(screen.getByTestId('board-counter')).toHaveTextContent('90 extraídas · 0 pendientes');
  });

  it('reports the error instead of pretending the board is empty', async () => {
    gameStore.setState({
      phase: 'error',
      game: null,
      banner: { tone: 'error', code: 'bootFailed' },
      busy: false,
    });
    await render(<BoardScreen />);

    expect(screen.getByText(MESSAGES.es.banners.bootFailed)).toBeOnTheScreen();
    expect(screen.queryByText(MESSAGES.es.board.empty)).toBeNull();
  });
});

describe('BoardScreen — accessible state (§7.3)', () => {
  it('announces each drawn cell with its number and position', async () => {
    const game = gameWith(PRESETS.eu90, 1);
    prime(game);
    await render(<BoardScreen />);

    const first = game.history[0]!;
    expect(screen.getByTestId(`board-cell-${first.number}`).props.accessibilityLabel).toBe(
      `${first.number}, extraída en la posición 1`,
    );
  });

  it('announces pending cells as pending', async () => {
    prime(gameWith(PRESETS.eu90, 1));
    await render(<BoardScreen />);

    expect(screen.getByTestId('board-cell-90').props.accessibilityLabel).toBe('90, pendiente');
  });

  it('prints the letter label the domain produced', async () => {
    prime(gameWith(PRESETS.us75, 1));
    await render(<BoardScreen />);

    // 12 is inside the B column: the board must print the domain label.
    expect(screen.getByTestId('board-cell-12').props.accessibilityLabel).toContain('B, 12');
  });

  it('does nothing when a cell is tapped', async () => {
    prime(gameWith(PRESETS.eu90, 2));
    await render(<BoardScreen />);

    await fireEvent.press(screen.getByTestId('board-cell-40'));

    expect(screen.getByTestId('board-counter')).toHaveTextContent('2 extraídas · 88 pendientes');
  });
});

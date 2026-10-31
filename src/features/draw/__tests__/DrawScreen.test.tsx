import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { AccessibilityInfo, Dimensions } from 'react-native';

import type { GameRepository } from '@/core/db/repositories/game.repository';
import { createGame, draw } from '@/core/engine/game';
import { PRESETS, customRange } from '@/core/engine/range';
import { mulberry32 } from '@/core/engine/rng';
import type { Game, RangeConfig } from '@/core/engine/types';
import { DEFAULT_SETTINGS } from '@/core/settings/settings';

import { DrawScreen } from '../DrawScreen';
import { gameStore } from '@/features/game/useGame';
import { settingsStore } from '@/features/settings/useSettings';
import { nativeFeedback } from '@/shared/feedback/native';
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
function gameWith(draws: number, cfg: RangeConfig = PRESETS.eu90): Game {
  const rng = mulberry32(9);
  let game = createGame(cfg, rng, 1_700_000_000_000);
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

/** The adapter is a jest mock in this project (see jest.ui.setup.js). */
const feedback = nativeFeedback as unknown as Record<
  'playBall' | 'playComplete' | 'impact' | 'success',
  jest.Mock
>;

const keepAwake = useKeepAwake as unknown as jest.Mock;

beforeEach(() => {
  settingsStore.setState({ settings: DEFAULT_SETTINGS, persistenceError: false });
});

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

describe('DrawScreen — sensory feedback (§4.4)', () => {
  it('plays the ball and an impact haptic after a committed draw', async () => {
    prime(gameWith(0));
    await render(<DrawScreen />);

    await fireEvent.press(screen.getByText('Sacar bola'));

    expect(feedback.playBall).toHaveBeenCalledTimes(1);
    expect(feedback.impact).toHaveBeenCalledTimes(1);
    expect(feedback.success).not.toHaveBeenCalled();
    expect(feedback.playComplete).not.toHaveBeenCalled();
  });

  it('celebrates the last ball with the completion cue', async () => {
    prime(gameWith(1, customRange(1, 2, 'number')));
    await render(<DrawScreen />);

    await fireEvent.press(screen.getByText('Sacar bola'));

    expect(feedback.playComplete).toHaveBeenCalledTimes(1);
    expect(feedback.success).toHaveBeenCalledTimes(1);
    expect(feedback.playBall).not.toHaveBeenCalled();
  });

  it('keeps the vibration with the sound off (§4.4)', async () => {
    settingsStore.setState({ settings: { ...DEFAULT_SETTINGS, sound: false } });
    prime(gameWith(0));
    await render(<DrawScreen />);

    await fireEvent.press(screen.getByText('Sacar bola'));

    expect(feedback.playBall).not.toHaveBeenCalled();
    expect(feedback.impact).toHaveBeenCalledTimes(1);
  });

  it('keeps the sound with the haptics off (§4.4)', async () => {
    settingsStore.setState({ settings: { ...DEFAULT_SETTINGS, haptics: false } });
    prime(gameWith(0));
    await render(<DrawScreen />);

    await fireEvent.press(screen.getByText('Sacar bola'));

    expect(feedback.playBall).toHaveBeenCalledTimes(1);
    expect(feedback.impact).not.toHaveBeenCalled();
    expect(feedback.success).not.toHaveBeenCalled();
  });

  it('announces the ball and what is left for screen readers (§4.5)', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    prime(gameWith(0));
    await render(<DrawScreen />);

    await fireEvent.press(screen.getByText('Sacar bola'));

    const ball = gameStore.getState().game!.history[0]!.number;
    expect(announce).toHaveBeenCalledWith(`Bola ${ball}. Quedan 89.`);
    announce.mockRestore();
  });

  it('plays nothing when the draw is rejected while busy (§7.9)', async () => {
    prime(gameWith(0));
    gameStore.setState({ busy: true });
    await render(<DrawScreen />);

    await fireEvent.press(screen.getByText('Sacar bola'));

    expect(feedback.playBall).not.toHaveBeenCalled();
    expect(feedback.impact).not.toHaveBeenCalled();
  });
});

describe('DrawScreen — keep awake (§7.9)', () => {
  it('holds the screen on while the tab is focused and the game runs', async () => {
    prime(gameWith(1));
    await render(<DrawScreen />);

    expect(keepAwake).toHaveBeenCalled();
  });

  it('releases it when the tab is not the visible one', async () => {
    prime(gameWith(1));
    await render(<DrawScreen focused={false} />);

    expect(keepAwake).not.toHaveBeenCalled();
  });

  it('releases it once the game is complete', async () => {
    prime(gameWith(2, customRange(1, 2, 'number')));
    await render(<DrawScreen />);

    expect(keepAwake).not.toHaveBeenCalled();
  });
});

/** Phone window for every test; the tablet cases raise it above 600 pt (§7.8). */
const PHONE = { width: 390, height: 844, scale: 2, fontScale: 1 } as const;
const TABLET = { width: 800, height: 1000, scale: 2, fontScale: 1 } as const;

function setWindow(size: typeof PHONE | typeof TABLET): void {
  Dimensions.set({ window: size, screen: size });
}

beforeEach(() => setWindow(PHONE));
afterEach(() => setWindow(PHONE));

describe('DrawScreen — tablet layout (§7.8)', () => {
  it('adds the compact board next to the ball from 600 pt', async () => {
    setWindow(TABLET);
    prime(gameWith(2));
    await render(<DrawScreen />);

    expect(screen.getByTestId('draw-compact-board')).toBeOnTheScreen();
    expect(screen.getByTestId('compact-cell-90')).toBeOnTheScreen();
    // The primary and secondary actions stay available in the left column.
    expect(screen.getByText('Sacar bola')).toBeOnTheScreen();
    expect(screen.getByTestId('draw-undo')).toBeOnTheScreen();
  });

  it('keeps the single column on a phone', async () => {
    prime(gameWith(1));
    await render(<DrawScreen />);

    expect(screen.queryByTestId('draw-compact-board')).toBeNull();
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

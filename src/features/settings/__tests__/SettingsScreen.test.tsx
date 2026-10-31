import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { GameRepository } from '@/core/db/repositories/game.repository';
import { createGame, draw } from '@/core/engine/game';
import { PRESETS, customRange } from '@/core/engine/range';
import { mulberry32 } from '@/core/engine/rng';
import { DEFAULT_SETTINGS } from '@/core/settings/settings';
import type { Game, RangeConfig } from '@/core/engine/types';
import { BoardScreen } from '@/features/board/BoardScreen';
import { gameStore } from '@/features/game/useGame';
import { LocaleProvider } from '@/features/i18n/LocaleProvider';
import { ThemeProvider } from '@/features/theme/ThemeProvider';

import SettingsScreen from '../SettingsScreen';
import { settingsStore } from '../useSettings';

/**
 * Full Ajustes screen (plan §3.3, §4.3, §7.5, §7.6).
 *
 * Two guarantees are tested here, because they are the phase gate:
 *  - appearance changes (theme, mode, size, labels) never touch the game;
 *  - a range change with a running game asks first and only restarts on
 *    confirmation, with the real counts in the copy.
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

function gameWith(draws: number, cfg: RangeConfig = PRESETS.eu90): Game {
  const rng = mulberry32(3);
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

function prime(game: Game | null, phase: 'loading' | 'ready' | 'error' = 'ready'): void {
  gameStore.setState({ phase, game, banner: null, busy: false });
}

function renderSettings(extra?: ReactNode) {
  return render(
    <ThemeProvider>
      <LocaleProvider>
        <SettingsScreen />
        {extra}
      </LocaleProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  gameStore.setState({ phase: 'loading', game: null, banner: null, busy: false });
  settingsStore.setState({ settings: DEFAULT_SETTINGS, persistenceError: false });
  mockRepo.saveNew.mockClear();
  mockRepo.save.mockClear();
});

describe('Settings — full screen (§7.5)', () => {
  it('shows the three sections with their current values', async () => {
    prime(gameWith(5));
    await renderSettings();

    expect(screen.getByText('PARTIDA')).toBeOnTheScreen();
    expect(screen.getByText('APARIENCIA')).toBeOnTheScreen();
    expect(screen.getByText('ACERCA DE')).toBeOnTheScreen();

    expect(screen.getByTestId('settings-range').props.accessibilityLabel).toBe(
      'Rango numérico: Europeo 1–90',
    );
    expect(screen.getByTestId('settings-theme').props.accessibilityLabel).toBe('Tema: Clásico');
    expect(screen.getByTestId('settings-appearance').props.accessibilityLabel).toBe(
      'Modo de color: Automático',
    );
    expect(screen.getByTestId('settings-size').props.accessibilityLabel).toBe(
      'Tamaño del número: Normal',
    );
    expect(screen.getByTestId('settings-labels').props.accessibilityLabel).toBe(
      'Etiquetas: Letra y número',
    );
  });

  it('keeps the destructive row only while a game is active', async () => {
    prime(null);
    await renderSettings();

    expect(screen.getByText('Todavía no hay una partida activa.')).toBeOnTheScreen();
    expect(screen.queryByTestId('settings-restart')).toBeNull();
    // The range row is not destructive: it stays available to prepare the next game.
    expect(screen.getByTestId('settings-range')).toBeOnTheScreen();
  });
});

describe('Settings — appearance never touches the game (§4.3, DoD)', () => {
  it('applies and persists a theme change live', async () => {
    const game = gameWith(5);
    prime(game);
    await renderSettings();

    await fireEvent.press(screen.getByTestId('settings-theme'));
    await fireEvent.press(screen.getByTestId('choice-theme-option-neon'));

    expect(settingsStore.getState().settings.themeId).toBe('neon');
    // The live sample is the ball in the new palette (§4.3).
    expect(screen.getByTestId('theme-sample')).toBeOnTheScreen();
    expect(screen.getByTestId('choice-theme-option-neon').props.accessibilityState).toEqual({
      checked: true,
      selected: true,
    });
    // Same game: no restart, no new id, no writes.
    expect(gameStore.getState().game?.id).toBe(game.id);
    expect(gameStore.getState().game?.history).toHaveLength(5);
    expect(mockRepo.saveNew).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('choice-theme-done'));
    expect(screen.queryByTestId('choice-theme')).toBeNull();
  });

  it('changes colour mode and number size', async () => {
    const game = gameWith(1);
    prime(game);
    await renderSettings();

    await fireEvent.press(screen.getByTestId('settings-appearance'));
    await fireEvent.press(screen.getByTestId('choice-appearance-option-dark'));
    await fireEvent.press(screen.getByTestId('choice-appearance-done'));

    await fireEvent.press(screen.getByTestId('settings-size'));
    await fireEvent.press(screen.getByTestId('choice-size-option-xlarge'));
    await fireEvent.press(screen.getByTestId('choice-size-done'));

    expect(settingsStore.getState().settings.appearance).toBe('dark');
    expect(settingsStore.getState().settings.numberSize).toBe('xlarge');
    expect(gameStore.getState().game?.id).toBe(game.id);
  });

  it('re-labels the board without restarting the game (§3.4)', async () => {
    const game = gameWith(3, PRESETS.us75);
    prime(game);
    await renderSettings(<BoardScreen />);

    expect(screen.getByTestId('board-cell-12').props.accessibilityLabel).toContain('B, 12');

    await fireEvent.press(screen.getByTestId('settings-labels'));
    await fireEvent.press(screen.getByTestId('choice-labels-option-number'));

    expect(settingsStore.getState().settings.labelMode).toBe('number');
    expect(screen.getByTestId('board-cell-12').props.accessibilityLabel).toContain('12,');
    expect(screen.getByTestId('board-cell-12').props.accessibilityLabel).not.toContain('B, 12');
    expect(gameStore.getState().game?.id).toBe(game.id);
  });
});

describe('Settings — feedback and motion (§4.4, §7.5)', () => {
  it('shows the feedback rows with their current values', async () => {
    prime(gameWith(1));
    await renderSettings();

    expect(screen.getByText('FEEDBACK')).toBeOnTheScreen();
    expect(screen.getByTestId('settings-sound').props.accessibilityLabel).toBe('Sonido: activado');
    expect(screen.getByTestId('settings-haptics').props.value).toBe(true);
    expect(screen.getByTestId('settings-speed').props.accessibilityLabel).toBe(
      'Velocidad de animación: 1×',
    );
    expect(screen.getByTestId('settings-motion').props.accessibilityLabel).toBe(
      'Reducir movimiento: Automático',
    );
    expect(screen.getByTestId('settings-keep-awake').props.value).toBe(true);
  });

  it('turns the sound off and explains what that means', async () => {
    const game = gameWith(1);
    prime(game);
    await renderSettings();

    await fireEvent(screen.getByTestId('settings-sound'), 'valueChange', false);

    expect(settingsStore.getState().settings.sound).toBe(false);
    expect(screen.getByText('El sorteo no hará ruido.')).toBeOnTheScreen();
    expect(screen.getByTestId('settings-sound').props.accessibilityLabel).toBe(
      'Sonido: desactivado',
    );
    expect(gameStore.getState().game?.id).toBe(game.id);
  });

  it('stores speed, motion, haptics and keep-awake without restarting the game', async () => {
    const game = gameWith(2);
    prime(game);
    await renderSettings();

    await fireEvent.press(screen.getByTestId('settings-speed'));
    await fireEvent.press(screen.getByTestId('choice-speed-option-1.5'));
    await fireEvent.press(screen.getByTestId('choice-speed-done'));

    await fireEvent.press(screen.getByTestId('settings-motion'));
    await fireEvent.press(screen.getByTestId('choice-motion-option-on'));
    await fireEvent.press(screen.getByTestId('choice-motion-done'));

    await fireEvent(screen.getByTestId('settings-haptics'), 'valueChange', false);
    await fireEvent(screen.getByTestId('settings-keep-awake'), 'valueChange', false);

    expect(settingsStore.getState().settings).toMatchObject({
      animationSpeed: 1.5,
      reduceMotion: 'on',
      haptics: false,
      keepAwake: false,
    });
    expect(gameStore.getState().game?.id).toBe(game.id);
    expect(mockRepo.saveNew).not.toHaveBeenCalled();
  });

  it('opens the privacy policy from ACERCA DE (§9.3)', async () => {
    prime(gameWith(1));
    await renderSettings();

    await fireEvent.press(screen.getByTestId('settings-privacy'));

    expect(screen.getByTestId('privacy-sheet')).toBeOnTheScreen();
    expect(screen.getByText(/La app no envía datos a ningún servidor/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('privacy-close'));
    expect(screen.queryByTestId('privacy-sheet')).toBeNull();
  });
});

describe('Settings — range form (§3.1-3.3)', () => {
  it('validates the custom bounds with the exact §3.2 copy', async () => {
    prime(gameWith(1));
    await renderSettings();

    await fireEvent.press(screen.getByTestId('settings-range'));
    await fireEvent.press(screen.getByTestId('range-preset-custom'));

    await fireEvent.changeText(screen.getByTestId('range-min'), '5');
    await fireEvent.changeText(screen.getByTestId('range-max'), '5');
    expect(screen.getByText('El mínimo debe ser menor que el máximo.')).toBeOnTheScreen();
    expect(screen.getByTestId('range-apply').props.accessibilityState).toEqual({ disabled: true });

    await fireEvent.changeText(screen.getByTestId('range-min'), '0');
    expect(screen.getByText('El rango empieza en 1 como mínimo.')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByTestId('range-min'), '1.5');
    expect(screen.getByText('Usá números enteros.')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByTestId('range-max'), '');
    expect(screen.getByText('Completá el mínimo y el máximo.')).toBeOnTheScreen();
  });

  it('shows the live total and the short-range warning', async () => {
    prime(gameWith(1));
    await renderSettings();

    await fireEvent.press(screen.getByTestId('settings-range'));
    await fireEvent.press(screen.getByTestId('range-preset-custom'));
    await fireEvent.changeText(screen.getByTestId('range-min'), '1');
    await fireEvent.changeText(screen.getByTestId('range-max'), '5');

    expect(screen.getByText('Serán 5 bolas')).toBeOnTheScreen();
    expect(
      screen.getByText('Un rango tan corto termina la partida en 10 extracciones.'),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('range-apply').props.accessibilityState).toEqual({ disabled: false });
  });

  it('shows the bounds of the chosen preset instead of the previous custom edit', async () => {
    prime(gameWith(1));
    await renderSettings();

    await fireEvent.press(screen.getByTestId('settings-range'));
    await fireEvent.press(screen.getByTestId('range-preset-custom'));
    await fireEvent.changeText(screen.getByTestId('range-min'), '3');
    await fireEvent.changeText(screen.getByTestId('range-max'), '7');
    expect(screen.getByTestId('range-min').props.value).toBe('3');

    await fireEvent.press(screen.getByTestId('range-preset-eu90'));
    expect(screen.getByTestId('range-min').props.value).toBe('1');
    expect(screen.getByTestId('range-max').props.value).toBe('90');
    expect(screen.getByText('Serán 90 bolas')).toBeOnTheScreen();

    // The typed numbers are not lost: `Personalizado` brings them back.
    await fireEvent.press(screen.getByTestId('range-preset-custom'));
    expect(screen.getByTestId('range-min').props.value).toBe('3');
    expect(screen.getByTestId('range-max').props.value).toBe('7');
    expect(screen.getByText('Serán 5 bolas')).toBeOnTheScreen();
  });

  it('asks before restarting and cancel keeps the game and the draft', async () => {
    const game = gameWith(5);
    prime(game);
    await renderSettings();

    await fireEvent.press(screen.getByTestId('settings-range'));
    await fireEvent.press(screen.getByTestId('range-preset-custom'));
    await fireEvent.changeText(screen.getByTestId('range-min'), '1');
    await fireEvent.changeText(screen.getByTestId('range-max'), '5');
    await fireEvent.press(screen.getByTestId('range-apply'));

    expect(screen.getByText('Cambiar el rango reinicia la partida')).toBeOnTheScreen();
    expect(screen.getByText('De 90 a 5 bolas. Se perderán las 5 extracciones.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('confirm-cancel'));

    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
    expect(gameStore.getState().game?.id).toBe(game.id);
    expect(gameStore.getState().game?.history).toHaveLength(5);
    expect(settingsStore.getState().settings.rangeDraft).toEqual(DEFAULT_SETTINGS.rangeDraft);
    expect(mockRepo.saveNew).not.toHaveBeenCalled();
  });

  it('restarts and applies the range only after confirming (§3.3)', async () => {
    const game = gameWith(5);
    prime(game);
    await renderSettings();

    await fireEvent.press(screen.getByTestId('settings-range'));
    await fireEvent.press(screen.getByTestId('range-preset-custom'));
    await fireEvent.changeText(screen.getByTestId('range-min'), '1');
    await fireEvent.changeText(screen.getByTestId('range-max'), '5');
    await fireEvent.press(screen.getByTestId('range-apply'));
    await fireEvent.press(screen.getByTestId('confirm-confirm'));

    const range = customRange(1, 5, DEFAULT_SETTINGS.labelMode);
    expect(settingsStore.getState().settings.rangeDraft).toEqual(range);
    expect(gameStore.getState().game?.range).toEqual(range);
    expect(gameStore.getState().game?.history).toHaveLength(0);
    expect(gameStore.getState().game?.status).toBe('running');
    expect(gameStore.getState().game?.id).not.toBe(game.id);
    expect(mockRepo.saveNew).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
    expect(screen.queryByTestId('range-sheet')).toBeNull();
  });

  it('switches the whole UI to English without touching the game (§7.5)', async () => {
    const game = gameWith(2);
    prime(game);
    await renderSettings();

    await fireEvent.press(screen.getByTestId('settings-language'));
    // The sheet is modal: close it before reading the screen behind it.
    await fireEvent.press(screen.getByTestId('choice-language-option-en'));
    await fireEvent.press(screen.getByTestId('choice-language-done'));

    // The same screen is now in English, including every section.
    expect(screen.getByText('Settings')).toBeOnTheScreen();
    expect(screen.getByText('LANGUAGE')).toBeOnTheScreen();
    expect(screen.getByText('APPEARANCE')).toBeOnTheScreen();
    expect(screen.getByText('Number range')).toBeOnTheScreen();
    expect(settingsStore.getState().settings.language).toBe('en');
    // A presentation preference: the match is untouched (DoD §11.2.3).
    expect(gameStore.getState().game?.id).toBe(game.id);
    expect(gameStore.getState().game?.history).toHaveLength(2);
  });

  it('stores the preference without restarting when the range is unchanged', async () => {
    const game = gameWith(2);
    prime(game);
    await renderSettings();

    await fireEvent.press(screen.getByTestId('settings-range'));
    await fireEvent.press(screen.getByTestId('range-apply'));

    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
    expect(gameStore.getState().game?.id).toBe(game.id);
    expect(mockRepo.saveNew).not.toHaveBeenCalled();
  });

  it('prepares the next game when there is no active one', async () => {
    prime(null);
    await renderSettings();

    await fireEvent.press(screen.getByTestId('settings-range'));
    await fireEvent.press(screen.getByTestId('range-preset-us75'));
    await fireEvent.press(screen.getByTestId('range-apply'));

    expect(settingsStore.getState().settings.rangeDraft).toEqual({
      ...PRESETS.us75,
      labelMode: DEFAULT_SETTINGS.labelMode,
    });
    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
    expect(mockRepo.saveNew).not.toHaveBeenCalled();
  });
});

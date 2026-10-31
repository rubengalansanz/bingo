/**
 * Theme tokens (plan §4.1-4.2, §4.5).
 *
 * A theme is **data**, not code: no component asks `if (theme === 'neon')`, it
 * reads tokens. That keeps the four themes × two schemes small and, above all,
 * testable: contrast is checked over every pair in CI (§8.4) without rendering.
 *
 * The palette lives in `src/core` because it has no React dependency and the
 * 100 % branch gate applies to it. Labels (Spanish copy) are a UI concern and
 * live in `@/features/settings/copy`.
 *
 * Scheme rule (§4.2): every theme declares both a light and a dark variant.
 * `auto` picks between them with the system setting; nothing is inverted at
 * runtime, because inverted colours break the contrast that was validated.
 */

export type ThemeId = 'classic' | 'minimal' | 'neon' | 'festive';

export type Appearance = 'light' | 'dark' | 'auto';

export type ColorScheme = 'light' | 'dark';

/** Every theme, in the order the picker shows them (§4.2). */
export const THEME_IDS = ['classic', 'minimal', 'neon', 'festive'] as const;

export const DEFAULT_THEME_ID: ThemeId = 'classic';

/** All colours a screen may use; no component hard-codes a hex value. */
export type ThemeColors = {
  readonly bg: string;
  readonly surface: string;
  /** Pressed rows and drawn board cells. */
  readonly surfaceStrong: string;
  /** Borders and grid lines. */
  readonly border: string;
  readonly text: string;
  readonly textMuted: string;
  readonly accent: string;
  /** Text drawn over `accent` (primary action, badge). */
  readonly onAccent: string;
  readonly danger: string;
  /** Destructive button background (§7.6). */
  readonly dangerStrong: string;
  readonly onDanger: string;
  readonly ballFrom: string;
  readonly ballTo: string;
  readonly ballText: string;
  readonly ballRing: string;
  /** Drawn cell background on the board (§7.3). */
  readonly drawn: string;
  /** Pending cell background; equals `bg` unless the theme wants contrast. */
  readonly pending: string;
};

export type ThemeBall = {
  /** 0.5 = perfect circle; kept as a token so a theme can square the ball. */
  readonly radius: number;
  /** Ring width in pt; 0 is a flat ball (minimal). */
  readonly ringWidth: number;
};

export type ThemeMotion = {
  /**
   * Base entrance time in ms (§5.3: 400 ms). The user's `animationSpeed`
   * divides it and `reduceMotion` replaces it with a 120 ms cross-fade, so the
   * screen never hard-codes a duration.
   */
  readonly drawDurationMs: number;
};

export type ThemeTokens = {
  readonly id: ThemeId;
  readonly scheme: ColorScheme;
  readonly colors: ThemeColors;
  readonly ball: ThemeBall;
  readonly motion: ThemeMotion;
};

type ThemePair = Record<ColorScheme, ThemeTokens>;

const classic: ThemePair = {
  light: {
    id: 'classic',
    scheme: 'light',
    colors: {
      bg: '#F3EADB',
      surface: '#FFF9EF',
      surfaceStrong: '#E7DAC4',
      border: '#8C7A5E',
      text: '#241A10',
      textMuted: '#5B4A36',
      accent: '#7A4E00',
      onAccent: '#FFF9EF',
      danger: '#A2261F',
      dangerStrong: '#A2261F',
      onDanger: '#FFFFFF',
      ballFrom: '#FFF4DC',
      ballTo: '#E8C547',
      ballText: '#241A10',
      ballRing: '#7A4E00',
      drawn: '#D7E6D3',
      pending: '#F3EADB',
    },
    ball: { radius: 0.5, ringWidth: 4 },
    motion: { drawDurationMs: 420 },
  },
  dark: {
    id: 'classic',
    scheme: 'dark',
    colors: {
      bg: '#0E2A1E',
      surface: '#16382A',
      surfaceStrong: '#1F4A36',
      border: '#4E8A6B',
      text: '#F7F2E7',
      textMuted: '#B7CCBE',
      accent: '#F0CE5A',
      onAccent: '#14231A',
      danger: '#F6B0AA',
      dangerStrong: '#C0392B',
      onDanger: '#FFFFFF',
      ballFrom: '#FFF4DC',
      ballTo: '#E8C547',
      ballText: '#14231A',
      ballRing: '#7A4E00',
      drawn: '#23513C',
      pending: '#0E2A1E',
    },
    ball: { radius: 0.5, ringWidth: 4 },
    motion: { drawDurationMs: 420 },
  },
};

const minimal: ThemePair = {
  light: {
    id: 'minimal',
    scheme: 'light',
    colors: {
      bg: '#F7F7F8',
      surface: '#FFFFFF',
      surfaceStrong: '#ECEDEF',
      border: '#6E737B',
      text: '#111315',
      textMuted: '#52575F',
      accent: '#0B57D0',
      onAccent: '#FFFFFF',
      danger: '#B3261E',
      dangerStrong: '#B3261E',
      onDanger: '#FFFFFF',
      ballFrom: '#FFFFFF',
      ballTo: '#DCE6F7',
      ballText: '#111315',
      ballRing: '#0B57D0',
      drawn: '#D3E3FD',
      pending: '#F7F7F8',
    },
    ball: { radius: 0.5, ringWidth: 3 },
    motion: { drawDurationMs: 260 },
  },
  dark: {
    id: 'minimal',
    scheme: 'dark',
    colors: {
      bg: '#0B0C0E',
      surface: '#17191C',
      surfaceStrong: '#22252A',
      border: '#838A94',
      text: '#F4F5F6',
      textMuted: '#B3B9C1',
      accent: '#A8C7FA',
      onAccent: '#0B1B33',
      danger: '#FFB4AB',
      dangerStrong: '#8C1D18',
      onDanger: '#FFFFFF',
      ballFrom: '#F4F5F6',
      ballTo: '#A8C7FA',
      ballText: '#0B1B33',
      ballRing: '#0B57D0',
      drawn: '#1D2A3F',
      pending: '#0B0C0E',
    },
    ball: { radius: 0.5, ringWidth: 3 },
    motion: { drawDurationMs: 260 },
  },
};

const neon: ThemePair = {
  light: {
    id: 'neon',
    scheme: 'light',
    colors: {
      bg: '#FAF7FF',
      surface: '#FFFFFF',
      surfaceStrong: '#EEE8FF',
      border: '#5A4B8A',
      text: '#16102E',
      textMuted: '#514472',
      accent: '#6A00B8',
      onAccent: '#FFFFFF',
      danger: '#A40033',
      dangerStrong: '#A40033',
      onDanger: '#FFFFFF',
      ballFrom: '#F1E6FF',
      ballTo: '#C77DFF',
      ballText: '#16102E',
      ballRing: '#6A00B8',
      drawn: '#E7DBFF',
      pending: '#FAF7FF',
    },
    ball: { radius: 0.5, ringWidth: 5 },
    motion: { drawDurationMs: 320 },
  },
  dark: {
    id: 'neon',
    scheme: 'dark',
    colors: {
      bg: '#05060E',
      surface: '#101426',
      surfaceStrong: '#1B2140',
      border: '#5767B0',
      text: '#F0F3FF',
      textMuted: '#B3BEEA',
      accent: '#5FF2FF',
      onAccent: '#04121A',
      danger: '#FF85AC',
      dangerStrong: '#9C103F',
      onDanger: '#FFFFFF',
      ballFrom: '#5FF2FF',
      ballTo: '#B388FF',
      ballText: '#05060E',
      ballRing: '#6A00B8',
      drawn: '#14313D',
      pending: '#05060E',
    },
    ball: { radius: 0.5, ringWidth: 5 },
    motion: { drawDurationMs: 320 },
  },
};

const festive: ThemePair = {
  light: {
    id: 'festive',
    scheme: 'light',
    colors: {
      bg: '#FFF4EC',
      surface: '#FFFCF8',
      surfaceStrong: '#FFE2D0',
      border: '#9A5A32',
      text: '#35180C',
      textMuted: '#6A3D28',
      accent: '#9C1B57',
      onAccent: '#FFFFFF',
      danger: '#A3221E',
      dangerStrong: '#A3221E',
      onDanger: '#FFFFFF',
      ballFrom: '#FFD9E5',
      ballTo: '#FF8FB8',
      ballText: '#35180C',
      ballRing: '#9C1B57',
      drawn: '#FBD9E4',
      pending: '#FFF4EC',
    },
    ball: { radius: 0.5, ringWidth: 6 },
    motion: { drawDurationMs: 400 },
  },
  dark: {
    id: 'festive',
    scheme: 'dark',
    colors: {
      bg: '#24080F',
      surface: '#35101B',
      surfaceStrong: '#471726',
      border: '#C2778F',
      text: '#FFF0F4',
      textMuted: '#E3B4C3',
      accent: '#FFB3C7',
      onAccent: '#3B0716',
      danger: '#FF9A8F',
      dangerStrong: '#9B1C2E',
      onDanger: '#FFFFFF',
      ballFrom: '#FFD1DE',
      ballTo: '#FF8FB8',
      ballText: '#3B0716',
      ballRing: '#9C1B57',
      drawn: '#4E1A2C',
      pending: '#24080F',
    },
    ball: { radius: 0.5, ringWidth: 6 },
    motion: { drawDurationMs: 400 },
  },
};

/** The eight palettes: four themes, each with a light and a dark variant (§4.2). */
export const THEMES = {
  classic,
  minimal,
  neon,
  festive,
} as const satisfies Record<ThemeId, ThemePair>;

/**
 * Which scheme to paint (§4.2): `auto` follows the system, anything else wins.
 * The system value is injected so this stays pure and testable in Node.
 */
export function resolveScheme(appearance: Appearance, systemScheme: ColorScheme): ColorScheme {
  return appearance === 'auto' ? systemScheme : appearance;
}

/** The tokens of one theme in one scheme. */
export function themeFor(id: ThemeId, scheme: ColorScheme): ThemeTokens {
  return THEMES[id][scheme];
}

import type { ThemeColors, ThemeId, ThemeTokens } from './tokens';
import { THEMES, THEME_IDS } from './tokens';

/**
 * WCAG contrast (plan §4.5, §8.4).
 *
 * The rule that keeps a theme out of the bundle: every text pair reaches AA
 * (4.5:1) and every graphic pair reaches 3:1. It runs over the eight palettes
 * in CI, so a new theme — or a "small tweak" to an existing one — cannot ship
 * unreadable. It lives in `src/core` so the check is pure and instant.
 */

/** Text minimum, WCAG AA for normal-sized text (§4.5). */
export const TEXT_CONTRAST = 4.5;

/** Non-text minimum: borders, checks, rings (§4.5). */
export const GRAPHIC_CONTRAST = 3;

export type ContrastPair = {
  readonly name: string;
  readonly fg: keyof ThemeColors;
  readonly bg: keyof ThemeColors;
  readonly min: number;
};

/**
 * Every combination the UI actually paints. Adding a coloured element without
 * adding its pair here would bypass the gate, so the list is kept exhaustive on
 * purpose: text roles, button text, ball text and the graphic separators.
 */
export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  { name: 'texto sobre fondo', fg: 'text', bg: 'bg', min: TEXT_CONTRAST },
  { name: 'texto sobre superficie', fg: 'text', bg: 'surface', min: TEXT_CONTRAST },
  { name: 'texto sobre fila pulsada', fg: 'text', bg: 'surfaceStrong', min: TEXT_CONTRAST },
  { name: 'texto atenuado sobre fondo', fg: 'textMuted', bg: 'bg', min: TEXT_CONTRAST },
  { name: 'texto atenuado sobre superficie', fg: 'textMuted', bg: 'surface', min: TEXT_CONTRAST },
  { name: 'acento sobre fondo', fg: 'accent', bg: 'bg', min: TEXT_CONTRAST },
  { name: 'acento sobre superficie', fg: 'accent', bg: 'surface', min: TEXT_CONTRAST },
  { name: 'acento sobre celda extraída', fg: 'accent', bg: 'drawn', min: TEXT_CONTRAST },
  { name: 'texto del botón principal', fg: 'onAccent', bg: 'accent', min: TEXT_CONTRAST },
  { name: 'error sobre superficie', fg: 'danger', bg: 'surface', min: TEXT_CONTRAST },
  { name: 'error sobre fondo', fg: 'danger', bg: 'bg', min: TEXT_CONTRAST },
  { name: 'texto del botón destructivo', fg: 'onDanger', bg: 'dangerStrong', min: TEXT_CONTRAST },
  { name: 'número sobre la bola (inicio)', fg: 'ballText', bg: 'ballFrom', min: TEXT_CONTRAST },
  { name: 'número sobre la bola (fin)', fg: 'ballText', bg: 'ballTo', min: TEXT_CONTRAST },
  { name: 'borde sobre fondo', fg: 'border', bg: 'bg', min: GRAPHIC_CONTRAST },
  { name: 'borde sobre superficie', fg: 'border', bg: 'surface', min: GRAPHIC_CONTRAST },
  { name: 'borde sobre celda pendiente', fg: 'border', bg: 'pending', min: GRAPHIC_CONTRAST },
  { name: 'aro de la bola', fg: 'ballRing', bg: 'ballFrom', min: GRAPHIC_CONTRAST },
];

/** Relative luminance of a `#RRGGBB` colour, per WCAG 2.1. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** Contrast ratio between two colours, 1 (none) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

/** One failing pair, with everything needed to fix it from the test output. */
export type ContrastFailure = {
  readonly themeId: ThemeId;
  readonly scheme: 'light' | 'dark';
  readonly pair: ContrastPair;
  readonly ratio: number;
};

/** Walks every theme × pair and returns the failures (empty = AA everywhere). */
export function findContrastFailures(catalog: ThemeCatalog = THEMES): ContrastFailure[] {
  const failures: ContrastFailure[] = [];

  for (const themeId of THEME_IDS) {
    for (const scheme of ['light', 'dark'] as const) {
      const tokens = catalog[themeId][scheme];
      for (const pair of CONTRAST_PAIRS) {
        const ratio = contrastRatio(tokens.colors[pair.fg], tokens.colors[pair.bg]);
        if (ratio < pair.min) {
          failures.push({ themeId, scheme, pair, ratio });
        }
      }
    }
  }

  return failures;
}

/** The eight palettes, injectable so a test can prove the gate rejects one. */
export type ThemeCatalog = Record<ThemeId, Record<'light' | 'dark', ThemeTokens>>;

/** sRGB channel [0,1] → linear light, the WCAG transfer function. */
function linearize(channel: number): number {
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** `#RRGGBB` → three [0,1] channels. Anything else is a programming error. */
function parseHex(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (match === null) {
    throw new Error(`Not a #RRGGBB colour: ${hex}`);
  }
  return [
    parseInt(match[1]!, 16) / 255,
    parseInt(match[2]!, 16) / 255,
    parseInt(match[3]!, 16) / 255,
  ];
}

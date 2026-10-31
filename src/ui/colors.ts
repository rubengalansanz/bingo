/**
 * Temporary palette shared by every screen (Phase 2).
 *
 * This is NOT the theming system: §4 (tokens, light/dark, themes) is Phase 3.
 * It exists so the tab bar, the board and the history do not each hard-code a
 * different green. Phase 3 replaces this file with the token layer.
 */
export const COLORS = {
  background: '#0E2A1E',
  surface: '#16382A',
  surfaceStrong: '#1D4634',
  line: '#23573F',
  text: '#F5F1E6',
  muted: '#9DB8A8',
  accent: '#E8C547',
  danger: '#F2A6A6',
  dangerStrong: '#C0392B',
} as const;

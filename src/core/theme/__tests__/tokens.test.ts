import {
  DEFAULT_THEME_ID,
  THEMES,
  THEME_IDS,
  resolveScheme,
  themeFor,
  type ThemeColors,
} from '../tokens';

/**
 * Theme tokens (plan §4.1-4.2). These are data assertions: the point is that
 * all eight palettes exist, are complete and keep the token shape the screens
 * consume, so adding a fifth theme without a dark variant fails here.
 */

function colorsOf(theme: (typeof THEME_IDS)[number]): ThemeColors[] {
  return [THEMES[theme].light.colors, THEMES[theme].dark.colors];
}

describe('themes (§4.2)', () => {
  it('ships the four themes with both schemes', () => {
    expect(THEME_IDS).toEqual(['classic', 'minimal', 'neon', 'festive']);

    for (const id of THEME_IDS) {
      expect(THEMES[id].light.id).toBe(id);
      expect(THEMES[id].light.scheme).toBe('light');
      expect(THEMES[id].dark.id).toBe(id);
      expect(THEMES[id].dark.scheme).toBe('dark');
    }
  });

  it('starts on the classic theme', () => {
    expect(DEFAULT_THEME_ID).toBe('classic');
    expect(themeFor('classic', 'dark')).toBe(THEMES.classic.dark);
  });

  it('uses six-digit hex colours everywhere', () => {
    for (const id of THEME_IDS) {
      for (const colors of colorsOf(id)) {
        for (const value of Object.values(colors)) {
          expect(value).toMatch(/^#[0-9A-F]{6}$/);
        }
      }
    }
  });

  it('gives every palette a positive base animation time (§4.4)', () => {
    for (const id of THEME_IDS) {
      for (const tokens of [THEMES[id].light, THEMES[id].dark]) {
        expect(Number.isInteger(tokens.motion.drawDurationMs)).toBe(true);
        expect(tokens.motion.drawDurationMs).toBeGreaterThan(0);
      }
    }
  });

  it('keeps the ball shape sane', () => {
    for (const id of THEME_IDS) {
      for (const tokens of [THEMES[id].light, THEMES[id].dark]) {
        expect(tokens.ball.radius).toBeGreaterThan(0);
        expect(tokens.ball.radius).toBeLessThanOrEqual(0.5);
        expect(tokens.ball.ringWidth).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('resolveScheme (§4.2)', () => {
  it('lets an explicit appearance win over the system', () => {
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });

  it('follows the system in auto mode', () => {
    expect(resolveScheme('auto', 'light')).toBe('light');
    expect(resolveScheme('auto', 'dark')).toBe('dark');
  });
});

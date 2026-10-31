import {
  CONTRAST_PAIRS,
  GRAPHIC_CONTRAST,
  TEXT_CONTRAST,
  contrastRatio,
  findContrastFailures,
  relativeLuminance,
} from '../contrast';
import { THEMES, themeFor, type ColorScheme, type ThemeId, type ThemeTokens } from '../tokens';

/**
 * The contrast gate (plan §4.5, §8.4): every text pair reaches AA and every
 * graphic pair reaches 3:1, in all eight palettes. A theme that fails never
 * ships, so this suite is a release blocker, not a nicety.
 */

describe('WCAG maths (§4.5)', () => {
  it('knows the luminances of black and white', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#FFFFFF')).toBe(1);
  });

  it('reaches 21:1 for black on white and is symmetric', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#123456', '#ABCDEF')).toBeCloseTo(
      contrastRatio('#ABCDEF', '#123456'),
      10,
    );
  });

  it('rejects a colour that is not #RRGGBB', () => {
    expect(() => relativeLuminance('#FFF')).toThrow('#FFF');
    expect(() => relativeLuminance('green')).toThrow('green');
  });
});

describe('palette gate (§4.5)', () => {
  it('requires AA for text and 3:1 for graphics', () => {
    expect(TEXT_CONTRAST).toBe(4.5);
    expect(GRAPHIC_CONTRAST).toBe(3);
    // The pair list is the contract: text roles first, then separators.
    expect(CONTRAST_PAIRS.length).toBeGreaterThanOrEqual(18);
  });

  it('passes every text and graphic pair in the eight palettes', () => {
    expect(findContrastFailures()).toEqual([]);
  });

  it('reports a pair that misses its threshold', () => {
    // One deliberately broken palette: the gate must name theme, scheme and pair.
    const broken: ThemeTokens = {
      ...themeFor('neon', 'dark'),
      colors: { ...themeFor('neon', 'dark').colors, textMuted: '#0A0A0A' },
    };
    const catalog: Record<ThemeId, Record<ColorScheme, ThemeTokens>> = {
      classic: THEMES.classic,
      minimal: THEMES.minimal,
      neon: { light: THEMES.neon.light, dark: broken },
      festive: THEMES.festive,
    };

    const failures = findContrastFailures(catalog);

    expect(failures.length).toBeGreaterThan(0);
    expect(failures[0]).toMatchObject({ themeId: 'neon', scheme: 'dark' });
    expect(failures[0]!.ratio).toBeLessThan(failures[0]!.pair.min);
  });
});

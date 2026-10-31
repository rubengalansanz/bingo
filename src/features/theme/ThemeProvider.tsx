import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { DEFAULT_THEME_ID, resolveScheme, themeFor, type ThemeTokens } from '@/core/theme/tokens';
import { useSettingsSelector } from '@/features/settings/useSettings';

/**
 * Theme provider (plan §4.1-4.2): tokens in, tokens out, no `if (theme === …)`
 * in any component.
 *
 * The provider reads the two preferences that decide the palette (which theme
 * and which colour mode) and the system scheme through `useColorScheme` — the
 * RN API, not a user preference — then exposes a memoized token object. A
 * theme change re-renders only the consumers; the game is never involved.
 *
 * The default context value exists so a component can be rendered in a test
 * without a provider; it is the classic dark palette, never `undefined`.
 */

const ThemeContext = createContext<ThemeTokens>(themeFor(DEFAULT_THEME_ID, 'dark'));

export function ThemeProvider({ children }: { readonly children: ReactNode }) {
  const themeId = useSettingsSelector((state) => state.settings.themeId);
  const appearance = useSettingsSelector((state) => state.settings.appearance);
  const system = useColorScheme();
  const scheme = resolveScheme(appearance, system === 'dark' ? 'dark' : 'light');

  const tokens = useMemo(() => themeFor(themeId, scheme), [themeId, scheme]);

  return <ThemeContext.Provider value={tokens}>{children}</ThemeContext.Provider>;
}

/** The active palette; every themed component reads colours from here. */
export function useTheme(): ThemeTokens {
  return useContext(ThemeContext);
}

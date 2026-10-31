import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { gameStore } from '@/features/game/useGame';
import { LocaleProvider } from '@/features/i18n/LocaleProvider';
import { settingsStore } from '@/features/settings/useSettings';
import { ThemeProvider, useTheme } from '@/features/theme/ThemeProvider';

/**
 * App shell (plan §5.7): loads preferences, then boots the game store once.
 *
 * Order matters: the first game materialises the range saved in Ajustes (§3.3),
 * so preferences are read synchronously before `boot()` looks for a game. Both
 * calls are safe to repeat, so React 19 double-mounting in development cannot
 * load or create anything twice.
 *
 * `ThemeProvider` and `LocaleProvider` wrap the stack; `ThemedShell` exists
 * only to read the active scheme for the status bar, which must live inside the
 * providers.
 */
export default function RootLayout() {
  useEffect(() => {
    settingsStore.getState().load();
    void gameStore.getState().boot();
  }, []);

  return (
    <ThemeProvider>
      <LocaleProvider>
        <ThemedShell />
      </LocaleProvider>
    </ThemeProvider>
  );
}

function ThemedShell() {
  const theme = useTheme();

  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

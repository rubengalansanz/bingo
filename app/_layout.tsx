import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { gameStore } from '@/features/game/useGame';

/**
 * App shell (plan §5.7): boots the game store once, then renders the stack.
 *
 * `boot()` is idempotent in the store itself, so React 19 double-mounting in
 * development cannot load or create the game twice.
 */
export default function RootLayout() {
  useEffect(() => {
    void gameStore.getState().boot();
  }, []);

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

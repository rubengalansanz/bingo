import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { DrawScreen } from './DrawScreen';

/**
 * Sorteo, bound to navigation focus (plan §7.9).
 *
 * Tabs stay mounted when the caller moves to the board, so the draw screen
 * cannot decide "am I visible" by itself. `useFocusEffect` needs a navigator,
 * which is exactly what the route has and a component test does not: keeping
 * the hook here lets `DrawScreen` stay a pure presentation component.
 */
export function FocusedDrawScreen() {
  const [focused, setFocused] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  return <DrawScreen focused={focused} />;
}

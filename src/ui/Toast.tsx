import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/ui/colors';

/**
 * Minimal toast (ADR-12: own components, no toast library).
 *
 * It is transient UI state (§5.4), so the message lives in the screen that
 * triggers it, never in the game store. The screen reader announces it without
 * stealing focus (`polite`), and a new message replaces the previous one
 * instead of queueing.
 */

/** How long the message stays on screen (§7.4: "~2.5 s"). */
export const TOAST_MS = 2500;

export type ToastController = {
  readonly message: string | null;
  readonly show: (message: string) => void;
};

export function useToast(durationMs: number = TOAST_MS): ToastController {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => clear, [clear]);

  const show = useCallback(
    (next: string) => {
      clear();
      setMessage(next);
      timer.current = setTimeout(() => {
        timer.current = null;
        setMessage(null);
      }, durationMs);
    },
    [clear, durationMs],
  );

  return { message, show };
}

/** Renders nothing while there is no message. */
export function Toast({ message }: { readonly message: string | null }) {
  if (message === null) {
    return null;
  }

  return (
    <View
      style={styles.root}
      pointerEvents="none"
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={message}
      testID="toast"
    >
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 96,
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.surfaceStrong,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  text: { color: COLORS.text, fontSize: 15, fontWeight: '600', textAlign: 'center' },
});

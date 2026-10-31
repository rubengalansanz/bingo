import { DrawScreen } from '@/features/draw/DrawScreen';

/**
 * `/` — the draw screen (plan §7.2). Inside `(tabs)` so the bar stays visible;
 * the game itself lives in the shared store, not in this screen.
 */
export default function Index() {
  return <DrawScreen />;
}

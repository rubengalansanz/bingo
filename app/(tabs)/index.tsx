import { FocusedDrawScreen } from '@/features/draw/FocusedDrawScreen';

/**
 * `/` — the draw screen (plan §7.2). Inside `(tabs)` so the bar stays visible;
 * the game itself lives in the shared store, not in this screen. The wrapper
 * adds the one thing only a route can know: whether the tab is focused (§7.9).
 */
export default function Index() {
  return <FocusedDrawScreen />;
}

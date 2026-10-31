import { DrawScreen } from '@/features/draw/DrawScreen';

/**
 * Phase 1: the draw screen is the whole app (§7.2). The tab bar with board,
 * history and settings lands in Phase 2/3 (§7.1).
 */
export default function Index() {
  return <DrawScreen />;
}

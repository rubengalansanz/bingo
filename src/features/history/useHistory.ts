import { useMemo } from 'react';

import { formatLabel } from '@/core/engine/range';
import { useGameStore } from '@/features/game/useGame';

/**
 * History view model (§7.4).
 *
 * The draw log is stored in draw order; the screen shows the newest first, so
 * the rows are reversed here instead of using `FlatList inverted`. The visible
 * result is the same ("la última bola arriba", §7.4) and the rendered order is
 * the visual order, which makes it assertable in a component test.
 *
 * Only one row can have `isLast`: the badge and the inline undo live there.
 */

export const HISTORY_EMPTY = 'Todavía no salió ninguna bola.';

/** Fixed row height: `getItemLayout` needs it to keep the scroll stable. */
export const ROW_HEIGHT = 72;

export type HistoryRow = {
  readonly position: number;
  readonly number: number;
  /** `42`, or `B-12` on the US75 board — the domain label (§3.4). */
  readonly label: string;
  readonly drawnAt: number;
  /** `HH:mm`, local time. */
  readonly time: string;
  readonly isLast: boolean;
};

/** `HH:mm` in the device's time zone (§7.4). */
export function formatClock(timestamp: number): string {
  const date = new Date(timestamp);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

export type HistoryViewModel = {
  readonly phase: 'loading' | 'ready' | 'error';
  readonly rows: HistoryRow[];
  readonly drawn: number;
  readonly onUndo: () => void;
};

export function useHistory(): HistoryViewModel {
  const phase = useGameStore((state) => state.phase);
  const game = useGameStore((state) => state.game);
  const onUndo = useGameStore((state) => state.undoBall);

  const rows = useMemo(() => {
    if (game === null) {
      return [];
    }
    const last = game.history.length;
    return game.history
      .slice()
      .reverse()
      .map((record) => ({
        position: record.position,
        number: record.number,
        label: formatLabel(record.number, game.range),
        drawnAt: record.drawnAt,
        time: formatClock(record.drawnAt),
        isLast: record.position === last,
      }));
  }, [game]);

  return { phase, rows, drawn: rows.length, onUndo };
}

import { useMemo } from 'react';

import { formatLabel } from '@/core/engine/range';
import type { Banner } from '@/features/game/gameStore';
import { useGameStore } from '@/features/game/useGame';
import { useSettingsSelector } from '@/features/settings/useSettings';

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
  readonly banner: Banner | null;
  readonly rows: HistoryRow[];
  readonly drawn: number;
  /** Every number of the range has been drawn. */
  readonly complete: boolean;
  readonly onUndo: () => void;
};

export function useHistory(): HistoryViewModel {
  const phase = useGameStore((state) => state.phase);
  const game = useGameStore((state) => state.game);
  const banner = useGameStore((state) => state.banner);
  const onUndo = useGameStore((state) => state.undoBall);
  // Display preference applied live, so board and history always agree (§3.4).
  const labelMode = useSettingsSelector((state) => state.settings.labelMode);

  const rows = useMemo(() => {
    if (game === null) {
      return [];
    }
    const last = game.history.length;
    const range = { ...game.range, labelMode };
    return game.history
      .slice()
      .reverse()
      .map((record) => ({
        position: record.position,
        number: record.number,
        label: formatLabel(record.number, range),
        drawnAt: record.drawnAt,
        time: formatClock(record.drawnAt),
        isLast: record.position === last,
      }));
  }, [game, labelMode]);

  return {
    phase,
    banner,
    rows,
    drawn: rows.length,
    complete: game?.status === 'exhausted',
    onUndo,
  };
}

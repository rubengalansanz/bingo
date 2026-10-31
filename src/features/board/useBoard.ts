import { useMemo } from 'react';

import {
  boardRows,
  findPosition,
  gridShape,
  type BoardCell,
  type BoardPosition,
  type BoardShape,
} from '@/core/board/grid';
import { DEFAULT_RANGE } from '@/core/engine/range';
import type { Banner } from '@/features/game/gameStore';
import { useGameStore } from '@/features/game/useGame';
import { useSettingsSelector } from '@/features/settings/useSettings';

/**
 * Board view model (§7.3): everything the screen needs to paint, computed once
 * per game change. The grid itself is domain (`@/core/board/grid`), so this hook
 * is the only place that mixes store state with board geometry.
 */

export type BoardViewModel = {
  readonly phase: 'loading' | 'ready' | 'error';
  readonly banner: Banner | null;
  readonly board: BoardCell[][];
  readonly shape: BoardShape;
  readonly drawn: number;
  readonly pending: number;
  readonly lastNumber: number | null;
  /** Where the newest ball sits, so the screen can scroll to it. */
  readonly lastPosition: BoardPosition | null;
  /** `true` on the US75 board: only that preset has B-I-N-G-O headers. */
  readonly hasLetterHeaders: boolean;
  /** Every number of the range has been drawn. */
  readonly complete: boolean;
};

export function useBoard(): BoardViewModel {
  const phase = useGameStore((state) => state.phase);
  const game = useGameStore((state) => state.game);
  const banner = useGameStore((state) => state.banner);
  // Label preference, not game state: the board prints the labels the user
  // chose for display, while the game keeps the range it was created with (§3.4).
  const labelMode = useSettingsSelector((state) => state.settings.labelMode);

  return useMemo(() => {
    const range = game === null ? { ...DEFAULT_RANGE, labelMode } : { ...game.range, labelMode };
    const board = game === null ? [] : boardRows({ ...game, range });
    const shape = gridShape(range);
    const history = game?.history ?? [];
    const lastNumber = history.length > 0 ? history[history.length - 1]!.number : null;
    const drawn = history.length;

    return {
      phase,
      banner,
      board,
      shape,
      drawn,
      pending: Math.max(0, shape.total - drawn),
      lastNumber,
      lastPosition: lastNumber === null ? null : findPosition(board, lastNumber),
      hasLetterHeaders: range.preset === 'us75',
      complete: game?.status === 'exhausted',
    };
  }, [game, phase, banner, labelMode]);
}

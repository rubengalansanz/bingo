import { formatLabel, rangeNumbers, rangeTotal } from '../engine/range';
import type { DrawRecord, Game, RangeConfig } from '../engine/types';

/**
 * Board geometry and cell state (plan §7.3, §3.1).
 *
 * Pure domain on purpose: the grid is a projection of the game, so it is
 * computed and tested in milliseconds without rendering, and the screen only
 * decides how a cell looks. It lives inside `src/core`, which means the 100 %
 * branch gate applies to it.
 *
 * Layout rules:
 * - preset 75 → 5 columns in B-I-N-G-O order, **column-major** (B is the first
 *   column, 15 rows: `B: 1-15 · I: 16-30 · N: 31-45 · G: 46-60 · O: 61-75`);
 * - presets 90 and 80 → 10 columns, read left to right (row-major);
 * - custom → `clamp(ceil(sqrt(total)), 5, 12)` columns, last row possibly short.
 */

/** Columns of the US 1-75 board: one per letter (§3.1). */
const US75_COLUMNS = 5;

/** Columns of the European/80 presets (§7.3). */
const FIXED_COLUMNS = 10;

/** Custom ranges never go below 5 columns: fewer makes the cells unreadable. */
const MIN_COLUMNS = 5;

/** Nine columns is where a phone cell stops being tappable at 44 pt (§3.2). */
const MAX_COLUMNS = 12;

export type BoardCell = {
  readonly number: number;
  /** `42`, or `B-12` on the US75 board — the same string history and ball print. */
  readonly label: string;
  readonly drawn: boolean;
  /** 1-based draw order, `null` while the ball is still in the bombo. */
  readonly position: number | null;
  readonly drawnAt: number | null;
};

export type BoardShape = {
  readonly columns: number;
  readonly rows: number;
  readonly total: number;
};

/** A cell's place on screen, used to scroll to the newest ball (§7.3). */
export type BoardPosition = {
  readonly row: number;
  readonly column: number;
};

/** How many columns the board of `range` has (§3.1, §7.3). */
export function gridColumns(range: RangeConfig): number {
  if (range.preset === 'custom') {
    return clamp(Math.ceil(Math.sqrt(Math.max(0, rangeTotal(range)))), MIN_COLUMNS, MAX_COLUMNS);
  }
  return range.preset === 'us75' ? US75_COLUMNS : FIXED_COLUMNS;
}

/** Columns, rows and total of the real board (§7.3). */
export function gridShape(range: RangeConfig): BoardShape {
  const total = Math.max(0, rangeTotal(range));
  const columns = gridColumns(range);
  return { columns, rows: total === 0 ? 0 : Math.ceil(total / columns), total };
}

/**
 * The whole board in visual order, one array per row.
 *
 * Every number of the range appears exactly once (INV-1 on the board), and the
 * last row of a custom range may be shorter: the screen renders what it gets.
 */
export function boardRows(game: Game): BoardCell[][] {
  const cells = orderedCells(game);
  const { columns, rows } = gridShape(game.range);
  const columnMajor = game.range.preset === 'us75';
  const board: BoardCell[][] = [];

  for (let row = 0; row < rows; row++) {
    const line: BoardCell[] = [];
    for (let column = 0; column < columns; column++) {
      const cell = cells[columnMajor ? column * rows + row : row * columns + column];
      // Only a short last row (custom ranges) can be missing a cell.
      if (cell !== undefined) {
        line.push(cell);
      }
    }
    board.push(line);
  }

  return board;
}

/** Where `number` sits on `board`, or `null` if it is not part of it. */
export function findPosition(
  board: readonly (readonly BoardCell[])[],
  number: number,
): BoardPosition | null {
  for (let row = 0; row < board.length; row++) {
    const line = board[row]!;
    for (let column = 0; column < line.length; column++) {
      if (line[column]!.number === number) {
        return { row, column };
      }
    }
  }
  return null;
}

/** `[min..max]` annotated with its draw record, in ascending number order. */
function orderedCells(game: Game): BoardCell[] {
  const drawnByNumber = new Map<number, DrawRecord>();
  for (const record of game.history) {
    drawnByNumber.set(record.number, record);
  }

  return rangeNumbers(game.range).map((number) => {
    const record = drawnByNumber.get(number);
    return {
      number,
      label: formatLabel(number, game.range),
      drawn: record !== undefined,
      position: record === undefined ? null : record.position,
      drawnAt: record === undefined ? null : record.drawnAt,
    };
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

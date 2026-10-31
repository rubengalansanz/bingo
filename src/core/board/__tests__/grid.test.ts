import { createGame, draw } from '../../engine/game';
import { PRESETS } from '../../engine/range';
import { mulberry32 } from '../../engine/rng';
import type { Game, RangeConfig } from '../../engine/types';
import { boardRows, findPosition, gridColumns, gridShape } from '../grid';

/**
 * Board geometry (§3.1, §7.3). This suite is inside `src/core`, so it also has
 * to keep the 100 % branch gate satisfied.
 */

const CUSTOM_1 = custom(1, 1);
const CUSTOM_10 = custom(1, 10);
const CUSTOM_36 = custom(1, 36);
const CUSTOM_200 = custom(1, 200);
const CUSTOM_SHIFTED = custom(5, 14);
const CUSTOM_EMPTY = custom(10, 5);

function custom(min: number, max: number): RangeConfig {
  return { preset: 'custom', min, max, labelMode: 'number' };
}

function gameOf(cfg: RangeConfig, draws = 0): Game {
  const rng = mulberry32(1);
  let game = createGame(cfg, rng, 1_700_000_000_000);
  for (let i = 0; i < draws; i++) {
    const result = draw(game, 1_700_000_000_000 + i + 1);
    if (!result.ok) {
      throw new Error(`unexpected ${result.error}`);
    }
    game = result.value.game;
  }
  return game;
}

describe('gridColumns (§3.1, §7.3)', () => {
  it('gives 10 columns to the 90 and 80 presets', () => {
    expect(gridColumns(PRESETS.eu90)).toBe(10);
    expect(gridColumns(PRESETS.n80)).toBe(10);
  });

  it('gives 5 columns to the US75 preset (one per letter)', () => {
    expect(gridColumns(PRESETS.us75)).toBe(5);
  });

  it('adapts custom ranges with clamp(ceil(sqrt(total)), 5, 12)', () => {
    // ceil(sqrt(1)) = 1 → clamped up to 5.
    expect(gridColumns(CUSTOM_1)).toBe(5);
    // ceil(sqrt(10)) = 4 → clamped up to 5.
    expect(gridColumns(CUSTOM_10)).toBe(5);
    // ceil(sqrt(36)) = 6 → inside the range.
    expect(gridColumns(CUSTOM_36)).toBe(6);
    // ceil(sqrt(200)) = 15 → clamped down to 12.
    expect(gridColumns(CUSTOM_200)).toBe(12);
  });
});

describe('gridShape (§7.3)', () => {
  it('describes the three presets', () => {
    expect(gridShape(PRESETS.eu90)).toEqual({ columns: 10, rows: 9, total: 90 });
    expect(gridShape(PRESETS.n80)).toEqual({ columns: 10, rows: 8, total: 80 });
    expect(gridShape(PRESETS.us75)).toEqual({ columns: 5, rows: 15, total: 75 });
  });

  it('keeps a short last row for custom ranges', () => {
    // 200 numbers in 12 columns → 17 rows, the last one with 8 cells.
    expect(gridShape(CUSTOM_200)).toEqual({ columns: 12, rows: 17, total: 200 });
    expect(boardRows(gameOf(CUSTOM_200)).at(-1)).toHaveLength(8);
  });

  it('survives a degenerate range without throwing', () => {
    expect(gridShape(CUSTOM_EMPTY)).toEqual({ columns: 5, rows: 0, total: 0 });
    expect(boardRows(gameOf(CUSTOM_EMPTY))).toEqual([]);
  });
});

describe('boardRows — layout (§7.3)', () => {
  it('reads the 90 preset left to right', () => {
    const board = boardRows(gameOf(PRESETS.eu90));

    expect(board).toHaveLength(9);
    expect(board[0]?.map((cell) => cell.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(board[1]?.[0]?.number).toBe(11);
    expect(board.at(-1)?.at(-1)?.number).toBe(90);
  });

  it('reads the US75 preset column-major, B first', () => {
    const board = boardRows(gameOf(PRESETS.us75));

    expect(board).toHaveLength(15);
    expect(board[0]?.map((cell) => cell.number)).toEqual([1, 16, 31, 46, 61]);
    expect(board.at(-1)?.map((cell) => cell.number)).toEqual([15, 30, 45, 60, 75]);
  });

  it('shows every number of the range exactly once', () => {
    const board = boardRows(gameOf(PRESETS.us75));
    const numbers = board.flat().map((cell) => cell.number);

    expect(numbers).toHaveLength(75);
    expect(new Set(numbers).size).toBe(75);
  });

  it('starts at the range minimum, not at 1', () => {
    const board = boardRows(gameOf(CUSTOM_SHIFTED));

    expect(board[0]?.map((cell) => cell.number)).toEqual([5, 6, 7, 8, 9]);
    expect(board.at(-1)?.map((cell) => cell.number)).toEqual([10, 11, 12, 13, 14]);
  });
});

describe('boardRows — cell state (§7.3)', () => {
  it('marks the drawn numbers with their order and timestamp', () => {
    const game = gameOf(PRESETS.eu90, 2);
    const first = game.history[0]!;
    const second = game.history[1]!;
    const cells = boardRows(game).flat();

    const firstCell = cells.find((cell) => cell.number === first.number);
    expect(firstCell).toMatchObject({
      drawn: true,
      position: 1,
      drawnAt: first.drawnAt,
    });

    const secondCell = cells.find((cell) => cell.number === second.number);
    expect(secondCell?.position).toBe(2);

    const pending = cells.filter((cell) => !cell.drawn);
    expect(pending).toHaveLength(88);
    expect(pending[0]?.position).toBeNull();
    expect(pending[0]?.drawnAt).toBeNull();
  });

  it('labels through the domain so every surface prints the same string', () => {
    const usBoard = boardRows(gameOf(PRESETS.us75)).flat();
    expect(usBoard.find((cell) => cell.number === 12)?.label).toBe('B-12');
    expect(usBoard.find((cell) => cell.number === 75)?.label).toBe('O-75');

    const euBoard = boardRows(gameOf(PRESETS.eu90)).flat();
    expect(euBoard.find((cell) => cell.number === 42)?.label).toBe('42');
  });
});

describe('findPosition (§7.3, auto-scroll)', () => {
  it('finds a number on the board', () => {
    const board = boardRows(gameOf(PRESETS.us75));

    expect(findPosition(board, 16)).toEqual({ row: 0, column: 1 });
    expect(findPosition(board, 75)).toEqual({ row: 14, column: 4 });
  });

  it('returns null when the number is not on this board', () => {
    expect(findPosition(boardRows(gameOf(PRESETS.eu90)), 91)).toBeNull();
  });
});

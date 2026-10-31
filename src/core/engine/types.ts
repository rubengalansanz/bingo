/**
 * Domain types (plan §6.1). No runtime code lives here on purpose.
 */

export type RangePreset = 'eu90' | 'us75' | 'n80' | 'custom';

export type LabelMode = 'number' | 'letter-number';

export type RangeConfig = {
  readonly preset: RangePreset;
  readonly min: number;
  readonly max: number;
  readonly labelMode: LabelMode;
};

export type DrawRecord = {
  readonly number: number;
  /** 1-based, monotonically increasing: history[i].position === i + 1. */
  readonly position: number;
  readonly drawnAt: number;
};

export type GameStatus = 'running' | 'exhausted' | 'abandoned';

export type Game = {
  readonly id: string;
  readonly range: RangeConfig;
  /**
   * Remaining order, consumed with `pop()` (plan §2.2): the LAST element is the
   * next ball, and `undo` pushes the returned ball back at the end so the next
   * draw repeats it exactly (§2.6). Note plan §6.1 states `pool[0]`; §2.2 and
   * §2.6 (consume + push at the end) are the ones that make undo reversible.
   */
  readonly pool: readonly number[];
  readonly history: readonly DrawRecord[];
  readonly status: GameStatus;
  readonly createdAt: number;
  readonly finishedAt: number | null;
  /** Only set in reproducible/dev mode (plan §2.8). */
  readonly seed: number | null;
};

/** Typed domain failures (plan §2.7). */
export type EngineError = 'EXHAUSTED' | 'EMPTY_HISTORY' | 'RANGE_LOCKED';

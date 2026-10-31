import { memo, useEffect, useRef, type ComponentRef } from 'react';
import {
  AccessibilityInfo,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { BoardCell } from '@/core/board/grid';
import { COLORS } from '@/ui/colors';

import { BOARD_EMPTY, useBoard } from './useBoard';

/**
 * Board screen (§7.3): the whole range, one cell per number.
 *
 * Rules this screen is responsible for:
 * - a drawn number is filled **and** struck through **and** checked, never
 *   distinguished by colour alone (colour blindness);
 * - every cell has an accessibility label with its number and state, so
 *   TalkBack/VoiceOver announce the board cell by cell;
 * - the B-I-N-G-O headers are outside the scroll view, which makes them sticky;
 * - a tap on a cell does nothing: the board is read-only (§7.3).
 */

const H_PADDING = 12;
const GAP = 4;
/** B-I-N-G-O columns of the US75 board, in order (§3.1). */
const LETTERS = ['B', 'I', 'N', 'G', 'O'] as const;
/** Below this, a check glyph does not fit next to the number. */
const MIN_SIZE_FOR_CHECK = 34;

type CellProps = {
  readonly cell: BoardCell;
  readonly size: number;
  readonly showCheck: boolean;
};

/**
 * One cell. Memoized on the four values that can change, so drawing a ball
 * re-renders the two cells involved instead of the whole board.
 */
const Cell = memo(function Cell({ cell, size, showCheck }: CellProps) {
  const spoken = cell.label.replace('-', ', ');
  const state =
    cell.drawn && cell.position !== null ? `extraída en la posición ${cell.position}` : 'pendiente';

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${spoken}, ${state}`}
      testID={`board-cell-${cell.number}`}
      style={[
        styles.cell,
        { width: size, height: size },
        cell.drawn ? styles.cellDrawn : styles.cellPending,
      ]}
    >
      <Text
        style={[
          styles.cellLabel,
          { fontSize: Math.max(11, Math.round(size * 0.36)) },
          cell.drawn && styles.cellLabelDrawn,
        ]}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {cell.label}
      </Text>
      {cell.drawn && showCheck && <Text style={styles.check}>✓</Text>}
    </View>
  );
});

export function BoardScreen() {
  const { phase, banner, board, shape, drawn, pending, lastPosition, hasLetterHeaders } =
    useBoard();
  const { width } = useWindowDimensions();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);

  const size = Math.max(
    24,
    Math.floor((width - H_PADDING * 2 - (shape.columns - 1) * GAP) / Math.max(1, shape.columns)),
  );
  const rowHeight = size + GAP;

  // Scroll to the newest ball, but never animate against the system preference.
  const lastRow = lastPosition?.row ?? null;
  useEffect(() => {
    if (lastRow === null) {
      return;
    }
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled) {
        return;
      }
      scroll.current?.scrollTo({
        y: Math.max(0, (lastRow - 1) * rowHeight),
        animated: !reduceMotion,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [lastRow, rowHeight]);

  return (
    <SafeAreaView style={styles.root} testID="board-screen" edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Tablero
        </Text>
        <Text style={styles.counter} testID="board-counter">
          {drawn} extraídas · {pending} pendientes
        </Text>
      </View>

      <Text style={styles.legend}>Verde = extraída · Gris = pendiente</Text>

      {drawn === 0 && phase === 'ready' && <Text style={styles.empty}>{BOARD_EMPTY}</Text>}

      {banner !== null && (
        <Text
          accessibilityRole="alert"
          style={[styles.banner, banner.tone === 'error' ? styles.bannerError : styles.bannerInfo]}
        >
          {banner.text}
        </Text>
      )}

      {hasLetterHeaders && (
        <View style={styles.letterRow} accessibilityElementsHidden importantForAccessibility="no">
          {LETTERS.map((letter) => (
            <Text key={letter} style={[styles.letter, { width: size, marginRight: GAP }]}>
              {letter}
            </Text>
          ))}
        </View>
      )}

      <ScrollView
        ref={scroll}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        testID="board-scroll"
      >
        {board.map((row, index) => (
          <View key={index} style={styles.row}>
            {row.map((cell) => (
              <View key={cell.number} style={styles.cellSlot}>
                <Cell cell={cell} size={size} showCheck={size >= MIN_SIZE_FOR_CHECK} />
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: H_PADDING,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: { color: COLORS.text, fontSize: 20, fontWeight: '700' },
  counter: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  legend: { color: COLORS.muted, fontSize: 13, paddingBottom: 8 },
  empty: { color: COLORS.muted, fontSize: 15, paddingBottom: 8 },
  banner: {
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  bannerInfo: { color: COLORS.text, backgroundColor: COLORS.surface },
  bannerError: { color: COLORS.danger, backgroundColor: COLORS.surface },
  letterRow: { flexDirection: 'row', paddingBottom: 4 },
  letter: {
    color: COLORS.accent,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24, gap: GAP },
  row: { flexDirection: 'row', gap: GAP },
  cellSlot: { alignItems: 'center', justifyContent: 'center' },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
  },
  cellDrawn: { backgroundColor: COLORS.surfaceStrong, borderColor: COLORS.accent },
  cellPending: { backgroundColor: 'transparent', borderColor: COLORS.line },
  cellLabel: {
    color: COLORS.text,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  cellLabelDrawn: {
    // Fill + strikethrough + check: three signals, none of them colour alone.
    color: COLORS.accent,
    textDecorationLine: 'line-through',
  },
  check: {
    position: 'absolute',
    top: 1,
    right: 3,
    color: COLORS.accent,
    fontSize: 9,
    fontWeight: '900',
  },
});

import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import type { ThemeTokens } from '@/core/theme/tokens';
import { useMessages } from '@/features/i18n/LocaleProvider';
import { useTheme } from '@/features/theme/ThemeProvider';
import { useBoard } from '@/features/board/useBoard';

/**
 * Compact board next to the ball on wide screens (plan §7.8).
 *
 * It is the same domain projection as the Tablero tab (`boardRows`), painted
 * smaller and without its own scroll animation: the point is to keep the whole
 * range visible while the caller draws, not to replace the board screen. Cells
 * announce their number and state as the full board does (§7.3), and a drawn
 * number is filled **and** struck through, never distinguished by colour alone.
 */

const GAP = 2;
const PADDING = 12;
/** Right column bounds: enough for 10 columns, never wider than the stage. */
const MIN_COLUMN_WIDTH = 260;
const MAX_COLUMN_WIDTH = 380;

export function CompactBoard() {
  const t = useMessages();
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { phase, board, shape, drawn, pending, complete } = useBoard();
  const { width } = useWindowDimensions();

  const columnWidth = Math.min(
    MAX_COLUMN_WIDTH,
    Math.max(MIN_COLUMN_WIDTH, Math.round(width * 0.4)),
  );
  const columns = Math.max(1, shape.columns);
  const size = Math.max(
    14,
    Math.floor((columnWidth - PADDING * 2 - (columns - 1) * GAP) / columns),
  );

  return (
    <View style={[styles.root, { width: columnWidth }]} testID="draw-compact-board">
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {t.board.title}
        </Text>
        <Text
          style={styles.counter}
          testID="draw-compact-counter"
          accessibilityLiveRegion="polite"
          accessibilityLabel={t.board.counterLabel(drawn, pending)}
        >
          {t.board.compactCounter(drawn, shape.total)}
        </Text>
      </View>

      <Text style={styles.legend}>{t.board.legend}</Text>

      {drawn === 0 && phase === 'ready' && <Text style={styles.empty}>{t.board.empty}</Text>}
      {complete && <Text style={styles.complete}>{t.board.complete}</Text>}

      <ScrollView contentContainerStyle={styles.grid} testID="draw-compact-scroll">
        {board.map((row, index) => (
          <View key={index} style={styles.row}>
            {row.map((cell) => {
              const state =
                cell.drawn && cell.position !== null
                  ? t.board.cellDrawn(cell.position)
                  : t.board.cellPending;
              return (
                <View
                  key={cell.number}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={t.board.cellLabel(cell.label.replace('-', ', '), state)}
                  testID={`compact-cell-${cell.number}`}
                  style={[
                    styles.cell,
                    { width: size, height: size },
                    cell.drawn
                      ? { backgroundColor: theme.colors.drawn, borderColor: theme.colors.accent }
                      : { backgroundColor: theme.colors.pending, borderColor: theme.colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.cellLabel,
                      { fontSize: Math.max(9, Math.round(size * 0.36)) },
                      cell.drawn && [styles.cellLabelDrawn, { color: theme.colors.accent }],
                    ]}
                    numberOfLines={1}
                    allowFontScaling={false}
                  >
                    {cell.label}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function makeStyles(theme: ThemeTokens) {
  const { colors } = theme;

  return StyleSheet.create({
    root: {
      paddingVertical: 8,
      gap: 6,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 8,
    },
    title: { color: colors.text, fontSize: 18, fontWeight: '700' },
    counter: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    legend: { color: colors.textMuted, fontSize: 12 },
    empty: { color: colors.textMuted, fontSize: 14 },
    complete: { color: colors.accent, fontSize: 14, fontWeight: '700' },
    grid: { paddingVertical: 6, gap: GAP },
    row: { flexDirection: 'row', gap: GAP },
    cell: {
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 4,
      borderWidth: 1,
    },
    cellLabel: { fontWeight: '700', fontVariant: ['tabular-nums'] },
    cellLabelDrawn: { textDecorationLine: 'line-through' },
  });
}

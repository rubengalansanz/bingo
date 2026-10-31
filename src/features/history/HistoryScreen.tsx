import { memo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '@/ui/colors';

import { HISTORY_EMPTY, ROW_HEIGHT, useHistory, type HistoryRow } from './useHistory';

/**
 * History screen (§7.4): the draw log, newest first.
 *
 * The rows arrive newest-first from `useHistory`, so a plain `FlatList` shows
 * the last draw on top. Rows are fixed height for `getItemLayout`, which keeps
 * the scroll stable with 90-200 entries.
 *
 * Undo lives on the newest row and needs no dialog: it is reversible, and the
 * toast says which ball went back to the bombo (§2.6, §7.6).
 */

type RowProps = {
  readonly row: HistoryRow;
  readonly onUndo: () => void;
  readonly disabled: boolean;
};

const Row = memo(function Row({ row, onUndo, disabled }: RowProps) {
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`Posición ${row.position}, bola ${row.label.replace('-', ', ')}, extraída a las ${row.time}`}
      testID={`history-row-${row.position}`}
    >
      <View style={styles.rowMain}>
        <Text style={styles.position}>#{row.position}</Text>
        <Text style={styles.number}>{row.label}</Text>
        <Text style={styles.time}>{row.time}</Text>
        {row.isLast && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Última</Text>
          </View>
        )}
      </View>

      {row.isLast && (
        <Pressable
          onPress={onUndo}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`Deshacer la bola ${row.label.replace('-', ', ')}`}
          accessibilityState={{ disabled }}
          testID="history-undo"
          style={({ pressed }) => [
            styles.undo,
            disabled && styles.undoDisabled,
            pressed && !disabled && styles.undoPressed,
          ]}
        >
          <Text style={styles.undoLabel}>Deshacer</Text>
        </Pressable>
      )}
    </View>
  );
});

export function HistoryScreen() {
  const { phase, rows, drawn, onUndo } = useHistory();
  const empty = rows.length === 0;

  return (
    <SafeAreaView style={styles.root} testID="history-screen" edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Historial
        </Text>
        <Text style={styles.counter} testID="history-counter">
          {drawn} {drawn === 1 ? 'extracción' : 'extracciones'}
        </Text>
      </View>

      {empty ? (
        <View style={styles.emptyBox}>
          <Text style={styles.empty}>{HISTORY_EMPTY}</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => String(row.position)}
          // Every row is exactly ROW_HEIGHT tall: offsets are arithmetic, so
          // scrolling 200 entries never jumps (§7.4).
          getItemLayout={(_, index) => ({
            length: ROW_HEIGHT,
            offset: ROW_HEIGHT * index,
            index,
          })}
          renderItem={({ item }) => <Row row={item} onUndo={onUndo} disabled={phase !== 'ready'} />}
          contentContainerStyle={styles.list}
          testID="history-list"
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 8,
    paddingBottom: 8,
  },
  title: { color: COLORS.text, fontSize: 20, fontWeight: '700' },
  counter: { color: COLORS.muted, fontSize: 14, fontWeight: '600' },
  list: { paddingBottom: 24 },
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    marginBottom: 8,
  },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  position: {
    color: COLORS.muted,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    minWidth: 38,
  },
  number: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  time: { color: COLORS.muted, fontSize: 14, fontVariant: ['tabular-nums'] },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: COLORS.accent,
  },
  badgeText: { color: COLORS.background, fontSize: 11, fontWeight: '800' },
  undo: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  undoDisabled: { opacity: 0.4 },
  undoPressed: { backgroundColor: COLORS.surfaceStrong },
  undoLabel: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  empty: { color: COLORS.muted, fontSize: 16, textAlign: 'center' },
});

import { memo, useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ThemeTokens } from '@/core/theme/tokens';
import { useMessages } from '@/features/i18n/LocaleProvider';
import { useTheme } from '@/features/theme/ThemeProvider';

import { ROW_HEIGHT, useHistory, type HistoryRow } from './useHistory';

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
  const theme = useTheme();
  const t = useMessages();
  const { colors } = theme;
  const spoken = row.label.replace('-', ', ');

  return (
    <View
      style={[rowStyles.row, { backgroundColor: colors.surface }]}
      accessible
      accessibilityLabel={t.history.rowLabel(row.position, spoken, row.time)}
      testID={`history-row-${row.position}`}
    >
      <View style={rowStyles.rowMain}>
        <Text style={[rowStyles.position, { color: colors.textMuted }]}>#{row.position}</Text>
        <Text style={[rowStyles.number, { color: colors.text }]}>{row.label}</Text>
        <Text style={[rowStyles.time, { color: colors.textMuted }]}>{row.time}</Text>
        {row.isLast && (
          <View style={[rowStyles.badge, { backgroundColor: colors.accent }]}>
            <Text style={[rowStyles.badgeText, { color: colors.onAccent }]}>{t.history.badge}</Text>
          </View>
        )}
      </View>

      {row.isLast && (
        <Pressable
          onPress={onUndo}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={t.history.undoLabel(spoken)}
          accessibilityState={{ disabled }}
          testID="history-undo"
          style={({ pressed }) => [
            rowStyles.undo,
            { borderColor: colors.border },
            disabled && rowStyles.undoDisabled,
            pressed && !disabled && { backgroundColor: colors.surfaceStrong },
          ]}
        >
          <Text style={[rowStyles.undoLabel, { color: colors.text }]}>{t.history.undo}</Text>
        </Pressable>
      )}
    </View>
  );
});

export function HistoryScreen() {
  const { phase, banner, rows, drawn, complete, onUndo } = useHistory();
  const theme = useTheme();
  const t = useMessages();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const empty = rows.length === 0 && phase === 'ready';

  return (
    <SafeAreaView style={styles.root} testID="history-screen" edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {t.history.title}
        </Text>
        <Text style={styles.counter} testID="history-counter">
          {t.history.counter(drawn)}
        </Text>
      </View>

      {banner !== null && (
        <Text
          accessibilityRole="alert"
          style={[styles.banner, banner.tone === 'error' ? styles.bannerError : styles.bannerInfo]}
        >
          {t.banners[banner.code]}
        </Text>
      )}

      {empty ? (
        <View style={styles.emptyBox}>
          <Text style={styles.empty}>{t.history.empty}</Text>
        </View>
      ) : (
        <>
          {complete && <Text style={styles.complete}>{t.history.complete}</Text>}
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
            renderItem={({ item }) => (
              <Row row={item} onUndo={onUndo} disabled={phase !== 'ready'} />
            )}
            contentContainerStyle={styles.list}
            testID="history-list"
          />
        </>
      )}
    </SafeAreaView>
  );
}

/** Layout only; every colour is applied from the tokens at render time. */
const rowStyles = StyleSheet.create({
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  position: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    minWidth: 38,
  },
  number: {
    fontSize: 24,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  time: { fontSize: 14, fontVariant: ['tabular-nums'] },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: '800' },
  undo: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  undoDisabled: { opacity: 0.4 },
  undoLabel: { fontSize: 15, fontWeight: '700' },
});

function makeStyles(theme: ThemeTokens) {
  const { colors } = theme;

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
    header: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 8,
      paddingTop: 8,
      paddingBottom: 8,
    },
    title: { color: colors.text, fontSize: 20, fontWeight: '700' },
    counter: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
    list: { paddingBottom: 24 },
    complete: {
      color: colors.accent,
      fontSize: 15,
      fontWeight: '700',
      paddingBottom: 8,
    },
    banner: {
      fontSize: 14,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      marginBottom: 8,
      overflow: 'hidden',
    },
    bannerInfo: { color: colors.text, backgroundColor: colors.surface },
    bannerError: { color: colors.danger, backgroundColor: colors.surface },
    emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    empty: { color: colors.textMuted, fontSize: 16, textAlign: 'center' },
  });
}

import { StyleSheet, Text, View } from 'react-native';

/**
 * `/board` — placeholder replaced by `BoardScreen` in the next work unit.
 * Kept minimal on purpose: the tab must exist and be reachable before the grid
 * lands, so the navigation commit is reviewable on its own.
 */
export default function BoardRoute() {
  return (
    <View style={styles.root} testID="board-screen">
      <Text style={styles.title} accessibilityRole="header">
        Tablero
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0E2A1E', padding: 24 },
  title: { color: '#F5F1E6', fontSize: 20, fontWeight: '700', paddingTop: 8 },
});

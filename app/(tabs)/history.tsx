import { StyleSheet, Text, View } from 'react-native';

/** `/history` — placeholder replaced by `HistoryScreen` in a later work unit. */
export default function HistoryRoute() {
  return (
    <View style={styles.root} testID="history-screen">
      <Text style={styles.title} accessibilityRole="header">
        Historial
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0E2A1E', padding: 24 },
  title: { color: '#F5F1E6', fontSize: 20, fontWeight: '700', paddingTop: 8 },
});

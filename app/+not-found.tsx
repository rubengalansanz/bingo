import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/ui/colors';

/** Unmatched route: a way back instead of a blank screen (§7.7). */
export default function NotFound() {
  return (
    <View style={styles.root}>
      <Text style={styles.title} accessibilityRole="header">
        Pantalla no encontrada
      </Text>
      <Link href="/" style={styles.link}>
        Volver al sorteo
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: COLORS.background,
    padding: 24,
  },
  title: { color: COLORS.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  link: { color: COLORS.accent, fontSize: 17, fontWeight: '700' },
});

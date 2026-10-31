import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useMessages } from '@/features/i18n/LocaleProvider';
import { useTheme } from '@/features/theme/ThemeProvider';

/** Unmatched route: a way back instead of a blank screen (§7.7). */
export default function NotFound() {
  const theme = useTheme();
  const t = useMessages();

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg }]}>
      <Text style={[styles.title, { color: theme.colors.text }]} accessibilityRole="header">
        {t.notFound.title}
      </Text>
      <Link href="/" style={[styles.link, { color: theme.colors.accent }]}>
        {t.notFound.back}
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
    padding: 24,
  },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  link: { fontSize: 17, fontWeight: '700' },
});

import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMessages } from '@/features/i18n/LocaleProvider';
import { useTheme } from '@/features/theme/ThemeProvider';

/**
 * Four tabs (plan §7.1): Sorteo is the initial screen, and every tab reads the
 * same game from the store. Icons plus labels, always visible: an icon alone
 * fails the "target ≥ 44 pt with a readable name" rule for screen readers.
 *
 * Colours come from the active theme (§4.1), so switching to neon or to light
 * mode re-themes the bar without touching the navigator's structure.
 *
 * `color as string`: the navigator types the tint as `string | number`, while
 * Ionicons only accepts a string/ColorValue. Both tints below are our hex
 * strings, so the cast is safe at runtime.
 */

/** Tab bar height with room for a label above the home indicator (§7.1). */
const BAR_HEIGHT = 64;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const t = useMessages();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: BAR_HEIGHT + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 8,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarItemStyle: { minHeight: 44 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabs.draw,
          tabBarButtonTestID: 'tab-sorteo',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="tennisball-outline" color={color as string} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="board"
        options={{
          title: t.tabs.board,
          tabBarButtonTestID: 'tab-tablero',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" color={color as string} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t.tabs.history,
          tabBarButtonTestID: 'tab-historial',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" color={color as string} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t.tabs.settings,
          tabBarButtonTestID: 'tab-ajustes',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" color={color as string} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

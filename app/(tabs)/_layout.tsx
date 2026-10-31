import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '@/ui/colors';

/**
 * Four tabs (plan §7.1): Sorteo is the initial screen, and every tab reads the
 * same game from the store. Icons plus labels, always visible: an icon alone
 * fails the "target ≥ 44 pt with a readable name" rule for screen readers.
 *
 * `color as string`: the navigator types the tint as `string | number`, while
 * Ionicons only accepts a string/ColorValue. Both tints below are our hex
 * strings, so the cast is safe at runtime.
 */

/** Tab bar height with room for a label above the home indicator (§7.1). */
const BAR_HEIGHT = 64;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.line,
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
          title: 'Sorteo',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="tennisball-outline" color={color as string} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="board"
        options={{
          title: 'Tablero',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" color={color as string} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Historial',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" color={color as string} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" color={color as string} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

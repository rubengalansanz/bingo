/**
 * Shared setup for the UI test project (U1).
 *
 * 1. `react-native-safe-area-context` ships its own mock, but as a default
 *    export: without `.default` every `SafeAreaView` in the tree is `undefined`
 *    and React fails with "Element type is invalid".
 * 2. `@/shared/db/client` opens expo-sqlite on first use, which needs a native
 *    module. It fails loudly instead of silently: any test that needs storage
 *    overrides this mock with its own (see DrawScreen/navigation tests).
 * 3. `@expo/vector-icons` loads its font at mount time through the asset
 *    registry, which does not exist under Jest ("Module 1 is missing from the
 *    asset registry"). Tab tests are about routing, not glyphs, so the icon
 *    becomes a Text with the icon name.
 * 4. `@/shared/kv/mmkv` opens a native MMKV store. Preferences are in-memory in
 *    a component test, so the adapter is replaced by a Map; the settings store
 *    and its persistence have their own unit tests with an injected port.
 * 5. `@/shared/feedback/native` touches expo-audio, which evaluates a native
 *    SharedObject at import time and throws under Jest. The adapter stays a
 *    real module on device; here it becomes four jest.fn so a test can assert
 *    what was played (the decision itself is tested in `src/core/feedback`).
 * 6. Skia draws the ball with a Canvas; Jest has no rendering backend, so the
 *    canvas becomes a View and the shapes are no-ops. Layout and copy are what
 *    the ball tests check, not pixels.
 * 7. `expo-keep-awake` is a no-op here: the screen must not be held awake by a
 *    test process, and the condition that mounts it is what gets asserted.
 */
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('@expo/vector-icons/Ionicons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ name }) => React.createElement(Text, null, name),
  };
});

jest.mock('@/shared/db/client', () => ({
  gameRepository: () => {
    throw new Error('gameRepository() is not available in a component test');
  },
}));

jest.mock('@/shared/feedback/native', () => ({
  nativeFeedback: {
    playBall: jest.fn(),
    playComplete: jest.fn(),
    impact: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock('@shopify/react-native-skia', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Noop = () => null;
  return {
    Canvas: ({ children, style }) => React.createElement(View, { style }, children),
    Circle: Noop,
    RadialGradient: Noop,
    vec: (x, y) => ({ x, y }),
  };
});

jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));

jest.mock('@/shared/kv/mmkv', () => {
  const memory = new Map();
  return {
    mmkvStorage: {
      get: (key) => (memory.has(key) ? memory.get(key) : null),
      set: (key, value) => {
        memory.set(key, value);
      },
    },
  };
});

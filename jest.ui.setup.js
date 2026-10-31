/**
 * Shared setup for the UI test project (U1).
 *
 * `react-native-safe-area-context` ships its own mock, but as a default export:
 * without `.default` every `SafeAreaView` in the tree is `undefined` and React
 * fails with "Element type is invalid".
 */
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

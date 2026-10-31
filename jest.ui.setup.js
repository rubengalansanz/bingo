/**
 * Shared setup for the UI test project (U1).
 *
 * 1. `react-native-safe-area-context` ships its own mock, but as a default
 *    export: without `.default` every `SafeAreaView` in the tree is `undefined`
 *    and React fails with "Element type is invalid".
 * 2. `@expo/vector-icons` loads its font at mount time through the asset
 *    registry, which does not exist under Jest ("Module 1 is missing from the
 *    asset registry"). Tab tests are about routing, not glyphs, so the icon
 *    becomes a Text with the icon name.
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

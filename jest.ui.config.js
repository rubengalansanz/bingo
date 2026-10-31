/**
 * UI/component test project (plan §8.1, Phase 2 U1).
 *
 * Deliberately a second, independent config:
 *  - `jest.config.js` keeps running only `src/core/**` with ts-jest, plain Node
 *    and the 100 % coverage gate. Nothing here can lower that gate.
 *  - This one runs React Native components with `jest-expo` (RNTL) and no
 *    coverage gate: component tests are about behavior, not line coverage.
 *
 * `@/` aliases come from the jest-expo preset, mirroring tsconfig `paths`.
 *
 * @type {import('jest').Config}
 */
module.exports = {
  preset: 'jest-expo',
  // Reanimated 4 runs its worklets through native code that does not exist in
  // Jest. Its own resolver swaps those modules for the web implementations, so
  // the ball renders (as plain views) and the animation is verified by the
  // policy tests in `src/core/feedback` instead of by frames.
  resolver: 'react-native-reanimated/jest/resolver',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  // The domain suite belongs to jest.config.js; running it twice would hide it.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/src/core/'],
  setupFilesAfterEnv: ['<rootDir>/jest.ui.setup.js'],
  clearMocks: true,
  // jest-expo renders the whole router tree through a mocked native layer; on a
  // loaded machine the first suite can pass 5 s even though every assertion is
  // correct. Component tests are about behaviour, so the budget is generous and
  // no assertion is relaxed.
  testTimeout: 20000,
};

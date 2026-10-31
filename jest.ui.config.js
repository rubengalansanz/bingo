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
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  // The domain suite belongs to jest.config.js; running it twice would hide it.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/src/core/'],
  setupFilesAfterEnv: ['<rootDir>/jest.ui.setup.js'],
  clearMocks: true,
};

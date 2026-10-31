/**
 * Jest runs the domain layer only (src/core/**): no React, no React Native,
 * no Expo. That is what keeps the engine testable in milliseconds and is the
 * reason ts-jest (node environment) is used here instead of jest-expo.
 * UI/component tests land in a separate project once there is UI (Phase 2).
 *
 * @type {import('jest').Config}
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/core'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        // Jest needs CommonJS; the app itself is bundled by Metro.
        tsconfig: {
          // TS 6 requires an explicit rootDir for the per-file emit ts-jest does,
          // and flags moduleResolution=node as deprecated (TS 7 removes it).
          rootDir: '.',
          ignoreDeprecations: '6.0',
          module: 'commonjs',
          moduleResolution: 'node',
          target: 'es2022',
          lib: ['es2022'],
          verbatimModuleSyntax: false,
          isolatedModules: true,
          jsx: 'react-jsx',
          strict: true,
          noUncheckedIndexedAccess: true,
        },
      },
    ],
  },
  collectCoverageFrom: ['src/core/**/*.ts', '!src/core/**/__tests__/**'],
  coverageReporters: ['text', 'lcov'],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};

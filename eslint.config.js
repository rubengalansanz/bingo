const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', 'coverage/*', 'android/*', 'ios/*', '.expo/*'],
  },
  {
    files: ['**/__tests__/**/*.ts'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        jest: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
      },
    },
    rules: {
      // fast-check's namespace API (`fc.property(...)`) is the documented style;
      // the rule mistakes it for a named-export misuse.
      'import/no-named-as-default-member': 'off',
    },
  },
]);

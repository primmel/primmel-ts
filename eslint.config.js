'use strict';

const gts = require('./node_modules/gts/build/src/index.js');
const defineConfig = require('eslint/config').defineConfig;

module.exports = defineConfig([
  ...gts,
  {
    rules: {
      curly: 'error',
      quotes: 'off',
    },
  },
  {
    // Test files use node:test's it/describe/before/after which return
    // values that look like floating promises to type-aware linting.
    files: ['**/test/**/*.ts', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    ignores: [
      'build/',
      'dist/',
      'node_modules/',
      '**/node_modules/',
      '.yarn/',
      'packages/*/dist/',
    ],
  },
]);

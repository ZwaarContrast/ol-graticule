// Flat-config ESLint setup mirroring documap's conventions, stripped to the
// parts that apply to this pure-TS library monorepo (no React, no Storybook).
// The Prettier spread at the end disables any stylistic rules Prettier owns.

import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';

export default [
  // Ignore patterns — dist and config files are checked by tsc / not worth linting.
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/*.config.js',
      // Covers `vitest.config.ts` *and* `vitest.config.base.ts` at the repo root,
      // which aren't referenced by any tsconfig (so the typed parser would reject them).
      '**/*.config*.ts',
      '**/*.config.mjs',
      '**/*.mjs',
      'packages/ol-graticule-rd/src/rdnaptrans.ts', // ported third-party numeric code
      'packages/ol-graticule-rd/src/rdtrans2018Base64.ts', // generated base64 blob
      'packages/ol-graticule-marinequadratkarte/src/kriegsmarine/data.ts', // large static data table
    ],
  },

  // Base JS recommended — unused-vars, prefer-const, no-undef, etc.
  js.configs.recommended,

  // TypeScript source + test files
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        // Browser (ol is a browser library)
        window: 'readonly',
        document: 'readonly',
        HTMLElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLSpanElement: 'readonly',
        HTMLCanvasElement: 'readonly',
        Image: 'readonly',
        PointerEvent: 'readonly',
        Event: 'readonly',
        CanvasRenderingContext2D: 'readonly',
        OffscreenCanvasRenderingContext2D: 'readonly',
        WebGLRenderingContext: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        localStorage: 'readonly',
        location: 'readonly',
        navigator: 'readonly',
        performance: 'readonly',
        Response: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        Blob: 'readonly',
        FileReader: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        // Common
        console: 'readonly',
        Promise: 'readonly',
        Set: 'readonly',
        Map: 'readonly',
        WeakMap: 'readonly',
        WeakSet: 'readonly',
        Symbol: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      // Lint-level TS-rules taken straight from documap.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',

      // JS base rule is shadowed (unreliable) for TS code; prefer the TS one.
      'no-unused-vars': 'off',

      // Prettier (disable conflicting stylistic rules — must be last).
      ...prettier.rules,
    },
  },

  {
    files: ['**/*.test.ts', '**/*.spec.ts', 'scripts/**/*.ts'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        afterAll: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
      },
    },
  },
];

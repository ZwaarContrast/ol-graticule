import { defineConfig } from 'vitest/config';

export const baseConfig = defineConfig({
  test: {
    globals: true,
    passWithNoTests: true,
    include: ['src/**/*.{test,spec}.ts'],
    benchmark: {
      include: ['src/**/*.bench.ts'],
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', '**/*.d.ts', '**/*.config.*', '**/types/**'],
    },
  },
});

import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';

// Opt-in profiler runner. The base config's default testMatch (spec/test only)
// keeps `*.profile.ts` OUT of `npm run test:e2e` and CI; this config selects
// exactly those files. Run via `npm run test:profile` (sets PROFILE_BUILD=1 so
// the base webServer serves an unminified build and flamegraphs show real names).
export default defineConfig({
  ...base,
  testMatch: '**/*.profile.ts',
});

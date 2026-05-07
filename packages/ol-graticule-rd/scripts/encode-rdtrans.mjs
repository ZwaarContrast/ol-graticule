#!/usr/bin/env node
/**
 * Regenerate src/rdtrans2018Base64.ts from src/rdtrans2018.gsb.
 *
 * The NTv2 grid is inlined as base64 instead of shipped as a .gsb asset so
 * the package works with zero bundler configuration. Every major bundler
 * handles string constants in JS correctly; `new URL('./asset',
 * import.meta.url)` patterns inside a dependency, by contrast, break under
 * Vite's esbuild dep-optimizer (the URL resolves into .vite/deps/...).
 *
 * Run this whenever the .gsb source file changes. Typical usage:
 *
 *   node scripts/encode-rdtrans.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'src', 'rdtrans2018.gsb');
const out = join(here, '..', 'src', 'rdtrans2018Base64.ts');

const buf = await readFile(src);
const b64 = buf.toString('base64');

// 76-char lines keep git diffs readable and compress well under gzip.
const lines = [];
for (let i = 0; i < b64.length; i += 76) lines.push(b64.slice(i, i + 76));

const body =
  '// Auto-generated from rdtrans2018.gsb by scripts/encode-rdtrans.mjs. Do not edit.\n\n' +
  'export const RDTRANS2018_BASE64 = [\n  "' +
  lines.join('",\n  "') +
  '",\n].join(\'\');\n';

await writeFile(out, body);
console.log(`wrote ${out} (${body.length} bytes; grid is ${buf.length} bytes raw)`);

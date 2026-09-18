/**
 * The `/headless` barrels must not reach `ol`, in any package.
 *
 * `ol` names its subpaths without a file extension (`ol/Feature`), which plain
 * Node ESM cannot resolve, so a single runtime `ol` import anywhere in a
 * barrel's graph makes it bundler-only again. Vitest resolves like a bundler
 * and would import such a barrel happily, so this walks the source graph
 * instead of importing it.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGES = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../..',
);

/**
 * Every workspace package, by its published name, discovered from disk rather
 * than listed here. A hardcoded list silently fails to cover a package someone
 * adds a `headless.ts` to, which is the one moment this guard exists for.
 */
const WORKSPACE: Record<string, string> = {};
for (const entry of readdirSync(PACKAGES, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const manifest = join(PACKAGES, entry.name, 'package.json');
  if (!existsSync(manifest)) continue;
  const { name }: { name?: unknown } = JSON.parse(
    readFileSync(manifest, 'utf8'),
  );
  if (typeof name === 'string') WORKSPACE[name] = entry.name;
}

/** Packages that ship an ol-free barrel, and so must be held to one. */
const HEADLESS_BARRELS = Object.values(WORKSPACE)
  .filter((dir) => existsSync(join(PACKAGES, dir, 'src/headless.ts')))
  .sort();

/** `import`/`export ... from '<spec>'`, capturing the clause so type-only ones can be skipped. */
const FROM_RE =
  /(?:^|[\s;}])(?:import|export)\b([\s\S]*?)\bfrom\s*['"]([^'"]+)['"]/g;

/** Runtime module specifiers of `file`; type-only imports are erased and don't count. */
function runtimeSpecifiers(file: string): string[] {
  const out: string[] = [];
  for (const [, clause, spec] of readFileSync(file, 'utf8').matchAll(FROM_RE)) {
    if (/^\s*type\s/.test(clause)) continue;
    const named = clause.match(/\{([\s\S]*)\}/);
    if (named) {
      const specs = named[1].split(',').filter((s) => s.trim());
      // `import { type A, type B } from` erases entirely; a default or `*` never does.
      const bare = clause
        .slice(0, clause.indexOf('{'))
        .replace(/^\s*|,\s*$/g, '');
      if (!bare && specs.length > 0 && specs.every((s) => /^\s*type\s/.test(s)))
        continue;
    }
    out.push(spec);
  }
  return out;
}

/** Resolve a specifier to a source file, or `null` when it leaves the workspace. */
function resolveSpecifier(spec: string, fromFile: string): string | null {
  if (spec.startsWith('.')) {
    const asFile = resolve(dirname(fromFile), spec).replace(/\.js$/, '.ts');
    if (existsSync(asFile)) return asFile;
    const asIndex = join(asFile.replace(/\.ts$/, ''), 'index.ts');
    return existsSync(asIndex) ? asIndex : null;
  }
  const headless = spec.match(/^(@zwaarcontrast\/[\w-]+)\/headless$/);
  if (headless) {
    const dir = WORKSPACE[headless[1]];
    return dir ? join(PACKAGES, dir, 'src/headless.ts') : null;
  }
  const dir = WORKSPACE[spec];
  return dir ? join(PACKAGES, dir, 'src/index.ts') : null;
}

/** Every `ol` specifier reachable from `entry`, with the import chain that reaches it. */
function olImportsReachableFrom(entry: string): string[] {
  const seen = new Set<string>();
  const hits: string[] = [];
  const queue: Array<{ file: string; trail: string[] }> = [
    { file: entry, trail: [entry] },
  ];

  for (let next = queue.pop(); next !== undefined; next = queue.pop()) {
    const { file, trail } = next;
    if (seen.has(file)) continue;
    seen.add(file);

    for (const spec of runtimeSpecifiers(file)) {
      if (spec === 'ol' || spec.startsWith('ol/')) {
        const chain = [...trail, spec]
          .map((p) => p.replace(`${PACKAGES}/`, ''))
          .join('\n    -> ');
        hits.push(chain);
        continue;
      }
      const target = resolveSpecifier(spec, file);
      if (target !== null)
        queue.push({ file: target, trail: [...trail, target] });
    }
  }
  return hits;
}

describe('headless barrels', () => {
  it('discovers the workspace and the barrels in it', () => {
    // Without this, a discovery bug would empty the suite below and every
    // barrel would go unchecked while the run still came back green.
    expect(Object.keys(WORKSPACE).length).toBeGreaterThanOrEqual(8);
    expect(HEADLESS_BARRELS.length).toBeGreaterThanOrEqual(7);
  });

  for (const pkg of HEADLESS_BARRELS) {
    const entry = join(PACKAGES, pkg, 'src/headless.ts');

    it(`${pkg}/headless exists and declares a subpath export`, () => {
      expect(existsSync(entry)).toBe(true);
      const manifest: { exports?: Record<string, unknown> } = JSON.parse(
        readFileSync(join(PACKAGES, pkg, 'package.json'), 'utf8'),
      );
      expect(manifest.exports?.['./headless']).toBeDefined();
    });

    it(`${pkg}/headless reaches no runtime ol import`, () => {
      expect(olImportsReachableFrom(entry)).toEqual([]);
    });
  }

  it('detects an ol import that is reachable, not merely absent everywhere', () => {
    // Negative control: the package roots do render maps, so they must trip the walker.
    const root = join(PACKAGES, 'ol-graticule-heeresgitter/src/index.ts');
    expect(olImportsReachableFrom(root).length).toBeGreaterThan(0);
  });
});

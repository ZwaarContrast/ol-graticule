#!/usr/bin/env node
/**
 * Aggregate per-package CHANGELOG.md files into the root CHANGELOG.md.
 *
 * Changesets writes per-package CHANGELOGs (needed so npm consumers see the
 * release history inside each package), but the repo root also wants one
 * unified CHANGELOG.md for GitHub readers. This script merges them.
 *
 * Strategy: read every package's CHANGELOG, group entries by version (the top
 * `## x.y.z` heading), and emit:
 *
 *     ## 0.2.0
 *
 *     ### @zwaarcontrast/ol-graticule
 *     - … body …
 *
 *     ### @zwaarcontrast/ol-graticule-projected
 *     - … body …
 *
 * Runs as a `postversion` hook after `changeset version`. Because `fixed`
 * groups all packages in the changesets config, they always bump in lockstep,
 * so "version" here is a single number shared across the monorepo.
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PACKAGES_DIR = join(ROOT, 'packages');
const ROOT_CHANGELOG = join(ROOT, 'CHANGELOG.md');

/** Parse a package's CHANGELOG.md into `{ version: body[] }`. */
function parseChangelog(text) {
  const entries = {};
  const lines = text.split('\n');
  let currentVersion = null;
  let currentBody = [];

  for (const line of lines) {
    const m = line.match(/^##\s+(\d+\.\d+\.\d+(?:-[^\s]+)?)\s*$/);
    if (m) {
      if (currentVersion) entries[currentVersion] = currentBody.join('\n').trim();
      currentVersion = m[1];
      currentBody = [];
    } else if (currentVersion) {
      currentBody.push(line);
    }
  }
  if (currentVersion) entries[currentVersion] = currentBody.join('\n').trim();
  return entries;
}

/** Compare semver strings, newer first. */
function compareSemver(a, b) {
  const pa = a.split(/[.-]/).map((p) => (/^\d+$/.test(p) ? Number(p) : p));
  const pb = b.split(/[.-]/).map((p) => (/^\d+$/.test(p) ? Number(p) : p));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x === y) continue;
    if (typeof x === 'number' && typeof y === 'number') return y - x;
    return String(y).localeCompare(String(x));
  }
  return 0;
}

async function main() {
  const packageDirs = (await readdir(PACKAGES_DIR, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => join(PACKAGES_DIR, d.name));

  /** { version: { packageName: body } } */
  const byVersion = {};

  for (const dir of packageDirs) {
    const changelogPath = join(dir, 'CHANGELOG.md');
    const pkgJsonPath = join(dir, 'package.json');
    if (!existsSync(changelogPath) || !existsSync(pkgJsonPath)) continue;

    const pkgJson = JSON.parse(await readFile(pkgJsonPath, 'utf8'));
    const entries = parseChangelog(await readFile(changelogPath, 'utf8'));
    for (const [version, body] of Object.entries(entries)) {
      if (!body) continue;
      (byVersion[version] ??= {})[pkgJson.name] = body;
    }
  }

  const versions = Object.keys(byVersion).sort(compareSemver);
  if (versions.length === 0) return;

  const out = ['# Changelog', ''];
  for (const version of versions) {
    out.push(`## ${version}`, '');
    const pkgs = Object.keys(byVersion[version]).sort();
    for (const pkg of pkgs) {
      out.push(`### ${pkg}`, '', byVersion[version][pkg], '');
    }
  }

  await writeFile(ROOT_CHANGELOG, out.join('\n').trimEnd() + '\n');
  console.log(`Wrote ${ROOT_CHANGELOG} with ${versions.length} version(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

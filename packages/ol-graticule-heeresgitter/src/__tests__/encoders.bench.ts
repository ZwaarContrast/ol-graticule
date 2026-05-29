import { bench, describe } from 'vitest';
import { encodeHmn } from '../heeresmeldenetz/encode.js';
import { parseHmn } from '../heeresmeldenetz/decode.js';
import { encodeHmnGeo } from '../heeresmeldenetz-geographic/encode.js';
import { parseHmnGeo } from '../heeresmeldenetz-geographic/decode.js';
import { encodeDhg, encodeDhgText } from '../dhg/encode.js';
import { parseDhg } from '../dhg/decode.js';

const points: Array<[number, number]> = [];
for (let i = 0; i < 100; i++) {
  // Mid-Europe band well inside a single Großtrapez lattice cell so neither
  // the planar nor the geographic encoder ever lands on a Kleinquadrat-row
  // edge that would push past the 25-letter alphabet.
  const lat = 49.5 + (i / 100) * 7;
  const lon = 8.5 + ((i * 3) % 13);
  points.push([lat, lon]);
}

const hmnRefs = points.map((p) => encodeHmn(p, { depth: 5 }));
const hmnGeoRefs = points.map((p) => encodeHmnGeo(p, { depth: 5 }));
const dhgTexts = points.map((p) => encodeDhgText(p));

describe('Heeresgitter encoders — ×100', () => {
  bench('encodeHmn depth=5 (planar)', () => {
    for (const p of points) encodeHmn(p, { depth: 5 });
  });

  bench('encodeHmnGeo depth=5 (geographic)', () => {
    for (const p of points) encodeHmnGeo(p, { depth: 5 });
  });

  bench('encodeDhg', () => {
    for (const p of points) encodeDhg(p);
  });

  bench('encodeDhgText', () => {
    for (const p of points) encodeDhgText(p);
  });
});

describe('Heeresgitter decoders — ×100', () => {
  bench('parseHmn', () => {
    for (const r of hmnRefs) parseHmn(r.canonical, { grossquadrat: r.grossquadrat });
  });

  bench('parseHmnGeo', () => {
    for (const r of hmnGeoRefs) parseHmnGeo(r.canonical, { grosstrapez: r.grosstrapez });
  });

  bench('parseDhg', () => {
    for (const t of dhgTexts) parseDhg(t);
  });
});

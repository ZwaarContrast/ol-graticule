import { bench, describe } from 'vitest';
import { encodeGnmv, encodeJmn } from '../encode.js';
import { parseGnmvRef, parseJmnRef, parseRef } from '../decode.js';

const points: Array<[number, number]> = [];
for (let i = 0; i < 100; i++) {
  // Stay inside one Jagdtrapez (5° lat × 10° lon) deep enough that the
  // JMN Mitteltrapez 20 × 20 letter pair grid is always populated.
  const lat = 51 + (i / 100) * 4;
  const lon = 3 + ((i * 3) % 7);
  points.push([lat, lon]);
}

const gnmvRefs = points
  .map((p) => encodeGnmv(p, 'post-1943', 5))
  .filter((r): r is string => r !== undefined);
const jmnRefs = points
  .map((p) => encodeJmn(p, 5))
  .filter((r): r is string => r !== undefined);
if (jmnRefs.length === 0) throw new Error('bench: JMN sample produced no refs');

describe('Luftwaffe encoders — ×100', () => {
  bench('encodeGnmv depth=5 post-1943', () => {
    for (const p of points) encodeGnmv(p, 'post-1943', 5);
  });

  bench('encodeGnmv depth=5 pre-1943', () => {
    for (const p of points) encodeGnmv(p, 'pre-1943', 5);
  });

  bench('encodeJmn depth=5', () => {
    for (const p of points) encodeJmn(p, 5);
  });

  bench('encodeGnmv depth=2 (Mitteltrapez)', () => {
    for (const p of points) encodeGnmv(p, 'post-1943', 2);
  });
});

describe('Luftwaffe decoders — ×100', () => {
  bench('parseGnmvRef', () => {
    for (const r of gnmvRefs) parseGnmvRef(r);
  });

  bench('parseJmnRef', () => {
    for (const r of jmnRefs) parseJmnRef(r);
  });

  bench('parseRef (auto-detect GNMV vs JMN)', () => {
    for (const r of gnmvRefs) parseRef(r);
  });
});

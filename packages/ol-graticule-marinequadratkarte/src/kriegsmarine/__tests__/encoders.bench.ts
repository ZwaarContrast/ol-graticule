import { bench, describe } from 'vitest';
import { coordinateToGridRef, gridRefToCoordinate, formatGridRef, parseGridRef } from '../format.js';

const points: Array<[number, number]> = [];
for (let i = 0; i < 100; i++) {
  // North Atlantic / Mediterranean / European waters.
  const lat = -20 + (i / 100) * 60;
  const lon = -45 + ((i * 11) % 50);
  points.push([lat, lon]);
}

const refsD1 = points.map((p) => coordinateToGridRef(p, 1)).filter((r): r is string => !!r);
const refsD4 = points.map((p) => coordinateToGridRef(p, 4)).filter((r): r is string => !!r);

describe('Marinequadratkarte encoders — ×100', () => {
  bench('coordinateToGridRef depth=1', () => {
    for (const p of points) coordinateToGridRef(p, 1);
  });

  bench('coordinateToGridRef depth=4', () => {
    for (const p of points) coordinateToGridRef(p, 4);
  });

  bench('formatGridRef', () => {
    for (const r of refsD4) formatGridRef(r);
  });
});

describe('Marinequadratkarte decoders — ×100', () => {
  bench('parseGridRef', () => {
    for (const r of refsD4) parseGridRef(r);
  });

  bench('gridRefToCoordinate depth=1', () => {
    for (const r of refsD1) gridRefToCoordinate(r);
  });

  bench('gridRefToCoordinate depth=4', () => {
    for (const r of refsD4) gridRefToCoordinate(r);
  });
});

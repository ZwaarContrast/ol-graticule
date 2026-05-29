import { bench, describe } from 'vitest';
import proj4 from 'proj4';
import { registerRDNAPTRANS2018, RD_NEW_PROJ4 } from '../index.js';

registerRDNAPTRANS2018();

const points: Array<[number, number]> = [];
for (let i = 0; i < 100; i++) {
  const lat = 52.0 + (i / 100) * 1.0;
  const lon = 5.0 + ((i * 3) % 10) / 10;
  points.push([lat, lon]);
}

const rdCoords = points.map((p) => proj4('EPSG:4326', RD_NEW_PROJ4, [p[1], p[0]]));

describe('RD transformations (RDNAPTRANS with GSB) — ×100', () => {
  bench('forward', () => {
    for (const p of points) proj4('EPSG:4326', RD_NEW_PROJ4, [p[1], p[0]]);
  });

  bench('inverse', () => {
    for (const c of rdCoords) proj4(RD_NEW_PROJ4, 'EPSG:4326', c);
  });
});

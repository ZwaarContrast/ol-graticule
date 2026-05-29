import { bench, describe } from 'vitest';
import { lonLatToMgrs, lonLatToMgrsParts } from '../conversion.js';
import { zoneNumberFromLonLat } from '../zones.js';

const samples: Array<[number, number]> = [];
for (let i = 0; i < 100; i++) {
  const lat = -60 + (i / 100) * 130; // -60..70°N
  const lon = -180 + ((i * 17) % 360); // walk
  samples.push([lon, lat]);
}

describe('MGRS conversion — hot path', () => {
  bench('zoneNumberFromLonLat ×100', () => {
    for (const [lon, lat] of samples) zoneNumberFromLonLat(lon, lat);
  });

  bench('lonLatToMgrsParts ×100', () => {
    for (const [lon, lat] of samples) lonLatToMgrsParts(lon, lat);
  });

  bench('lonLatToMgrs precision=5 ×100', () => {
    for (const [lon, lat] of samples) lonLatToMgrs(lon, lat, 5);
  });
});

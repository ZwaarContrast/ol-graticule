import { bench, describe } from 'vitest';
import proj4 from 'proj4';
import { register } from 'ol/proj/proj4';
import { getTransform } from 'ol/proj';
import {
  TransformCache,
  transformBatchCached,
} from '@zwaarcontrast/ol-graticule';
import { registerRDNAPTRANS2018, RD_NEW_PROJ4, RD_NEW_CRS } from '../index.js';

// TransformCache exists to skip *expensive* proj4 datum-shift math, not the
// built-in spherical-mercator transform the earlier core bench used. RD New
// goes through the RDNAPTRANS2018 NTv2 grid (Bessel→ETRS89), the heaviest
// transform this library ships. This bench measures the cache's real payoff:
// warm (grid-line vertices recur at fixed RD metres → hits skip proj4) vs cold
// (fresh coords → full proj4) vs no cache (proj4 every frame).

registerRDNAPTRANS2018();
proj4.defs(RD_NEW_CRS, RD_NEW_PROJ4);
register(proj4);
const toView = getTransform(RD_NEW_CRS, 'EPSG:3857');

// Guard against silently benching an identity transform (unregistered CRS).
const probe = toView([155000, 463000], [0, 0], 2);
if (Math.abs(probe[0]! - 155000) < 1 && Math.abs(probe[1]! - 463000) < 1) {
  throw new Error('RD→3857 transform looks like identity; CRS not registered');
}

const PTS = 200;
const FRAMES = 100;

// A frame of RD-metre grid-line vertices across the NL extent.
const warmFrame: number[] = [];
for (let i = 0; i < PTS; i++) {
  warmFrame.push(10_000 + (i % 20) * 13_000, 305_000 + (i % 10) * 30_000);
}

describe('TransformCache — real proj4 RD/RDNAPTRANS (28992→3857)', () => {
  bench('warm (same points every frame, cache hits)', () => {
    const cache = new TransformCache();
    for (let f = 0; f < FRAMES; f++) {
      transformBatchCached(warmFrame, warmFrame.slice(), 2, toView, cache);
    }
  });
  bench('cold (fresh points every frame, cache misses)', () => {
    const cache = new TransformCache();
    for (let f = 0; f < FRAMES; f++) {
      const frame: number[] = [];
      for (let i = 0; i < PTS; i++) {
        frame.push(10_000 + f * 7 + i * 1_300, 305_000 + i * 1_500);
      }
      transformBatchCached(frame, frame.slice(), 2, toView, cache);
    }
  });
  bench('no cache (proj4 every frame)', () => {
    for (let f = 0; f < FRAMES; f++) {
      toView(warmFrame.slice(), warmFrame.slice(), 2);
    }
  });
});

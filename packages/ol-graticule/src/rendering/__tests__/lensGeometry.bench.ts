import { bench, describe } from 'vitest';
import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import { create as createTransform } from 'ol/transform';
import { collectLensHoles } from '../lensGeometry.js';

// The per-frame hover-lens geometry pass: for each grid line near the cursor,
// find its nearest segment + crossing, then intersect vertical×horizontal lines
// into carve holes. Runs every frame while the lens is active.

const features: Feature[] = [];
for (let i = 0; i < 40; i++) {
  features.push(new Feature({ geometry: new LineString([[i * 25, 0], [i * 25, 1000]]), gridAxis: 'x' }));
  features.push(new Feature({ geometry: new LineString([[0, i * 25], [1000, i * 25]]), gridAxis: 'y' }));
}
const toPixel = createTransform();
const CX = 500;
const CY = 500;
const RADIUS = 200;
const PR = 2;

describe(`hover lens — collectLensHoles (${features.length} lines)`, () => {
  bench('collect holes near cursor', () => {
    collectLensHoles(features, toPixel, PR, 0, CX, CY, RADIUS, 0.6, 56, 64);
  });
});

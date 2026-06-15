import { bench, describe } from 'vitest';
import proj4 from 'proj4';
import { register } from 'ol/proj/proj4';
import { ProjectedGridSystem } from '../ProjectedGridSystem.js';
import type { Extent } from 'ol/extent';

proj4.defs('EPSG:32633', '+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs +type=crs');
register(proj4);

// Straight in Web Mercator: a lat/lon graticule is axis-aligned, so adaptive
// densification collapses every line to 2 points.
const straight = new ProjectedGridSystem({ crs: 'EPSG:4326' });
const straightExtent: Extent = [0, 5621521, 1113195, 7361866];

// Curved in Web Mercator: UTM 33N far from its 15°E central meridian over a
// wide span, where lines genuinely bend and densification climbs to the cap.
const curved = new ProjectedGridSystem({ crs: 'EPSG:32633' });
const curvedExtent: Extent = [-2_000_000, 4_000_000, 4_000_000, 9_000_000];

describe('ProjectedGridSystem.getFeatures — adaptive densification', () => {
  bench('straight lines (2 points each)', () => {
    straight.getFeatures(straightExtent, 1000, 'EPSG:3857');
  });
  bench('curved lines (densified to cap)', () => {
    curved.getFeatures(curvedExtent, 1000, 'EPSG:3857');
  });
});

/** OpenLayers grid-system factory for WarOfficeCassini; the theatre data itself is ol-free in `WarOfficeCassini.ts`. */

import type { PolygonClippedGridSystem } from '@zwaarcontrast/ol-graticule';
import { WAR_OFFICE_CASSINI_SCHEME } from '../formatters/schemes.js';
import { createMBSGridSystem, type MBSGridSystemOptions } from './shared.js';
import {
  WAR_OFFICE_CASSINI_CLIP_POLYGON,
  WAR_OFFICE_CASSINI_CRS,
  WAR_OFFICE_CASSINI_PROJ4,
} from './WarOfficeCassini.js';

export type WarOfficeCassiniGridSystemOptions = MBSGridSystemOptions;

export function createWarOfficeCassiniGridSystem(
  options?: WarOfficeCassiniGridSystemOptions,
): PolygonClippedGridSystem {
  return createMBSGridSystem(
    WAR_OFFICE_CASSINI_CRS,
    WAR_OFFICE_CASSINI_PROJ4,
    WAR_OFFICE_CASSINI_SCHEME,
    WAR_OFFICE_CASSINI_CLIP_POLYGON,
    options,
  );
}

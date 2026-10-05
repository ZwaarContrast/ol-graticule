/** OpenLayers grid-system factory for ItalianNorthern; the theatre data itself is ol-free in `ItalianNorthern.ts`. */

import type { PolygonClippedGridSystem } from '@zwaarcontrast/ol-graticule';
import { ITALIAN_NORTHERN_SCHEME } from '../formatters/schemes.js';
import { createMBSGridSystem, type MBSGridSystemOptions } from './shared.js';
import {
  ITALIAN_NORTHERN_CLIP_POLYGON,
  ITALIAN_NORTHERN_CRS,
  ITALIAN_NORTHERN_PROJ4,
} from './ItalianNorthern.js';

export type ItalianNorthernGridSystemOptions = MBSGridSystemOptions;

export function createItalianNorthernGridSystem(
  options?: ItalianNorthernGridSystemOptions,
): PolygonClippedGridSystem {
  return createMBSGridSystem(
    ITALIAN_NORTHERN_CRS,
    ITALIAN_NORTHERN_PROJ4,
    ITALIAN_NORTHERN_SCHEME,
    ITALIAN_NORTHERN_CLIP_POLYGON,
    options,
  );
}

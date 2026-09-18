/** OpenLayers grid-system factory for NordDeGuerre; the theatre data itself is ol-free in `NordDeGuerre.ts`. */

import type { PolygonClippedGridSystem } from '@zwaarcontrast/ol-graticule';
import { registerCRS } from '@zwaarcontrast/ol-graticule-projected';
import { NORD_DE_GUERRE_SCHEME } from '../formatters/schemes.js';
import { assembleMBSGridSystem, type MBSGridSystemOptions } from './shared.js';
import {
  NORD_DE_GUERRE_CLIP_POLYGON,
  NORD_DE_GUERRE_CRS,
  NORD_DE_GUERRE_DEFAULT_TOWGS84,
  NORD_DE_GUERRE_EXTENT,
  buildNordDeGuerreProj4,
} from './NordDeGuerre.js';

export type NordDeGuerreGridSystemOptions = MBSGridSystemOptions & {
  /**
   * Override the Helmert shift baked into the registered proj4 string
   * for datum transformation between EPSG:27500 and WGS84.
   *
   * - `undefined` (default): use {@link NORD_DE_GUERRE_DEFAULT_TOWGS84}.
   * - `null`: register the canonical EPSG:27500 with no `+towgs84`.
   *   proj4 falls back to a ballpark transformation (~100 m off across
   *   the Western Front).
   * - 3- or 7-element array (`[Tx, Ty, Tz]` or
   *   `[Tx, Ty, Tz, Rx, Ry, Rz, Ds]`): use this Helmert.
   *
   * Calling the factory with a different `towgs84` re-registers
   * `EPSG:27500` against the new string; last call wins.
   */
  towgs84?: readonly number[] | null | undefined;
};

/** Build a Nord de Guerre grid with the MBS letter-cell formatter and standard coverage polygon. */
export function createNordDeGuerreGridSystem(
  options?: NordDeGuerreGridSystemOptions,
): PolygonClippedGridSystem {
  const { clipPolygon: clipOverride, towgs84, ...projOptions } = options ?? {};
  const towgs84Effective =
    towgs84 === undefined ? NORD_DE_GUERRE_DEFAULT_TOWGS84 : towgs84;
  if (
    towgs84Effective !== null &&
    towgs84Effective.length !== 3 &&
    towgs84Effective.length !== 7
  ) {
    throw new Error(
      `towgs84 must have 3 or 7 elements, got ${towgs84Effective.length}`,
    );
  }
  registerCRS(NORD_DE_GUERRE_CRS, buildNordDeGuerreProj4(towgs84Effective));
  return assembleMBSGridSystem(
    NORD_DE_GUERRE_CRS,
    NORD_DE_GUERRE_SCHEME,
    clipOverride ?? NORD_DE_GUERRE_CLIP_POLYGON,
    projOptions,
    NORD_DE_GUERRE_EXTENT,
  );
}

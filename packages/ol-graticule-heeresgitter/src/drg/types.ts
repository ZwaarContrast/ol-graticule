import type { DatumShift, LatLon } from '../dhg/types.js';

export type { DatumShift, LatLon };

/** One Gauß-Krüger 3° meridian strip of the German Reich survey. */
export interface DrgZone {
  /** Kennziffer (0..59): the central meridian divided by 3°. */
  kennziffer: number;
  /** Central meridian, degrees east of Greenwich. */
  cm: number;
  /** Rechtswert of the central meridian: `kennziffer × 1 000 000 + 500 000`. */
  falseEasting: number;
  /** Western edge of the nominal 3° strip (CM − 1°30'). */
  westLon: number;
  /** Eastern edge of the nominal 3° strip (CM + 1°30'). */
  eastLon: number;
}

/** Planar coordinate on the Gauß-Krüger 3° grid. */
export interface DrgCoord {
  /** Zone Kennziffer (0..59). */
  kennziffer: number;
  /** Rechtswert in metres, Kennziffer prefix and 500 000 m false easting included. */
  easting: number;
  /** Hochwert in metres from the equator (no false northing). */
  northing: number;
}

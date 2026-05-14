import type { LatLon } from '@zwaarcontrast/ol-graticule';

export type { LatLon };

/**
 * 7-parameter Helmert datum-shift used when transforming between WGS 84 and
 * Bessel 1841 / Potsdam. Values are in metres, arc-seconds, ppm. Default is
 * the classic `towgs84=598.1,73.7,418.2,0.202,0.045,-2.455,6.7` quoted by
 * BKG for the Rauenberg-Potsdam datum.
 */
export interface DatumShift {
  /** Translation in metres: [dx, dy, dz]. */
  translation: [number, number, number];
  /** Rotation in arc-seconds: [rx, ry, rz]. */
  rotation: [number, number, number];
  /** Scale factor in ppm. */
  scale: number;
}

/** One of the 60 Deutsches Heeresgitter 6° meridian strips. */
export interface DhgZone {
  /** Kennziffer (1..60). */
  kennziffer: number;
  /** Central meridian, signed degrees east of Greenwich, in [-177, 180]. */
  cm: number;
  /** Western edge of the nominal 6° strip (CM − 3°). */
  westLon: number;
  /** Eastern edge of the nominal 6° strip (CM + 3°). */
  eastLon: number;
}

/** Planar coordinate on the Deutsches Heeresgitter. */
export interface DhgCoord {
  /** Zone Kennziffer (1..60). */
  kennziffer: number;
  /** Rechtswert in metres, with the 500 000 m false easting applied. */
  easting: number;
  /** Hochwert in metres from the equator (no false northing). */
  northing: number;
}

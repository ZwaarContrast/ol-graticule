/**
 * Geometry of the geographic Heeresmeldenetz (geographisch) hierarchy.
 *
 * Per Buchroithner & Pfahlbusch (2015), citing
 * RdLuObdL ChAusbW VorschLmAbtRLM/LIn12 76/40:
 *
 *   Großtrapez:    2°30' lon × 1°40' lat, anchored at 0°40'N, 0°E, stepping
 *                  both directions. (The Buchroithner paper prints "1°N (!)"
 *                  for the anchor, but every observed geographic-HMN sheet
 *                  (Bildplankarte E27O Romfo, an Atlantikwall sector overprint
 *                  of the Dutch coast) only fits the 0°40'N anchor.
 *                  Treated as a transcription error in the source.)
 *   Kleintrapez:   6' lon × 4' lat, 25 × 25 per Großtrapez, NW→SE
 *                  letter-pair labelling A..Z (no I).
 *   Meldetrapez:   2' lon × 1'20" lat, 3 × 3 per Kleintrapez, 1..9 NW→SE.
 *   Arbeitstrapez: 1' lon × 40" lat, 2 × 2 per Meldetrapez, a/b/c/d NW→SE.
 *   Tenths:        6" lon × 4" lat, from SW corner of the Arbeitstrapez.
 *
 * All sizes stored in arcseconds so the arithmetic stays integer.
 */

/** One arcsecond = 1/3600 degree. */
export const ARCSEC_PER_DEG = 3600;

/** Großtrapez size in arcseconds: longitude × latitude. */
export const GROSSTRAPEZ_LON_SEC = 2 * 3600 + 30 * 60; // 2°30' = 9000"
export const GROSSTRAPEZ_LAT_SEC = 1 * 3600 + 40 * 60; // 1°40' = 6000"

/** Kleintrapez (one cell) size in arcseconds. */
export const KLEINTRAPEZ_LON_SEC = 6 * 60; // 6' = 360"
export const KLEINTRAPEZ_LAT_SEC = 4 * 60; // 4' = 240"

/** Meldetrapez size in arcseconds. */
export const MELDETRAPEZ_LON_SEC = 2 * 60; // 2' = 120"
export const MELDETRAPEZ_LAT_SEC = 1 * 60 + 20; // 1'20" = 80"

/** Arbeitstrapez size in arcseconds. */
export const ARBEITSTRAPEZ_LON_SEC = 1 * 60; // 1' = 60"
export const ARBEITSTRAPEZ_LAT_SEC = 40; // 40"

/** Tenth-of-Arbeitstrapez sizes in arcseconds. */
export const TENTH_LON_SEC = 6; // 6"
export const TENTH_LAT_SEC = 4; // 4"

/** Empirical anchor: 0°40'N. Source paper prints "1°N (!)"; see preamble. */
export const ANCHOR_LAT_SEC = 40 * 60; // 0°40' = 2400"
/** Anchor longitude: Greenwich. */
export const ANCHOR_LON_SEC = 0;

/** Kleintrapeze per Großtrapez side (25, both axes). */
export const KLEIN_PER_GROSS = 25;
/** Meldetrapeze per Kleintrapez side (3, both axes). */
export const MELDE_PER_KLEIN = 3;
/** Arbeitstrapeze per Meldetrapez side (2, both axes). */
export const ARBEIT_PER_MELDE = 2;

const _checks = [
  GROSSTRAPEZ_LON_SEC / KLEINTRAPEZ_LON_SEC === KLEIN_PER_GROSS,
  GROSSTRAPEZ_LAT_SEC / KLEINTRAPEZ_LAT_SEC === KLEIN_PER_GROSS,
  KLEINTRAPEZ_LON_SEC / MELDETRAPEZ_LON_SEC === MELDE_PER_KLEIN,
  KLEINTRAPEZ_LAT_SEC / MELDETRAPEZ_LAT_SEC === MELDE_PER_KLEIN,
  MELDETRAPEZ_LON_SEC / ARBEITSTRAPEZ_LON_SEC === ARBEIT_PER_MELDE,
  MELDETRAPEZ_LAT_SEC / ARBEITSTRAPEZ_LAT_SEC === ARBEIT_PER_MELDE,
  ARBEITSTRAPEZ_LON_SEC / TENTH_LON_SEC === 10,
  ARBEITSTRAPEZ_LAT_SEC / TENTH_LAT_SEC === 10,
];
if (!_checks.every(Boolean)) {
  throw new Error('Geographic HMN level constants are inconsistent.');
}

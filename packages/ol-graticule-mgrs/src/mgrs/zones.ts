/** UTM grid zone designators (GZD) for MGRS. */

/** Latitude band letters from south to north. `I` and `O` are skipped. */
export const BAND_LETTERS = 'CDEFGHJKLMNPQRSTUVWX';

const BAND_SOUTH_LATS = [
  -80, -72, -64, -56, -48, -40, -32, -24, -16, -8,
  0, 8, 16, 24, 32, 40, 48, 56, 64, 72,
];

/** Latitude band letter for `lat` (degrees), or `undefined` outside UTM range. */
export function bandLetterFromLatitude(lat: number): string | undefined {
  if (!Number.isFinite(lat)) return undefined;
  if (lat < -80 || lat >= 84) return undefined;
  const idx = lat >= 72 ? 19 : Math.floor((lat + 80) / 8);
  return BAND_LETTERS[idx];
}

/**
 * UTM zone number (1-60) for `lon` (degrees), with Norway and Svalbard
 * exceptions applied when `lat` is supplied.
 */
export function zoneNumberFromLonLat(lon: number, lat?: number): number {
  let wrappedLon = ((lon + 180) % 360 + 360) % 360 - 180;
  if (wrappedLon === 180) wrappedLon = -180;

  let zone = Math.floor((wrappedLon + 180) / 6) + 1;
  if (zone < 1) zone = 1;
  if (zone > 60) zone = 60;

  if (lat === undefined) return zone;

  if (lat >= 56 && lat < 64 && wrappedLon >= 3 && wrappedLon < 12) {
    return 32;
  }

  if (lat >= 72 && lat < 84) {
    if (wrappedLon >= 0 && wrappedLon < 9) return 31;
    if (wrappedLon >= 9 && wrappedLon < 21) return 33;
    if (wrappedLon >= 21 && wrappedLon < 33) return 35;
    if (wrappedLon >= 33 && wrappedLon < 42) return 37;
  }

  return zone;
}

/** Geographic [west, east] longitude bounds of a (zone, band) pair. */
export function zoneBandLonBounds(
  zone: number,
  band: string,
): readonly [number, number] | undefined {
  if (band === 'V') {
    if (zone === 31) return [0, 3];
    if (zone === 32) return [3, 12];
  }
  if (band === 'X') {
    if (zone === 31) return [0, 9];
    if (zone === 32 || zone === 34 || zone === 36) return undefined;
    if (zone === 33) return [9, 21];
    if (zone === 35) return [21, 33];
    if (zone === 37) return [33, 42];
  }
  if (zone < 1 || zone > 60) return undefined;
  const west = -180 + (zone - 1) * 6;
  return [west, west + 6];
}

/** [southLat, northLat] of a band letter; `undefined` for unknown letters. */
export function bandLatBounds(band: string): readonly [number, number] | undefined {
  const idx = BAND_LETTERS.indexOf(band);
  if (idx < 0) return undefined;
  const south = BAND_SOUTH_LATS[idx]!;
  const north = idx === 19 ? 84 : south + 8;
  return [south, north];
}

/** proj4 definition for a UTM zone using WGS84. */
export function utmProj4(zone: number): string {
  return `+proj=utm +zone=${zone} +datum=WGS84 +units=m +no_defs +type=crs`;
}

/** EPSG-ish CRS code for a UTM zone (32601-32660 north, 32701-32760 south). */
export function utmCrsCode(zone: number, southHemisphere: boolean): string {
  const epsg = southHemisphere ? 32700 + zone : 32600 + zone;
  return `EPSG:${epsg}`;
}

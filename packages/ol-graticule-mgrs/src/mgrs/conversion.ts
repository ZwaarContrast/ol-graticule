/** Lat/lon to MGRS conversion. */

import proj4 from 'proj4';
import {
  bandLetterFromLatitude,
  utmCrsCode,
  utmProj4,
  zoneNumberFromLonLat,
} from './zones.js';
import { rowLetter, columnLetter } from './squares.js';
import {
  upsColumnLetter,
  upsCrsCode,
  upsIsNorth,
  upsProj4,
  upsRowLetter,
  upsZoneLetter,
} from './ups.js';

/** Number of digits per axis in an MGRS string. 5 = 1 m, 4 = 10 m, ... 0 = GZD only. */
export type MgrsPrecision = 0 | 1 | 2 | 3 | 4 | 5;

export interface MgrsParts {
  /** UTM zone number 1-60, or `0` for UPS (polar) coordinates. */
  zone: number;
  /** Latitude band letter (C-X for UTM, omitting I/O; A/B/Y/Z for UPS). */
  band: string;
  /** Two-letter 100 km square id. */
  square: string;
  /** Easting offset within the 100 km square, integer metres in [0, 99 999]. */
  easting: number;
  /** Northing offset within the 100 km square, integer metres in [0, 99 999]. */
  northing: number;
}

const utmRegistered = new Set<number>();
const upsRegistered = new Set<boolean>();

function ensureUtmRegistered(zone: number, southHemisphere: boolean): string {
  const code = utmCrsCode(zone, southHemisphere);
  if (utmRegistered.has(zone)) return code;
  proj4.defs(utmCrsCode(zone, false), utmProj4(zone));
  proj4.defs(utmCrsCode(zone, true), utmProj4(zone));
  utmRegistered.add(zone);
  return code;
}

function ensureUpsRegistered(north: boolean): string {
  const code = upsCrsCode(north);
  if (upsRegistered.has(north)) return code;
  proj4.defs(code, upsProj4(north));
  upsRegistered.add(north);
  return code;
}

/** Project `[lon, lat]` (WGS84 degrees) into UPS metres. */
export function lonLatToUps(
  lon: number,
  lat: number,
  north: boolean,
): { easting: number; northing: number } {
  const code = ensureUpsRegistered(north);
  const out = proj4('EPSG:4326', code, [lon, lat]);
  return { easting: out[0]!, northing: out[1]! };
}

/** Inverse of {@link lonLatToUps}. */
export function upsToLonLat(
  easting: number,
  northing: number,
  north: boolean,
): [number, number] {
  const code = ensureUpsRegistered(north);
  const out = proj4(code, 'EPSG:4326', [easting, northing]);
  return [out[0]!, out[1]!];
}

/** Project `[lon, lat]` (WGS84 degrees) into UTM `zone` metres. */
export function lonLatToUtm(
  lon: number,
  lat: number,
  zone: number,
): { easting: number; northing: number } {
  const code = ensureUtmRegistered(zone, lat < 0);
  const out = proj4('EPSG:4326', code, [lon, lat]);
  const northing = lat < 0 ? out[1]! + 10_000_000 : out[1]!;
  return { easting: out[0]!, northing };
}

/** Inverse of {@link lonLatToUtm}: UTM `(zone, easting, northing)` to `[lon, lat]`. */
export function utmToLonLat(
  zone: number,
  easting: number,
  northing: number,
  southHemisphere: boolean,
): [number, number] {
  ensureUtmRegistered(zone, southHemisphere);
  const code = utmCrsCode(zone, false);
  const adjustedNorthing = southHemisphere ? northing - 10_000_000 : northing;
  const out = proj4(code, 'EPSG:4326', [easting, adjustedNorthing]);
  return [out[0]!, out[1]!];
}

/** Decompose `[lon, lat]` into MGRS parts. */
export function lonLatToMgrsParts(
  lon: number,
  lat: number,
): MgrsParts | undefined {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return undefined;
  lon = ((lon + 180) % 360 + 360) % 360 - 180;

  const north = upsIsNorth(lat);
  if (north !== undefined) {
    const upsZone = upsZoneLetter(lon, lat);
    if (upsZone === undefined) return undefined;
    const { easting, northing } = lonLatToUps(lon, lat, north);
    const col = upsColumnLetter(upsZone, easting);
    if (col === undefined) return undefined;
    const row = upsRowLetter(upsZone, northing);
    if (row === undefined) return undefined;
    const eOffset = Math.floor(easting) % 100_000;
    const nOffset = Math.floor(northing) % 100_000;
    return {
      zone: 0,
      band: upsZone,
      square: col + row,
      easting: eOffset < 0 ? eOffset + 100_000 : eOffset,
      northing: nOffset < 0 ? nOffset + 100_000 : nOffset,
    };
  }

  const band = bandLetterFromLatitude(lat);
  if (band === undefined) return undefined;

  const zone = zoneNumberFromLonLat(lon, lat);
  const { easting, northing } = lonLatToUtm(lon, lat, zone);

  const col = columnLetter(zone, easting);
  if (col === undefined) return undefined;
  const row = rowLetter(zone, northing);
  const eOffset = Math.floor(easting) % 100_000;
  const nOffset = Math.floor(northing) % 100_000;

  return {
    zone,
    band,
    square: col + row,
    easting: eOffset < 0 ? eOffset + 100_000 : eOffset,
    northing: nOffset < 0 ? nOffset + 100_000 : nOffset,
  };
}

/** Format MGRS parts as a string at the requested precision. */
export function formatMgrs(parts: MgrsParts, precision: MgrsPrecision = 5): string {
  const gzd = parts.zone === 0 ? parts.band : `${parts.zone}${parts.band}`;
  if (precision === 0) return gzd;
  const factor = 10 ** (5 - precision);
  const e = Math.floor(parts.easting / factor)
    .toString()
    .padStart(precision, '0');
  const n = Math.floor(parts.northing / factor)
    .toString()
    .padStart(precision, '0');
  return `${gzd} ${parts.square} ${e} ${n}`;
}

/** Lat/lon to formatted MGRS string. */
export function lonLatToMgrs(
  lon: number,
  lat: number,
  precision: MgrsPrecision = 5,
): string | undefined {
  const parts = lonLatToMgrsParts(lon, lat);
  return parts ? formatMgrs(parts, precision) : undefined;
}

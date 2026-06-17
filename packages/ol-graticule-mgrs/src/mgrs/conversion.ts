/** Lat/lon to MGRS conversion. */

import proj4 from 'proj4';
import { ParseError } from '@zwaarcontrast/ol-graticule';
import {
  bandLatBounds,
  bandLetterFromLatitude,
  utmCrsCode,
  utmProj4,
  zoneNumberFromLonLat,
} from './zones.js';
import {
  columnLetter,
  columnLetterToEasting,
  rowLetter,
  rowLetterToCycleIndex,
} from './squares.js';
import {
  upsColumnLetter,
  upsColumnLetterToEasting,
  upsCrsCode,
  upsIsNorth,
  upsProj4,
  upsRowLetter,
  upsRowLetterToNorthing,
  upsZoneLetter,
  upsZoneLonLatBounds,
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

export interface ParsedMgrs {
  parts: MgrsParts;
  precision: MgrsPrecision;
}

const MGRS_RE = /^(?:(\d{1,2})([C-HJ-NP-X])|([ABYZ]))(?:([A-HJ-NP-Z])([A-HJ-NP-V])(\d*))?$/;

/** Parse an MGRS reference into its component parts and the implied precision. */
export function parseMgrsRef(text: string): ParsedMgrs {
  if (typeof text !== 'string') throw new ParseError(String(text), 'expected string input');
  const normalised = text.replace(/[\s/,;\-_]+/g, '').toUpperCase();
  if (normalised.length === 0) throw new ParseError(text, 'empty input');
  const m = MGRS_RE.exec(normalised);
  if (!m) throw new ParseError(text, 'unrecognised MGRS shape');
  const [, utmZone, utmBand, upsBand, col, row, digits = ''] = m;

  let zone: number;
  let band: string;
  if (utmZone !== undefined && utmBand !== undefined) {
    zone = Number(utmZone);
    if (zone < 1 || zone > 60) throw new ParseError(text, `UTM zone out of range: ${zone}`);
    band = utmBand;
  } else if (upsBand !== undefined) {
    zone = 0;
    band = upsBand;
  } else {
    throw new ParseError(text, 'missing GZD');
  }

  if (col === undefined || row === undefined) {
    return { parts: { zone, band, square: '', easting: 0, northing: 0 }, precision: 0 };
  }

  if (digits.length % 2 !== 0 || digits.length > 10) {
    throw new ParseError(text, `expected even number of digits (0–10), got ${digits.length}`);
  }
  const precision = (digits.length / 2) as MgrsPrecision;
  const square = col + row;
  if (precision === 0) {
    return { parts: { zone, band, square, easting: 0, northing: 0 }, precision: 0 };
  }
  const factor = 10 ** (5 - precision);
  const easting = Number(digits.slice(0, precision)) * factor;
  const northing = Number(digits.slice(precision)) * factor;
  return { parts: { zone, band, square, easting, northing }, precision };
}

const ROW_CYCLE_M = 2_000_000;

function isUpsBand(band: string): band is 'Y' | 'Z' | 'A' | 'B' {
  return band === 'Y' || band === 'Z' || band === 'A' || band === 'B';
}

/**
 * Inverse of {@link lonLatToMgrsParts} + {@link formatMgrs}: returns the
 * `[lon, lat]` cell centre at the given precision. Bare GZD (no square) →
 * GZD centre; GZD + square (precision 0) → 100 km cell centre.
 */
export function mgrsPartsToLonLat(
  parts: MgrsParts,
  precision: MgrsPrecision = 5,
): [number, number] | undefined {
  const { zone, band, square, easting, northing } = parts;

  if (square === '') return gzdCentre_(zone, band);

  if (zone === 0) {
    if (!isUpsBand(band)) return undefined;
    const cellE = upsColumnLetterToEasting(band, square[0]!);
    const cellN = upsRowLetterToNorthing(band, square[1]!);
    if (cellE === undefined || cellN === undefined) return undefined;
    const cellSize = 10 ** (5 - precision);
    return upsToLonLat(
      cellE + easting + cellSize / 2,
      cellN + northing + cellSize / 2,
      band === 'Y' || band === 'Z',
    );
  }

  const cellE = columnLetterToEasting(zone, square[0]!);
  if (cellE === undefined) return undefined;
  const cycleIdx = rowLetterToCycleIndex(zone, square[1]!);
  if (cycleIdx === undefined) return undefined;
  const latRange = bandLatBounds(band);
  if (latRange === undefined) return undefined;
  const approxLat = (latRange[0] + latRange[1]) / 2;
  const lonCentre = -180 + (zone - 1) * 6 + 3;
  const approx = lonLatToUtm(lonCentre, approxLat, zone);
  const baseCycle = Math.round((approx.northing - cycleIdx * 100_000) / ROW_CYCLE_M);
  const cellN = baseCycle * ROW_CYCLE_M + cycleIdx * 100_000;

  const cellSize = 10 ** (5 - precision);
  return utmToLonLat(
    zone,
    cellE + easting + cellSize / 2,
    cellN + northing + cellSize / 2,
    approxLat < 0,
  );
}

function gzdCentre_(zone: number, band: string): [number, number] | undefined {
  if (zone === 0) {
    if (!isUpsBand(band)) return undefined;
    const b = upsZoneLonLatBounds(band);
    return [(b.lon[0] + b.lon[1]) / 2, (b.lat[0] + b.lat[1]) / 2];
  }
  const lat = bandLatBounds(band);
  if (!lat) return undefined;
  return [-180 + (zone - 1) * 6 + 3, (lat[0] + lat[1]) / 2];
}

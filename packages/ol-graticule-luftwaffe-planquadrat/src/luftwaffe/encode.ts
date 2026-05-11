/**
 * Forward encoding: a `[lat, lon]` coordinate to a Luftwaffe map reference.
 * Implements both Gradnetzmeldeverfahren (GNMV) and Jägermeldenetz (JMN),
 * with selectable era (pre-1943 / post-1943).
 *
 * Sources for the rules implemented here:
 *   - "The Last Flight of Halifax JB837" (Ron Birch / prwg.co.uk):
 *     https://www.prwg.co.uk/Halifax_JB837/Luftwaffe_Map_Reference.asp
 *   - aircrewremembered.com "Luftwaffe Grid Reference System":
 *     https://aircrewremembered.com/luftwaffe-grid-reference-system.html
 */

import {
  ZZG_LAT_DEG,
  ZZG_LON_DEG,
  ZZG_NORTH_LIMIT,
  ZZG_BASELINE_LAT,
  GT_LAT_DEG,
  GT_LON_DEG,
  MT_LAT_DEG,
  MT_LON_DEG,
  KT_LAT_DEG,
  KT_LON_DEG,
  JAGDTRAPEZ_LAT_DEG,
  meldetrapezDims,
  arbeitstrapezDims,
} from './levels.js';
import { letterFromIndex } from './letters.js';
import type { LatLon, LuftwaffeEra, ZzgSuffix, JmnHalf } from './types.js';

const PRE_AT_LABELS = ['lo', 'ro', 'lu', 'ru'] as const;
const POST_AT_LABELS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'] as const;

/**
 * Wrap a longitude into the half-open interval `[-180, 180)`. The antimeridian
 * (lon=180) and any out-of-range value (-355, 365, ...) fold onto a unique
 * representative inside the range, so the ZZG encoding stays in lonTens 0..18 W
 * with no East/West ambiguity at the antimeridian.
 */
export function normalizeAntimeridian(lon: number): number {
  if (!Number.isFinite(lon)) return lon;
  return (((lon + 180) % 360) + 360) % 360 - 180;
}

/** ZZG digits + hemisphere suffix derived from the NW corner of the 10°×10° box. */
interface ZzgIdentity {
  /** ZZG digit string. The lon ten-count is the leading digit(s); the lat ten-count is the last digit. */
  digits: string;
  suffix: ZzgSuffix;
  /** Lat of the NW (upper) edge of the ZZG, in degrees north. */
  nwLat: number;
  /** Lon of the NW (left, western) edge of the ZZG, in degrees east. */
  nwLon: number;
}

/** Find the ZZG containing `(lat, lon)`. Returns `undefined` for inputs at or above 89°N. */
export function zzgFor(lat: number, lon: number): ZzgIdentity | undefined {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
  if (lat >= ZZG_NORTH_LIMIT) return undefined;

  const normalizedLon = normalizeAntimeridian(lon);
  const bandFromBaseline = Math.floor((lat - ZZG_BASELINE_LAT) / ZZG_LAT_DEG);
  const isSouth = bandFromBaseline < 0;
  const latTens = isSouth ? -bandFromBaseline - 1 : bandFromBaseline;
  const nwLat = ZZG_BASELINE_LAT + ZZG_LAT_DEG * (bandFromBaseline + 1);

  const isEast = normalizedLon >= 0;
  const nwLon = Math.floor(normalizedLon / ZZG_LON_DEG) * ZZG_LON_DEG;
  const lonTens = Math.abs(nwLon) / ZZG_LON_DEG;

  const suffix: ZzgSuffix = isSouth
    ? (isEast ? 'Südost' : 'Südwest')
    : (isEast ? 'Ost' : 'West');

  return {
    digits: `${lonTens}${latTens}`,
    suffix,
    nwLat,
    nwLon,
  };
}

/** NW (upper) latitude of the cell of size `latSpan` containing `lat`. */
function nwLat(lat: number, latSpan: number): number {
  return (Math.floor(lat / latSpan) + 1) * latSpan;
}

/** NW (left, western) longitude of the cell of size `lonSpan` containing `lon`. */
function nwLon(lon: number, lonSpan: number): number {
  return Math.floor(lon / lonSpan) * lonSpan;
}

/** Großtrapez two-digit code: ones-count of the GT NW longitude, then ones-count of the GT NW latitude. */
export function gtDigitsFor(lat: number, lon: number): string {
  const gtNwLat = nwLat(lat, GT_LAT_DEG);
  const gtNwLon = nwLon(lon, GT_LON_DEG);
  const lonOnes = Math.abs(Math.round(gtNwLon)) % 10;
  const latOnes = Math.abs(Math.round(gtNwLat)) % 10;
  return `${lonOnes}${latOnes}`;
}

/** Jagdtrapez half (Nord / Süd) for `lat` within `zzg`. The split runs 5° below the ZZG north edge. */
export function jagdtrapezHalfFor(zzg: ZzgIdentity, lat: number): JmnHalf {
  const splitLat = zzg.nwLat - JAGDTRAPEZ_LAT_DEG;
  return lat >= splitLat ? 'N' : 'S';
}

interface SubcellCoord {
  /** Row index from the north (0-based). */
  row: number;
  /** Column index from the west (0-based). */
  col: number;
}

/** Locate `(lat, lon)` within a regular `rows × cols` sub-grid of a parent box. */
function subcell(
  lat: number,
  lon: number,
  parentNwLat: number,
  parentNwLon: number,
  cellLatSpan: number,
  cellLonSpan: number,
  rows: number,
  cols: number,
): SubcellCoord {
  const rowFromNorth = Math.floor((parentNwLat - lat) / cellLatSpan);
  const colFromWest = Math.floor((lon - parentNwLon) / cellLonSpan);
  return {
    row: clamp(rowFromNorth, 0, rows - 1),
    col: clamp(colFromWest, 0, cols - 1),
  };
}

function clamp(value: number, lo: number, hi: number): number {
  return value < lo ? lo : value > hi ? hi : value;
}

/** Mitteltrapez digit (1..8) inside the parent 1°×1° GT, indexed top-to-bottom, left-to-right (4 rows × 2 cols). */
export function mtDigitFor(lat: number, lon: number): number {
  const cell = subcell(
    lat, lon,
    nwLat(lat, GT_LAT_DEG), nwLon(lon, GT_LON_DEG),
    MT_LAT_DEG, MT_LON_DEG, 4, 2,
  );
  return cell.row * 2 + cell.col + 1;
}

/** JMN Mitteltrapez two-letter code (AA..UU, no I) inside a 5°×10° Jagdtrapez. */
export function jmnMtLettersFor(lat: number, lon: number, zzg: ZzgIdentity, half: JmnHalf): string | undefined {
  const halfNwLat = half === 'N' ? zzg.nwLat : zzg.nwLat - JAGDTRAPEZ_LAT_DEG;
  const cell = subcell(lat, lon, halfNwLat, zzg.nwLon, MT_LAT_DEG, MT_LON_DEG, 20, 20);
  const rowLetter = letterFromIndex(cell.row);
  const colLetter = letterFromIndex(cell.col);
  if (rowLetter === undefined || colLetter === undefined) return undefined;
  return `${rowLetter}${colLetter}`;
}

/** Kleintrapez digit (1..9) inside its parent Mitteltrapez (3 rows × 3 cols). */
export function ktDigitFor(lat: number, lon: number): number {
  const cell = subcell(
    lat, lon,
    nwLat(lat, MT_LAT_DEG), nwLon(lon, MT_LON_DEG),
    KT_LAT_DEG, KT_LON_DEG, 3, 3,
  );
  return cell.row * 3 + cell.col + 1;
}

/** Meldetrapez digit (1..9 post-1943, 1..4 pre-1943) inside its parent Kleintrapez. */
export function meltDigitFor(lat: number, lon: number, era: LuftwaffeEra): number {
  const dims = meldetrapezDims(era);
  const cell = subcell(
    lat, lon,
    nwLat(lat, KT_LAT_DEG), nwLon(lon, KT_LON_DEG),
    dims.latDeg, dims.lonDeg, dims.rows, dims.cols,
  );
  return cell.row * dims.cols + cell.col + 1;
}

/** Arbeitstrapez label (a..i post-1943, lo/ro/lu/ru pre-1943) inside its parent Meldetrapez. */
export function atLabelFor(lat: number, lon: number, era: LuftwaffeEra): string {
  const meltDims = meldetrapezDims(era);
  const atDims = arbeitstrapezDims(era);
  const cell = subcell(
    lat, lon,
    nwLat(lat, meltDims.latDeg), nwLon(lon, meltDims.lonDeg),
    atDims.latDeg, atDims.lonDeg, atDims.rows, atDims.cols,
  );
  if (era === 'pre-1943') {
    return PRE_AT_LABELS[cell.row * 2 + cell.col]!;
  }
  return POST_AT_LABELS[cell.row * 3 + cell.col]!;
}

/**
 * Encode `(lat, lon)` to a GNMV reference at the requested depth.
 *
 *   depth 0: ZZG only                         e.g. "15O"
 *   depth 1: + Großtrapez (2 digits)          e.g. "15O33"
 *   depth 2: + Mitteltrapez (1 digit)         e.g. "15O333"
 *   depth 3: + Kleintrapez (1 digit)          e.g. "15O3339"
 *   depth 4: + Meldetrapez                    e.g. "15O33397"
 *   depth 5: + Arbeitstrapez                  e.g. "15O33397c"
 */
export function encodeGnmv(point: LatLon, era: LuftwaffeEra = 'post-1943', depth: number = 5): string | undefined {
  const [lat, rawLon] = point;
  const lon = normalizeAntimeridian(rawLon);
  const zzg = zzgFor(lat, lon);
  if (!zzg) return undefined;

  let out = `${zzg.digits}${suffixToken(zzg.suffix)}`;
  if (depth <= 0) return out;

  out += gtDigitsFor(lat, lon);
  if (depth <= 1) return out;

  out += String(mtDigitFor(lat, lon));
  if (depth <= 2) return out;

  out += String(ktDigitFor(lat, lon));
  if (depth <= 3) return out;

  out += String(meltDigitFor(lat, lon, era));
  if (depth <= 4) return out;

  out += atLabelFor(lat, lon, era);
  return out;
}

/**
 * Encode `(lat, lon)` to a JMN reference at the requested depth.
 * The Jägermeldenetz only existed in its post-1943 (9-cell MelT/AT) form,
 * so this entry point has no era parameter.
 *
 *   depth 0: ZZG only (no Nord/Süd)           e.g. "15O"
 *   depth 1: + Jagdtrapez half                e.g. "15OS"
 *   depth 2: + Mitteltrapez letter pair       e.g. "15OSFG"
 *   depth 3: + Kleintrapez                    e.g. "15OSFG3"
 *   depth 4: + Meldetrapez                    e.g. "15OSFG39"
 *   depth 5: + Arbeitstrapez                  e.g. "15OSFG39c"
 */
export function encodeJmn(point: LatLon, depth: number = 5): string | undefined {
  const [lat, rawLon] = point;
  const lon = normalizeAntimeridian(rawLon);
  const zzg = zzgFor(lat, lon);
  if (!zzg) return undefined;

  let out = `${zzg.digits}${suffixToken(zzg.suffix)}`;
  if (depth <= 0) return out;

  const half = jagdtrapezHalfFor(zzg, lat);
  out += half;
  if (depth <= 1) return out;

  const letters = jmnMtLettersFor(lat, lon, zzg, half);
  if (!letters) return undefined;
  out += letters;
  if (depth <= 2) return out;

  out += String(ktDigitFor(lat, lon));
  if (depth <= 3) return out;

  out += String(meltDigitFor(lat, lon, 'post-1943'));
  if (depth <= 4) return out;

  out += atLabelFor(lat, lon, 'post-1943');
  return out;
}

/** Compact suffix token used in canonical, whitespace-free references (`O`, `W`, `SO`, `SW`). */
export function suffixToken(suffix: ZzgSuffix): string {
  switch (suffix) {
    case 'Ost':     return 'O';
    case 'West':    return 'W';
    case 'Südost':  return 'SO';
    case 'Südwest': return 'SW';
  }
}

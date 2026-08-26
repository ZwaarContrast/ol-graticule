/**
 * Text forms of a Gauß-Krüger 3° reference, following the *Planzeiger* note
 * printed on the sheets: Rechtswert first, then Hochwert, both in metres, with
 * the Kennziffer carried as the leading digit(s) of the Rechtswert.
 *
 *   long   `"2512200 5585450"`   full Rechtswert / Hochwert in metres
 *   short  `"12200 85450"`       the sheet's "kurz" form, leading pair dropped
 *
 * Grid-line labels along a sheet edge print the kilometre value only, in the
 * same two forms: `"2512"` at the corners, `"12"` on inline ticks.
 */

import { forward, forwardInZone, inverse } from './projection.js';
import type { DrgCoord, LatLon } from './types.js';
import { MAX_KENNZIFFER } from './zones.js';

export { inverse as decodeDrg };

export interface DrgFormatOptions {
  /** `'long'` keeps the leading Kennziffer/100 km pair, `'short'` drops it. Default `'long'`. */
  form?: 'long' | 'short';
  /** `'km'` for grid-line labels, `'m'` for point references. Default `'km'`. */
  unit?: 'km' | 'm';
}

function format(value: number, options: DrgFormatOptions): string {
  const metres = Math.round(value);
  const km = Math.floor(metres / 1000);
  const head = options.form === 'short' ? String(km % 100).padStart(2, '0') : String(km);
  if (options.unit !== 'm') return head;
  return `${head}${String(metres - km * 1000).padStart(3, '0')}`;
}

/** Format the Rechtswert as printed on a sheet (default: `"2512"`). */
export function formatEasting(coord: DrgCoord, options: DrgFormatOptions = {}): string {
  return format(coord.easting, options);
}

/** Format the Hochwert as printed on a sheet (default: `"5585"`). */
export function formatNorthing(coord: DrgCoord, options: DrgFormatOptions = {}): string {
  return format(coord.northing, options);
}

/**
 * Encode `(lat, lon)` into the strip whose central meridian is nearest the
 * longitude. Pass `kennziffer` to force a strip, which is what a sheet in the
 * 20' overlap band does.
 */
export function encodeDrg(point: LatLon, kennziffer?: number): DrgCoord {
  return kennziffer === undefined ? forward(point) : forwardInZone(point, kennziffer);
}

/** Encode `(lat, lon)` to its metre-precision text form, e.g. `"2512200 5585450"`. */
export function encodeDrgText(point: LatLon, kennziffer?: number): string {
  const coord = encodeDrg(point, kennziffer);
  const options: DrgFormatOptions = { unit: 'm' };
  return `${formatEasting(coord, options)} ${formatNorthing(coord, options)}`;
}

const SEP = /[\s\-/_,]+/;

export interface ParsedDrg {
  coord: DrgCoord;
  /** Normalised metre-precision text for the parsed coord. */
  canonical: string;
}

/**
 * Parse a long-form reference. Accepted shapes, separators flexible:
 *
 *   `"2512200 5585450"`   metres, Kennziffer glued to the Rechtswert
 *   `"2512 5585"`         kilometres, same gluing
 *   `"2 512 5585"`        Kennziffer split off as its own token
 *
 * The bare "kurz" form (`"12200 85450"`) has no strip information and is not
 * parseable on its own.
 */
export function parseDrg(text: string): ParsedDrg | undefined {
  if (typeof text !== 'string') return undefined;
  const tokens = text.trim().split(SEP).filter(Boolean);

  let kennziffer: number;
  let easting: number;
  let northing: number;

  if (tokens.length === 3) {
    const [kz, e, n] = tokens.map(Number);
    if (!isInt(kz) || !isInt(e) || !isInt(n)) return undefined;
    kennziffer = kz;
    easting = kennziffer * 1_000_000 + toMetres(e, 6);
    northing = toMetres(n, 6);
  } else if (tokens.length === 2) {
    const [eToken, nToken] = tokens;
    if (eToken === undefined || nToken === undefined) return undefined;
    const e = Number(eToken);
    const n = Number(nToken);
    if (!isInt(e) || !isInt(n)) return undefined;
    if (eToken.replace(/^0+/, '').length >= 7) {
      kennziffer = Math.floor(e / 1_000_000);
      easting = e;
    } else if (e >= 1000) {
      kennziffer = Math.floor(e / 1000);
      easting = kennziffer * 1_000_000 + (e % 1000) * 1000;
    } else {
      return undefined;
    }
    northing = toMetres(n, 6);
  } else {
    return undefined;
  }

  if (kennziffer < 0 || kennziffer > MAX_KENNZIFFER) return undefined;
  const zoneEasting = easting - kennziffer * 1_000_000;
  if (zoneEasting < 0 || zoneEasting > 1_000_000) return undefined;

  const coord: DrgCoord = { kennziffer, easting, northing };
  const options: DrgFormatOptions = { unit: 'm' };
  return {
    coord,
    canonical: `${formatEasting(coord, options)} ${formatNorthing(coord, options)}`,
  };
}

/** Values below `metreThreshold` digits are read as kilometres. */
function toMetres(value: number, metreThreshold: number): number {
  return String(Math.abs(value)).length >= metreThreshold ? value : value * 1000;
}

function isInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n);
}

/**
 * DHG textual format helpers.
 *
 * Wartime sheets use two conventions for the kilometre labels along a grid edge:
 *
 *   - **Long form** at the corners: zone Kennziffer prepended to the 3-digit
 *     km value, e.g. `"5600"` on the Owrutsch 1:300 000 NW corner (zone 5,
 *     Rechtswert 600 km).
 *
 *   - **Short form** on inline grid ticks: last 2 km digits only, e.g. `"83"`
 *     on the Kolosjoki 1:50 000 sheet next to the easting label `383 000`.
 *
 * Northings (Hochwerte) are measured straight from the equator, never carry a
 * zone prefix, and use the same long/short distinction.
 */

import { forward, forwardInZone } from './projection.js';
import type { DhgCoord, LatLon } from './types.js';

export interface DhgFormatOptions {
  /**
   * `'long'` writes the Kennziffer-prefixed full km value (`"5600"`);
   * `'short'` writes only the last 2 km digits (`"00"`). Default: `'long'`.
   */
  form?: 'long' | 'short';
}

/** Format the Rechtswert as printed on a wartime sheet (default: `"5600"` long form). */
export function formatEasting(coord: DhgCoord, options: DhgFormatOptions = {}): string {
  const km = Math.floor(coord.easting / 1000);
  if (options.form === 'short') return String(km % 100).padStart(2, '0');
  return `${coord.kennziffer}${String(km).padStart(3, '0')}`;
}

/** Format the Hochwert as printed on a wartime sheet (default: `"5760"` long form). */
export function formatNorthing(coord: DhgCoord, options: DhgFormatOptions = {}): string {
  const km = Math.floor(coord.northing / 1000);
  if (options.form === 'short') return String(km % 100).padStart(2, '0');
  return String(km);
}

/**
 * Encode a `(lat, lon)` to its DHG coordinate, picking the zone whose central
 * meridian is nearest the longitude. Pass `kennziffer` to force a specific
 * zone (useful when straddling a boundary).
 */
export function encodeDhg(point: LatLon, kennziffer?: number): DhgCoord {
  return kennziffer === undefined ? forward(point) : forwardInZone(point, kennziffer);
}

/**
 * Encode a `(lat, lon)` to its full text form, e.g. `"5600 5760"`
 * (zone Kennziffer prepended to the easting; northing is the equator-referenced
 * Hochwert in kilometres).
 */
export function encodeDhgText(point: LatLon, kennziffer?: number): string {
  const coord = encodeDhg(point, kennziffer);
  return `${formatEasting(coord)} ${formatNorthing(coord)}`;
}

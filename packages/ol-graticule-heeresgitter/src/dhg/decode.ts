/**
 * Parse a DHG textual reference back to a planar coordinate.
 *
 * Accepted forms (whitespace flexible, both zone-prefixed and bare):
 *   "5 600 5760"     → zone 5, E = 600 000 m, N = 5 760 000 m
 *   "5600 5760"      → identical (zone prefix glued to easting)
 *   "5 600000 5760000" → metres rather than kilometres also accepted
 *   "5-600-5760"     → hyphen-separated, same semantics
 *
 * Bare 2-digit short-form inline labels (`"83"`) cannot be parsed in
 * isolation; pass them together with their resolving zone Kennziffer and a
 * surrounding context (full easting in km) via `parseDhgShort`.
 */

import type { DhgCoord } from './types.js';
import { inverse } from './projection.js';

export { inverse as decodeDhg };

const SEP = /[\s\-/_,]+/;

export interface ParsedDhg {
  coord: DhgCoord;
  /** The raw, normalised text used to produce this coord. */
  canonical: string;
}

/** Try to parse `text` as a long-form DHG reference. Returns `undefined` if not recognised. */
export function parseDhg(text: string): ParsedDhg | undefined {
  if (typeof text !== 'string') return undefined;
  const tokens = text.trim().split(SEP).filter(Boolean);
  if (tokens.length === 0) return undefined;

  // Possible token shapes:
  //   1) "5"     "600"     "5760"            (3 tokens: zone, E km, N km)
  //   2) "5600"  "5760"                       (2 tokens: zone-prefixed E km, N km)
  //   3) "5600000" "5760000"                  (2 tokens: full metres on E and N)
  let kennziffer: number;
  let eastingKm: number;
  let northingKm: number;

  if (tokens.length === 3) {
    const [kz, e, n] = tokens.map(Number);
    if (!isInt(kz) || !isInt(e) || !isInt(n)) return undefined;
    kennziffer = kz;
    eastingKm = toKm(e);
    northingKm = toKm(n);
  } else if (tokens.length === 2) {
    const [eRaw, nRaw] = tokens.map(Number);
    if (!isInt(eRaw) || !isInt(nRaw)) return undefined;
    if (eRaw > 99_999_999 || nRaw > 99_999_999) return undefined;
    // Long form: easting starts with the Kennziffer digit(s).
    if (eRaw >= 1_000_000) {
      // 7-digit Rechtswert: K|EEE|EEE  (1-digit zone)
      kennziffer = Math.floor(eRaw / 1_000_000);
      eastingKm = Math.floor((eRaw % 1_000_000) / 1000);
      northingKm = toKm(nRaw);
    } else if (eRaw >= 100_000) {
      // 6-digit Rechtswert: K|EEE|EE
      return undefined;
    } else {
      // 4-digit zone-prefixed km: K|EEE
      kennziffer = Math.floor(eRaw / 1000);
      eastingKm = eRaw % 1000;
      northingKm = toKm(nRaw);
    }
  } else {
    return undefined;
  }

  if (kennziffer < 1 || kennziffer > 60) return undefined;

  return {
    coord: {
      kennziffer,
      easting: eastingKm * 1000,
      northing: northingKm * 1000,
    },
    canonical: `${kennziffer} ${eastingKm} ${northingKm}`,
  };
}

/**
 * Parse a 2-digit short-form easting (or northing) given the surrounding
 * full km value. Returns the rebuilt full km value.
 *
 *   parseShortDigits('83', 383)  →  383   (already aligned)
 *   parseShortDigits('00', 399)  →  400   (rolled over the next 100 km)
 */
export function parseShortDigits(short: string, contextKm: number): number | undefined {
  if (!/^\d{2}$/.test(short)) return undefined;
  const tens = Number(short);
  const base = Math.floor(contextKm / 100) * 100;
  const candidate = base + tens;
  // Pick whichever centred candidate is closest to context.
  const alternatives = [candidate - 100, candidate, candidate + 100];
  return alternatives.reduce((best, c) =>
    Math.abs(c - contextKm) < Math.abs(best - contextKm) ? c : best,
  );
}

function toKm(v: number): number {
  return v >= 100_000 ? Math.floor(v / 1000) : v;
}

function isInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n);
}

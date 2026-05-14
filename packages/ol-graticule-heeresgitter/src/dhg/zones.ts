/**
 * The 60 zones of the Deutsches Heeresgitter (DHG).
 *
 * From the Planheft Schweiz (g 23/1, 16 March 1944), page C 1:
 *
 *   "Mittelmeridiane der 6°-Streifen und Kennziffern:
 *      3°  9° 15° 21° ...  357°  ostw. Greenwich
 *      1   2   3   4  ...  59 60  Kennziffern
 *
 *    Die Kennziffer findet man, indem man die Gradzahl des Mittelmeridians
 *    Lₘ um 3° vergrößert und dann durch 6 dividiert:
 *      n = (Lₘ + 3) / 6
 *
 *    Den Mittelmeridian findet man, indem man die Kennziffer mit 6
 *    multipliziert und dann 3 subtrahiert:
 *      Lₘ = n × 6 − 3"
 *
 * Each strip is calculated with a 30' overlap on each side, so the actual
 * valid longitude band for zone `n` is `[CM − 3°30', CM + 3°30']`.
 */

import type { DhgZone } from './types.js';

/** Nominal half-width of a DHG strip (3°). */
export const STRIP_HALF_WIDTH_DEG = 3;

/** Overlap distance on each side beyond the nominal strip edge (30'). */
export const STRIP_OVERLAP_DEG = 0.5;

/** False easting (m) applied to all DHG zones. */
export const FALSE_EASTING = 500_000;

/**
 * Return the central meridian (signed degrees east of Greenwich, in [-177, 180])
 * for a given DHG Kennziffer.
 *
 * Kennziffer 1..30 → CM = 3°, 9°, 15° … 177° (east of Greenwich).
 * Kennziffer 31..60 → CM = -177°, -171° … -3° (west of Greenwich).
 */
export function cmForKennziffer(kennziffer: number): number {
  if (!Number.isInteger(kennziffer) || kennziffer < 1 || kennziffer > 60) {
    throw new RangeError(`DHG Kennziffer out of range: ${kennziffer}`);
  }
  const raw = kennziffer * 6 - 3;
  return raw <= 180 ? raw : raw - 360;
}

/**
 * Return the Kennziffer for a given central meridian (signed degrees east).
 * Inverse of `cmForKennziffer`.
 */
export function kennzifferForCm(cm: number): number {
  const normalized = ((cm % 360) + 360) % 360;
  return (normalized + 3) / 6;
}

/**
 * Pick the DHG zone for a longitude. Picks the strip whose central meridian
 * is nearest the input. With `includeOverlap`, the 30' overlap band counts
 * toward both neighbouring zones; this function then returns the primary zone
 * (nearest CM). Use `zonesContainingLon` to enumerate every zone whose
 * extended band contains the longitude.
 */
export function zoneForLon(lon: number): DhgZone {
  const shifted = ((lon % 360) + 360) % 360;
  const kennziffer = Math.floor(shifted / 6) + 1;
  return zoneByKennziffer(kennziffer > 60 ? kennziffer - 60 : kennziffer);
}

/** Every zone whose nominal-strip-plus-30'-overlap contains `lon`. 1 or 2 zones. */
export function zonesContainingLon(lon: number): DhgZone[] {
  const primary = zoneForLon(lon);
  const result: DhgZone[] = [primary];
  const normalized = ((lon + 180) % 360 + 360) % 360 - 180;
  const distFromCm = Math.abs(normalized - primary.cm);
  // Within 30' of a 6° boundary → also include the neighbouring zone.
  if (distFromCm > STRIP_HALF_WIDTH_DEG - STRIP_OVERLAP_DEG) {
    const neighbourKz =
      normalized > primary.cm
        ? wrapKennziffer(primary.kennziffer + 1)
        : wrapKennziffer(primary.kennziffer - 1);
    result.push(zoneByKennziffer(neighbourKz));
  }
  return result;
}

function wrapKennziffer(k: number): number {
  if (k < 1) return k + 60;
  if (k > 60) return k - 60;
  return k;
}

/** Construct a `DhgZone` from its Kennziffer (validates range). */
export function zoneByKennziffer(kennziffer: number): DhgZone {
  const cm = cmForKennziffer(kennziffer);
  return {
    kennziffer,
    cm,
    westLon: cm - STRIP_HALF_WIDTH_DEG,
    eastLon: cm + STRIP_HALF_WIDTH_DEG,
  };
}

/** All 60 DHG zones, ordered by Kennziffer. */
export const ALL_ZONES: readonly DhgZone[] = Object.freeze(
  Array.from({ length: 60 }, (_v, i) => zoneByKennziffer(i + 1)),
);

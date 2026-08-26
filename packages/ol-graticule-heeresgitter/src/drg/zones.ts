/**
 * The Gauß-Krüger 3° meridian strips of the German Reich survey, the grid
 * printed on Reich map sheets before the 6° Deutsches Heeresgitter.
 *
 * From the *Planzeiger* note on sheet 5503 Elsenborn (Planblatt A, Geheim,
 * Sonderdruck der Heeresplankammer, Stand 1.10.1939):
 *
 *   "Der Rechtswert ist stets zuerst zu nennen. Die Punktangabe erfolgt in
 *    Metern. Nicht ablesbare Werte sind bis zur Angabe des vollen Meters
 *    durch Nullen zu ersetzen.
 *
 *    Beispiel: Punkt p liegt in Metern:
 *      'Rechts'  ⁴⁵27000 + 200 = ⁴⁵27200 = (kurz:) 27200
 *      'Hoch'    ⁵⁷96000 + 450 = ⁵⁷96450 = (kurz:) 96450
 *
 *      * Kennziffer des Meridianstreifens"
 *
 * The Kennziffer of a strip is its central meridian divided by 3°, and it is
 * carried as the leading digit(s) of the Rechtswert rather than quoted apart
 * from it, so Elsenborn's western grid line reads `2512` km: Kennziffer 2
 * (CM 6° E), Rechtswert 512 km.
 *
 * Strips reach 1°40' either side of the central meridian, so neighbours share
 * a 20' overlap band in which a point has coordinates in both.
 */

import type { DrgZone } from './types.js';

/** Nominal half-width of a 3° strip (1°30'). */
export const STRIP_HALF_WIDTH_DEG = 1.5;

/** Overlap distance on each side beyond the nominal strip edge (10'). */
export const STRIP_OVERLAP_DEG = 10 / 60;

/** Rechtswert added per Kennziffer step. */
export const ZONE_EASTING_STEP = 1_000_000;

/** False easting (m) applied within every strip. */
export const FALSE_EASTING = 500_000;

/** Highest supported Kennziffer. Strip 59 has its central meridian at 177° E. */
export const MAX_KENNZIFFER = 59;

/** Central meridian (degrees east of Greenwich) for a Kennziffer. */
export function cmForKennziffer(kennziffer: number): number {
  if (!Number.isInteger(kennziffer) || kennziffer < 0 || kennziffer > MAX_KENNZIFFER) {
    throw new RangeError(`Gauß-Krüger 3° Kennziffer out of range: ${kennziffer}`);
  }
  return kennziffer * 3;
}

/** Kennziffer for a central meridian. Inverse of {@link cmForKennziffer}. */
export function kennzifferForCm(cm: number): number {
  return cm / 3;
}

/** Rechtswert of a strip's central meridian. */
export function falseEastingFor(kennziffer: number): number {
  return kennziffer * ZONE_EASTING_STEP + FALSE_EASTING;
}

/** Construct a `DrgZone` from its Kennziffer (validates range). */
export function zoneByKennziffer(kennziffer: number): DrgZone {
  const cm = cmForKennziffer(kennziffer);
  return {
    kennziffer,
    cm,
    falseEasting: falseEastingFor(kennziffer),
    westLon: cm - STRIP_HALF_WIDTH_DEG,
    eastLon: cm + STRIP_HALF_WIDTH_DEG,
  };
}

/** The strip whose central meridian is nearest `lon`, clamped to the supported range. */
export function zoneForLon(lon: number): DrgZone {
  const nearest = Math.round(lon / 3);
  const clamped = Math.min(MAX_KENNZIFFER, Math.max(0, nearest));
  return zoneByKennziffer(clamped);
}

/** Every strip whose nominal band plus 10' overlap contains `lon`. 1 or 2 strips. */
export function zonesContainingLon(lon: number): DrgZone[] {
  const primary = zoneForLon(lon);
  const result: DrgZone[] = [primary];
  const distFromCm = Math.abs(lon - primary.cm);
  if (distFromCm > STRIP_HALF_WIDTH_DEG - STRIP_OVERLAP_DEG) {
    const neighbour = lon > primary.cm ? primary.kennziffer + 1 : primary.kennziffer - 1;
    if (neighbour >= 0 && neighbour <= MAX_KENNZIFFER) result.push(zoneByKennziffer(neighbour));
  }
  return result;
}

/** Every supported strip, ordered by Kennziffer. */
export const ALL_ZONES: readonly DrgZone[] = Object.freeze(
  Array.from({ length: MAX_KENNZIFFER + 1 }, (_v, i) => zoneByKennziffer(i)),
);

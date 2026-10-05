/**
 * The Gauß-Krüger 3° meridian strips of the German Reich survey, the grid
 * printed on Reich map sheets before the 6° Deutsches Heeresgitter.
 *
 * Specified verbatim in the Planheft section *Das Deutsche Reichsgitter*
 * (Planheft Schweiz, OKH g 23/1, 16 March 1944, p. C 3; identical text in
 * Planheft Osteuropa, Merkblatt 34/31b). It names the system, defines it, and
 * gives the strip table:
 *
 *   "Zur eindeutigen und kurzen Unterscheidung wird künftig das deutsche
 *    Gauß-Krüger-Gitter mit 3° breiten Streifen (Ausgangspunkt Potsdam) als
 *    Deutsches Reichsgitter — DRG — bezeichnet.
 *
 *    Für das Deutsche Reichsgitter — DRG — gilt:
 *      Bezugsellipsoid Bessel
 *      Projektion Gauß-Krüger
 *      Ausgangspunkt Potsdam
 *      Maßstabsreduktion O.
 *
 *    Die Hochwerte werden vom Äquator mit dem Hochwert 0 und die Rechtswerte
 *    vom Mittelmeridian mit dem Rechtswert 500 000 gezählt. Den Rechtswerten
 *    wird die Kennziffer vorausgesetzt.
 *
 *    Mittelmeridiane der 3° Streifen und Kennziffern:
 *      3°  6°  9°  12°  15°   ostwärts Greenwich
 *      1   2   3   4    5     Kennziffern
 *
 *    Die Kennziffer findet man, indem man die Gradzahl des Mittelmeridians
 *    durch 3 teilt."
 *
 * The same page states where the grid applies: it arises "im Großdeutschen
 * Reich und in den Grenzgebieten", alongside the DHG as that system is taken
 * over strip by strip.
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

/**
 * Overlap distance on each side beyond the nominal strip edge (10').
 *
 * UNSOURCED, and the one DRG constant the Planheft appears to contradict. Its
 * Schweiz 1:25 000 entry puts the overlap of strips 2 and 3 at "etwa zwischen
 * 6° 50' und 8° 20' ostw. Greenwich", a band 1°30' wide about the 7°30' strip
 * boundary. This value gives 7°20'-7°40', a band of 20'. Matching the Planheft
 * would need the strips to reach roughly 2°15' either side of their central
 * meridian rather than 1°40'.
 *
 * Left as it stands because that sentence describes one printed map series and
 * may be quantised to whole sheets, and because it is the only reading we have.
 * It affects `zonesContainingLon` and the 'overlap' boundary mode only, never a
 * coordinate.
 */
export const STRIP_OVERLAP_DEG = 10 / 60;

/** Rechtswert added per Kennziffer step. */
export const ZONE_EASTING_STEP = 1_000_000;

/** False easting (m) applied within every strip. */
export const FALSE_EASTING = 500_000;

/**
 * Highest Kennziffer the formula admits. Strip 59 has its central meridian at
 * 177° E. This is a bound on the arithmetic, NOT a claim that the grid was
 * printed there: see {@link PUBLISHED_KENNZIFFERN}.
 */
export const MAX_KENNZIFFER = 59;

/**
 * The strips the Planheft actually tabulates: Kennziffern 1-5, central
 * meridians 3° to 15° E, covering the Großdeutsches Reich. The Osteuropa
 * edition prints the same five and no more, so a DRG strip east of 15° E is
 * unattested in the sources this package is built on.
 *
 * `zoneByKennziffer` still builds any Kennziffer up to {@link MAX_KENNZIFFER},
 * because the Planheft gives Kennziffer = central meridian / 3 as a general
 * rule. Use this list to tell "the arithmetic works" from "the grid was
 * printed here" — for a DRG sheet the two are separable, because the Kennziffer
 * is printed on the face inside the Rechtswert rather than inferred.
 *
 * Do NOT use it to reject a strip. A sheet printing a leading 11 in its
 * Rechtswert is the only evidence that could ever extend this list, and a filter
 * built on the list would throw exactly that sheet away: absence of attestation
 * is not attestation of absence, and a catalogue's silence does not outrank a
 * sheet's own ink. The Kennziffer being glued into the Rechtswert already makes
 * a DRG sheet vouch for itself, so there is nothing here for a veto to do.
 */
export const PUBLISHED_KENNZIFFERN: readonly number[] = Object.freeze([
  1, 2, 3, 4, 5,
]);

/** Whether `kennziffer` is one of the strips the Planheft tabulates. */
export function isPublishedKennziffer(kennziffer: number): boolean {
  return PUBLISHED_KENNZIFFERN.includes(kennziffer);
}

/** Central meridian (degrees east of Greenwich) for a Kennziffer. */
export function cmForKennziffer(kennziffer: number): number {
  if (
    !Number.isInteger(kennziffer) ||
    kennziffer < 0 ||
    kennziffer > MAX_KENNZIFFER
  ) {
    throw new RangeError(
      `Gauß-Krüger 3° Kennziffer out of range: ${kennziffer}`,
    );
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
    const neighbour =
      lon > primary.cm ? primary.kennziffer + 1 : primary.kennziffer - 1;
    if (neighbour >= 0 && neighbour <= MAX_KENNZIFFER)
      result.push(zoneByKennziffer(neighbour));
  }
  return result;
}

/** Every supported strip, ordered by Kennziffer. */
export const ALL_ZONES: readonly DrgZone[] = Object.freeze(
  Array.from({ length: MAX_KENNZIFFER + 1 }, (_v, i) => zoneByKennziffer(i)),
);

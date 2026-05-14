/**
 * Geometry of the Heeresmeldenetz hierarchy.
 *
 * From the Planheft Schweiz cross-references + the Hadres / Kolosjoki sheets
 * (which print explicit subdivision diagrams), each DHG zone is tiled with
 * 150 km Großquadrate. A Großquadrat divides 25×25 into 6 km Kleinquadrate
 * (letter pairs `AA..ZZ`, alphabet without `I`). Each Kleinquadrat further
 * divides 3×3 into 2 km Meldetrapeze numbered `1..9` from the NW corner, and
 * each Meldetrapez divides 2×2 into 1 km Arbeitstrapeze labelled `a..d`:
 *
 *   Meldetrapez (2 km)       Arbeitstrapez (1 km, inside each)
 *     1  2  3                  a  b
 *     4  5  6                  c  d
 *     7  8  9
 *
 * Numbering is row-major from the NW corner. The optional 2-digit tenths
 * suffix is `(east, north)` from the **SW corner** of the Arbeitstrapez,
 * giving 100 m × 100 m precision.
 */

/** Großquadrat side length in metres. */
export const GROSSQUADRAT_M = 150_000;

/** Kleinquadrat side length in metres. */
export const KLEINQUADRAT_M = 6_000;

/** Meldetrapez side length in metres. */
export const MELDETRAPEZ_M = 2_000;

/** Arbeitstrapez side length in metres. */
export const ARBEITSTRAPEZ_M = 1_000;

/** Tenths-of-Arbeitstrapez side length: 100 m. */
export const TENTH_M = 100;

/** Kleinquadrate per Großquadrat side (= 25). */
export const KLEIN_PER_GROSS = GROSSQUADRAT_M / KLEINQUADRAT_M;

/** Meldetrapeze per Kleinquadrat side (= 3). */
export const MELDE_PER_KLEIN = KLEINQUADRAT_M / MELDETRAPEZ_M;

/** Arbeitstrapeze per Meldetrapez side (= 2). */
export const ARBEIT_PER_MELDE = MELDETRAPEZ_M / ARBEITSTRAPEZ_M;

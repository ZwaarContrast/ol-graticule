import type { LuftwaffeEra } from './types.js';

/**
 * Subdivision levels of the Gradnetzmeldeverfahren (GNMV).
 *
 *   0 ZZG          (Zusatzzahlgebiet)        10°    × 10°
 *   1 GT           (Großtrapez)               1°    × 1°
 *   2 MT           (Mitteltrapez)            15'    × 30'
 *   3 KT           (Kleintrapez)              5'    × 10'
 *   4 MelT         (Meldetrapez)              1'40" × 3'20"
 *   5 AT           (Arbeitstrapez)         33.33"   × 1'06.67"
 *
 * In the pre-1 May 1943 era, MelT and AT were each 2×2 instead of 3×3, so
 * MelT = 2'30" × 5' and AT = 1'15" × 2'30".
 *
 * The Jägermeldenetz (JMN) shares levels 2..5 with the GNMV; only level 1
 * differs (5° × 10° Jagdtrapez halves of the ZZG, indexed by 20×20 letter
 * pairs at the same 15' × 30' resolution as the GNMV Mitteltrapez).
 *
 * Level dimensions and the pre/post-1943 refinement are documented at
 * prwg.co.uk's Halifax JB837 page (Ron Birch) and aircrewremembered.com's
 * Luftwaffe Grid Reference System article. See the package README for the
 * full credit.
 */
export const ZZG_LAT_DEG = 10;
export const ZZG_LON_DEG = 10;

export const GT_LAT_DEG = 1;
export const GT_LON_DEG = 1;

export const JAGDTRAPEZ_LAT_DEG = 5;

export const MT_LAT_DEG = 15 / 60;
export const MT_LON_DEG = 30 / 60;

export const KT_LAT_DEG = 5 / 60;
export const KT_LON_DEG = 10 / 60;

const MELT_POST: CellDims = { latDeg: (1 + 40 / 60) / 60, lonDeg: (3 + 20 / 60) / 60, rows: 3, cols: 3 };
const MELT_PRE:  CellDims = { latDeg: 2.5 / 60,            lonDeg: 5 / 60,             rows: 2, cols: 2 };
const AT_POST:   CellDims = { latDeg: MELT_POST.latDeg / 3, lonDeg: MELT_POST.lonDeg / 3, rows: 3, cols: 3 };
const AT_PRE:    CellDims = { latDeg: MELT_PRE.latDeg  / 2, lonDeg: MELT_PRE.lonDeg  / 2, rows: 2, cols: 2 };

/** Northern boundary of the topmost ZZG band (89°N). */
export const ZZG_NORTH_LIMIT = 89;
/** Baseline parallel: ZZG bands north of this are 'Ost'/'West', south are 'Südost'/'Südwest'. */
export const ZZG_BASELINE_LAT = -1;

interface CellDims {
  latDeg: number;
  lonDeg: number;
  rows: number;
  cols: number;
}

export function meldetrapezDims(era: LuftwaffeEra): CellDims {
  return era === 'pre-1943' ? MELT_PRE : MELT_POST;
}

export function arbeitstrapezDims(era: LuftwaffeEra): CellDims {
  return era === 'pre-1943' ? AT_PRE : AT_POST;
}

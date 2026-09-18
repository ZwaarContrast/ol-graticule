/**
 * The ol-free surface of this package: MGRS grid reference parsing, formatting,
 * zone and square arithmetic, with no import of `ol` anywhere in the graph.
 * Importable under plain `node`.
 *
 * `MgrsGridSystem` in the package root renders the grid and does need
 * OpenLayers.
 */

export { MgrsIntervals } from './mgrs/intervals.js';

export {
  formatMgrs,
  lonLatToMgrs,
  lonLatToMgrsParts,
  lonLatToUps,
  lonLatToUtm,
  upsToLonLat,
  utmToLonLat,
  mgrsPartsToLonLat,
  parseMgrsRef,
} from './mgrs/conversion.js';
export type {
  MgrsParts,
  MgrsPrecision,
  ParsedMgrs,
} from './mgrs/conversion.js';

export {
  upsColumnLetter,
  upsCrsCode,
  upsIsNorth,
  upsProj4,
  upsRowLetter,
  upsSquareLetters,
  upsZoneLetter,
  upsZoneLonLatBounds,
} from './mgrs/ups.js';

export {
  bandLetterFromLatitude,
  bandLatBounds,
  zoneBandLonBounds,
  zoneNumberFromLonLat,
  utmCrsCode,
  utmProj4,
  BAND_LETTERS,
} from './mgrs/zones.js';

export {
  columnLetter,
  columnSetForZone,
  rowLetter,
  rowOffsetForZone,
  squareLetters,
} from './mgrs/squares.js';

export { iterateVisibleGzds } from './mgrs/gzd.js';
export type { Gzd } from './mgrs/gzd.js';

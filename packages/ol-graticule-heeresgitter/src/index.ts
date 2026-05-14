// DHG (Deutsches Heeresgitter): 6° Gauß-Krüger on the Bessel 1841 ellipsoid.
export { DhgGridSystem } from './grid-systems/DhgGridSystem.js';
export type {
  DhgGridSystemOptions,
  DhgZoneBoundaryMode,
} from './grid-systems/DhgGridSystem.js';

export { encodeDhg, encodeDhgText, formatEasting, formatNorthing } from './dhg/encode.js';
export type { DhgFormatOptions } from './dhg/encode.js';
export { decodeDhg, parseDhg, parseShortDigits } from './dhg/decode.js';
export type { ParsedDhg } from './dhg/decode.js';

export {
  ALL_ZONES,
  cmForKennziffer,
  kennzifferForCm,
  zoneByKennziffer,
  zoneForLon,
  zonesContainingLon,
  STRIP_HALF_WIDTH_DEG,
  STRIP_OVERLAP_DEG,
  FALSE_EASTING,
} from './dhg/zones.js';

export {
  DEFAULT_DATUM_SHIFT,
  dhgCrsCode,
  forward as dhgForward,
  forwardInZone as dhgForwardInZone,
  inverse as dhgInverse,
  registerAllZones,
  registerZone,
  resetDhgDatumShift,
  setDhgDatumShift,
} from './dhg/projection.js';

export type { DatumShift, DhgCoord, DhgZone, LatLon } from './dhg/types.js';

// HMN (Heeresmeldenetz): orange letter-pair overprint built on top of DHG.
export { HmnGridSystem } from './grid-systems/HmnGridSystem.js';
export type { HmnGridSystemOptions } from './grid-systems/HmnGridSystem.js';

export { encodeHmn, decomposeHmn, formatHmn } from './heeresmeldenetz/encode.js';
export { parseHmn } from './heeresmeldenetz/decode.js';
export type { ParseHmnOptions } from './heeresmeldenetz/decode.js';
export { letterFromIndex, letterToIndex, HMN_LETTER_COUNT } from './heeresmeldenetz/letters.js';
export {
  GROSSQUADRAT_M,
  KLEINQUADRAT_M,
  MELDETRAPEZ_M,
  ARBEITSTRAPEZ_M,
  TENTH_M,
  KLEIN_PER_GROSS,
  MELDE_PER_KLEIN,
  ARBEIT_PER_MELDE,
} from './heeresmeldenetz/levels.js';
export type {
  Arbeitstrapez,
  DecodedHmnRef,
  Grossquadrat,
  HmnEncodeOptions,
} from './heeresmeldenetz/types.js';

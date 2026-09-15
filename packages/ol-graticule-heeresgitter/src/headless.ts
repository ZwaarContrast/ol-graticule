/**
 * The ol-free surface of this package: every Deutsches Heeresgitter, Reichs-
 * gitter and Heeresmeldenetz codec, with no import of `ol` anywhere in the
 * graph. Importable under plain `node`, where `ol`'s extensionless subpaths
 * (`ol/Feature`) cannot resolve at all.
 *
 * The grid systems in the package root render these grids on a map and do
 * need OpenLayers. Everything here is pure coordinate maths over proj4.
 */

export {
  encodeDhg,
  encodeDhgText,
  formatEasting,
  formatNorthing,
} from './dhg/encode.js';

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

export {
  encodeDrg,
  encodeDrgText,
  decodeDrg,
  parseDrg,
  formatEasting as formatDrgEasting,
  formatNorthing as formatDrgNorthing,
} from './drg/codec.js';

export type { DrgFormatOptions, ParsedDrg } from './drg/codec.js';

export {
  ALL_ZONES as DRG_ALL_ZONES,
  cmForKennziffer as drgCmForKennziffer,
  kennzifferForCm as drgKennzifferForCm,
  falseEastingFor as drgFalseEastingFor,
  zoneByKennziffer as drgZoneByKennziffer,
  zoneForLon as drgZoneForLon,
  zonesContainingLon as drgZonesContainingLon,
  STRIP_HALF_WIDTH_DEG as DRG_STRIP_HALF_WIDTH_DEG,
  STRIP_OVERLAP_DEG as DRG_STRIP_OVERLAP_DEG,
  ZONE_EASTING_STEP as DRG_ZONE_EASTING_STEP,
  FALSE_EASTING as DRG_FALSE_EASTING,
  MAX_KENNZIFFER as DRG_MAX_KENNZIFFER,
  PUBLISHED_KENNZIFFERN as DRG_PUBLISHED_KENNZIFFERN,
  isPublishedKennziffer as isPublishedDrgKennziffer,
} from './drg/zones.js';

export {
  drgCrsCode,
  forward as drgForward,
  forwardInZone as drgForwardInZone,
  inverse as drgInverse,
  registerAllZones as registerAllDrgZones,
  registerZone as registerDrgZone,
  resetDrgDatumShift,
  setDrgDatumShift,
} from './drg/projection.js';

export type { DrgCoord, DrgZone } from './drg/types.js';

export {
  encodeHmn,
  decomposeHmn,
  formatHmn,
} from './heeresmeldenetz/encode.js';

export { parseHmn } from './heeresmeldenetz/decode.js';

export type { ParseHmnOptions } from './heeresmeldenetz/decode.js';

export {
  letterFromIndex,
  letterToIndex,
  HMN_LETTER_COUNT,
} from './heeresmeldenetz/letters.js';

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

export {
  encodeHmnGeo,
  decomposeHmnGeo,
  formatHmnGeo,
} from './heeresmeldenetz-geographic/encode.js';

export { parseHmnGeo } from './heeresmeldenetz-geographic/decode.js';

export type { ParseHmnGeoOptions } from './heeresmeldenetz-geographic/decode.js';

export { hmnGeoHierarchicalLabel } from './heeresmeldenetz-geographic/formatter.js';

export type { HmnGeoRenderDepth } from './heeresmeldenetz-geographic/formatter.js';

export {
  GROSSTRAPEZ_LON_SEC,
  GROSSTRAPEZ_LAT_SEC,
  KLEINTRAPEZ_LON_SEC,
  KLEINTRAPEZ_LAT_SEC,
  MELDETRAPEZ_LON_SEC,
  MELDETRAPEZ_LAT_SEC,
  ARBEITSTRAPEZ_LON_SEC,
  ARBEITSTRAPEZ_LAT_SEC,
  TENTH_LON_SEC,
  TENTH_LAT_SEC,
  ANCHOR_LAT_SEC,
  ANCHOR_LON_SEC,
  ARCSEC_PER_DEG,
  KLEIN_PER_GROSS as KLEIN_PER_GROSSTRAPEZ,
  MELDE_PER_KLEIN as MELDE_PER_KLEINTRAPEZ,
  ARBEIT_PER_MELDE as ARBEIT_PER_MELDETRAPEZ,
} from './heeresmeldenetz-geographic/levels.js';

export type {
  DecodedHmnGeoRef,
  Grosstrapez,
  HmnGeoEncodeOptions,
} from './heeresmeldenetz-geographic/types.js';

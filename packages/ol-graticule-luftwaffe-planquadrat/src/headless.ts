/**
 * The ol-free surface of this package: Luftwaffe Planquadrat reference parsing
 * and encoding, with no import of `ol` anywhere in the graph. Importable under
 * plain `node`.
 *
 * `LuftwaffeGridSystem` in the package root renders the grid and does need
 * OpenLayers.
 */

export { encodeGnmv, encodeJmn } from './luftwaffe/encode.js';
export { parseRef } from './luftwaffe/decode.js';
export type { ParseResult } from './luftwaffe/decode.js';

export type {
  LatLon,
  LuftwaffeSystem,
  LuftwaffeEra,
  GeoBox,
  DecodedRef,
} from './luftwaffe/types.js';

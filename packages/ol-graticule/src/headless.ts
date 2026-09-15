/**
 * The ol-free subset of this package: parsing, formatting and plane geometry
 * that grid codecs need, with no import of `ol` anywhere in the graph.
 *
 * `ol` names its subpaths without file extensions (`ol/Feature`), which plain
 * Node ESM cannot resolve, so anything reaching `ol` is bundler-only. Import
 * from here to decode and encode grid references under bare `node`.
 */

export { ParseError } from './util/ParseError.js';
export { BoundedCache } from './util/boundedCache.js';
export { normalizeLon } from './util/normalizeLon.js';
export { formatDecimal } from './util/formatNumber.js';
export { parseLinear } from './formatters/MetricFormatter.js';
export { pointInRing, pointInRings } from './clipping/pointInRing.js';
export { signedArea, polygonArea } from './clipping/polygonArea.js';

export type { LabelFormatter, FormattedCoordinate } from './types.js';

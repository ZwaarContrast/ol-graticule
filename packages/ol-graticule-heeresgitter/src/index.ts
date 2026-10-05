// Codecs, all ol-free and separately importable from the `/headless` subpath.
export * from './headless.js';

// DHG (Deutsches Heeresgitter): 6° Gauß-Krüger on the Bessel 1841 ellipsoid.
export { DhgGridSystem } from './grid-systems/DhgGridSystem.js';

export type {
  DhgGridSystemOptions,
  DhgZoneBoundaryMode,
} from './grid-systems/DhgGridSystem.js';

// Gauß-Krüger 3°-Streifen: the Reich sheet grid that preceded the 6° DHG.
export { DrgGridSystem } from './grid-systems/DrgGridSystem.js';

export type {
  DrgGridSystemOptions,
  DrgZoneBoundaryMode,
} from './grid-systems/DrgGridSystem.js';

// HMN (Heeresmeldenetz): orange letter-pair overprint built on top of DHG.
export { HmnGridSystem } from './grid-systems/HmnGridSystem.js';

export type { HmnGridSystemOptions } from './grid-systems/HmnGridSystem.js';

// Geographic HMN: the lat/lon-bounded variant of the Heeresmeldenetz,
// identified on a sheet by a `Heeresmeldenetz (geogr.)` header. Distinct
// grid system from the planar one above; cells are 6' lon × 4' lat instead
// of 6 km × 6 km.
export { GeographicHmnGridSystem } from './grid-systems/GeographicHmnGridSystem.js';

export type { GeographicHmnGridSystemOptions } from './grid-systems/GeographicHmnGridSystem.js';

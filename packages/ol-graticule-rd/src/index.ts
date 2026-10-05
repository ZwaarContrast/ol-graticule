// Constants and proj4 wiring: all ol-free and separately importable from the
// `/headless` subpath.
export * from './headless.js';

export { createRDNewGridSystem } from './grids/RDNew.grid.js';
export type { RDNewGridSystemOptions } from './grids/RDNew.grid.js';

export { createRDOldGridSystem } from './grids/RDOld.grid.js';
export type { RDOldGridSystemOptions } from './grids/RDOld.grid.js';

export type { RDGridSystemOptions } from './grids/shared.js';

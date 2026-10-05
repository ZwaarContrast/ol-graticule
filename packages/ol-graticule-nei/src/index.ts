// Constants and validity rings: all ol-free and separately importable from the
// `/headless` subpath.
export * from './headless.js';

export {
  createNEISouthernZoneGridSystem,
  createNEIEquatorialZoneGridSystem,
  NEI_GRIDS,
} from './grids.js';
export type { NEIGrid, NEIGridSystemOptions } from './grids.js';

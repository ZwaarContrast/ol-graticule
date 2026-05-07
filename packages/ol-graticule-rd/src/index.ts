export {
  createRDNewGridSystem,
  RD_NEW_CRS,
  RD_NEW_PROJ4,
  RD_NEW_EXTENT,
  RD_NEW_CLIP_POLYGON,
} from './grids/RDNew.js';
export type { RDNewGridSystemOptions } from './grids/RDNew.js';

export {
  createRDOldGridSystem,
  RD_OLD_CRS,
  RD_OLD_PROJ4,
  RD_OLD_EXTENT,
  RD_OLD_CLIP_POLYGON,
} from './grids/RDOld.js';
export type { RDOldGridSystemOptions } from './grids/RDOld.js';

export type { RDGridSystemOptions } from './grids/shared.js';

export {
  registerRDNAPTRANS2018,
  RDNAPTRANS2018_GRID_NAME,
} from './rdnaptrans.js';

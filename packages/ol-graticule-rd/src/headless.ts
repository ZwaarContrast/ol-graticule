/**
 * The ol-free surface of this package: the RD New and RD Old CRS codes, proj4
 * definitions, extents and area-of-use polygons, plus RDNAPTRANS 2018 grid
 * registration, with no import of `ol` anywhere in the graph. Importable under
 * plain `node`.
 *
 * The grid-system factories in the package root render these grids and do need
 * OpenLayers.
 */

export {
  RD_NEW_CRS,
  RD_NEW_PROJ4,
  RD_NEW_EXTENT,
  RD_NEW_CLIP_POLYGON,
} from './grids/RDNew.js';

export {
  RD_OLD_CRS,
  RD_OLD_PROJ4,
  RD_OLD_EXTENT,
  RD_OLD_CLIP_POLYGON,
} from './grids/RDOld.js';

export { buildRDProj4 } from './grids/proj4.js';

export {
  registerRDNAPTRANS2018,
  RDNAPTRANS2018_GRID_NAME,
} from './rdnaptrans.js';

/**
 * The ol-free surface of this package: the yard grid's CRS code, proj4
 * definition, validity rings and label formatter, with no import of `ol`
 * anywhere in the graph. Importable under plain `node`.
 */

export {
  BRITISH_YARD_M,
  OS_YARD_GRID_CRS,
  OS_YARD_GRID_PROJ4,
  OS_YARD_GRID_VALIDITY,
  OS_YARD_GRID_VALIDITY_WGS84,
} from './yardGrid.js';
export { YardFormatter } from './YardFormatter.js';

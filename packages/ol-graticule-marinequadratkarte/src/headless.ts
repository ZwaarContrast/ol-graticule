/**
 * The ol-free surface of this package: Kriegsmarine Marinequadratkarte grid
 * reference parsing, formatting and square lookup, with no import of `ol`
 * anywhere in the graph. Importable under plain `node`.
 *
 * `KriegsmarineGridSystem` in the package root renders the grid and does need
 * OpenLayers.
 */

export {
  coordinateToGridRef,
  formatGridRef,
  parseGridRef,
  gridRefToCoordinate,
} from './kriegsmarine/format.js';

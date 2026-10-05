/**
 * The ol-free subset of this package: proj4 CRS registration with no import
 * of `ol` anywhere in the graph, for codecs that run under plain Node.
 *
 * Registering here does *not* tell OpenLayers about the CRS. Rendering paths
 * want `registerCRS` from the package root instead.
 */

export { registerProj4 } from './registerProj4.js';

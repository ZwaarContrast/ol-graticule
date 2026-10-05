import proj4 from 'proj4';

/**
 * Track which `(code, proj4Def)` pairs we've already processed so repeat
 * calls in the same process become no-ops. We key on both the EPSG code and
 * the proj4 string, if the caller passes a *different* definition for the
 * same code later, we update the registry rather than silently keeping the
 * old one.
 */
const registered = new Map<string, string>();

/**
 * Register a CRS with proj4 alone, without touching OpenLayers' projection
 * registry. Returns `true` when the registry changed.
 *
 * This is the ol-free half of {@link registerCRS}. Grid *codecs* resolve
 * their CRS through `proj4(code, ...)` directly and need nothing more, which
 * is what lets them run under plain Node. Anything that hands the code to
 * OpenLayers (`transform`, `getTransform`, a grid system) needs `registerCRS`
 * or a later `syncOlProjections()` so OL learns the same definition.
 */
export function registerProj4(code: string, proj4Def: string): boolean {
  if (registered.get(code) === proj4Def) return false;
  proj4.defs(code, proj4Def);
  registered.set(code, proj4Def);
  return true;
}

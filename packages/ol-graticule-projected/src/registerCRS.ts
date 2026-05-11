import proj4 from 'proj4';
import { register } from 'ol/proj/proj4';

/**
 * Track which `(code, proj4Def)` pairs we've already processed so repeat
 * `registerCRS` calls in the same process become no-ops. We key on both
 * the EPSG code and the proj4 string, if the caller passes a *different*
 * definition for the same code later, we update the registry rather than
 * silently keeping the old one.
 */
const registered = new Map<string, string>();

/**
 * Register a CRS with proj4 and OpenLayers so grid systems that reference
 * it by EPSG code (or any proj4-supported name) can resolve it.
 *
 * Call this once at application startup, before constructing any grid
 * system that names the CRS. Idempotent: calling twice with the same
 * `(code, proj4Def)` pair does nothing on the second call.
 *
 * ```ts
 * registerCRS(
 *   'EPSG:28992',
 *   '+proj=sterea +lat_0=52.156... +units=m +no_defs',
 * );
 * const grid = new ProjectedGridSystem({ crs: 'EPSG:28992' });
 * ```
 *
 * Built-in CRSs (`EPSG:4326`, `EPSG:3857`) don't need registration, OL
 * ships with them. `ProjectedGridSystem` will throw a clear error if it
 * encounters an unknown CRS, so missing `registerCRS` calls surface
 * immediately.
 */
export function registerCRS(code: string, proj4Def: string): void {
  if (registered.get(code) === proj4Def) return;
  proj4.defs(code, proj4Def);
  register(proj4);
  registered.set(code, proj4Def);
}

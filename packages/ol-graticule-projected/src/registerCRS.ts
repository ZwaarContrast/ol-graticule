import proj4 from 'proj4';
import { register } from 'ol/proj/proj4';

import { registerProj4 } from './registerProj4.js';

/**
 * Push proj4's current definitions into OpenLayers' projection registry.
 *
 * Call this after `registerProj4` when the code will reach OpenLayers, for
 * instance a grid system that resolves it through `ol/proj`. Cheap to repeat,
 * but it must run *after* the definitions it should pick up.
 */
export function syncOlProjections(): void {
  register(proj4);
}

/** Codes OpenLayers has been told about, so a repeat `registerCRS` is a no-op. */
const olKnows = new Set<string>();

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
 *
 * Decoding a grid reference under plain Node wants `registerProj4` from
 * `@zwaarcontrast/ol-graticule-projected/headless`, which skips the OL half.
 */
export function registerCRS(code: string, proj4Def: string): void {
  const definitionChanged = registerProj4(code, proj4Def);
  // `registerProj4` reports no change for a code it already holds, including
  // one registered through the headless path, which OpenLayers has never been
  // told about. Sync unless this code has reached OL before.
  if (!definitionChanged && olKnows.has(code)) return;
  syncOlProjections();
  olKnows.add(code);
}

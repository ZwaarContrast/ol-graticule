/**
 * Shared by the two Gauß-Krüger strip systems in this package, the 6° DHG and
 * the 3° DRG: the Potsdam datum default, the CRS-code suffix that keeps grid
 * instances configured with different shifts apart in the proj4 registry, and
 * register-once CRS registration.
 */

import { registerCRS } from '@zwaarcontrast/ol-graticule-projected';

import type { DatumShift } from './dhg/types.js';

/**
 * Default WGS 84 to Bessel Potsdam Helmert parameters (BKG / EPSG:1777
 * "Deutsches Hauptdreiecksnetz to WGS 84 (3)"). Accurate to ~5 m globally.
 */
export const DEFAULT_DATUM_SHIFT: DatumShift = {
  translation: [598.1, 73.7, 418.2],
  rotation: [0.202, 0.045, -2.455],
  scale: 6.7,
};

/** CRS-code suffix identifying a non-default shift. Empty for the default. */
export function datumShiftKey(shift: DatumShift): string {
  if (shift === DEFAULT_DATUM_SHIFT) return '';
  const [tx, ty, tz] = shift.translation;
  const [rx, ry, rz] = shift.rotation;
  return `:${tx}_${ty}_${tz}_${rx}_${ry}_${rz}_${shift.scale}`;
}

const registeredCodes = new Set<string>();

/**
 * Register `code` with proj4 and OpenLayers on first use, returning `code`.
 * `buildDef` runs only when the code is not yet registered, so callers can
 * hand over a proj4 string that is expensive to assemble.
 */
export function registerZoneCrs(code: string, buildDef: () => string): string {
  if (registeredCodes.has(code)) return code;
  registerCRS(code, buildDef());
  registeredCodes.add(code);
  return code;
}

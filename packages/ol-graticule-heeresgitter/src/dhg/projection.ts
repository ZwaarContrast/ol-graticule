/**
 * proj4 wiring for the 60 DHG zones (Bessel 1841 ellipsoid, Potsdam datum,
 * 6° wide Gauß-Krüger strips, scale 1.0, false easting 500 000 m).
 *
 * Each zone is registered under a CRS code that encodes its Helmert datum
 * shift, so multiple grid instances configured with different shifts can
 * coexist without overwriting one another's proj4 definitions.
 */

import proj4 from 'proj4';
import { registerCRS } from '@zwaarcontrast/ol-graticule-projected';

import type { DatumShift, DhgCoord, DhgZone, LatLon } from './types.js';
import { ALL_ZONES, zoneByKennziffer, zoneForLon } from './zones.js';

/**
 * Default WGS 84 to Bessel Potsdam Helmert parameters (BKG / EPSG:1777
 * "Deutsches Hauptdreiecksnetz to WGS 84 (3)"). Accurate to ~5 m globally.
 */
export const DEFAULT_DATUM_SHIFT: DatumShift = {
  translation: [598.1, 73.7, 418.2],
  rotation: [0.202, 0.045, -2.455],
  scale: 6.7,
};

let activeDatumShift: DatumShift = DEFAULT_DATUM_SHIFT;
const registeredCodes = new Set<string>();

function shiftKey(shift: DatumShift): string {
  if (shift === DEFAULT_DATUM_SHIFT) return '';
  const [tx, ty, tz] = shift.translation;
  const [rx, ry, rz] = shift.rotation;
  return `:${tx}_${ty}_${tz}_${rx}_${ry}_${rz}_${shift.scale}`;
}

/** EPSG-like code identifying a DHG zone for a given datum shift in the proj4 registry. */
export function dhgCrsCode(kennziffer: number, shift: DatumShift = activeDatumShift): string {
  return `DHG:Z${String(kennziffer).padStart(2, '0')}${shiftKey(shift)}`;
}

function proj4DefFor(zone: DhgZone, shift: DatumShift): string {
  const [tx, ty, tz] = shift.translation;
  const [rx, ry, rz] = shift.rotation;
  return [
    '+proj=tmerc',
    '+lat_0=0',
    `+lon_0=${zone.cm}`,
    '+k=1',
    '+x_0=500000',
    '+y_0=0',
    '+ellps=bessel',
    `+towgs84=${tx},${ty},${tz},${rx},${ry},${rz},${shift.scale}`,
    '+units=m',
    '+no_defs',
  ].join(' ');
}

/**
 * Set the default WGS 84 to Bessel Potsdam datum shift used by procedural
 * `forward` / `inverse` calls that don't pass an explicit shift. Existing
 * grid instances that captured a shift at construction are unaffected.
 */
export function setDhgDatumShift(shift: DatumShift): void {
  activeDatumShift = shift;
}

/** Restore the default datum shift. */
export function resetDhgDatumShift(): void {
  activeDatumShift = DEFAULT_DATUM_SHIFT;
}

/** Register a zone's CRS with proj4 and OpenLayers under the shift-specific code. Idempotent. */
export function registerZone(zone: DhgZone, shift: DatumShift = activeDatumShift): string {
  const code = dhgCrsCode(zone.kennziffer, shift);
  if (registeredCodes.has(code)) return code;
  registerCRS(code, proj4DefFor(zone, shift));
  registeredCodes.add(code);
  return code;
}

/** Register every DHG zone under the given shift (defaults to the active shift). */
export function registerAllZones(shift: DatumShift = activeDatumShift): void {
  for (const zone of ALL_ZONES) registerZone(zone, shift);
}

/** Forward project a WGS 84 `(lat, lon)` to DHG `(easting, northing)` in the strip whose CM is nearest `lon`. */
export function forward(point: LatLon, shift: DatumShift = activeDatumShift): DhgCoord {
  const zone = zoneForLon(point[1]);
  return forwardInZone(point, zone.kennziffer, shift);
}

/** Forward project into a specific zone. */
export function forwardInZone(
  point: LatLon,
  kennziffer: number,
  shift: DatumShift = activeDatumShift,
): DhgCoord {
  const zone = zoneByKennziffer(kennziffer);
  const code = registerZone(zone, shift);
  const [lat, lon] = point;
  const [easting, northing] = proj4('EPSG:4326', code, [lon, lat]) as [number, number];
  return {
    kennziffer: zone.kennziffer,
    easting,
    northing,
  };
}

/** Inverse project DHG `(easting, northing)` in a given zone to WGS 84 `(lat, lon)`. */
export function inverse(coord: DhgCoord, shift: DatumShift = activeDatumShift): LatLon {
  const zone = zoneByKennziffer(coord.kennziffer);
  const code = registerZone(zone, shift);
  const [lon, lat] = proj4(code, 'EPSG:4326', [coord.easting, coord.northing]) as [number, number];
  return [lat, lon];
}

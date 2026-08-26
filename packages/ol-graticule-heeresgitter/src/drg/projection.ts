/**
 * proj4 wiring for the Gauß-Krüger 3° strips (Bessel 1841 ellipsoid, Potsdam
 * datum, scale 1.0, Kennziffer-prefixed false easting).
 *
 * Strips 2..5 are the German ones and match EPSG:31466..31469; the same
 * definition generalises to every Kennziffer.
 */

import proj4 from 'proj4';

import { DEFAULT_DATUM_SHIFT, datumShiftKey, registerZoneCrs } from '../gaussKrueger.js';
import type { DatumShift, DrgCoord, DrgZone, LatLon } from './types.js';
import { ALL_ZONES, zoneByKennziffer, zoneForLon } from './zones.js';

export { DEFAULT_DATUM_SHIFT };

let activeDatumShift: DatumShift = DEFAULT_DATUM_SHIFT;

/** CRS code identifying a 3° strip for a given datum shift in the proj4 registry. */
export function drgCrsCode(kennziffer: number, shift: DatumShift = activeDatumShift): string {
  return `DRG:Z${String(kennziffer).padStart(2, '0')}${datumShiftKey(shift)}`;
}

function proj4DefFor(zone: DrgZone, shift: DatumShift): string {
  const [tx, ty, tz] = shift.translation;
  const [rx, ry, rz] = shift.rotation;
  return [
    '+proj=tmerc',
    '+lat_0=0',
    `+lon_0=${zone.cm}`,
    '+k=1',
    `+x_0=${zone.falseEasting}`,
    '+y_0=0',
    '+ellps=bessel',
    `+towgs84=${tx},${ty},${tz},${rx},${ry},${rz},${shift.scale}`,
    '+units=m',
    '+no_defs',
  ].join(' ');
}

/** Set the datum shift used by procedural calls that don't pass an explicit one. */
export function setDrgDatumShift(shift: DatumShift): void {
  activeDatumShift = shift;
}

/** Restore the default datum shift. */
export function resetDrgDatumShift(): void {
  activeDatumShift = DEFAULT_DATUM_SHIFT;
}

/** Register a strip's CRS with proj4 and OpenLayers. Idempotent. */
export function registerZone(zone: DrgZone, shift: DatumShift = activeDatumShift): string {
  return registerZoneCrs(drgCrsCode(zone.kennziffer, shift), () => proj4DefFor(zone, shift));
}

/** Register every supported strip under the given shift. */
export function registerAllZones(shift: DatumShift = activeDatumShift): void {
  for (const zone of ALL_ZONES) registerZone(zone, shift);
}

/** Forward project WGS 84 `(lat, lon)` into the strip whose CM is nearest `lon`. */
export function forward(point: LatLon, shift: DatumShift = activeDatumShift): DrgCoord {
  return forwardInZone(point, zoneForLon(point[1]).kennziffer, shift);
}

/** Forward project into a specific strip. */
export function forwardInZone(
  point: LatLon,
  kennziffer: number,
  shift: DatumShift = activeDatumShift,
): DrgCoord {
  const zone = zoneByKennziffer(kennziffer);
  const code = registerZone(zone, shift);
  const [lat, lon] = point;
  const [easting, northing] = proj4('EPSG:4326', code, [lon, lat]);
  return { kennziffer: zone.kennziffer, easting, northing };
}

/** Inverse project a `DrgCoord` back to WGS 84 `(lat, lon)`. */
export function inverse(coord: DrgCoord, shift: DatumShift = activeDatumShift): LatLon {
  const zone = zoneByKennziffer(coord.kennziffer);
  const code = registerZone(zone, shift);
  const [lon, lat] = proj4(code, 'EPSG:4326', [coord.easting, coord.northing]);
  return [lat, lon];
}

/** UPS (Universal Polar Stereographic) MGRS support for lat >= 84 and lat < -80. */

/** Letter for the polar UPS zone covering `(lon, lat)`, or `undefined` outside polar coverage. */
export function upsZoneLetter(lon: number, lat: number): 'Y' | 'Z' | 'A' | 'B' | undefined {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return undefined;
  if (lat >= 84) return lon < 0 ? 'Y' : 'Z';
  if (lat < -80) return lon < 0 ? 'A' : 'B';
  return undefined;
}

/** Whether `lat` falls in the UPS-N (`true`) or UPS-S (`false`) cap, or `undefined`. */
export function upsIsNorth(lat: number): boolean | undefined {
  if (lat >= 84) return true;
  if (lat < -80) return false;
  return undefined;
}

/** proj4 definition for UPS-North (`true`) or UPS-South (`false`). */
export function upsProj4(north: boolean): string {
  const lat0 = north ? 90 : -90;
  return `+proj=stere +lat_0=${lat0} +lat_ts=${lat0} +lon_0=0 +k=0.994 +x_0=2000000 +y_0=2000000 +datum=WGS84 +units=m +no_defs +type=crs`;
}

/** EPSG-ish code: `EPSG:5041` (north) or `EPSG:5042` (south). */
export function upsCrsCode(north: boolean): string {
  return north ? 'EPSG:5041' : 'EPSG:5042';
}

const UPS_COLS = {
  Y: { offset: 13, letters: 'RSTUXYZ' },
  Z: { offset: 20, letters: 'ABCFGHJ' },
  A: { offset:  8, letters: 'JKLPQRSTUXYZ' },
  B: { offset: 20, letters: 'ABCFGHJKLPQR' },
} as const;

const UPS_ROWS = {
  N: { offset: 13, letters: 'ABCDEFGHJKLMNP' },
  S: { offset:  8, letters: 'ABCDEFGHJKLMNPQRSTUVWXYZ' },
} as const;

/** Column letter for an easting `E` (metres) in UPS `zone`. */
export function upsColumnLetter(
  zone: 'Y' | 'Z' | 'A' | 'B',
  easting: number,
): string | undefined {
  const xh = Math.floor(easting / 100_000);
  const tab = UPS_COLS[zone];
  const idx = xh - tab.offset;
  if (idx < 0 || idx >= tab.letters.length) return undefined;
  return tab.letters[idx];
}

/** Row letter for a northing `N` (metres) in UPS `zone`. */
export function upsRowLetter(
  zone: 'Y' | 'Z' | 'A' | 'B',
  northing: number,
): string | undefined {
  const yh = Math.floor(northing / 100_000);
  const tab = (zone === 'Y' || zone === 'Z') ? UPS_ROWS.N : UPS_ROWS.S;
  const idx = yh - tab.offset;
  if (idx < 0 || idx >= tab.letters.length) return undefined;
  return tab.letters[idx];
}

/** Two-letter UPS square id for `(easting, northing)` in `zone`. */
export function upsSquareLetters(
  zone: 'Y' | 'Z' | 'A' | 'B',
  easting: number,
  northing: number,
): string | undefined {
  const col = upsColumnLetter(zone, easting);
  if (col === undefined) return undefined;
  const row = upsRowLetter(zone, northing);
  if (row === undefined) return undefined;
  return col + row;
}

/** Lat/lon range of a UPS zone's geographic footprint. */
export function upsZoneLonLatBounds(
  zone: 'Y' | 'Z' | 'A' | 'B',
): { lon: readonly [number, number]; lat: readonly [number, number] } {
  switch (zone) {
    case 'Y': return { lon: [-180, 0], lat: [84, 90] };
    case 'Z': return { lon: [0, 180], lat: [84, 90] };
    case 'A': return { lon: [-180, 0], lat: [-90, -80] };
    case 'B': return { lon: [0, 180], lat: [-90, -80] };
  }
}

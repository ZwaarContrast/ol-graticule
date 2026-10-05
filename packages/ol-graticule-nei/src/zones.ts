import proj4 from 'proj4';

type Ring = ReadonlyArray<readonly [number, number]>;

/**
 * Batavia datum (Bessel 1841) to WGS84, EPSG:8452 "Batavia to WGS 84 (1)":
 * geocentric translations, 6 m accuracy. Same values as the deprecated
 * EPSG:1123 it replaces.
 */
const BATAVIA_TOWGS84 = '+towgs84=-377,681,-50,0,0,0,0';

/**
 * NEI Southern Zone Grid (Java and the Lesser Sundas). Lambert Conformal Conic
 * with one standard parallel, origin 8°S / 110°E Greenwich, scale factor
 * 0.9997, false origin (550 000 m E, 400 000 m N), Bessel 1841 on the Batavia
 * datum. Not in EPSG.
 *
 * Source: C. J. Mugnier, "Grids & Datums: Netherlands East Indies", citing US
 * Army Map Service "Notes on East Indies Maps", Theater Area T, March 1945.
 * Checked against the Batavia Military Guide Map 1:20 000 (HIND/SEA/B/951,
 * Dec 1945), whose 195 to 206 km E × 595 to 609 km N frame lands on Jakarta.
 *
 * Early-1942 British DSvy Java sheets print this grid with +3 000 000 E and
 * +1 000 000 N; that variant is not registered.
 */
export const NEI_SOUTHERN_ZONE_CRS = 'NEI:SOUTHERN_ZONE';

export const NEI_SOUTHERN_ZONE_PROJ4 =
  '+proj=lcc +lat_1=-8 +lat_0=-8 +lon_0=110 +k_0=0.9997 ' +
  `+x_0=550000 +y_0=400000 +ellps=bessel ${BATAVIA_TOWGS84} ` +
  '+units=m +no_defs +type=crs';

/**
 * NEI Equatorial Zone Grid, EPSG:3001 "Batavia / NEIEZ": Mercator (1SP),
 * lon_0 110°E, scale factor 0.997, false origin (3 900 000 m E, 900 000 m N),
 * Bessel 1841 on the Batavia datum.
 */
export const NEI_EQUATORIAL_ZONE_CRS = 'EPSG:3001';

export const NEI_EQUATORIAL_ZONE_PROJ4 =
  '+proj=merc +lon_0=110 +k=0.997 +x_0=3900000 +y_0=900000 ' +
  `+ellps=bessel ${BATAVIA_TOWGS84} +units=m +no_defs +type=crs`;

const DEG_7_S_104_30_E: readonly [number, number] = [104.5, -7];
const DEG_5_S_107_E: readonly [number, number] = [107, -5];

// ponytail: rhumb lines are straight in lon/lat; over these 2 to 5° spans the
// difference from a true loxodrome is far below the zone limits' precision.
function onRhumb7S1045To5S107(lon: number): number {
  const [lon0, lat0] = DEG_7_S_104_30_E;
  const [lon1, lat1] = DEG_5_S_107_E;
  return lat0 + ((lon - lon0) * (lat1 - lat0)) / (lon1 - lon0);
}

const southernToWgs84 = proj4(
  NEI_SOUTHERN_ZONE_PROJ4,
  '+proj=longlat +datum=WGS84 +no_defs',
);

function zeroEastingPoint(northing: number): [number, number] {
  const [lon, lat] = southernToWgs84.forward([0, northing]);
  return [lon ?? 0, lat ?? 0];
}

/** Northing on the zero-easting line at which it crosses `lat`, by bisection. */
function zeroEastingNorthingWhere(
  above: (point: [number, number]) => boolean,
): number {
  let lo = -500_000;
  let hi = 1_000_000;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (above(zeroEastingPoint(mid))) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

const ZERO_EASTING_TOP = zeroEastingNorthingWhere(
  ([lon, lat]) => lat > onRhumb7S1045To5S107(lon),
);
const ZERO_EASTING_AT_11_S = zeroEastingNorthingWhere(([, lat]) => lat > -11);
const ZERO_EASTING_SAMPLES = 16;

/** The Southern Zone's western limit, the zero-easting line, from 11°S north. */
const ZERO_EASTING_LINE: Ring = Array.from(
  { length: ZERO_EASTING_SAMPLES + 1 },
  (_, i) =>
    zeroEastingPoint(
      ZERO_EASTING_AT_11_S +
        ((ZERO_EASTING_TOP - ZERO_EASTING_AT_11_S) * i) / ZERO_EASTING_SAMPLES,
    ),
);

/**
 * Southern Zone limits per Mugnier, as a WGS84 lon/lat ring (open). North:
 * rhumb line 7°S 104°30'E to 5°S 107°E, then 5°S to 117°30'E, south to 7°S,
 * 7°S to 137°E. East: 137°E. South: 11°S west to 125°E, south to 12°S, 12°S
 * west to 120°E, north to 11°S, 11°S west to the zero-easting line. West: the
 * zero-easting line.
 */
export const NEI_SOUTHERN_ZONE_VALIDITY_WGS84: Ring = [
  ...ZERO_EASTING_LINE,
  DEG_5_S_107_E,
  [117.5, -5],
  [117.5, -7],
  [137, -7],
  [137, -11],
  [125, -11],
  [125, -12],
  [120, -12],
  [120, -11],
];

/** Approximate western limit of the Equatorial Zone; the source leaves it open. */
const EQUATORIAL_WEST_LON = 94;

/**
 * Equatorial Zone limits per Mugnier, as a WGS84 lon/lat ring (open). North:
 * 7°N to 98°40'E, south to 4°40'N, rhumb line to 0°30'N 103°50'E, 0°30'N to
 * 105°E, north to 7°N, 7°N to 119°30'E, south to 5°N, 5°N to 165°E. East:
 * 165°E. South: 5°S west to 153°30'E, south to 7°S, 7°S west to 117°30'E,
 * north to 5°S, 5°S west to 107°E, rhumb line to 7°S 104°30'E.
 *
 * The source leaves the west open; 94°E along 7°S and 7°N closes it past
 * Sumatra's coast. Unlike EPSG:3001's area of use this excludes Java, which
 * the Southern Zone covers.
 */
export const NEI_EQUATORIAL_ZONE_VALIDITY_WGS84: Ring = [
  [EQUATORIAL_WEST_LON, 7],
  [98 + 40 / 60, 7],
  [98 + 40 / 60, 4 + 40 / 60],
  [103 + 50 / 60, 0.5],
  [105, 0.5],
  [105, 7],
  [119.5, 7],
  [119.5, 5],
  [165, 5],
  [165, -5],
  [153.5, -5],
  [153.5, -7],
  [117.5, -7],
  [117.5, -5],
  DEG_5_S_107_E,
  DEG_7_S_104_30_E,
  [EQUATORIAL_WEST_LON, -7],
];

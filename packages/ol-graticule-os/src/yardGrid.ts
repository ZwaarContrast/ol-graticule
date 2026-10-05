import proj4 from 'proj4';

type Ring = ReadonlyArray<readonly [number, number]>;

/** The British yard, in metres. */
export const BRITISH_YARD_M = 0.9143984;

/**
 * The Ordnance Survey yard grid of the 1930s: transverse Mercator from a true
 * origin at 49°N 2°W on the Airy ellipsoid, the scale reduced by one part in
 * 2500 on the central meridian, and a false origin 1 000 000 yards west and
 * 1 000 000 yards south of the true origin. Printed on the One-inch Fifth
 * Edition (1931), the ten-mile maps (1932) and the Quarter-inch Fourth Edition
 * (1934), whose sheet lines it laid out.
 *
 * Sources: R. Oliver, "The evolution of the Ordnance Survey National Grid",
 * Sheetlines 43 (1995) 25-46, p. 36 (origin, scale factor); the OS sheet
 * instructions quoted by R. Hellyer, "The first National Grid map?",
 * Sheetlines 55 (1999) 31-34 (false origin).
 *
 * The shift to WGS84 is the OSGB36 one (EPSG:1314). The grid predates OSGB36,
 * so on the ground it inherits the older triangulation's offsets.
 */
export const OS_YARD_GRID_CRS = 'OS:YARD_GRID';

export const OS_YARD_GRID_PROJ4 =
  '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996 ' +
  `+x_0=${1_000_000 * BRITISH_YARD_M} +y_0=${1_000_000 * BRITISH_YARD_M} ` +
  '+ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 ' +
  `+to_meter=${BRITISH_YARD_M} +no_defs +type=crs`;

/**
 * Where the grid was printed, in its own yards (open ring): the union of the
 * Quarter-inch Fourth Edition sheet faces (NLS footprints of the 1934-39
 * coloured edition), Great Britain with Orkney and Shetland. Hellyer
 * (Sheetlines 55) records the grid calculated "to the very north of the
 * Shetland Islands" with Ireland omitted.
 */
export const OS_YARD_GRID_VALIDITY: Ring = [
  [620_000, 1_960_000],
  [680_000, 1_960_000],
  [680_000, 1_800_000],
  [730_000, 1_800_000],
  [730_000, 1_690_000],
  [850_000, 1_690_000],
  [850_000, 1_560_000],
  [790_000, 1_560_000],
  [790_000, 1_440_000],
  [740_000, 1_440_000],
  [740_000, 1_280_000],
  [710_000, 1_280_000],
  [710_000, 1_120_000],
  [900_000, 1_120_000],
  [900_000, 1_180_000],
  [1_090_000, 1_180_000],
  [1_090_000, 1_210_000],
  [1_270_000, 1_210_000],
  [1_270_000, 1_300_000],
  [1_280_000, 1_300_000],
  [1_280_000, 1_490_000],
  [1_180_000, 1_490_000],
  [1_180_000, 1_590_000],
  [1_160_000, 1_590_000],
  [1_160_000, 1_690_000],
  [1_060_000, 1_690_000],
  [1_060_000, 1_830_000],
  [1_000_000, 1_830_000],
  [1_000_000, 1_910_000],
  [1_020_000, 1_910_000],
  [1_020_000, 2_070_000],
  [940_000, 2_070_000],
  [940_000, 2_145_000],
  [1_030_000, 2_145_000],
  [1_030_000, 2_275_000],
  [1_080_000, 2_275_000],
  [1_080_000, 2_445_000],
  [990_000, 2_445_000],
  [990_000, 2_285_000],
  [900_000, 2_285_000],
  [900_000, 2_180_000],
  [740_000, 2_180_000],
  [740_000, 2_170_000],
  [620_000, 2_170_000],
];

const EDGE_STEP_YD = 10_000;

const toWgs84 = proj4(
  OS_YARD_GRID_PROJ4,
  '+proj=longlat +datum=WGS84 +no_defs',
);

/** {@link OS_YARD_GRID_VALIDITY} as a WGS84 lon/lat ring, densified every 10 000 yards. */
export const OS_YARD_GRID_VALIDITY_WGS84: Ring = OS_YARD_GRID_VALIDITY.flatMap(
  (from, i) => {
    const to =
      OS_YARD_GRID_VALIDITY[(i + 1) % OS_YARD_GRID_VALIDITY.length] ?? from;
    const steps = Math.max(
      1,
      Math.round(Math.hypot(to[0] - from[0], to[1] - from[1]) / EDGE_STEP_YD),
    );
    return Array.from({ length: steps }, (_, k): [number, number] => {
      const [lon, lat] = toWgs84.forward([
        from[0] + ((to[0] - from[0]) * k) / steps,
        from[1] + ((to[1] - from[1]) * k) / steps,
      ]);
      return [lon ?? 0, lat ?? 0];
    });
  },
);

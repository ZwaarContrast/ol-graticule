type Ring = ReadonlyArray<readonly [number, number]>;

/**
 * Modified Bessel ellipsoid of the Norwegian triangulation (EPSG:7005 "Bessel
 * Modified") and EPSG:1654 "NGO 1948 to WGS 84 (1)", a position-vector
 * shift accurate to 3 m. The sheets name neither; the ellipsoid fits their
 * printed corners to within 25 m.
 */
const NGO_DATUM =
  '+a=6377492.018 +rf=299.1528128 ' +
  '+towgs84=278.3,93,474.5,7.889,0.05,-6.61,6.21';

/** Roman numeral of a strip ("norweg. Gitterstreifen"). */
export type NGOStripNumber =
  'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | 'VII' | 'VIII';

/** One strip as German 1:50 000 sheets of Norway print it. */
export interface NGOStripDefinition {
  readonly strip: NGOStripNumber;
  readonly crs: string;
  /** Central meridian east of the Oslo meridian, in degrees. */
  readonly centralMeridianFromOslo: number;
  readonly originLatitude: number;
  readonly falseEasting: number;
  readonly falseNorthing: number;
  readonly proj4: string;
  /** EPSG area of use of the strip's zone. */
  readonly validityWgs84: Ring;
  /**
   * Where German sheets print the strip: {@link validityWgs84}, widened where
   * a sheet carries the strip past the EPSG boundary.
   */
  readonly printedValidityWgs84: Ring;
}

/** Oslo meridian, 10°43'22.5" E of Greenwich (EPSG:8913). */
const OSLO_LON = 10 + 43 / 60 + 22.5 / 3600;

/** Central meridians of all eight strips, east of Oslo (EPSG:27391-27398). */
const CENTRAL_MERIDIANS: Readonly<Record<string, number>> = {
  I: -(4 + 40 / 60),
  II: -(2 + 20 / 60),
  III: 0,
  IV: 2.5,
  V: 6 + 10 / 60,
  VI: 10 + 10 / 60,
  VII: 14 + 10 / 60,
  VIII: 18 + 20 / 60,
};
const ORDER = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

/** South and north of each EPSG area of use (extents 1741-1748), WGS84 degrees. */
const LATITUDE_RANGE: Readonly<Record<string, readonly [number, number]>> = {
  I: [57.92, 63.17],
  II: [57.9, 64.23],
  III: [58.78, 67.58],
  IV: [59.88, 69.1],
  V: [66.15, 70.27],
  VI: [68.33, 70.93],
  VII: [68.58, 71.24],
  VIII: [69.02, 71.19],
};
/** West of extent 1741 and east of extent 1748, WGS84 degrees. */
const WEST_LON = 4.39;
const EAST_LON = 31.32;

/** Midpoint between a strip's central meridian and its neighbour's, Greenwich; the EPSG extent's edge past the outer strips. */
function edgeLon(strip: string, side: -1 | 1): number {
  const i = ORDER.indexOf(strip);
  const here = CENTRAL_MERIDIANS[strip] ?? 0;
  const neighbour = CENTRAL_MERIDIANS[ORDER[i + side] ?? ''];
  if (neighbour === undefined) return side < 0 ? WEST_LON : EAST_LON;
  return OSLO_LON + (here + neighbour) / 2;
}

/**
 * East edge, east of Oslo, where German sheets carry a strip past its EPSG
 * boundary: strip III on Røgden (to 2°00') and Trysil (to 2°10'), both
 * printing "Mittelmeridian: Nullmeridian Oslo" with strip III eastings.
 */
const PRINTED_EAST_FROM_OSLO: Readonly<Record<string, number>> = {
  III: 2 + 10 / 60,
};

function printedValidity(strip: string): Ring {
  const ring = stripValidity(strip);
  const printedEast = PRINTED_EAST_FROM_OSLO[strip];
  if (printedEast === undefined) return ring;
  const east = Math.max(edgeLon(strip, 1), OSLO_LON + printedEast);
  return ring.map(([lon, lat], i): [number, number] =>
    i === 1 || i === 2 ? [east, lat] : [lon, lat],
  );
}

function stripValidity(strip: string): Ring {
  const west = edgeLon(strip, -1);
  const east = edgeLon(strip, 1);
  const [south, north] = LATITUDE_RANGE[strip] ?? [0, 0];
  return [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
  ];
}

function defineStrip(
  strip: NGOStripNumber,
  originLatitude: number,
  falseEasting: number,
): NGOStripDefinition {
  const centralMeridianFromOslo = CENTRAL_MERIDIANS[strip] ?? 0;
  const falseNorthing = 100_000;
  return {
    strip,
    crs: `NGO:STRIP_${strip}`,
    centralMeridianFromOslo,
    originLatitude,
    falseEasting,
    falseNorthing,
    proj4:
      `+proj=tmerc +lat_0=${originLatitude} +lon_0=${centralMeridianFromOslo} ` +
      `+pm=oslo +k=1 +x_0=${falseEasting} +y_0=${falseNorthing} ` +
      `${NGO_DATUM} +units=m +no_defs +type=crs`,
    validityWgs84: stripValidity(strip),
    printedValidityWgs84: printedValidity(strip),
  };
}

/**
 * The strips read off German sheets, each transverse Mercator with scale 1 on
 * its central meridian:
 *
 * - I: 4°40' W of Oslo, origin 58°N, 200 000 m E / 100 000 m N
 *   (B 34-W Fana, B 38 W-O Stavanger)
 * - II: 2°20' W of Oslo, origin 58°N, 400 000 m E / 100 000 m N
 *   (E 26 O Trollheimen, E 26 W Stangvik, E 27 W Aura, E 24 W Kvenvär)
 * - III: the Oslo meridian, origin 58°N, 600 000 m E / 100 000 m N
 *   (H 38 Enningdal)
 * - IV: 2°30' E of Oslo, origin 64°N, 100 000 m E / 100 000 m N
 *   (Jot 18 Hattfjelldal)
 * - V: 6°10' E of Oslo, origin 66°N, 300 000 m E / 100 000 m N (M 6 Torsken)
 * - VI: 10°10' E of Oslo, origin 68°N, 500 000 m E / 100 000 m N
 *   (T 7 Kautokeino)
 * - VII: 14°10' E of Oslo, origin 68°N, 700 000 m E / 100 000 m N
 *   (X 4 Laksfjordvidda)
 * - VIII: 18°20' E of Oslo, origin 68°N, 900 000 m E / 100 000 m N
 *   (Y 3 Vestertana)
 *
 * Each sheet's margin names its strip and central meridian; origins and false
 * co-ordinates are fitted to the grid printed against the graticule; EPSG's
 * NGO zones put every origin at 58°N with no false co-ordinates. Validity is
 * the band between midpoints of adjacent central meridians, which are the
 * EPSG zone boundaries, over the latitudes of each zone's EPSG area of use
 * (extents 1741-1748).
 */
export const NGO_STRIPS: Readonly<Record<NGOStripNumber, NGOStripDefinition>> =
  {
    I: defineStrip('I', 58, 200_000),
    II: defineStrip('II', 58, 400_000),
    III: defineStrip('III', 58, 600_000),
    IV: defineStrip('IV', 64, 100_000),
    V: defineStrip('V', 66, 300_000),
    VI: defineStrip('VI', 68, 500_000),
    VII: defineStrip('VII', 68, 700_000),
    VIII: defineStrip('VIII', 68, 900_000),
  };

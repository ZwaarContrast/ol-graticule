/** Iterate (zone, band) cells whose lat/lon footprint overlaps a geographic extent. */

import { BAND_LETTERS, bandLatBounds, zoneBandLonBounds } from './zones.js';
import { upsZoneLonLatBounds } from './ups.js';

/** A single GZD with its WGS84 footprint. UPS GZDs use `zone === 0`. */
export interface Gzd {
  zone: number;
  band: string;
  /** [west, east] longitude in degrees. */
  lon: readonly [number, number];
  /** [south, north] latitude in degrees. */
  lat: readonly [number, number];
}

/** Iterate every GZD that overlaps `[minLon, minLat, maxLon, maxLat]`. */
export function* iterateVisibleGzds(
  minLon: number,
  minLat: number,
  maxLon: number,
  maxLat: number,
): IterableIterator<Gzd> {
  const lonRanges = splitLonRange_(minLon, maxLon);

  if (maxLat >= 84) yield* yieldUpsZones_(['Y', 'Z'], lonRanges);
  if (minLat < -80) yield* yieldUpsZones_(['A', 'B'], lonRanges);

  const minBandIdx = bandIndexForLat_(Math.max(minLat, -80));
  const maxBandIdx = Math.min(19, bandIndexForLat_(Math.min(maxLat, 83.999_999)));

  for (let bIdx = minBandIdx; bIdx <= maxBandIdx; bIdx++) {
    const band = BAND_LETTERS[bIdx]!;
    const latBounds = bandLatBounds(band);
    if (!latBounds) continue;
    const [bLatS, bLatN] = latBounds;
    if (bLatN <= minLat || bLatS >= maxLat) continue;

    for (const [rangeMin, rangeMax] of lonRanges) {
      const startZone = Math.max(1, Math.floor((rangeMin + 180) / 6) + 1);
      const endZone = Math.min(60, Math.ceil((rangeMax + 180) / 6));
      const seen = new Set<number>();
      for (let z = startZone; z <= endZone; z++) {
        if (seen.has(z)) continue;
        seen.add(z);
        const lonBounds = zoneBandLonBounds(z, band);
        if (!lonBounds) continue;
        const [zLonW, zLonE] = lonBounds;
        if (zLonE <= rangeMin || zLonW >= rangeMax) continue;
        yield { zone: z, band, lon: lonBounds, lat: latBounds };
      }
      if (band === 'V') {
        yield* yieldExceptionZones_([31, 32], band, latBounds, rangeMin, rangeMax, seen);
      }
      if (band === 'X') {
        yield* yieldExceptionZones_([31, 33, 35, 37], band, latBounds, rangeMin, rangeMax, seen);
      }
    }
  }
}

function* yieldUpsZones_(
  zones: ReadonlyArray<'Y' | 'Z' | 'A' | 'B'>,
  lonRanges: ReadonlyArray<[number, number]>,
): IterableIterator<Gzd> {
  for (const z of zones) {
    const b = upsZoneLonLatBounds(z);
    for (const [rangeMin, rangeMax] of lonRanges) {
      if (b.lon[1] <= rangeMin || b.lon[0] >= rangeMax) continue;
      yield { zone: 0, band: z, lon: b.lon, lat: b.lat };
      break;
    }
  }
}

function* yieldExceptionZones_(
  zones: ReadonlyArray<number>,
  band: string,
  latBounds: readonly [number, number],
  rangeMin: number,
  rangeMax: number,
  seen: Set<number>,
): IterableIterator<Gzd> {
  for (const z of zones) {
    if (seen.has(z)) continue;
    const b = zoneBandLonBounds(z, band);
    if (!b) continue;
    if (b[1] <= rangeMin || b[0] >= rangeMax) continue;
    yield { zone: z, band, lon: b, lat: latBounds };
    seen.add(z);
  }
}

function bandIndexForLat_(lat: number): number {
  if (lat < -80) return 0;
  if (lat >= 72) return 19;
  return Math.floor((lat + 80) / 8);
}

function splitLonRange_(minLon: number, maxLon: number): [number, number][] {
  if (maxLon - minLon >= 360) return [[-180, 180]];
  const wrap = (lon: number): number => {
    const n = ((lon + 180) % 360 + 360) % 360 - 180;
    return n;
  };
  const a = wrap(minLon);
  const b = wrap(maxLon);
  if (a <= b) return [[a, b]];
  return [[-180, b], [a, 180]];
}

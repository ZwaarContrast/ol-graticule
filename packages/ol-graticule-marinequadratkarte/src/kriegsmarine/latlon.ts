/**
 * Longitude/latitude helpers for the Kriegsmarine grid.
 *
 * `smallestLonDiff` adapted from Chris Veness, "Latitude/longitude spherical
 * geodesy formulae", https://www.movable-type.co.uk/scripts/latlong.html
 * (© 2002-2022 Chris Veness, MIT).
 */

import { normalizeLon } from '@zwaarcontrast/ol-graticule';

/** Smallest longitude difference in radians, taking the shorter path across the anti-meridian. */
export function smallestLonDiff(lon1Rad: number, lon2Rad: number): number {
  const dLon = lon2Rad - lon1Rad;
  if (Math.abs(dLon) > Math.PI) {
    return dLon > 0 ? -(2 * Math.PI - dLon) : (2 * Math.PI + dLon);
  }
  return dLon;
}

/** Evenly-spaced longitudes along the shortest path from lon1 to lon2; returns div+1 values inclusive. */
export function lonRange(lon1: number, lon2: number, div: number): number[] {
  const dLon = lon2 - lon1;
  let startLon: number;
  let endLon: number;

  if (dLon < -180) {
    startLon = lon1;
    endLon = lon1 + (180 - lon1) + (180 + lon2);
  } else if (dLon > 180) {
    startLon = lon1;
    endLon = lon1 - ((180 + lon1) + (180 - lon2));
  } else {
    startLon = lon1;
    endLon = lon2;
  }

  const step = (endLon - startLon) / div;
  const result: number[] = [];
  for (let i = 0; i < div; i++) {
    result.push(normalizeLon(startLon + i * step));
  }
  result.push(lon2);
  return result;
}

/** Evenly-spaced latitudes between lat1 and lat2; returns div+1 values inclusive. */
export function latRange(lat1: number, lat2: number, div: number): number[] {
  const step = (lat2 - lat1) / div;
  const result: number[] = [];
  for (let i = 0; i < div; i++) {
    result.push(lat1 + i * step);
  }
  result.push(lat2);
  return result;
}

/** Divide an axis-aligned segment (same lat or same lon) into `div` equal parts; throws on diagonals. */
export function simpleRhumbDivision(
  coord1: [number, number],
  coord2: [number, number],
  div: number
): [number, number][] {
  const [lat1, lon1] = coord1;
  const [lat2, lon2] = coord2;

  if (lat1 === lat2) {
    return lonRange(lon1, lon2, div).map((lon) => [lat1, lon]);
  }
  if (lon1 === lon2) {
    return latRange(lat1, lat2, div).map((lat) => [lat, lon1]);
  }
  throw new Error(`Invalid bearing from [${coord1}] to [${coord2}]. Must be horizontal or vertical.`);
}

/** Round to a given number of decimal places. */
export function roundTo(digits: number, value: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

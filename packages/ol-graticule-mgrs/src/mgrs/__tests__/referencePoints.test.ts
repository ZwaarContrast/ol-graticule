import { describe, it, expect } from 'vitest';
import { lonLatToMgrs } from '../conversion.js';

/**
 * Cross-check every reference point against the canonical proj4js/mgrs
 * library. The expected MGRS strings were captured by feeding the same
 * (lat, lon) tuples to `mgrs.forward([lon, lat], 5)` and reformatting the
 * result into our spaced 1-m form (`"GZD SQ EEEEE NNNNN"`).
 *
 * The set is deliberately diverse — 19 famous landmarks across every
 * continent and both hemispheres, plus boundary-stress points: lat ≈ 0
 * (equator from both sides), lon ≈ ±180 (antimeridian), and the two
 * standard MGRS exceptions (Norway 32V widening at lat 58 lon 4.5, and
 * Svalbard 33X widening at lat 78 lon 15).
 *
 * Locking these in as a regression test means any future change to the
 * column letter table, row offset, Norway/Svalbard logic, or the UTM
 * forward transform that quietly breaks one of them surfaces immediately.
 */

interface ReferencePoint {
  name: string;
  lat: number;
  lon: number;
  expected: string;
}

const POINTS: ReferencePoint[] = [
  // Famous landmarks — sortable by zone for grouping in failure output.
  { name: 'Antimeridian west',         lat:   0.0000,    lon: -179.9900, expected: '1N AA 67135 00000' },
  { name: 'Honolulu (Wikipedia ref)',  lat:  21.4098418, lon: -157.9160808, expected: '4Q FJ 12345 67894' },
  { name: 'Equator at Quito',          lat:   0.0,       lon:  -78.45587, expected: '17N QA 83191 00000' },
  { name: 'Statue of Liberty',         lat:  40.6892472, lon:  -74.04450200, expected: '18T WL 80735 04700' },
  { name: 'White House',               lat:  38.897661,  lon:  -77.03657, expected: '18S UJ 23388 07391' },
  { name: 'Empire State Building',     lat:  40.74844,   lon:  -73.98565, expected: '18T WL 85632 11326' },
  { name: 'Machu Picchu',              lat: -13.1631500, lon:  -72.5449950, expected: '18L YL 66122 43523' },
  { name: 'Ushuaia (extreme south)',   lat: -54.81,      lon:  -68.31,   expected: '19F EV 44346 26133' },
  { name: 'Christ the Redeemer',       lat: -22.9519540, lon:  -43.2104850, expected: '23K PQ 83477 60681' },
  { name: 'Big Ben',                   lat:  51.5000730, lon:   -0.1246290, expected: '30U XC 99568 09357' },
  { name: 'Eiffel Tower',              lat:  48.8582270, lon:    2.2946900, expected: '31U DQ 48265 11935' },
  { name: 'Sagrada Família',           lat:  41.4036070, lon:    2.1744160, expected: '31T DF 30992 83891' },
  { name: 'SW Norway (32V exception)', lat:  58.0,       lon:    4.5,    expected: '32V KK 34128 37571' },
  { name: 'Bergen, Norway (lat 60)',   lat:  60.39126,   lon:    5.32218, expected: '32V KN 97358 00643' },
  { name: 'Colosseum',                 lat:  41.8902140, lon:   12.4922360, expected: '33T TG 91949 40628' },
  { name: 'Brandenburg Gate',          lat:  52.5162910, lon:   13.3777750, expected: '33U UU 89922 19700' },
  { name: 'Svalbard (33X exception)',  lat:  78.0,       lon:   15.0,    expected: '33X WG 00000 58369' },
  { name: 'Cape of Good Hope',         lat: -34.35681,   lon:   18.47339, expected: '34H BG 67625 95387' },
  { name: 'Acropolis (Parthenon)',     lat:  37.9715430, lon:   23.7265360, expected: '34S GH 39497 06165' },
  { name: 'North Cape',                lat:  71.17085,   lon:   25.78332, expected: '35W MU 56175 96892' },
  { name: 'Pyramid of Khufu',          lat:  29.9791910, lon:   31.1342090, expected: '36R UU 19995 17944' },
  { name: 'Red Square (Kremlin)',      lat:  55.7540440, lon:   37.6208630, expected: '37U DB 13443 79567' },
  { name: 'Taj Mahal',                 lat:  27.1750250, lon:   78.0421920, expected: '44R KR 06919 09278' },
  { name: 'Mt. Everest summit',        lat:  27.9881060, lon:   86.9252750, expected: '45R VL 92652 95887' },
  { name: 'Just south of equator',     lat:  -0.0001,    lon:  100.0,    expected: '47M PV 11280 99988' },
  { name: 'Just north of equator',     lat:   0.0001,    lon:  100.0,    expected: '47N PA 11280 00011' },
  { name: 'Tokyo Imperial Palace',     lat:  35.6825050, lon:  139.7525100, expected: '54S UE 87114 49451' },
  { name: 'Sydney Opera House',        lat: -33.8568780, lon:  151.2152550, expected: '56H LH 34896 52280' },
  { name: 'Antimeridian east',         lat:   0.0,       lon:  179.99,   expected: '60N ZF 32864 00000' },
  // Boundary-stress: every Svalbard exception zone (lat 76 inside band X)
  // and the Norway 32V exception's southern and northern lat edges.
  { name: 'Svalbard 31X',              lat:  76.0,       lon:    5.0,    expected: '31X EE 54000 36099' },
  { name: 'Svalbard 35X',              lat:  76.0,       lon:   27.0,    expected: '35X NE 00000 35185' },
  { name: 'Svalbard 37X',              lat:  76.0,       lon:   39.0,    expected: '37X EE 00000 35185' },
  { name: 'Norway 32V (south edge)',   lat:  56.01,      lon:    4.0,    expected: '32V JH 88389 18477' },
  { name: 'Norway 32V (north edge)',   lat:  63.99,      lon:    4.0,    expected: '32V KS 55542 05494' },
  // Band X is 12° tall (72°-84°) instead of 8°; sample its south and
  // north edges to confirm the bandLetter / bandLatBounds path works.
  { name: 'Band X south edge',         lat:  72.01,      lon:   50.0,    expected: '39X VV 65529 90334' },
  { name: 'Band X north edge',         lat:  83.99,      lon:   50.0,    expected: '39X VP 88311 27078' },
];

describe('reference points (cross-check vs proj4js/mgrs)', () => {
  for (const p of POINTS) {
    it(`${p.name}: (${p.lat}, ${p.lon}) → ${p.expected}`, () => {
      const got = lonLatToMgrs(p.lon, p.lat, 5);
      expect(got).toBe(p.expected);
    });
  }
});

import { describe, it, expect } from 'vitest';
import { ParseError } from '@zwaarcontrast/ol-graticule';
import { parseGnmvRef, parseJmnRef, parseRef } from '../decode.js';
import { encodeGnmv, encodeJmn } from '../encode.js';

describe('parseGnmvRef', () => {
  it('round-trips Berlin Reichstag', () => {
    const decoded = parseGnmvRef('15 O 33 3 9 7 c');
    expect(decoded.canonical).toBe('15O33397c');
    expect(decoded.depth).toBe(5);
    expect(decoded.bbox[1]).toBeLessThanOrEqual(52.518720);
    expect(decoded.bbox[3]).toBeGreaterThanOrEqual(52.518720);
    expect(decoded.bbox[0]).toBeLessThanOrEqual(13.3762568);
    expect(decoded.bbox[2]).toBeGreaterThanOrEqual(13.3762568);
  });

  it('accepts slash separators', () => {
    const decoded = parseGnmvRef('05 Ost / 61 / 2 / 3 / 2 / a');
    expect(decoded.canonical).toBe('05O61232a');
    expect(decoded.depth).toBe(5);
  });

  it('parses ZZG-only input', () => {
    const decoded = parseGnmvRef('15O');
    expect(decoded.depth).toBe(0);
    expect(decoded.bbox).toEqual([10, 49, 20, 59]);
  });

  it('parses up to Mitteltrapez', () => {
    const decoded = parseGnmvRef('15O333');
    expect(decoded.depth).toBe(2);
    expect(decoded.canonical).toBe('15O333');
  });

  it('throws ParseError for missing suffix', () => {
    expect(() => parseGnmvRef('15')).toThrow(ParseError);
  });

  it('throws ParseError for trailing garbage', () => {
    expect(() => parseGnmvRef('15O33397cZ')).toThrow(ParseError);
  });

  it('honours pre-1943 era for Arbeitstrapez labels', () => {
    expect(() => parseGnmvRef('15O33397lo', 'post-1943')).toThrow(ParseError);
    const decoded = parseGnmvRef('15O33391lo', 'pre-1943');
    expect(decoded.depth).toBe(5);
  });
});

describe('parseJmnRef', () => {
  it('round-trips Köln', () => {
    const lat = 50 + 59 / 60 + 28 / 3600;
    const lon = 6 + 53 / 60 + 42 / 3600;
    const decoded = parseJmnRef('05 Ost S NO 3 2 a');
    expect(decoded.canonical).toBe('05OSNO32a');
    expect(decoded.depth).toBe(5);
    expect(decoded.bbox[1]).toBeLessThanOrEqual(lat);
    expect(decoded.bbox[3]).toBeGreaterThanOrEqual(lat);
    expect(decoded.bbox[0]).toBeLessThanOrEqual(lon);
    expect(decoded.bbox[2]).toBeGreaterThanOrEqual(lon);
  });

  it('parses JMN with Südost suffix', () => {
    const decoded = parseJmnRef('15SOSAA');
    expect(decoded.depth).toBe(2);
  });

  it('parses JMN with full "Südost" word and umlaut', () => {
    const decoded = parseJmnRef('15 Südost S NO');
    expect(decoded.depth).toBe(2);
  });

  it('parses GNMV with "Sudost" without umlaut', () => {
    const decoded = parseGnmvRef('15 Sudost 33');
    expect(decoded.depth).toBe(1);
  });

  it('parses GNMV with "Suedost" transliteration', () => {
    const decoded = parseGnmvRef('15 Suedost 33');
    expect(decoded.depth).toBe(1);
  });

  it('throws on invalid letter (I forbidden)', () => {
    expect(() => parseJmnRef('05OSAI')).toThrow(ParseError);
    expect(() => parseJmnRef('05OSIA')).toThrow(ParseError);
  });
});

describe('encode/decode round-trip', () => {
  const sites: Array<{ name: string; lat: number; lon: number }> = [
    { name: 'Berlin', lat: 52.518720, lon: 13.3762568 },
    { name: 'Köln',   lat: 50.991111, lon: 6.895 },
    { name: 'Paris',  lat: 48.858370, lon: 2.294481 },
    { name: 'London', lat: 51.500729, lon: -0.124625 },
    { name: 'Oslo',   lat: 59.913868, lon: 10.752245 },
    { name: 'Rome',   lat: 41.890251, lon: 12.492373 },
  ];

  for (const site of sites) {
    it(`GNMV decodes back into the cell containing ${site.name}`, () => {
      const ref = encodeGnmv([site.lat, site.lon])!;
      const decoded = parseGnmvRef(ref);
      expect(decoded.bbox[1]).toBeLessThanOrEqual(site.lat);
      expect(decoded.bbox[3]).toBeGreaterThanOrEqual(site.lat);
      expect(decoded.bbox[0]).toBeLessThanOrEqual(site.lon);
      expect(decoded.bbox[2]).toBeGreaterThanOrEqual(site.lon);
    });

    it(`JMN decodes back into the cell containing ${site.name}`, () => {
      const ref = encodeJmn([site.lat, site.lon])!;
      const decoded = parseJmnRef(ref);
      expect(decoded.bbox[1]).toBeLessThanOrEqual(site.lat);
      expect(decoded.bbox[3]).toBeGreaterThanOrEqual(site.lat);
      expect(decoded.bbox[0]).toBeLessThanOrEqual(site.lon);
      expect(decoded.bbox[2]).toBeGreaterThanOrEqual(site.lon);
    });
  }
});

describe('parseRef auto-detect', () => {
  it('detects JMN', () => {
    const result = parseRef('05OSNO32a');
    expect(result.system).toBe('jmn');
  });

  it('detects GNMV', () => {
    const result = parseRef('15O33397c');
    expect(result.system).toBe('gnmv');
  });

  it('reports both grammars when neither matches', () => {
    expect(() => parseRef('not-a-ref')).toThrow(/not JMN.*not GNMV/);
  });
});

describe('antimeridian round-trip', () => {
  const sites: Array<{ name: string; lat: number; lon: number }> = [
    { name: 'lon=180 exactly', lat: 50.123, lon: 180     },
    { name: 'lon=-179.5',      lat: 50.123, lon: -179.5  },
    { name: 'lon=-175.4',      lat: 50.123, lon: -175.4  },
    { name: 'lon=-169.9',      lat: 50.123, lon: -169.9  },
    { name: 'lon=175.4',       lat: 50.123, lon: 175.4   },
    { name: 'lon=170.1',       lat: 50.123, lon: 170.1   },
  ];
  for (const site of sites) {
    it(`GNMV round-trips ${site.name}`, () => {
      const ref = encodeGnmv([site.lat, site.lon])!;
      const decoded = parseGnmvRef(ref);
      expect(decoded.bbox[1]).toBeLessThanOrEqual(site.lat);
      expect(decoded.bbox[3]).toBeGreaterThanOrEqual(site.lat);
      const normalizedLon = site.lon === 180 ? -180 : site.lon;
      expect(decoded.bbox[0]).toBeLessThanOrEqual(normalizedLon);
      expect(decoded.bbox[2]).toBeGreaterThanOrEqual(normalizedLon);
    });
    it(`JMN round-trips ${site.name}`, () => {
      const ref = encodeJmn([site.lat, site.lon])!;
      const decoded = parseJmnRef(ref);
      expect(decoded.bbox[1]).toBeLessThanOrEqual(site.lat);
      expect(decoded.bbox[3]).toBeGreaterThanOrEqual(site.lat);
      const normalizedLon = site.lon === 180 ? -180 : site.lon;
      expect(decoded.bbox[0]).toBeLessThanOrEqual(normalizedLon);
      expect(decoded.bbox[2]).toBeGreaterThanOrEqual(normalizedLon);
    });
  }

  it('rejects lonTens=18 with an East suffix', () => {
    expect(() => parseGnmvRef('185O')).toThrow(/lon.*18.*west/i);
  });

  it('accepts lonTens=18 with a West suffix', () => {
    const decoded = parseGnmvRef('185W');
    expect(decoded.bbox[0]).toBe(-180);
    expect(decoded.bbox[2]).toBe(-170);
  });
});

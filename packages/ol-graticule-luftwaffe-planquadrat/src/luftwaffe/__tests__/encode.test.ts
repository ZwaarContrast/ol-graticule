import { describe, it, expect } from 'vitest';
import { encodeGnmv, encodeJmn, zzgFor, gtDigitsFor, mtDigitFor, ktDigitFor, meltDigitFor, atLabelFor, jmnMtLettersFor, jagdtrapezHalfFor } from '../encode.js';

describe('zzgFor', () => {
  it('places Berlin in ZZG 15 Ost', () => {
    const zzg = zzgFor(52.518720, 13.3762568)!;
    expect(zzg.digits).toBe('15');
    expect(zzg.suffix).toBe('Ost');
    expect(zzg.nwLat).toBe(59);
    expect(zzg.nwLon).toBe(10);
  });

  it('places Köln-Butzweilerhof in ZZG 05 Ost', () => {
    const zzg = zzgFor(50 + 59 / 60 + 28 / 3600, 6 + 53 / 60 + 42 / 3600)!;
    expect(zzg.digits).toBe('05');
    expect(zzg.suffix).toBe('Ost');
    expect(zzg.nwLat).toBe(59);
    expect(zzg.nwLon).toBe(0);
  });

  it('flips suffix for the Western hemisphere', () => {
    const zzg = zzgFor(40, -74)!;
    expect(zzg.suffix).toBe('West');
    expect(zzg.nwLon).toBe(-80);
    expect(zzg.digits).toBe('84');
  });

  it('uses Südost for the southern Eastern hemisphere', () => {
    const zzg = zzgFor(-34, 151)!;
    expect(zzg.suffix).toBe('Südost');
    expect(zzg.nwLat).toBe(-31);
    expect(zzg.digits).toBe('153');
  });

  it('rejects above 89°N', () => {
    expect(zzgFor(89.5, 0)).toBeUndefined();
  });

  it('places lat=-11 in south band 0 (NW=-1) by [SW, NW) convention', () => {
    const z = zzgFor(-11, 5)!;
    expect(z.nwLat).toBe(-1);
    expect(z.digits).toBe('00');
    expect(z.suffix).toBe('Südost');
  });

  it('places lat just below -11 in south band 1 (NW=-11)', () => {
    const z = zzgFor(-11.001, 5)!;
    expect(z.nwLat).toBe(-11);
    expect(z.digits).toBe('01');
  });

  it('places lat=-1 in north band 0 (NW=9)', () => {
    const z = zzgFor(-1, 5)!;
    expect(z.nwLat).toBe(9);
    expect(z.digits).toBe('00');
    expect(z.suffix).toBe('Ost');
  });
});

describe('GNMV worked example: Berlin Reichstag', () => {
  const lat = 52.518720;
  const lon = 13.3762568;

  it('Großtrapez digits = 33', () => {
    expect(gtDigitsFor(lat, lon)).toBe('33');
  });

  it('Mitteltrapez digit = 3', () => {
    expect(mtDigitFor(lat, lon)).toBe(3);
  });

  it('Kleintrapez digit = 9', () => {
    expect(ktDigitFor(lat, lon)).toBe(9);
  });

  it('Meldetrapez digit (post-1943) = 7', () => {
    expect(meltDigitFor(lat, lon, 'post-1943')).toBe(7);
  });

  it('Arbeitstrapez label (post-1943) = c', () => {
    expect(atLabelFor(lat, lon, 'post-1943')).toBe('c');
  });

  it('encodeGnmv(post-1943) gives "15O33397c"', () => {
    expect(encodeGnmv([lat, lon])).toBe('15O33397c');
  });

  it('encodeGnmv depth=2 stops after Mitteltrapez', () => {
    expect(encodeGnmv([lat, lon], 'post-1943', 2)).toBe('15O333');
  });

  it('encodeGnmv depth=0 returns just ZZG + suffix', () => {
    expect(encodeGnmv([lat, lon], 'post-1943', 0)).toBe('15O');
  });
});

describe('GNMV worked example: Köln-Butzweilerhof', () => {
  const lat = 50 + 59 / 60 + 28 / 3600;
  const lon = 6 + 53 / 60 + 42 / 3600;

  it('encodeGnmv(post-1943) gives "05O61232a"', () => {
    expect(encodeGnmv([lat, lon])).toBe('05O61232a');
  });
});

describe('JMN worked example: Köln-Butzweilerhof', () => {
  const lat = 50 + 59 / 60 + 28 / 3600;
  const lon = 6 + 53 / 60 + 42 / 3600;

  it('Jagdtrapez half = S', () => {
    const zzg = zzgFor(lat, lon)!;
    expect(jagdtrapezHalfFor(zzg, lat)).toBe('S');
  });

  it('JMN Mitteltrapez letter pair = NO', () => {
    const zzg = zzgFor(lat, lon)!;
    expect(jmnMtLettersFor(lat, lon, zzg, 'S')).toBe('NO');
  });

  it('encodeJmn gives "05OSNO32a"', () => {
    expect(encodeJmn([lat, lon])).toBe('05OSNO32a');
  });
});

describe('pre-1943 Arbeitstrapez labels', () => {
  it('uses lo/ro/lu/ru in pre-1943 era', () => {
    expect(atLabelFor(0.001, 0.001, 'pre-1943')).toBe('lu');
    expect(atLabelFor(0.024, 0.001, 'pre-1943')).toBe('lo');
    expect(atLabelFor(0.024, 0.05, 'pre-1943')).toBe('ro');
  });

  it('Meldetrapez digit is 1..4 in pre-1943', () => {
    const v = meltDigitFor(0.01, 0.01, 'pre-1943');
    expect(v).toBeGreaterThanOrEqual(1);
    expect(v).toBeLessThanOrEqual(4);
  });
});

describe('boundary handling', () => {
  it('rejects lat=89 (would produce a phantom ZZG with nwLat=99)', () => {
    expect(zzgFor(89, 0)).toBeUndefined();
    expect(encodeGnmv([89, 0])).toBeUndefined();
    expect(encodeJmn([89, 0])).toBeUndefined();
  });

  it('accepts lat just below 89', () => {
    const z = zzgFor(88.999, 0)!;
    expect(z.digits).toBe('08');
    expect(z.nwLat).toBe(89);
  });

  it('encodes lon=180 as the West-side antimeridian cell (lonTens=18 West)', () => {
    const z = zzgFor(50, 180)!;
    expect(z.suffix).toBe('West');
    expect(z.digits).toBe('185');
    expect(z.nwLon).toBe(-180);
  });

  it('encodes lon just below -170 (antimeridian-adjacent west cell) as lonTens=18 West', () => {
    const z = zzgFor(50, -175)!;
    expect(z.suffix).toBe('West');
    expect(z.digits).toBe('185');
    expect(z.nwLon).toBe(-180);
  });
});

import { describe, expect, it } from 'vitest';
import { parseDhg, parseShortDigits } from '../decode.js';

describe('parseDhg', () => {
  it('parses the 3-token form "5 600 5760"', () => {
    const r = parseDhg('5 600 5760');
    expect(r).toBeDefined();
    expect(r!.coord).toEqual({ kennziffer: 5, easting: 600_000, northing: 5_760_000 });
    expect(r!.canonical).toBe('5 600 5760');
  });

  it('parses the 2-token zone-prefixed km form "5600 5760"', () => {
    const r = parseDhg('5600 5760');
    expect(r!.coord).toEqual({ kennziffer: 5, easting: 600_000, northing: 5_760_000 });
  });

  it('parses metric form "5600000 5760000" as full metres', () => {
    const r = parseDhg('5600000 5760000');
    expect(r!.coord).toEqual({ kennziffer: 5, easting: 600_000, northing: 5_760_000 });
  });

  it('accepts alternative separators (hyphens, slashes, underscores)', () => {
    const r1 = parseDhg('5-600-5760');
    const r2 = parseDhg('5/600/5760');
    const r3 = parseDhg('5_600_5760');
    expect(r1!.coord).toEqual(r2!.coord);
    expect(r2!.coord).toEqual(r3!.coord);
  });

  it('rejects empty / non-string input', () => {
    expect(parseDhg('')).toBeUndefined();
    expect(parseDhg('   ')).toBeUndefined();
    // @ts-expect-error guarding runtime behaviour for non-string input
    expect(parseDhg(123)).toBeUndefined();
  });

  it('rejects zero / out-of-range Kennziffer', () => {
    expect(parseDhg('0 600 5760')).toBeUndefined();
    expect(parseDhg('61 600 5760')).toBeUndefined();
  });

  it('rejects malformed token counts', () => {
    expect(parseDhg('5')).toBeUndefined();
    expect(parseDhg('5 600 5760 9999')).toBeUndefined();
  });

  it('rejects 6-digit easting (ambiguous; not used in source documents)', () => {
    expect(parseDhg('560000 5760')).toBeUndefined();
  });
});

describe('parseShortDigits', () => {
  it('picks the centred candidate inside the same 100 km block', () => {
    expect(parseShortDigits('83', 383)).toBe(383);
  });

  it('rolls over to the next 100 km block when closer to context', () => {
    expect(parseShortDigits('00', 399)).toBe(400);
  });

  it('rolls back to the previous block when closer to context', () => {
    expect(parseShortDigits('99', 301)).toBe(299);
  });

  it('rejects non-2-digit input', () => {
    expect(parseShortDigits('1', 100)).toBeUndefined();
    expect(parseShortDigits('123', 100)).toBeUndefined();
    expect(parseShortDigits('aa', 100)).toBeUndefined();
  });
});

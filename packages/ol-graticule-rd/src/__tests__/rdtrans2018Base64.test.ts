import { describe, expect, it } from 'vitest';
import { RDTRANS2018_BASE64 } from '../rdtrans2018Base64.js';

describe('RDTRANS2018_BASE64 inline NTv2 grid', () => {
  it('is a non-empty base64 string', () => {
    expect(typeof RDTRANS2018_BASE64).toBe('string');
    expect(RDTRANS2018_BASE64.length).toBeGreaterThan(50_000);
  });

  it('contains only base64 alphabet characters', () => {
    expect(RDTRANS2018_BASE64).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  });

  it('decodes to a buffer whose length is a multiple of 16 (NTv2 record size)', () => {
    const decoded = atob(RDTRANS2018_BASE64);
    expect(decoded.length % 16).toBe(0);
    expect(decoded.length).toBeGreaterThan(50_000);
  });

  it('begins with the NTv2 NUM_OREC header', () => {
    const decoded = atob(RDTRANS2018_BASE64);
    expect(decoded.startsWith('NUM_OREC')).toBe(true);
  });

  it('ends with the NTv2 "END" trailer', () => {
    const decoded = atob(RDTRANS2018_BASE64);
    expect(decoded).toContain('END     ');
  });
});

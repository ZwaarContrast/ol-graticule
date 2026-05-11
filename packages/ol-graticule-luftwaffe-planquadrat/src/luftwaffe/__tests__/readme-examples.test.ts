import { describe, it, expect } from 'vitest';
import { encodeGnmv, encodeJmn } from '../encode.js';

describe('README code-block examples must match actual output', () => {
  const berlin: [number, number] = [52.518720, 13.376257];
  const koln: [number, number] = [50.991111, 6.895];

  it('encodeGnmv(Berlin) == "15O33397c"', () => {
    expect(encodeGnmv(berlin)).toBe('15O33397c');
  });

  it("encodeGnmv(Berlin, 'pre-1943') == '15O33393ru'", () => {
    expect(encodeGnmv(berlin, 'pre-1943')).toBe('15O33393ru');
  });

  it("encodeGnmv(Berlin, 'post-1943', 1) == '15O33'", () => {
    expect(encodeGnmv(berlin, 'post-1943', 1)).toBe('15O33');
  });

  it('encodeJmn(Köln) == "05OSNO32a"', () => {
    expect(encodeJmn(koln)).toBe('05OSNO32a');
  });
});

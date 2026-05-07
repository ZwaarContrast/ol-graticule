import { describe, it, expect, beforeEach, vi } from 'vitest';
import proj4 from 'proj4';
import { loadNadgrid, __resetNadgridLoadCache } from '../loadNadgrid.js';

/**
 * Minimal NTv2 header. proj4's nadgrid parser is permissive enough that a
 * buffer with the right magic + subgrid count will load. Actual coordinate
 * transformations using this grid would be nonsense, but that's fine — we're
 * testing registration plumbing, not proj4's math.
 *
 * NTv2 layout: 11-record overview + per-subgrid header + grid records.
 * Each record is 16 bytes: 8-byte key, 8-byte value.
 */
function makeMinimalNtv2(): ArrayBuffer {
  const headerRecords = 11;
  const subgridRecords = 11;
  const gridRows = 2;
  const gridCols = 2;
  const nodes = gridRows * gridCols;
  const totalBytes = (headerRecords + subgridRecords) * 16 + nodes * 16;
  const buf = new ArrayBuffer(totalBytes);
  const view = new DataView(buf);
  const te = new TextEncoder();

  function writeKey(offset: number, key: string): void {
    const bytes = te.encode(key.padEnd(8, ' '));
    for (let i = 0; i < 8; i++) view.setUint8(offset + i, bytes[i]!);
  }
  function writeI32(offset: number, value: number): void {
    view.setInt32(offset, value, true);
    view.setInt32(offset + 4, 0, true);
  }
  function writeF64(offset: number, value: number): void {
    view.setFloat64(offset, value, true);
  }
  function writeStr(offset: number, value: string): void {
    const bytes = te.encode(value.padEnd(8, ' '));
    for (let i = 0; i < 8; i++) view.setUint8(offset + i, bytes[i]!);
  }

  // Overview header.
  let o = 0;
  writeKey(o, 'NUM_OREC'); writeI32(o + 8, headerRecords); o += 16;
  writeKey(o, 'NUM_SREC'); writeI32(o + 8, subgridRecords); o += 16;
  writeKey(o, 'NUM_FILE'); writeI32(o + 8, 1); o += 16;
  writeKey(o, 'GS_TYPE '); writeStr(o + 8, 'SECONDS '); o += 16;
  writeKey(o, 'VERSION '); writeStr(o + 8, 'TEST    '); o += 16;
  writeKey(o, 'SYSTEM_F'); writeStr(o + 8, 'WGS84   '); o += 16;
  writeKey(o, 'SYSTEM_T'); writeStr(o + 8, 'BESSEL  '); o += 16;
  writeKey(o, 'MAJOR_F '); writeF64(o + 8, 6378137.0); o += 16;
  writeKey(o, 'MINOR_F '); writeF64(o + 8, 6356752.3); o += 16;
  writeKey(o, 'MAJOR_T '); writeF64(o + 8, 6377397.155); o += 16;
  writeKey(o, 'MINOR_T '); writeF64(o + 8, 6356078.963); o += 16;

  // Subgrid header.
  writeKey(o, 'SUB_NAME'); writeStr(o + 8, 'SUB0    '); o += 16;
  writeKey(o, 'PARENT  '); writeStr(o + 8, 'NONE    '); o += 16;
  writeKey(o, 'CREATED '); writeStr(o + 8, '20000101'); o += 16;
  writeKey(o, 'UPDATED '); writeStr(o + 8, '20000101'); o += 16;
  writeKey(o, 'S_LAT   '); writeF64(o + 8, 0); o += 16;
  writeKey(o, 'N_LAT   '); writeF64(o + 8, 3600); o += 16;
  writeKey(o, 'E_LONG  '); writeF64(o + 8, 0); o += 16;
  writeKey(o, 'W_LONG  '); writeF64(o + 8, 3600); o += 16;
  writeKey(o, 'LAT_INC '); writeF64(o + 8, 3600); o += 16;
  writeKey(o, 'LONG_INC'); writeF64(o + 8, 3600); o += 16;
  writeKey(o, 'GS_COUNT'); writeI32(o + 8, nodes); o += 16;

  // Nodes: each is (lat shift, lon shift, lat accuracy, lon accuracy) f32.
  for (let i = 0; i < nodes; i++) {
    view.setFloat32(o, 0, true);
    view.setFloat32(o + 4, 0, true);
    view.setFloat32(o + 8, 0, true);
    view.setFloat32(o + 12, 0, true);
    o += 16;
  }
  return buf;
}

describe('loadNadgrid', () => {
  beforeEach(() => {
    __resetNadgridLoadCache();
  });

  it('registers an ArrayBuffer with proj4 under the given name', async () => {
    const spy = vi.spyOn(proj4, 'nadgrid');
    const buffer = makeMinimalNtv2();
    await loadNadgrid('test_grid_a', buffer);
    expect(spy).toHaveBeenCalledWith('test_grid_a', buffer);
    spy.mockRestore();
  });

  it('caches loads per name: second call returns the same settled promise', async () => {
    const spy = vi.spyOn(proj4, 'nadgrid');
    const buffer = makeMinimalNtv2();
    await loadNadgrid('test_grid_b', buffer);
    await loadNadgrid('test_grid_b', buffer);
    // Second call must not re-invoke proj4.nadgrid.
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('shares the in-flight promise between concurrent callers', async () => {
    const spy = vi.spyOn(proj4, 'nadgrid');
    const buffer = makeMinimalNtv2();
    await Promise.all([
      loadNadgrid('test_grid_c', buffer),
      loadNadgrid('test_grid_c', buffer),
      loadNadgrid('test_grid_c', buffer),
    ]);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('re-registers when called with { force: true }', async () => {
    const spy = vi.spyOn(proj4, 'nadgrid');
    const buffer = makeMinimalNtv2();
    await loadNadgrid('test_grid_d', buffer);
    await loadNadgrid('test_grid_d', buffer, { force: true });
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  it('drops failed loads from the cache so callers can retry', async () => {
    const spy = vi
      .spyOn(proj4, 'nadgrid')
      .mockImplementationOnce(() => {
        throw new Error('bad grid');
      });
    await expect(loadNadgrid('test_grid_e', makeMinimalNtv2())).rejects.toThrow('bad grid');
    spy.mockRestore();

    // Second call with a fresh buffer should re-invoke nadgrid rather than
    // replaying the cached rejection.
    const spy2 = vi.spyOn(proj4, 'nadgrid');
    await loadNadgrid('test_grid_e', makeMinimalNtv2());
    expect(spy2).toHaveBeenCalledTimes(1);
    spy2.mockRestore();
  });

  it('fetches when given a URL string and rejects on non-OK responses', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as Response);

    await expect(loadNadgrid('test_grid_f', 'https://example.invalid/none.gsb'))
      .rejects.toThrow(/404 Not Found/);

    fetchSpy.mockRestore();
  });

  it('fetches when given a string URL and registers the returned bytes', async () => {
    const buffer = makeMinimalNtv2();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: async () => buffer,
    } as unknown as Response);
    const nadgridSpy = vi.spyOn(proj4, 'nadgrid');

    await loadNadgrid('test_grid_g', 'https://example.invalid/test.gsb');
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(nadgridSpy).toHaveBeenCalledWith('test_grid_g', buffer);

    fetchSpy.mockRestore();
    nadgridSpy.mockRestore();
  });
});

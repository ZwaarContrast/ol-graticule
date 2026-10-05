import { afterEach, describe, expect, it, vi } from 'vitest';
import proj4 from 'proj4';
import { PolygonClippedGridSystem } from '@zwaarcontrast/ol-graticule';
import { createProjectedGridSystemFromEPSG } from '../fromEPSG.js';
import { ProjectedGridSystem } from '../grid-systems/ProjectedGridSystem.js';

// epsg.io and spatialreference.org responses for NGO 1948 (Oslo) / NGO zone II
// and OSGB36 / British National Grid, as served on 2026-10-04.
const NGO_II_PROJ4 =
  '+proj=tmerc +lat_0=58 +lon_0=-2.33333333333333 +k=1 +x_0=0 +y_0=0 ' +
  '+a=6377492.018 +rf=299.1528128 +pm=oslo ' +
  '+towgs84=278.3,93,474.5,7.889,0.05,-6.61,6.21 +units=m +no_defs +type=crs';
const NGO_II_BBOX = {
  south_latitude: 57.9,
  west_longitude: 7.22,
  north_latitude: 64.23,
  east_longitude: 9.56,
};
const BNG_PROJ4 =
  '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 ' +
  '+ellps=airy +nadgrids=uk_os_OSTN15_NTv2_OSGBtoETRS.tif +units=m +no_defs +type=crs';

function respond(routes: Record<string, string | undefined>) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    calls.push(url);
    const body = routes[url];
    return body === undefined
      ? new Response('', { status: 404 })
      : new Response(body, { status: 200 });
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('createProjectedGridSystemFromEPSG', () => {
  it('registers the epsg.io definition, datum shift included, and clips to the area of use', async () => {
    respond({
      'https://epsg.io/27392.proj4': NGO_II_PROJ4,
      'https://spatialreference.org/ref/epsg/27392/projjson.json':
        JSON.stringify({ bbox: NGO_II_BBOX }),
    });
    const grid = await createProjectedGridSystemFromEPSG(27392);
    expect(grid).toBeInstanceOf(PolygonClippedGridSystem);
    const p: [number, number] = [8.72, 63];
    const [x, y] = proj4('EPSG:4326', 'EPSG:27392', p);
    const [ex, ey] = proj4('EPSG:4326', NGO_II_PROJ4, p);
    expect(x).toBeCloseTo(ex ?? 0, 3);
    expect(y).toBeCloseTo(ey ?? 0, 3);
    // Without the shift the same point lands more than 100 m away.
    const unshifted = NGO_II_PROJ4.replace(/\+towgs84=\S+ /, '');
    const [ux, uy] = proj4('EPSG:4326', unshifted, p);
    expect(Math.hypot(x - (ux ?? 0), y - (uy ?? 0))).toBeGreaterThan(100);
  });

  it('accepts "EPSG:n" and fetches a code once for the session', async () => {
    const calls = respond({
      'https://epsg.io/27393.proj4': NGO_II_PROJ4.replace(
        '-2.33333333333333',
        '0',
      ),
      'https://spatialreference.org/ref/epsg/27393/projjson.json':
        JSON.stringify({ bbox: NGO_II_BBOX }),
    });
    await Promise.all([
      createProjectedGridSystemFromEPSG('EPSG:27393'),
      createProjectedGridSystemFromEPSG(27393),
    ]);
    await createProjectedGridSystemFromEPSG(27393);
    expect(calls).toHaveLength(2);
  });

  it('makes grid-file shifts optional so the CRS works before loadNadgrid', async () => {
    respond({ 'https://epsg.io/27700.proj4': BNG_PROJ4 });
    const grid = await createProjectedGridSystemFromEPSG(27700);
    expect(grid).toBeInstanceOf(ProjectedGridSystem);
    const def = proj4.defs('EPSG:27700');
    expect(JSON.stringify(def)).toContain(
      '@uk_os_OSTN15_NTv2_OSGBtoETRS.tif,@null',
    );
    const [x] = proj4('EPSG:4326', 'EPSG:27700', [-2, 52]);
    expect(Number.isFinite(x)).toBe(true);
  });

  it('rejects a code epsg.io does not know, and lets a later call retry', async () => {
    respond({});
    await expect(createProjectedGridSystemFromEPSG(999_999)).rejects.toThrow(
      /epsg\.io\/999999\.proj4: 404/,
    );
    respond({
      'https://epsg.io/999999.proj4': NGO_II_PROJ4,
    });
    await expect(
      createProjectedGridSystemFromEPSG(999_999),
    ).resolves.toBeDefined();
  });

  it('refuses something that is not an EPSG code', async () => {
    await expect(
      createProjectedGridSystemFromEPSG('ESRI:102101'),
    ).rejects.toThrow(/Not an EPSG code/);
  });
});

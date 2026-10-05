import { afterEach, describe, expect, it, vi } from 'vitest';
import proj4 from 'proj4';
import { PolygonClippedGridSystem } from '@zwaarcontrast/ol-graticule';
import { createProjectedGridSystemFromEPSG, lookupEPSG } from '../fromEPSG.js';
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

  it('rejects a code neither service knows, and lets a later call retry', async () => {
    respond({});
    await expect(createProjectedGridSystemFromEPSG(999_999)).rejects.toThrow(
      'Unknown EPSG code: 999999',
    );
    respond({
      'https://epsg.io/999999.proj4': NGO_II_PROJ4,
    });
    await expect(
      createProjectedGridSystemFromEPSG(999_999),
    ).resolves.toBeDefined();
  });

  it('passes on a failed definition fetch when the code does exist', async () => {
    respond({
      'https://spatialreference.org/ref/epsg/27394/projjson.json':
        JSON.stringify({ name: 'NGO 1948 (Oslo) / NGO zone IV' }),
    });
    await expect(createProjectedGridSystemFromEPSG(27394)).rejects.toThrow(
      /epsg\.io\/27394\.proj4: 404/,
    );
  });

  it('refuses something that is not an EPSG code', async () => {
    await expect(
      createProjectedGridSystemFromEPSG('ESRI:102101'),
    ).rejects.toThrow(/Not an EPSG code/);
  });
});

describe('lookupEPSG', () => {
  // spatialreference.org records as served on 2026-10-05.
  it('returns the PROJJSON name, type, area, scope, box and axis units', async () => {
    respond({
      'https://epsg.io/2263.proj4':
        '+proj=lcc +lat_0=40.1666666666667 +lon_0=-74 +lat_1=41.0333333333333 ' +
        '+lat_2=40.6666666666667 +x_0=300000 +y_0=0 +datum=NAD83 ' +
        '+units=us-ft +no_defs +type=crs',
      'https://spatialreference.org/ref/epsg/2263/projjson.json':
        JSON.stringify({
          type: 'ProjectedCRS',
          name: 'NAD83 / New York Long Island (ftUS)',
          coordinate_system: {
            subtype: 'Cartesian',
            axis: ['Easting', 'Northing'].map((name, i) => ({
              name,
              abbreviation: i === 0 ? 'X' : 'Y',
              direction: i === 0 ? 'east' : 'north',
              unit: {
                type: 'LinearUnit',
                name: 'US survey foot',
                conversion_factor: 0.304800609601219,
              },
            })),
          },
          scope: 'Engineering survey, topographic mapping.',
          area: 'United States (USA) - New York - counties of Bronx; Kings; Nassau; New York; Queens; Richmond; Suffolk.',
          bbox: {
            south_latitude: 40.47,
            west_longitude: -74.26,
            north_latitude: 41.3,
            east_longitude: -71.8,
          },
        }),
    });
    expect(await lookupEPSG('EPSG:2263')).toEqual({
      code: 2263,
      crs: 'EPSG:2263',
      name: 'NAD83 / New York Long Island (ftUS)',
      type: 'ProjectedCRS',
      area: 'United States (USA) - New York - counties of Bronx; Kings; Nassau; New York; Queens; Richmond; Suffolk.',
      scope: 'Engineering survey, topographic mapping.',
      bbox: { west: -74.26, south: 40.47, east: -71.8, north: 41.3 },
      axes: [
        {
          name: 'Easting',
          abbreviation: 'X',
          direction: 'east',
          unit: 'US survey foot',
        },
        {
          name: 'Northing',
          abbreviation: 'Y',
          direction: 'north',
          unit: 'US survey foot',
        },
      ],
    });
  });

  it('reads the first usage of a CRS that has several, and clips to it', async () => {
    respond({
      'https://epsg.io/25832.proj4':
        '+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
      'https://spatialreference.org/ref/epsg/25832/projjson.json':
        JSON.stringify({
          type: 'ProjectedCRS',
          name: 'ETRS89 / UTM zone 32N',
          usages: [
            {
              scope: 'Engineering survey, topographic mapping.',
              area: 'Europe between 6°E and 12°E: Austria; Denmark - onshore and offshore; Germany - onshore and offshore; Italy - onshore and offshore; Norway including Svalbard - onshore and offshore; Spain - offshore.',
              bbox: {
                south_latitude: 36.53,
                west_longitude: 6,
                north_latitude: 84.01,
                east_longitude: 12.01,
              },
            },
            {
              scope:
                'Pan-European conformal mapping at scales larger than 1:500,000.',
              area: "Europe between 6°E and 12°E and approximately 36°30'N to 84°N.",
              bbox: {
                south_latitude: 36.53,
                west_longitude: 6,
                north_latitude: 84.01,
                east_longitude: 12.01,
              },
            },
          ],
        }),
    });
    const record = await lookupEPSG(25832);
    expect(record.scope).toBe('Engineering survey, topographic mapping.');
    expect(record.bbox).toEqual({
      west: 6,
      south: 36.53,
      east: 12.01,
      north: 84.01,
    });
    expect(await createProjectedGridSystemFromEPSG(25832)).toBeInstanceOf(
      PolygonClippedGridSystem,
    );
  });

  it('carries an area across the antimeridian past 180', async () => {
    respond({
      'https://epsg.io/3832.proj4':
        '+proj=merc +lon_0=150 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs +type=crs',
      'https://spatialreference.org/ref/epsg/3832/projjson.json':
        JSON.stringify({
          name: 'WGS 84 / PDC Mercator',
          bbox: {
            south_latitude: -60,
            west_longitude: 98.69,
            north_latitude: 66.67,
            east_longitude: -68,
          },
        }),
    });
    const { bbox } = await lookupEPSG(3832);
    expect(bbox).toEqual({ west: 98.69, south: -60, east: 292, north: 66.67 });
  });

  it('shares its cache with createProjectedGridSystemFromEPSG', async () => {
    const calls = respond({
      'https://epsg.io/27395.proj4': NGO_II_PROJ4.replace(
        '-2.33333333333333',
        '6.16666666666667',
      ),
      'https://spatialreference.org/ref/epsg/27395/projjson.json':
        JSON.stringify({
          name: 'NGO 1948 (Oslo) / NGO zone V',
          bbox: NGO_II_BBOX,
        }),
    });
    const [record] = await Promise.all([
      lookupEPSG(27395),
      createProjectedGridSystemFromEPSG(27395),
    ]);
    expect(record.name).toBe('NGO 1948 (Oslo) / NGO zone V');
    expect(calls).toHaveLength(2);
  });
});

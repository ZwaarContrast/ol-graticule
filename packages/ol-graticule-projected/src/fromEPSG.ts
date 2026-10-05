import proj4 from 'proj4';
import {
  PolygonClippedGridSystem,
  extentFromPolygon,
} from '@zwaarcontrast/ol-graticule';

import { ProjectedGridSystem } from './grid-systems/ProjectedGridSystem.js';
import type { ProjectedGridSystemOptions } from './grid-systems/ProjectedGridSystem.js';
import { registerCRS, syncOlProjections } from './registerCRS.js';

type Ring = Array<[number, number]>;

/** EPSG area of use as a WGS84 lon/lat box. */
interface AreaOfUse {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** Where definitions and areas of use are fetched from. */
export interface EPSGSources {
  /** proj4 string for an EPSG number. Defaults to epsg.io, which includes `+towgs84`. */
  definitionUrl?: (code: number) => string;
  /** PROJJSON carrying a `bbox` for an EPSG number. Defaults to spatialreference.org. */
  areaOfUseUrl?: (code: number) => string;
}

export interface EPSGGridSystemOptions extends Omit<
  ProjectedGridSystemOptions,
  'crs' | 'extent'
> {
  sources?: EPSGSources;
}

const DEFAULT_SOURCES: Required<EPSGSources> = {
  definitionUrl: (code) => `https://epsg.io/${code}.proj4`,
  areaOfUseUrl: (code) =>
    `https://spatialreference.org/ref/epsg/${code}/projjson.json`,
};

const EXTENT_MARGIN_M = 100_000;
const EDGE_SAMPLES = 8;

/** In-flight or settled lookups per code, shared by concurrent callers. */
const lookups = new Map<number, Promise<AreaOfUse | undefined>>();

function epsgNumber(code: number | string): number {
  const n =
    typeof code === 'number' ? code : Number(code.replace(/^EPSG:/i, ''));
  if (!Number.isInteger(n) || n <= 0)
    throw new Error(`Not an EPSG code: ${String(code)}`);
  return n;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Unexpected response from ${url}: ${response.status}`);
  return response.text();
}

/** Grid files become optional, falling back to no shift until `loadNadgrid`. */
function optionalGrids(def: string): string {
  return def.replace(/\+nadgrids=(\S+)/g, (_, list: string) => {
    const grids = list.split(',').map((g) => (g.startsWith('@') ? g : `@${g}`));
    if (!grids.includes('@null')) grids.push('@null');
    return `+nadgrids=${grids.join(',')}`;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function areaOfUse(projjson: unknown): AreaOfUse | undefined {
  if (!isRecord(projjson)) return undefined;
  const bbox = projjson['bbox'];
  if (!isRecord(bbox)) return undefined;
  const { west_longitude, south_latitude, east_longitude, north_latitude } =
    bbox;
  if (
    typeof west_longitude !== 'number' ||
    typeof south_latitude !== 'number' ||
    typeof east_longitude !== 'number' ||
    typeof north_latitude !== 'number'
  )
    return undefined;
  return {
    west: west_longitude,
    south: south_latitude,
    east:
      east_longitude < west_longitude ? east_longitude + 360 : east_longitude,
    north: north_latitude,
  };
}

async function lookup(
  code: number,
  sources: Required<EPSGSources>,
): Promise<AreaOfUse | undefined> {
  const crs = `EPSG:${code}`;
  const [def, projjson] = await Promise.all([
    proj4.defs(crs) ? undefined : fetchText(sources.definitionUrl(code)),
    fetchText(sources.areaOfUseUrl(code)).then(
      (text): unknown => JSON.parse(text),
      () => undefined,
    ),
  ]);
  if (def !== undefined) registerCRS(crs, optionalGrids(def.trim()));
  else syncOlProjections();
  return areaOfUse(projjson);
}

/** The area of use as a closed WGS84 ring, densified along each edge. */
function areaRing({ west, south, east, north }: AreaOfUse): Ring {
  const ring: Ring = [];
  const edge = (from: [number, number], to: [number, number]) => {
    for (let i = 0; i < EDGE_SAMPLES; i++) {
      const t = i / EDGE_SAMPLES;
      ring.push([
        from[0] + (to[0] - from[0]) * t,
        from[1] + (to[1] - from[1]) * t,
      ]);
    }
  };
  edge([west, south], [east, south]);
  edge([east, south], [east, north]);
  edge([east, north], [west, north]);
  edge([west, north], [west, south]);
  return ring;
}

/**
 * A projected grid for any EPSG code, fetched at runtime: the proj4
 * definition from epsg.io and the EPSG area of use from spatialreference.org.
 * The grid is clipped to that area; without one it is returned unclipped.
 *
 * Lookups are cached per code for the session, and a code already registered
 * with proj4 is not fetched again. `+nadgrids` references are made optional,
 * so load the grid with `loadNadgrid` for the full datum shift.
 *
 * ```ts
 * const grid = await createProjectedGridSystemFromEPSG(27700);
 * map.addLayer(new UniversalGraticule({ gridSystem: grid }));
 * ```
 */
export async function createProjectedGridSystemFromEPSG(
  code: number | string,
  options: EPSGGridSystemOptions = {},
): Promise<PolygonClippedGridSystem | ProjectedGridSystem> {
  const { sources, ...gridOptions } = options;
  const n = epsgNumber(code);
  const crs = `EPSG:${n}`;
  let pending = lookups.get(n);
  if (!pending) {
    pending = lookup(n, { ...DEFAULT_SOURCES, ...sources });
    lookups.set(n, pending);
    pending.catch(() => lookups.delete(n));
  }
  const area = await pending;
  if (!area) return new ProjectedGridSystem({ ...gridOptions, crs });

  const ring = areaRing(area);
  const toGrid = proj4('EPSG:4326', crs);
  const projected = ring.map(([lon, lat]): [number, number] => {
    const [x, y] = toGrid.forward([lon, lat]);
    return [x ?? 0, y ?? 0];
  });
  return new PolygonClippedGridSystem({
    source: new ProjectedGridSystem({
      ...gridOptions,
      crs,
      extent: extentFromPolygon(projected, EXTENT_MARGIN_M),
    }),
    clipPolygon: { rings: [ring], crs: 'EPSG:4326' },
  });
}

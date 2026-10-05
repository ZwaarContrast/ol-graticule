import proj4 from 'proj4';
import {
  PolygonClippedGridSystem,
  extentFromPolygon,
} from '@zwaarcontrast/ol-graticule';
import {
  ProjectedGridSystem,
  registerCRS,
} from '@zwaarcontrast/ol-graticule-projected';
import type { ProjectedGridSystemOptions } from '@zwaarcontrast/ol-graticule-projected';
import {
  NEI_EQUATORIAL_ZONE_CRS,
  NEI_EQUATORIAL_ZONE_PROJ4,
  NEI_EQUATORIAL_ZONE_VALIDITY_WGS84,
  NEI_SOUTHERN_ZONE_CRS,
  NEI_SOUTHERN_ZONE_PROJ4,
  NEI_SOUTHERN_ZONE_VALIDITY_WGS84,
} from './zones.js';

type Ring = ReadonlyArray<readonly [number, number]>;

const EXTENT_MARGIN_M = 100_000;

/** Options every NEI grid-system factory accepts; CRS and extent are fixed. */
export type NEIGridSystemOptions = Omit<
  ProjectedGridSystemOptions,
  'crs' | 'proj4Def' | 'extent'
>;

/** Grid system for one zone, clipped to its WGS84 validity ring. */
function createNEIGridSystem(
  crs: string,
  proj4Def: string,
  validityWgs84: Ring,
  options?: NEIGridSystemOptions,
): PolygonClippedGridSystem {
  registerCRS(crs, proj4Def);
  const toGrid = proj4('EPSG:4326', proj4Def);
  const projected = validityWgs84.map(([lon, lat]): [number, number] => {
    const [x, y] = toGrid.forward([lon, lat]);
    return [x ?? 0, y ?? 0];
  });
  return new PolygonClippedGridSystem({
    source: new ProjectedGridSystem({
      ...options,
      crs,
      extent: extentFromPolygon(projected, EXTENT_MARGIN_M),
    }),
    clipPolygon: { rings: [validityWgs84], crs: 'EPSG:4326' },
  });
}

export function createNEISouthernZoneGridSystem(
  options?: NEIGridSystemOptions,
): PolygonClippedGridSystem {
  return createNEIGridSystem(
    NEI_SOUTHERN_ZONE_CRS,
    NEI_SOUTHERN_ZONE_PROJ4,
    NEI_SOUTHERN_ZONE_VALIDITY_WGS84,
    options,
  );
}

export function createNEIEquatorialZoneGridSystem(
  options?: NEIGridSystemOptions,
): PolygonClippedGridSystem {
  return createNEIGridSystem(
    NEI_EQUATORIAL_ZONE_CRS,
    NEI_EQUATORIAL_ZONE_PROJ4,
    NEI_EQUATORIAL_ZONE_VALIDITY_WGS84,
    options,
  );
}

/** A single NEI grid zone, shaped like a `GSGS_GRIDS` entry. */
export interface NEIGrid {
  readonly crs: string;
  /** Human-readable name, e.g. "NEI Southern Zone". */
  readonly name: string;
  readonly proj4: string;
  createGridSystem(): PolygonClippedGridSystem;
  /** Validity as WGS84 lon/lat rings. */
  readonly validityWgs84: ReadonlyArray<Ring>;
}

/** Every NEI grid zone, keyed by CRS. */
export const NEI_GRIDS: Readonly<Record<string, NEIGrid>> = {
  [NEI_SOUTHERN_ZONE_CRS]: {
    crs: NEI_SOUTHERN_ZONE_CRS,
    name: 'NEI Southern Zone',
    proj4: NEI_SOUTHERN_ZONE_PROJ4,
    createGridSystem: () => createNEISouthernZoneGridSystem(),
    validityWgs84: [NEI_SOUTHERN_ZONE_VALIDITY_WGS84],
  },
  [NEI_EQUATORIAL_ZONE_CRS]: {
    crs: NEI_EQUATORIAL_ZONE_CRS,
    name: 'NEI Equatorial Zone',
    proj4: NEI_EQUATORIAL_ZONE_PROJ4,
    createGridSystem: () => createNEIEquatorialZoneGridSystem(),
    validityWgs84: [NEI_EQUATORIAL_ZONE_VALIDITY_WGS84],
  },
};

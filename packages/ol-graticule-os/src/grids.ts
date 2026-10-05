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
  OS_YARD_GRID_CRS,
  OS_YARD_GRID_PROJ4,
  OS_YARD_GRID_VALIDITY,
  OS_YARD_GRID_VALIDITY_WGS84,
} from './yardGrid.js';
import { YardFormatter } from './YardFormatter.js';

type Ring = ReadonlyArray<readonly [number, number]>;

const EXTENT_MARGIN_YD = 100_000;

/** Options the yard grid factory accepts; CRS and extent are fixed. */
export type OSGridSystemOptions = Omit<
  ProjectedGridSystemOptions,
  'crs' | 'proj4Def' | 'extent'
>;

/** The OS yard grid, clipped to the Quarter-inch Fourth Edition sheet faces. */
export function createOSYardGridSystem(
  options?: OSGridSystemOptions,
): PolygonClippedGridSystem {
  registerCRS(OS_YARD_GRID_CRS, OS_YARD_GRID_PROJ4);
  return new PolygonClippedGridSystem({
    source: new ProjectedGridSystem({
      formatter: new YardFormatter(),
      ...options,
      crs: OS_YARD_GRID_CRS,
      extent: extentFromPolygon(OS_YARD_GRID_VALIDITY, EXTENT_MARGIN_YD),
    }),
    clipPolygon: { rings: [OS_YARD_GRID_VALIDITY], crs: OS_YARD_GRID_CRS },
  });
}

/** A single OS grid, shaped like a `GSGS_GRIDS` entry. */
export interface OSGrid {
  readonly crs: string;
  /** Human-readable name, e.g. "OS yard grid". */
  readonly name: string;
  readonly proj4: string;
  createGridSystem(): PolygonClippedGridSystem;
  /** Validity as WGS84 lon/lat rings. */
  readonly validityWgs84: ReadonlyArray<Ring>;
}

/** Every OS grid, keyed by CRS. */
export const OS_GRIDS: Readonly<Record<string, OSGrid>> = {
  [OS_YARD_GRID_CRS]: {
    crs: OS_YARD_GRID_CRS,
    name: 'OS yard grid',
    proj4: OS_YARD_GRID_PROJ4,
    createGridSystem: () => createOSYardGridSystem(),
    validityWgs84: [OS_YARD_GRID_VALIDITY_WGS84],
  },
};

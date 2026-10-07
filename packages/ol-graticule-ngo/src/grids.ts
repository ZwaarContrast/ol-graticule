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
import { NGO_STRIPS } from './strips.js';
import type { NGOStripDefinition, NGOStripNumber } from './strips.js';

type Ring = ReadonlyArray<readonly [number, number]>;

const EXTENT_MARGIN_M = 100_000;

/** Options every strip grid-system factory accepts; CRS and extent are fixed. */
export type NGOGridSystemOptions = Omit<
  ProjectedGridSystemOptions,
  'crs' | 'proj4Def' | 'extent'
>;

/** Grid system for one strip, clipped to where German sheets print it. */
export function createNGOStripGridSystem(
  strip: NGOStripNumber,
  options?: NGOGridSystemOptions,
): PolygonClippedGridSystem {
  const { crs, proj4: def, printedValidityWgs84: validity } = NGO_STRIPS[strip];
  registerCRS(crs, def);
  const toGrid = proj4('EPSG:4326', def);
  const projected = validity.map(([lon, lat]): [number, number] => {
    const [x, y] = toGrid.forward([lon, lat]);
    return [x ?? 0, y ?? 0];
  });
  return new PolygonClippedGridSystem({
    source: new ProjectedGridSystem({
      ...options,
      crs,
      extent: extentFromPolygon(projected, EXTENT_MARGIN_M),
    }),
    clipPolygon: { rings: [validity], crs: 'EPSG:4326' },
  });
}

/** A single strip, shaped like a `GSGS_GRIDS` entry. */
export interface NGOGrid {
  readonly crs: string;
  /** Human-readable name, e.g. "Norwegian strip II". */
  readonly name: string;
  readonly proj4: string;
  createGridSystem(): PolygonClippedGridSystem;
  /** Where German sheets print the strip, as WGS84 lon/lat rings. */
  readonly validityWgs84: ReadonlyArray<Ring>;
}

function toGrid(def: NGOStripDefinition): NGOGrid {
  return {
    crs: def.crs,
    name: `Norwegian strip ${def.strip}`,
    proj4: def.proj4,
    createGridSystem: () => createNGOStripGridSystem(def.strip),
    validityWgs84: [def.printedValidityWgs84],
  };
}

/** Every strip, keyed by CRS. */
export const NGO_GRIDS: Readonly<Record<string, NGOGrid>> = Object.fromEntries(
  Object.values(NGO_STRIPS).map((def) => [def.crs, toGrid(def)]),
);

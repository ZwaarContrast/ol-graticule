import {
  PolygonClippedGridSystem,
  extentFromPolygon,
} from '@zwaarcontrast/ol-graticule';
import {
  ProjectedGridSystem,
  registerCRS,
} from '@zwaarcontrast/ol-graticule-projected';
import type { ProjectedGridSystemOptions } from '@zwaarcontrast/ol-graticule-projected';
import { MBSFormatter } from '../formatters/MBSFormatter.js';
import type { MBSLetterScheme } from '../formatters/schemes.js';
import { MBSIntervals } from '../intervals/MBSIntervals.js';

/** Caller-settable {@link ProjectedGridSystem} options for an MBS theatre factory. */
export type MBSProjOptions = Omit<
  ProjectedGridSystemOptions,
  'crs' | 'proj4Def' | 'extent' | 'formatter' | 'intervals'
>;

/** Options every MBS theatre grid-system factory accepts. */
export type MBSGridSystemOptions = MBSProjOptions & {
  /** Override the default coverage polygon; coordinates in the theatre's CRS metres. */
  clipPolygon?: [number, number][] | undefined;
};

/**
 * Assemble a {@link PolygonClippedGridSystem} from an already-registered CRS, its
 * letter scheme, and a coverage polygon. An `MBSIntervals` drives both the inner
 * grid's line spacing and the clip system's cell snapping. Shared by every MBS
 * theatre factory; theatres that compute their own proj4 (Nord de Guerre's datum
 * override) register their CRS and call this directly with a fixed `extent`.
 */
export function assembleMBSGridSystem(
  crs: string,
  scheme: MBSLetterScheme,
  clip: [number, number][],
  projOptions: MBSProjOptions,
  extent?: [number, number, number, number],
): PolygonClippedGridSystem {
  const intervals = new MBSIntervals();
  const inner = new ProjectedGridSystem({
    ...projOptions,
    crs,
    extent: extent ?? extentFromPolygon(clip, 50_000),
    formatter: new MBSFormatter(scheme),
    intervals,
  });
  return new PolygonClippedGridSystem({
    source: inner,
    clipPolygon: { rings: [clip], crs },
    cellSnapInterval: (resolution, viewProjection) =>
      intervals.getInterval(resolution, viewProjection),
  });
}

/**
 * Register a theatre's CRS and build its clipped grid system. For theatres whose
 * proj4 string is a fixed constant; theatres that compute proj4 (Nord de Guerre's
 * datum override) register their own CRS and call {@link assembleMBSGridSystem}.
 */
export function createMBSGridSystem(
  crs: string,
  proj4: string,
  scheme: MBSLetterScheme,
  defaultClip: [number, number][],
  options?: MBSGridSystemOptions,
): PolygonClippedGridSystem {
  registerCRS(crs, proj4);
  const { clipPolygon, ...projOptions } = options ?? {};
  return assembleMBSGridSystem(crs, scheme, clipPolygon ?? defaultClip, projOptions);
}

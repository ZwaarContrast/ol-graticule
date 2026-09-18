import { describe, expect, it } from 'vitest';
import { getTransform } from 'ol/proj';
import LineString from 'ol/geom/LineString';
import { snapRingToCellGrid } from '@zwaarcontrast/ol-graticule';
import {
  NORD_DE_GUERRE_CRS,
  NORD_DE_GUERRE_CLIP_POLYGON,
} from '../NordDeGuerre.js';
import { createNordDeGuerreGridSystem } from '../NordDeGuerre.grid.js';

const VIEW = 'EPSG:3857';
const resAt = (zoom: number): number => 156543.03392804097 / 2 ** zoom;

/**
 * A grid line lying ON the snapped coverage edge must survive clipping whole.
 * It is only as accurate as its own densification (about a pixel of chord sag),
 * so a clip tighter than that chops it into fragments with visible gaps — worst
 * when zoomed out, where a pixel of sag is kilometres on the ground.
 */
describe('Nord de Guerre coverage-edge lines', () => {
  const ring =
    snapRingToCellGrid(NORD_DE_GUERRE_CLIP_POLYGON, 100_000)[0] ?? [];

  it.each([5, 6, 7, 8, 10, 12])(
    'are emitted as one unbroken piece at z%i',
    (zoom) => {
      const grid = createNordDeGuerreGridSystem();
      const toView = getTransform(NORD_DE_GUERRE_CRS, VIEW);
      const res = resAt(zoom);
      const broken: string[] = [];

      for (let i = 0; i < ring.length; i++) {
        const a = ring[i]!;
        const b = ring[(i + 1) % ring.length]!;
        const axis = Math.abs(b[0] - a[0]) < 1 ? 'x' : 'y';
        const value = axis === 'x' ? a[0] : a[1];
        const mid = toView(
          [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
          undefined,
          2,
        );
        const extent: [number, number, number, number] = [
          (mid[0] ?? 0) - 512 * res,
          (mid[1] ?? 0) - 384 * res,
          (mid[0] ?? 0) + 512 * res,
          (mid[1] ?? 0) + 384 * res,
        ];
        const pieces = grid
          .getFeatures(extent, res, VIEW)
          .filter(
            (f) => f.get('gridAxis') === axis && f.get('gridValue') === value,
          );
        if (pieces.length !== 1) {
          broken.push(
            `edge ${i} (${axis}=${value / 1000}k): ${pieces.length} pieces`,
          );
          continue;
        }
        // The one piece must reach both ends of this ring edge.
        const geom = pieces[0]?.getGeometry();
        if (!(geom instanceof LineString)) {
          broken.push(`edge ${i} (${axis}=${value / 1000}k): no geometry`);
          continue;
        }
        const e = geom.getExtent();
        const lo = axis === 'x' ? (e[1] ?? 0) : (e[0] ?? 0);
        const hi = axis === 'x' ? (e[3] ?? 0) : (e[2] ?? 0);
        const ends = [
          toView([a[0], a[1]], undefined, 2),
          toView([b[0], b[1]], undefined, 2),
        ];
        const eLo = Math.min(
          ...ends.map((p) => (axis === 'x' ? (p[1] ?? 0) : (p[0] ?? 0))),
        );
        const eHi = Math.max(
          ...ends.map((p) => (axis === 'x' ? (p[1] ?? 0) : (p[0] ?? 0))),
        );
        const want = [
          Math.max(lo, eLo, axis === 'x' ? extent[1] : extent[0]),
          Math.min(hi, eHi, axis === 'x' ? extent[3] : extent[2]),
        ];
        const covered =
          (want[1]! - want[0]!) /
          Math.min(
            eHi - eLo,
            axis === 'x' ? extent[3] - extent[1] : extent[2] - extent[0],
          );
        if (covered < 0.99) {
          broken.push(
            `edge ${i} (${axis}=${value / 1000}k): covers ${(covered * 100).toFixed(0)}% of the edge`,
          );
        }
      }

      expect(
        broken,
        `fragmented coverage-edge lines:\n${broken.join('\n')}`,
      ).toHaveLength(0);
    },
  );
});

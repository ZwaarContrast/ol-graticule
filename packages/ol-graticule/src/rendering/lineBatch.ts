/**
 * Packing grid-line geometry into GPU vertex/index buffers, and resolving an
 * OpenLayers line style into the per-bucket uniforms the shader draws with.
 */

import LineString from 'ol/geom/LineString';
import MultiLineString from 'ol/geom/MultiLineString';
import Stroke from 'ol/style/Stroke';
import Style from 'ol/style/Style';
import type Feature from 'ol/Feature';
import type Geometry from 'ol/geom/Geometry';
import type { GraticuleLineStyle } from '../style.js';
import { isMajorMinor, DEFAULT_LINE_STROKE, DEFAULT_MINOR_LINE_STROKE } from '../style.js';
import { toRgbaNormalized } from '../util/color.js';
import { MAX_DASH, LINE_STRIDE } from './shaders.js';

export interface LineBucket {
  color: [number, number, number, number];
  width: number;
  dashPattern: Float32Array;
  dashCount: number;
  dashPeriod: number;
  dashOffset: number;
}
export interface BucketSpec {
  list: LineBucket[];
  classify: (feature: Feature<Geometry>) => number;
}
export interface LineBatch {
  vf: Float32Array<ArrayBuffer>;
  vfLen: number;
  iu: Uint32Array<ArrayBuffer>;
  iuLen: number;
}

function writeLineVertex(
  batch: LineBatch, x: number, y: number, dx: number, dy: number, side: number, dist: number,
): void {
  const vf = batch.vf;
  let o = batch.vfLen;
  vf[o++] = x;
  vf[o++] = y;
  vf[o++] = dx;
  vf[o++] = dy;
  vf[o++] = side;
  vf[o++] = dist;
  batch.vfLen = o;
}

/** Grow so `len + need` fits, preserving contents; returns `buf` when it already does. */
export function growF32(
  buf: Float32Array<ArrayBuffer>,
  len: number,
  need: number,
): Float32Array<ArrayBuffer> {
  if (len + need <= buf.length) return buf;
  const grown = new Float32Array(Math.max(buf.length * 2, len + need));
  grown.set(buf);
  return grown;
}

export function growU32(
  buf: Uint32Array<ArrayBuffer>,
  len: number,
  need: number,
): Uint32Array<ArrayBuffer> {
  if (len + need <= buf.length) return buf;
  const grown = new Uint32Array(Math.max(buf.length * 2, len + need));
  grown.set(buf);
  return grown;
}

function ensureLineCapacity(batch: LineBatch, vFloats: number, iInts: number): void {
  batch.vf = growF32(batch.vf, batch.vfLen, vFloats);
  batch.iu = growU32(batch.iu, batch.iuLen, iInts);
}

export function appendGeometryFlat(
  geom: Geometry | undefined,
  offset: number,
  cx: number,
  cy: number,
  batch: LineBatch,
): void {
  if (geom instanceof LineString) {
    appendFlatLine(geom.getFlatCoordinates(), geom.getStride(), 0, geom.getFlatCoordinates().length, offset, cx, cy, batch);
  } else if (geom instanceof MultiLineString) {
    const flat = geom.getFlatCoordinates();
    const stride = geom.getStride();
    const ends = geom.getEnds();
    let start = 0;
    for (let e = 0; e < ends.length; e++) {
      const end = ends[e] ?? 0;
      appendFlatLine(flat, stride, start, end, offset, cx, cy, batch);
      start = end;
    }
  }
}

function appendFlatLine(
  flat: number[],
  stride: number,
  start: number,
  end: number,
  offset: number,
  cx: number,
  cy: number,
  batch: LineBatch,
): void {
  if (end - start < 2 * stride) return;
  let dist = 0;
  let prevX = (flat[start] ?? 0) + offset - cx;
  let prevY = (flat[start + 1] ?? 0) - cy;
  for (let i = start + stride; i + 1 < end; i += stride) {
    const x = (flat[i] ?? 0) + offset - cx;
    const y = (flat[i + 1] ?? 0) - cy;
    const segLen = Math.hypot(x - prevX, y - prevY);
    if (segLen > 0) {
      appendSegment(batch, prevX, prevY, x, y, dist, dist + segLen);
      dist += segLen;
    }
    prevX = x;
    prevY = y;
  }
}

function appendSegment(
  batch: LineBatch, ax: number, ay: number, bx: number, by: number, distA: number, distB: number,
): void {
  ensureLineCapacity(batch, 4 * LINE_STRIDE, 6);
  const dx = bx - ax;
  const dy = by - ay;
  const base = batch.vfLen / LINE_STRIDE;
  writeLineVertex(batch, ax, ay, dx, dy, -1, distA);
  writeLineVertex(batch, ax, ay, dx, dy, 1, distA);
  writeLineVertex(batch, bx, by, dx, dy, -1, distB);
  writeLineVertex(batch, bx, by, dx, dy, 1, distB);
  const iu = batch.iu;
  iu[batch.iuLen++] = base;
  iu[batch.iuLen++] = base + 1;
  iu[batch.iuLen++] = base + 2;
  iu[batch.iuLen++] = base + 2;
  iu[batch.iuLen++] = base + 1;
  iu[batch.iuLen++] = base + 3;
}

export function resolveBuckets(style: GraticuleLineStyle | undefined): BucketSpec {
  const config = style ?? { major: DEFAULT_LINE_STROKE, minor: DEFAULT_MINOR_LINE_STROKE };

  if (config instanceof Stroke) {
    return { list: [strokeToBucket(config)], classify: () => 0 };
  }

  if (isMajorMinor(config)) {
    const list = [strokeToBucket(config.major), strokeToBucket(config.minor ?? DEFAULT_MINOR_LINE_STROKE)];
    let boundaryIdx = 0;
    if (config.boundary) {
      list.push(strokeToBucket(config.boundary));
      boundaryIdx = 2;
    }
    return {
      list,
      classify: (feature) => {
        const type = feature.get('gridLineType');
        if (type === 'minor') return 1;
        if (type === 'boundary') return boundaryIdx;
        return 0;
      },
    };
  }

  if (config instanceof Style && config.getStroke()) {
    return { list: [strokeToBucket(config.getStroke()!)], classify: () => 0 };
  }

  throw new TypeError(
    'WebGLGraticuleLayer line style must be a Stroke or { major, minor?, boundary? }; ' +
    'a raw StyleLike cannot render on the WebGL line layer.',
  );
}

function strokeToBucket(stroke: Stroke): LineBucket {
  const [r, g, b, a] = toRgbaNormalized(stroke.getColor(), 0.2);
  const pattern = resolveDashPattern(stroke.getLineDash());
  return {
    color: [r, g, b, a],
    width: stroke.getWidth() ?? 1,
    dashPattern: new Float32Array(pattern),
    dashCount: pattern.length,
    dashPeriod: pattern.reduce((sum, v) => sum + v, 0),
    dashOffset: stroke.getLineDashOffset() ?? 0,
  };
}

function resolveDashPattern(dash: number[] | null): number[] {
  if (!dash || dash.length === 0) return [];
  const even = dash.length % 2 === 1 ? dash.concat(dash) : dash;
  return even.length > MAX_DASH ? even.slice(0, MAX_DASH) : even;
}

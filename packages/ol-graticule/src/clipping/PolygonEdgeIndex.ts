import { createEmpty, extendXY } from 'ol/extent';
import type { Extent } from 'ol/extent';

/** Uniform-grid spatial index over a ring's edges for fast bbox queries. */
export class PolygonEdgeIndex {
  private readonly edgeBuf_: Float64Array;
  private readonly numEdges_: number;
  private readonly extent_: Extent;
  private readonly cells_: number;
  private readonly cellSizeX_: number;
  private readonly cellSizeY_: number;
  private readonly buckets_: number[][];
  private readonly visitedGen_: Int32Array;
  private currentGen_: number = 0;

  constructor(
    input: ReadonlyArray<readonly [number, number]>
      | ReadonlyArray<ReadonlyArray<readonly [number, number]>>,
  ) {
    const rings = normaliseRings_(input);
    let totalEdges = 0;
    for (let r = 0; r < rings.length; r++) {
      const m = rings[r]!.length;
      if (m < 3) {
        throw new Error(`PolygonEdgeIndex: ring needs at least 3 vertices, got ${m}`);
      }
      totalEdges += m;
    }
    this.numEdges_ = totalEdges;
    this.edgeBuf_ = new Float64Array(totalEdges * 4);

    const extent = createEmpty();
    let edgeIdx = 0;
    for (let r = 0; r < rings.length; r++) {
      const ring = rings[r]!;
      const m = ring.length;
      for (let i = 0; i < m; i++) {
        const p0 = ring[i]!;
        const p1 = ring[(i + 1) % m]!;
        const base = edgeIdx * 4;
        this.edgeBuf_[base] = p0[0];
        this.edgeBuf_[base + 1] = p0[1];
        this.edgeBuf_[base + 2] = p1[0];
        this.edgeBuf_[base + 3] = p1[1];
        extendXY(extent, p0[0], p0[1]);
        edgeIdx++;
      }
    }
    this.extent_ = extent;
    const [minX, minY, maxX, maxY] = extent;

    this.cells_ = Math.max(1, Math.ceil(Math.sqrt(totalEdges)));
    this.cellSizeX_ = (maxX - minX) / this.cells_ || 1;
    this.cellSizeY_ = (maxY - minY) / this.cells_ || 1;

    this.buckets_ = new Array(this.cells_ * this.cells_);
    for (let i = 0; i < this.buckets_.length; i++) this.buckets_[i] = [];

    for (let i = 0; i < totalEdges; i++) {
      const base = i * 4;
      const x0 = this.edgeBuf_[base]!;
      const y0 = this.edgeBuf_[base + 1]!;
      const x1 = this.edgeBuf_[base + 2]!;
      const y1 = this.edgeBuf_[base + 3]!;
      const eMinX = x0 < x1 ? x0 : x1;
      const eMaxX = x0 < x1 ? x1 : x0;
      const eMinY = y0 < y1 ? y0 : y1;
      const eMaxY = y0 < y1 ? y1 : y0;
      const cxMin = this.clampCellX_(eMinX);
      const cxMax = this.clampCellX_(eMaxX);
      const cyMin = this.clampCellY_(eMinY);
      const cyMax = this.clampCellY_(eMaxY);
      for (let cx = cxMin; cx <= cxMax; cx++) {
        for (let cy = cyMin; cy <= cyMax; cy++) {
          this.buckets_[cx * this.cells_ + cy]!.push(i);
        }
      }
    }

    this.visitedGen_ = new Int32Array(totalEdges);
  }

  /** Ring AABB `[minX, minY, maxX, maxY]`. */
  get ringExtent(): Extent {
    return this.extent_;
  }

  get edgeCount(): number {
    return this.numEdges_;
  }

  /** Copy edge `edgeId`'s endpoints into `out`. */
  readEdge(edgeId: number, out: EdgeBuffer): void {
    const base = edgeId * 4;
    out.x1 = this.edgeBuf_[base]!;
    out.y1 = this.edgeBuf_[base + 1]!;
    out.x2 = this.edgeBuf_[base + 2]!;
    out.y2 = this.edgeBuf_[base + 3]!;
  }

  /** Even-odd ray-casting point-in-ring test using the bucket index. */
  pointInRing(x: number, y: number): boolean {
    if (x < this.extent_[0] || x > this.extent_[2] ||
        y < this.extent_[1] || y > this.extent_[3]) {
      return false;
    }
    this.currentGen_++;
    const gen = this.currentGen_;
    const buf = this.edgeBuf_;
    const visited = this.visitedGen_;
    let inside = false;
    const cxMin = this.clampCellX_(x);
    const cxMax = this.cells_ - 1;
    const cy = this.clampCellY_(y);
    for (let cx = cxMin; cx <= cxMax; cx++) {
      const bucket = this.buckets_[cx * this.cells_ + cy]!;
      for (let k = 0; k < bucket.length; k++) {
        const edgeId = bucket[k]!;
        if (visited[edgeId] === gen) continue;
        visited[edgeId] = gen;
        const base = edgeId * 4;
        const xi = buf[base]!;
        const yi = buf[base + 1]!;
        const xj = buf[base + 2]!;
        const yj = buf[base + 3]!;
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
          inside = !inside;
        }
      }
    }
    return inside;
  }

  /** Write deduplicated candidate edge IDs overlapping the AABB into `out`. */
  queryBBox(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    out: number[],
  ): void {
    out.length = 0;
    if (maxX < this.extent_[0] || minX > this.extent_[2] ||
        maxY < this.extent_[1] || minY > this.extent_[3]) {
      return;
    }
    this.currentGen_++;
    const gen = this.currentGen_;
    const cxMin = this.clampCellX_(minX);
    const cxMax = this.clampCellX_(maxX);
    const cyMin = this.clampCellY_(minY);
    const cyMax = this.clampCellY_(maxY);
    for (let cx = cxMin; cx <= cxMax; cx++) {
      for (let cy = cyMin; cy <= cyMax; cy++) {
        const bucket = this.buckets_[cx * this.cells_ + cy]!;
        for (let k = 0; k < bucket.length; k++) {
          const edgeId = bucket[k]!;
          if (this.visitedGen_[edgeId] !== gen) {
            this.visitedGen_[edgeId] = gen;
            out.push(edgeId);
          }
        }
      }
    }
  }

  private clampCellX_(x: number): number {
    const c = Math.floor((x - this.extent_[0]) / this.cellSizeX_);
    if (c < 0) return 0;
    if (c > this.cells_ - 1) return this.cells_ - 1;
    return c;
  }

  private clampCellY_(y: number): number {
    const c = Math.floor((y - this.extent_[1]) / this.cellSizeY_);
    if (c < 0) return 0;
    if (c > this.cells_ - 1) return this.cells_ - 1;
    return c;
  }
}

/** Scratch struct filled by {@link PolygonEdgeIndex.readEdge}. */
export interface EdgeBuffer {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function createEdgeBuffer(): EdgeBuffer {
  return { x1: 0, y1: 0, x2: 0, y2: 0 };
}

type RingInput = ReadonlyArray<readonly [number, number]>;
type MultiRingInput = ReadonlyArray<RingInput>;

function normaliseRings_(
  input: RingInput | MultiRingInput,
): MultiRingInput {
  if (input.length === 0) return [] as unknown as MultiRingInput;
  const first = input[0]!;
  if (Array.isArray(first) && first.length === 2 && typeof first[0] === 'number') {
    return [input as RingInput];
  }
  return input as MultiRingInput;
}

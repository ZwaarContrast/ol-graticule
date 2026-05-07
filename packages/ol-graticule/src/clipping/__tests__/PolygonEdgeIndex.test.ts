import { describe, it, expect } from 'vitest';
import { PolygonEdgeIndex, createEdgeBuffer } from '../PolygonEdgeIndex.js';

describe('PolygonEdgeIndex', () => {
  const square: [number, number][] = [
    [0, 0], [10, 0], [10, 10], [0, 10],
  ];

  it('throws for rings with < 3 vertices', () => {
    expect(() => new PolygonEdgeIndex([[0, 0], [1, 1]])).toThrow();
  });

  it('reports the ring AABB', () => {
    const index = new PolygonEdgeIndex(square);
    expect(index.ringExtent).toEqual([0, 0, 10, 10]);
  });

  it('reports the edge count', () => {
    const index = new PolygonEdgeIndex(square);
    expect(index.edgeCount).toBe(4);
  });

  it('returns candidate edges overlapping a bbox', () => {
    const index = new PolygonEdgeIndex(square);
    const out: number[] = [];
    index.queryBBox(-1, -1, 11, 11, out);
    expect(out.length).toBe(4);
    expect(new Set(out)).toEqual(new Set([0, 1, 2, 3]));
  });

  it('returns no candidates for a bbox outside the ring extent', () => {
    const index = new PolygonEdgeIndex(square);
    const out: number[] = [];
    index.queryBBox(100, 100, 200, 200, out);
    expect(out.length).toBe(0);
  });

  it('deduplicates across buckets', () => {
    // Long thin horizontal ring so its bottom edge spans many cells
    const thin: [number, number][] = [
      [0, 0], [100, 0], [100, 1], [0, 1],
    ];
    const index = new PolygonEdgeIndex(thin);
    const out: number[] = [];
    index.queryBBox(-10, -10, 200, 200, out);
    // Four edges, each unique — dedup must hold.
    expect(new Set(out).size).toBe(out.length);
    expect(out.length).toBe(4);
  });

  it('reuses the out array without leaking from previous queries', () => {
    const index = new PolygonEdgeIndex(square);
    const out: number[] = [];
    index.queryBBox(-1, -1, 11, 11, out);
    expect(out.length).toBe(4);
    index.queryBBox(100, 100, 200, 200, out);
    expect(out.length).toBe(0);
  });

  it('reads edge endpoints into a scratch buffer', () => {
    const index = new PolygonEdgeIndex(square);
    const buf = createEdgeBuffer();
    index.readEdge(0, buf);
    expect(buf).toEqual({ x1: 0, y1: 0, x2: 10, y2: 0 });
    index.readEdge(3, buf);
    expect(buf).toEqual({ x1: 0, y1: 10, x2: 0, y2: 0 });
  });

  it('queries only the spatially relevant edges on a bigger ring', () => {
    // 12-gon around origin
    const n = 12;
    const poly: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      poly.push([Math.cos(a) * 10, Math.sin(a) * 10]);
    }
    const index = new PolygonEdgeIndex(poly);
    const out: number[] = [];
    // Narrow bbox at the +X side — should return only a subset of edges.
    index.queryBBox(9, -1, 11, 1, out);
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThan(n);
  });
});

import type { TransformFunction } from 'ol/proj';

/**
 * Result cache for `(x, y) → (outX, outY)` projection transforms. Grid
 * rendering hits the same input coordinates (cell edges, label centres) on
 * every frame; caching the proj4 output avoids the expensive projection
 * math for repeats.
 *
 * Uses a nested `Map<inputX, Map<inputY, [outX, outY]>>` lookup so hits are
 * one Map.get per axis with no string-key allocation. Bulk-clears once
 * `maxEntries` is exceeded.
 */
export class TransformCache {
  private readonly outer_: Map<number, Map<number, [number, number]>> = new Map();
  private size_ = 0;
  private readonly maxEntries_: number;

  constructor(maxEntries = 8192) {
    this.maxEntries_ = maxEntries;
  }

  get(x: number, y: number): [number, number] | undefined {
    const inner = this.outer_.get(x);
    if (inner === undefined) return undefined;
    return inner.get(y);
  }

  set(x: number, y: number, value: [number, number]): void {
    let inner = this.outer_.get(x);
    const isNewKey = inner === undefined || !inner.has(y);
    if (isNewKey && this.size_ >= this.maxEntries_) {
      this.outer_.clear();
      this.size_ = 0;
      inner = undefined;
    }
    if (inner === undefined) {
      inner = new Map();
      this.outer_.set(x, inner);
    }
    if (isNewKey) this.size_++;
    inner.set(y, value);
  }

  get size(): number {
    return this.size_;
  }

  clear(): void {
    this.outer_.clear();
    this.size_ = 0;
  }
}

/**
 * Project a flat `(x, y, x, y, ...)` buffer through `transformFn`, caching
 * per-point results in `cache`. Missing points are batched into one inner
 * `transformFn` call, then their outputs written back to `output` and
 * stored in the cache for future frames.
 *
 * `input` and `output` may be the same buffer (in-place transform).
 * `stride` must be 2 for the cache lookup; the loop reads `[x, y]` pairs.
 */
export function transformBatchCached(
  input: ReadonlyArray<number>,
  output: number[],
  stride: number,
  transformFn: TransformFunction,
  cache: TransformCache,
): number[] {
  if (stride !== 2) {
    return transformFn(input as number[], output, stride);
  }
  const npts = (input.length / 2) | 0;
  if (npts === 0) return output;
  // Snapshot the miss keys up front: `input` and `output` may alias, so
  // `input[i*2]` is no longer the original key once we start writing back.
  const missIndices: number[] = [];
  const missInputs: number[] = [];
  for (let i = 0; i < npts; i++) {
    const x = input[i * 2]!;
    const y = input[i * 2 + 1]!;
    const hit = cache.get(x, y);
    if (hit !== undefined) {
      output[i * 2] = hit[0];
      output[i * 2 + 1] = hit[1];
    } else {
      missIndices.push(i);
      missInputs.push(x, y);
    }
  }
  if (missInputs.length > 0) {
    const missOutputs = missInputs.slice();
    transformFn(missOutputs, missOutputs, 2);
    for (let k = 0; k < missIndices.length; k++) {
      const i = missIndices[k]!;
      const ox = missOutputs[k * 2]!;
      const oy = missOutputs[k * 2 + 1]!;
      output[i * 2] = ox;
      output[i * 2 + 1] = oy;
      cache.set(missInputs[k * 2]!, missInputs[k * 2 + 1]!, [ox, oy]);
    }
  }
  return output;
}

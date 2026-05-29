/** Reusable interleaved coordinate buffer for one-pass per-frame projection. */
import type { TransformFunction } from 'ol/proj';
import { transformBatchCached, type TransformCache } from './transformCache.js';

export class ProjectionScratch {
  private readonly buf_: number[] = [];

  /** Drop logical length to 0; retain backing store. */
  reset(): void {
    this.buf_.length = 0;
  }

  /** Raw number count (pairs × 2). */
  get length(): number {
    return this.buf_.length;
  }

  /** Append one coordinate pair. */
  push2(x: number, y: number): void {
    this.buf_.push(x, y);
  }

  getX(i: number): number {
    return this.buf_[i * 2]!;
  }

  getY(i: number): number {
    return this.buf_[i * 2 + 1]!;
  }

  /** Project the buffer in place. */
  transform(toView: TransformFunction): void {
    if (this.buf_.length === 0) return;
    toView(this.buf_, this.buf_, 2);
  }

  /** Project the buffer in place, consulting `cache` for repeat (x, y) inputs. */
  transformCached(toView: TransformFunction, cache: TransformCache): void {
    if (this.buf_.length === 0) return;
    transformBatchCached(this.buf_, this.buf_, 2, toView, cache);
  }

  /** Copy a contiguous range out as flat-coord array.
   * @param offset Raw offset into the buffer.
   * @param npts   Number of `(x, y)` pairs to copy. */
  slice(offset: number, npts: number): number[] {
    return this.buf_.slice(offset, offset + npts * 2);
  }

  /** Truncate the buffer to `length` (raw count). */
  truncate(length: number): void {
    this.buf_.length = length;
  }

  /** Direct read-only access to the underlying flat buffer. */
  get raw(): number[] {
    return this.buf_;
  }
}

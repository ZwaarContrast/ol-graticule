import { LruCache } from '@zwaarcontrast/ol-graticule';

/**
 * One grid line's transformed polyline over a perp-axis WINDOW (the viewport
 * span grown by a margin), in view-projection coordinates.
 *
 * A line is identified by `(axis, gridValue)`; the CRS→view transform is
 * pan/zoom invariant, so once a line is transformed for a zoom band it can be
 * re-sliced to the viewport on every later frame without touching proj4 again —
 * only a band change or a pan past the cached window re-transforms it.
 */
export interface LinePolyline {
  /** Zoom band this polyline was sampled for; a change invalidates it. */
  band: number;
  /** Window perp-axis bounds (CRS units), ascending. */
  pMin: number;
  pMax: number;
  /** Sample positions along the perp axis (CRS units), strictly ascending. */
  perps: number[];
  /** Transformed points, flat `[x, y, x, y, …]` in view-projection units. */
  coords: number[];
}

// Slack so a viewport edge sitting exactly on a cached window edge still counts
// as covered (floating-point equality guard).
const COVER_EPS = 1e-6;

/**
 * Per-line cache of transformed polylines, keyed `${axis}${gridValue}`, bounded
 * by an LRU so a long pan across many lines cannot grow it without limit. Stores
 * view-projection coordinates, so it is cleared when the view projection changes.
 */
export class LineTransformCache {
  private readonly cache_: LruCache<string, LinePolyline>;
  private projKey_ = '';

  constructor(max = 1024) {
    this.cache_ = new LruCache(max);
  }

  /** Drop everything if the view projection changed (cached coords are in it). */
  ensureProjection(projKey: string): void {
    if (projKey !== this.projKey_) {
      this.cache_.clear();
      this.projKey_ = projKey;
    }
  }

  /**
   * The cached polyline for this line IF it is sampled for `band` and its window
   * still covers `[vMin, vMax]`; otherwise undefined (caller recomputes + sets).
   */
  get(key: string, band: number, vMin: number, vMax: number): LinePolyline | undefined {
    const entry = this.cache_.get(key);
    if (
      entry !== undefined &&
      entry.band === band &&
      entry.pMin <= vMin + COVER_EPS &&
      entry.pMax >= vMax - COVER_EPS
    ) {
      return entry;
    }
    return undefined;
  }

  set(key: string, entry: LinePolyline): void {
    this.cache_.set(key, entry);
  }

  clear(): void {
    this.cache_.clear();
  }

  get size(): number {
    return this.cache_.size;
  }
}

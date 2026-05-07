import type { Extent } from 'ol/extent';
import type { ProjectionLike } from 'ol/proj';

/** Single-entry memoizer keyed on `(extent, resolution, projection)`. */
export class RenderCache<T> {
  private x0_ = 0;
  private y0_ = 0;
  private x1_ = 0;
  private y1_ = 0;
  private resolution_ = 0;
  private projKey_ = '';
  private value_!: T;
  private has_ = false;

  /** Return cached value when key matches; otherwise compute and cache. */
  get(
    extent: Extent,
    resolution: number,
    projection: ProjectionLike,
    compute: () => T,
  ): T {
    const projKey =
      typeof projection === 'string' ? projection : (projection?.getCode() ?? '');
    if (
      this.has_ &&
      this.resolution_ === resolution &&
      this.x0_ === extent[0] &&
      this.y0_ === extent[1] &&
      this.x1_ === extent[2] &&
      this.y1_ === extent[3] &&
      this.projKey_ === projKey
    ) {
      return this.value_;
    }
    const value = compute();
    this.x0_ = extent[0];
    this.y0_ = extent[1];
    this.x1_ = extent[2];
    this.y1_ = extent[3];
    this.resolution_ = resolution;
    this.projKey_ = projKey;
    this.value_ = value;
    this.has_ = true;
    return value;
  }

  /** Drop the cached entry. */
  invalidate(): void {
    this.has_ = false;
  }
}

import TinySDF from '@mapbox/tiny-sdf';
import { getFontParameters } from 'ol/css';

/** A baked glyph: atlas UV rect, cell size and placement metrics, all CSS px. */
export interface Glyph {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  cellW: number;
  cellH: number;
  bearingLeft: number;
  bearingTop: number;
  advance: number;
}

// SDF encoding: the glyph edge sits at alpha 1 - CUTOFF, and alpha falls off
// linearly by 1 per RADIUS_CSS device px away from the edge (positive distance =
// outside). A wider halo is just a lower threshold on the same field, so one bake
// serves every halo width and colour.
const CUTOFF = 0.25;
const RADIUS_CSS = 8;

/**
 * Bakes glyph SIGNED DISTANCE FIELDS (via `@mapbox/tiny-sdf`) at device
 * resolution into one texture-backed canvas, keyed by character + font, and
 * returns UV rects + placement metrics for a WebGL layer to compose labels from
 * textured quads. The fragment shader reconstructs the glyph edge analytically
 * from the distance, so text is crisp at any sub-pixel position, scale and
 * rotation, and the halo comes free from a second distance threshold — no
 * per-halo re-bake. The atlas is bounded by the distinct glyph shapes on screen
 * (tiny); if it ever fills it resets and re-bakes.
 */
export class GlyphAtlas {
  /** Alpha at the glyph edge; fill is where sampled alpha exceeds it. */
  readonly fillEdge = 1 - CUTOFF;
  /** Distance range in device px, for the shader's halo-edge and AA maths. */
  readonly radiusPx: number;
  /** Padding TinySDF bakes around each glyph (device px), = the pen offset. */
  private readonly bufferPx_: number;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly dpr: number;
  private readonly dim: number;
  private readonly cache = new Map<string, Glyph | null>();
  private readonly baselineCache_ = new Map<string, number>();
  private readonly sdfByFont_ = new Map<string, TinySDF>();
  private shelfX = 0;
  private shelfY = 0;
  private shelfH = 0;
  private dirty = false;
  private readonly onFontsLoaded_ = () => this.reset();

  constructor(dpr: number, dim = 1024) {
    this.dpr = dpr > 0 ? dpr : 1;
    this.radiusPx = RADIUS_CSS * this.dpr;
    this.bufferPx_ = Math.ceil(this.radiusPx);
    this.dim = dim;
    const canvas = document.createElement('canvas');
    canvas.width = dim;
    canvas.height = dim;
    // The atlas ctx is only used to pack SDF bitmaps and to measure baselines,
    // both of which read pixels back, so hint the browser to keep it CPU-side.
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('[ol-graticule] 2D context unavailable for the glyph atlas');
    this.canvas = canvas;
    this.ctx = ctx;
    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.addEventListener('loadingdone', this.onFontsLoaded_);
    }
  }

  /**
   * CSS-px offset from a label's anchor down to its alphabetic baseline for a
   * given `textBaseline`, measured the way the browser (and so the canvas
   * variant) actually places text — instead of approximating it from font
   * ascent/descent, which drifts ~1px for `middle`. Font-level, cached per
   * (font, baseline). Uses the un-scaled CSS font so the result is in CSS px.
   */
  baselineOffset(font: string, baseline: string): number {
    const key = `${font}|${baseline}`;
    const cached = this.baselineCache_.get(key);
    if (cached !== undefined) return cached;
    const ctx = this.ctx;
    ctx.font = font;
    ctx.textAlign = 'left';
    // fontBoundingBoxAscent is measured from the current textBaseline origin, so
    // the drop from the anchor to the alphabetic baseline is the difference.
    ctx.textBaseline = 'alphabetic';
    const alpha = orElse(ctx.measureText('x').fontBoundingBoxAscent, 0);
    ctx.textBaseline = asBaseline(baseline);
    const anchored = orElse(ctx.measureText('x').fontBoundingBoxAscent, 0);
    const offset = alpha - anchored;
    this.baselineCache_.set(key, offset);
    return offset;
  }

  get source(): HTMLCanvasElement {
    return this.canvas;
  }

  takeDirty(): boolean {
    const was = this.dirty;
    this.dirty = false;
    return was;
  }

  /** Force a re-upload of the whole atlas, e.g. after a WebGL context restore
   * replaces the texture with an empty one. */
  markDirty(): void {
    this.dirty = true;
  }

  reset(): void {
    this.cache.clear();
    this.baselineCache_.clear();
    this.shelfX = 0;
    this.shelfY = 0;
    this.shelfH = 0;
    this.ctx.clearRect(0, 0, this.dim, this.dim);
    this.dirty = true;
  }

  dispose(): void {
    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.removeEventListener('loadingdone', this.onFontsLoaded_);
    }
  }

  glyph(char: string, font: string): Glyph | null {
    const key = `${char}|${font}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;
    let baked = this.bake_(char, font);
    if (baked === null && this.cache.size > 0) {
      // Ran out of shelf space: start clean and try once more.
      this.reset();
      baked = this.bake_(char, font);
    }
    this.cache.set(key, baked);
    if (baked) this.dirty = true;
    return baked;
  }

  private sdfFor_(font: string): TinySDF {
    let sdf = this.sdfByFont_.get(font);
    if (!sdf) {
      const { family, weight, style, size } = parseFont(font);
      sdf = new TinySDF({
        fontSize: size * this.dpr,
        buffer: this.bufferPx_,
        radius: this.radiusPx,
        cutoff: CUTOFF,
        fontFamily: family,
        fontWeight: weight,
        fontStyle: style,
      });
      this.sdfByFont_.set(font, sdf);
    }
    return sdf;
  }


  private bake_(char: string, font: string): Glyph | null {
    const dpr = this.dpr;
    const sdf = this.sdfFor_(font);
    const g = sdf.draw(char);
    const advance = g.glyphAdvance / dpr;
    // Whitespace and zero-ink glyphs carry an advance but no quad.
    if (g.width === 0 || g.height === 0) {
      return { u0: 0, v0: 0, u1: 0, v1: 0, cellW: 0, cellH: 0, bearingLeft: 0, bearingTop: 0, advance };
    }
    const cellW = g.width;
    const cellH = g.height;
    if (cellW > this.dim || cellH > this.dim) return null;

    if (this.shelfX + cellW > this.dim) {
      this.shelfX = 0;
      this.shelfY += this.shelfH;
      this.shelfH = 0;
    }
    if (this.shelfY + cellH > this.dim) return null;

    const x = this.shelfX;
    const y = this.shelfY;
    this.shelfX += cellW;
    this.shelfH = Math.max(this.shelfH, cellH);

    // TinySDF returns a single distance channel; store it in RGB (A opaque) so
    // the shader can sample it linearly without alpha premultiplication.
    const img = this.ctx.createImageData(cellW, cellH);
    const px = img.data;
    const d = g.data;
    for (let i = 0; i < d.length; i++) {
      const v = d[i] ?? 0;
      px[i * 4] = v;
      px[i * 4 + 1] = v;
      px[i * 4 + 2] = v;
      px[i * 4 + 3] = 255;
    }
    this.ctx.putImageData(img, x, y);

    return {
      u0: x / this.dim,
      v0: y / this.dim,
      u1: (x + cellW) / this.dim,
      v1: (y + cellH) / this.dim,
      cellW: cellW / dpr,
      cellH: cellH / dpr,
      // The glyph's pen origin sits at (buffer - glyphLeft, buffer + glyphTop)
      // inside the bitmap; the cell's top-left is that offset back from the pen.
      bearingLeft: -(this.bufferPx_ - g.glyphLeft) / dpr,
      bearingTop: -(this.bufferPx_ + g.glyphTop) / dpr,
      advance,
    };
  }
}

function parseFont(font: string): { family: string; weight: string; style: string; size: number } {
  const params = getFontParameters(font);
  if (!params) {
    return { family: font || 'sans-serif', weight: 'normal', style: 'normal', size: 10 };
  }
  const size = parseFloat(params.size);
  return {
    family: params.families && params.families.length > 0 ? params.families.join(', ') : (params.family || 'sans-serif'),
    weight: String(params.weight || 'normal'),
    style: params.style || 'normal',
    size: Number.isFinite(size) && size > 0 ? size : 10,
  };
}


function orElse(value: number | undefined, fallback: number): number {
  return value !== undefined && value > 0 ? value : fallback;
}

/** Narrow a placement's baseline string to a valid CanvasTextBaseline. */
function asBaseline(value: string): CanvasTextBaseline {
  switch (value) {
    case 'top':
    case 'hanging':
    case 'middle':
    case 'alphabetic':
    case 'ideographic':
    case 'bottom':
      return value;
    default:
      return 'alphabetic';
  }
}

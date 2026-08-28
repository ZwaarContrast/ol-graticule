import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import { apply as applyTransform, create as createTransform } from 'ol/transform';
import type { Transform } from 'ol/transform';
import type Feature from 'ol/Feature';
import type Geometry from 'ol/geom/Geometry';
import type Style from 'ol/style/Style';
import type Text from 'ol/style/Text';
import type { LabelSink } from './LabelSink.js';
import { toRgbaNormalized } from '../util/color.js';

/**
 * One resolved label, positions in CSS px. Colours are RGB 0..1 and applied in
 * the shader, so the atlas bakes one colourless shape. `haloAlpha` is relative
 * to the fill (0 for none); the label's own fade rides in `opacity`.
 */
export interface LabelPlacement {
  x: number;
  y: number;
  text: string;
  font: string;
  fill: [number, number, number];
  halo: [number, number, number];
  haloAlpha: number;
  haloWidth: number;
  opacity: number;
  align: string;
  baseline: string;
  offsetX: number;
  offsetY: number;
  rotation: number;
}

/** A dotted/solid leader stroke shared by all leaders drawn this frame. */
export interface LeaderStroke {
  r: number;
  g: number;
  b: number;
  a: number;
  width: number;
  /** Dash on-length in px; 0 for a solid line. */
  dashOn: number;
  /** Dash period (on+off) in px; 0 for a solid line. */
  dashPeriod: number;
  dashOffset: number;
}

/**
 * A {@link LabelSink} recording each drawn label as a {@link LabelPlacement} in
 * screen CSS px for a WebGL layer to compose as textured quads, plus edge-label
 * leaders as flat screen-px segments.
 */
export class PlacementSink implements LabelSink {
  private toPixel_: Transform = createTransform();
  private readonly scratch_: [number, number] = [0, 0];
  readonly placements: LabelPlacement[] = [];
  count = 0;
  /** Flat [x0, y0, x1, y1, …] leader segments in screen CSS px. */
  readonly leaders: number[] = [];
  /** Style shared by this frame's leaders (they all use one tick style). */
  leaderStroke: LeaderStroke | null = null;
  private stroke_: LeaderStroke | null = null;

  begin(toPixel: Transform): void {
    this.toPixel_ = toPixel;
    this.count = 0;
    this.leaders.length = 0;
    this.leaderStroke = null;
    this.stroke_ = null;
  }

  setStyle(style: Style): void {
    const stroke = style.getStroke();
    if (!stroke) {
      this.stroke_ = null;
      return;
    }
    const [r, g, b, a] = toRgbaNormalized(stroke.getColor());
    const dash = stroke.getLineDash();
    const period = dash && dash.length ? dash.reduce((s, v) => s + v, 0) : 0;
    this.stroke_ = {
      r, g, b, a,
      width: stroke.getWidth() ?? 1,
      dashOn: dash && dash.length ? dash[0] ?? 0 : 0,
      dashPeriod: period,
      dashOffset: stroke.getLineDashOffset() ?? 0,
    };
    this.leaderStroke = this.stroke_;
  }

  drawGeometry(geometry: Geometry): void {
    if (!(geometry instanceof LineString) || !this.stroke_) return;
    const flat = geometry.getFlatCoordinates();
    const stride = geometry.getStride();
    const s = this.scratch_;
    for (let i = 0; i + stride + 1 < flat.length; i += stride) {
      s[0] = flat[i] ?? 0;
      s[1] = flat[i + 1] ?? 0;
      applyTransform(this.toPixel_, s);
      const ax = s[0];
      const ay = s[1];
      s[0] = flat[i + stride] ?? 0;
      s[1] = flat[i + stride + 1] ?? 0;
      applyTransform(this.toPixel_, s);
      this.leaders.push(ax, ay, s[0], s[1]);
    }
  }

  drawFeature(feature: Feature, style: Style): void {
    const geom = feature.getGeometry();
    if (!(geom instanceof Point)) return;
    const text = style.getText();
    if (!text) return;
    const content = textToString(text.getText());
    if (!content) return;

    const flat = geom.getFlatCoordinates();
    const s = this.scratch_;
    s[0] = flat[0] ?? 0;
    s[1] = flat[1] ?? 0;
    applyTransform(this.toPixel_, s);
    const p = this.slot_();
    p.x = s[0];
    p.y = s[1];
    p.text = content;
    fillTextStyle(p, text);
  }

  private slot_(): LabelPlacement {
    let p = this.placements[this.count];
    if (!p) {
      p = blankPlacement();
      this.placements.push(p);
    }
    this.count++;
    return p;
  }
}

function fillTextStyle(p: LabelPlacement, text: Text): void {
  // Fill alpha becomes per-quad opacity; halo alpha is stored relative to it.
  const [fr, fg, fb, fa] = toRgbaNormalized(text.getFill()?.getColor());
  p.opacity = fa;
  p.fill[0] = fr; p.fill[1] = fg; p.fill[2] = fb;
  const stroke = text.getStroke();
  if (stroke) {
    const [hr, hg, hb, ha] = toRgbaNormalized(stroke.getColor());
    p.halo[0] = hr; p.halo[1] = hg; p.halo[2] = hb;
    p.haloAlpha = fa > 0 ? Math.min(1, ha / fa) : ha;
    p.haloWidth = stroke.getWidth() ?? 0;
  } else {
    p.haloAlpha = 0;
    p.haloWidth = 0;
  }
  p.font = text.getFont() ?? '';
  p.align = text.getTextAlign() ?? 'center';
  p.baseline = text.getTextBaseline() ?? 'middle';
  p.offsetX = text.getOffsetX();
  p.offsetY = text.getOffsetY();
  p.rotation = text.getRotation() ?? 0;
}

function textToString(text: string | string[] | undefined): string {
  if (typeof text === 'string') return text;
  if (Array.isArray(text)) return text.filter((_, i) => i % 2 === 0).join('');
  return '';
}

function blankPlacement(): LabelPlacement {
  return {
    x: 0, y: 0, text: '', font: '', fill: [0, 0, 0], halo: [0, 0, 0], haloAlpha: 0,
    haloWidth: 0, opacity: 1, align: 'center', baseline: 'middle',
    offsetX: 0, offsetY: 0, rotation: 0,
  };
}


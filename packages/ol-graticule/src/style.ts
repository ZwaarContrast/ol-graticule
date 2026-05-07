import Feature from 'ol/Feature';
import Style from 'ol/style/Style';
import Stroke from 'ol/style/Stroke';
import Text from 'ol/style/Text';
import Fill from 'ol/style/Fill';
import Point from 'ol/geom/Point';
import type { StyleLike } from 'ol/style/Style';
import type { Extent } from 'ol/extent';
import type { GridLabel, GridCellLabel } from './types.js';

/** Grid-line styling: stroke, `{ major, minor?, boundary? }`, or a `StyleLike`. */
export type GraticuleLineStyle =
  | Stroke
  | { major: Stroke; minor?: Stroke; boundary?: Stroke }
  | StyleLike;

export interface EdgeLabelContext {
  /** Label emitted by the grid system for this position. */
  label: GridLabel;
  /** Current view extent in projection coords. */
  extent: Extent;
  /** Current view resolution (map units per pixel). */
  resolution: number;
  /** Where x-axis labels snap. */
  xLabelPosition: 'top' | 'bottom';
  /** Where y-axis labels snap. */
  yLabelPosition: 'left' | 'right';
  /** Pixel offset for x-axis labels from the edge, inward. */
  xLabelOffset: number;
  /** Pixel offset for y-axis labels from the edge, inward. */
  yLabelOffset: number;
}

/** Pooled edge-label slot mutated in place each frame. */
export interface EdgeLabelSlot {
  feature: Feature;
  text: Text;
  style: Style;
}

export interface EdgeLabelStyleHandler {
  /** Allocate a new slot. */
  create: () => EdgeLabelSlot;
  /** Mutate the slot for this label; return `false` to skip drawing. */
  update: (slot: EdgeLabelSlot, ctx: EdgeLabelContext) => boolean;
}

/** Edge-label styling: `true` for defaults, `Text` for overrides, or a handler. */
export type GraticuleEdgeLabelStyle = true | Text | EdgeLabelStyleHandler;

export interface CellLabelContext {
  /** Cell label emitted by the grid system. */
  label: GridCellLabel;
}

export interface CellLabelSlot {
  feature: Feature;
  text: Text;
  fill: Fill;
  stroke: Stroke;
  style: Style;
}

export interface CellLabelStyleHandler {
  create: () => CellLabelSlot;
  update: (slot: CellLabelSlot, ctx: CellLabelContext) => boolean;
}

/** Cell-label styling: handler or `false` to suppress. */
export type GraticuleCellLabelStyle = CellLabelStyleHandler | false;

/** Shared config accepted by every graticule rendering surface. */
export interface GraticuleStyle {
  /** Line styling. */
  line?: GraticuleLineStyle;
  /** Edge labels; omit to hide. */
  edgeLabel?: GraticuleEdgeLabelStyle;
  /** Cell labels; omit for defaults, `false` to suppress. */
  cellLabel?: GraticuleCellLabelStyle;
}

/** Styling for {@link CursorPositionControl}. */
export interface CursorStyle {
  /** CSS color for the indicator background. */
  color?: string;
  /** CSS applied directly to each `<span>` label. */
  labelCss?: string;
}

export const DEFAULT_LINE_STROKE = new Stroke({
  color: 'rgba(0, 0, 0, 0.2)',
  width: 1,
});

export const DEFAULT_MINOR_LINE_STROKE = new Stroke({
  color: 'rgba(0, 0, 0, 0.1)',
  width: 0.5,
});

export const DEFAULT_LINE_STYLE: { major: Stroke; minor: Stroke } = {
  major: DEFAULT_LINE_STROKE,
  minor: DEFAULT_MINOR_LINE_STROKE,
};

export const DEFAULT_CURSOR_COLOR = 'rgba(249, 115, 22, 0.9)';
export const DEFAULT_CURSOR_LABEL_CSS =
  'font: 600 10px system-ui, -apple-system, sans-serif; color: #fff; font-variant-numeric: tabular-nums;';

export function createDefaultEdgeLabelText(): Text {
  return new Text({
    font: '600 10px system-ui, -apple-system, sans-serif',
    fill: new Fill({ color: 'rgba(255, 255, 255, 0.9)' }),
    stroke: new Stroke({ color: 'rgba(0, 0, 0, 0.7)', width: 3 }),
  });
}

/** Wrap a `Text` template as an {@link EdgeLabelStyleHandler}. */
export function createDefaultEdgeLabelHandler(
  template?: Text,
): EdgeLabelStyleHandler {
  const baseText = template ?? createDefaultEdgeLabelText();
  return {
    create(): EdgeLabelSlot {
      const text = baseText.clone();
      const style = new Style({ text });
      const feature = new Feature();
      feature.setGeometry(new Point([0, 0]));
      return { feature, text, style };
    },
    update(slot, ctx): boolean {
      const [minX, minY, maxX, maxY] = ctx.extent;
      const { label } = ctx;
      const coords = label.point.getCoordinates();
      const geom = slot.feature.getGeometry();
      if (!(geom instanceof Point)) return false;

      slot.text.setText(label.text);

      if (label.axis === 'x') {
        const atTop = ctx.xLabelPosition === 'top';
        const off = ctx.xLabelOffset;
        geom.setCoordinates([coords[0]!, atTop ? maxY : minY]);
        slot.text.setTextBaseline(atTop ? 'top' : 'bottom');
        slot.text.setTextAlign('center');
        slot.text.setOffsetX(0);
        slot.text.setOffsetY(atTop ? off : -off);
      } else {
        const atLeft = ctx.yLabelPosition === 'left';
        const off = ctx.yLabelOffset;
        geom.setCoordinates([atLeft ? minX : maxX, coords[1]!]);
        slot.text.setTextBaseline('middle');
        slot.text.setTextAlign(atLeft ? 'left' : 'right');
        slot.text.setOffsetX(atLeft ? off : -off);
        slot.text.setOffsetY(0);
      }
      return true;
    },
  };
}

export interface DefaultCellLabelOptions {
  /** Font family stack. */
  fontFamily?: string;
  /** Font weight. */
  fontWeight?: number | string;
  /** Font style (e.g. `italic`, `oblique`). */
  fontStyle?: string;
  /** Fill color as a function of opacity. */
  fillColor?: (opacity: number) => string;
  /** Halo (stroke) color as a function of opacity. */
  strokeColor?: (opacity: number) => string;
  /** Halo width. */
  strokeWidth?: number;
  /** `[minSize, maxSize]` clamp for font size in px. */
  fontSizeRange?: [number, number];
  /** Font size as a fraction of cell pixel size. */
  fontSizeFactor?: number;
  /** Fade stops in cell pixels: `[fadeInStart, fullStart, fullEnd, fadeOutEnd]`. */
  fadeStops?: [number, number, number, number];
  /** Peak opacity at full visibility, 0-1. */
  peakOpacity?: number;
  /** Rotation in radians applied to every label. */
  rotation?: number;
}

/** Library-default cell label handler. */
export function createDefaultCellLabelHandler(
  options: DefaultCellLabelOptions = {},
): CellLabelStyleHandler {
  const fontFamily = options.fontFamily ?? 'system-ui, -apple-system, sans-serif';
  const fontWeight = options.fontWeight ?? 700;
  const fontStyle = options.fontStyle ?? '';
  const fillColor =
    options.fillColor ?? ((o: number) => `rgba(255, 255, 255, ${o.toFixed(2)})`);
  const strokeColor =
    options.strokeColor ?? ((o: number) => `rgba(0, 0, 0, ${(o * 0.8).toFixed(2)})`);
  const strokeWidth = options.strokeWidth ?? 3;
  const [minSize, maxSize] = options.fontSizeRange ?? [12, 32];
  const sizeFactor = options.fontSizeFactor ?? 0.15;
  const [fadeInStart, fullStart, fullEnd, fadeOutEnd] =
    options.fadeStops ?? [40, 80, 400, 800];
  const peak = options.peakOpacity ?? 0.45;
  const rotation = options.rotation ?? 0;

  const fontPrefix = fontStyle ? `${fontStyle} ${fontWeight}` : `${fontWeight}`;
  const fontCache = new Map<number, string>();
  const fontOf = (px: number): string => {
    let cached = fontCache.get(px);
    if (cached === undefined) {
      cached = `${fontPrefix} ${px}px ${fontFamily}`;
      fontCache.set(px, cached);
    }
    return cached;
  };
  const fillCache = new Map<number, string>();
  const fillOf = (opacity: number): string => {
    let cached = fillCache.get(opacity);
    if (cached === undefined) {
      cached = fillColor(opacity);
      fillCache.set(opacity, cached);
    }
    return cached;
  };
  const strokeCache = new Map<number, string>();
  const strokeOf = (opacity: number): string => {
    let cached = strokeCache.get(opacity);
    if (cached === undefined) {
      cached = strokeColor(opacity);
      strokeCache.set(opacity, cached);
    }
    return cached;
  };

  return {
    create(): CellLabelSlot {
      const fill = new Fill({ color: fillOf(1) });
      const stroke = new Stroke({ color: strokeOf(1), width: strokeWidth });
      const text = new Text({
        font: fontOf(minSize),
        fill,
        stroke,
        textAlign: 'center',
        textBaseline: 'middle',
        rotation,
      });
      const style = new Style({ text });
      return { feature: new Feature(), text, fill, stroke, style };
    },
    update(slot, { label }): boolean {
      const size = label.cellSizePx;
      if (size < fadeInStart || size >= fadeOutEnd) return false;

      const rawOpacity =
        size < fullStart ? ((size - fadeInStart) / (fullStart - fadeInStart)) * peak :
        size < fullEnd   ? peak :
                           Math.max(0, peak * (1 - (size - fullEnd) / (fadeOutEnd - fullEnd)));
      if (rawOpacity < 0.02) return false;

      const opacity = Math.round(rawOpacity * 100) / 100;
      const fontPx = Math.round(Math.min(maxSize, Math.max(minSize, size * sizeFactor)));

      slot.fill.setColor(fillOf(opacity));
      slot.stroke.setColor(strokeOf(opacity));
      slot.text.setFont(fontOf(fontPx));
      slot.text.setText(label.text);
      slot.feature.setGeometry(label.point);
      return true;
    },
  };
}

/** Resolve a {@link GraticuleEdgeLabelStyle} to a handler, or `null` to suppress. */
export function resolveEdgeLabelHandler(
  input: GraticuleEdgeLabelStyle | undefined,
): EdgeLabelStyleHandler | null {
  if (input === undefined) return null;
  if (input === true) return createDefaultEdgeLabelHandler();
  if (input instanceof Text) return createDefaultEdgeLabelHandler(input);
  return input;
}

/** Resolve a {@link GraticuleLineStyle} to an OL `StyleLike` for `setStyle`. */
export function resolveLineStyle(input: GraticuleLineStyle | undefined): StyleLike {
  const config: GraticuleLineStyle = input ?? DEFAULT_LINE_STYLE;

  if (config instanceof Stroke) {
    const style = new Style({ stroke: config });
    return style;
  }

  if (isMajorMinor(config)) {
    const major = new Style({ stroke: config.major });
    const minor = new Style({ stroke: config.minor ?? DEFAULT_MINOR_LINE_STROKE });
    const boundary = config.boundary ? new Style({ stroke: config.boundary }) : major;
    return (feature): Style => {
      const type = feature.get('gridLineType');
      if (type === 'minor') return minor;
      if (type === 'boundary') return boundary;
      return major;
    };
  }

  return config;
}

function isMajorMinor(
  value: GraticuleLineStyle,
): value is { major: Stroke; minor?: Stroke; boundary?: Stroke } {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'major' in value &&
    (value as { major: unknown }).major instanceof Stroke
  );
}

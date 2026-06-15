/** Luftwaffe Planquadrat grid system for the UniversalGraticule. */

import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import type { Geometry } from 'ol/geom';
import type { Extent } from 'ol/extent';
import type { ProjectionLike } from 'ol/proj';
import { getTransform, transform, transformExtent } from 'ol/proj';

import type {
  GridSystem,
  GridLabel,
  GridCellLabel,
  FormattedCoordinate,
  FlatLineSpec,
} from '@zwaarcontrast/ol-graticule';
import {
  ParseError,
  ProjectionScratch,
  RenderCache,
  TransformCache,
  emitFlatLineFeatures,
  adaptiveAxisTs,
  isOnMajorLine,
  measureTargetResolution,
  normalizeLon,
  transformBatchCached,
} from '@zwaarcontrast/ol-graticule';

import {
  ZZG_LAT_DEG,
  ZZG_LON_DEG,
  ZZG_BASELINE_LAT,
  GT_LAT_DEG,
  GT_LON_DEG,
  JAGDTRAPEZ_LAT_DEG,
  MT_LAT_DEG,
  MT_LON_DEG,
  KT_LAT_DEG,
  KT_LON_DEG,
  meldetrapezDims,
  arbeitstrapezDims,
} from '../luftwaffe/levels.js';
import {
  zzgFor,
  gtDigitsFor,
  mtDigitFor,
  ktDigitFor,
  meltDigitFor,
  atLabelFor,
  jagdtrapezHalfFor,
  jmnMtLettersFor,
  normalizeAntimeridian,
} from '../luftwaffe/encode.js';
import { parseRef } from '../luftwaffe/decode.js';
import type { LuftwaffeEra, LuftwaffeSystem } from '../luftwaffe/types.js';

export interface LuftwaffeGridSystemOptions {
  /** Which Luftwaffe grid (default: 'gnmv'). JMN is post-1943 only and ignores `era`. */
  system?: LuftwaffeSystem | undefined;
  /** Era of the GNMV (default: 'post-1943'). Ignored for JMN. */
  era?: LuftwaffeEra | undefined;
  /** Maximum subdivision depth, 0 (ZZG) to 5 (Arbeitstrapez). Default: 5. */
  maxDepth?: number | undefined;
  /**
   * Minimum on-screen pixels for a cell to be the deepest visible level.
   * Default `40`, matching the cell-label handler's fade-in start, so the
   * new level becomes deepest exactly when its predecessor hits the
   * handler's fade-out end (`cellPx = 800`). Specifically, this closes the
   * 20:1 JMN Jagdtrapez→Mitteltrapez handoff: at the swap, JT is at
   * `cellPx = 800` (just past peak) and MT is at `cellPx = 40` (just
   * entering peak).
   */
  minCellPx?: number | undefined;
  /** Minimum on-screen pixels for a cell to render a label. Default: 40. */
  minLabelPx?: number | undefined;
  /** Densification points per line for non-affine view projections. Default: 50. */
  densificationPoints?: number | undefined;
}

interface LevelDef {
  /** Depth index 0..5. */
  depth: number;
  latSpan: number;
  lonSpan: number;
  /** Top-of-cell label tag. Used as `gridDepth` on Feature properties. */
  tag: string;
}

interface RenderContext {
  geoExtent: Extent;
  /** Degrees of latitude per pixel (after view-CRS distortion correction). */
  degPerPx: number;
  /** Deepest visible level; lines are drawn at this spacing. */
  deepestLevel: number;
  /** Parameter samples for vertical lines (constant lon, sweeping lat). */
  xTs: number[];
  /** Parameter samples for horizontal lines (constant lat, sweeping lon). */
  yTs: number[];
}

export class LuftwaffeGridSystem implements GridSystem {
  private readonly system_: LuftwaffeSystem;
  private readonly era_: LuftwaffeEra;
  private readonly maxDepth_: number;
  private readonly minCellPx_: number;
  private readonly minLabelPx_: number;
  private readonly densificationPoints_: number;
  private readonly levels_: LevelDef[];

  private readonly ctxCache_ = new RenderCache<RenderContext>();
  private readonly projScratch_ = new ProjectionScratch();
  private readonly transformCache_ = new TransformCache();

  constructor(options?: LuftwaffeGridSystemOptions) {
    this.system_ = options?.system ?? 'gnmv';
    const requestedEra: LuftwaffeEra = options?.era ?? 'post-1943';
    this.era_ = this.system_ === 'jmn' ? 'post-1943' : requestedEra;
    this.maxDepth_ = clampInt(options?.maxDepth ?? 5, 0, 5);
    this.minCellPx_ = options?.minCellPx ?? 40;
    this.minLabelPx_ = options?.minLabelPx ?? 40;
    this.densificationPoints_ = options?.densificationPoints ?? 20;
    this.levels_ = buildLevels(this.system_, this.era_);
  }

  getFeatures(extent: Extent, resolution: number, viewProjection: ProjectionLike): Feature<Geometry>[] {
    const ctx = this.renderContext_(extent, resolution, viewProjection);
    if (ctx.geoExtent[3] - ctx.geoExtent[1] <= 0) return [];

    const transformFn = getTransform('EPSG:4326', viewProjection);
    const deepest = this.levels_[ctx.deepestLevel]!;
    const specs: FlatLineSpec[] = [];

    pushAxisSpecs(specs, ctx, this.levels_, deepest, 'h', ctx.yTs);
    pushAxisSpecs(specs, ctx, this.levels_, deepest, 'v', ctx.xTs);

    const features: Feature<Geometry>[] = [];
    emitFlatLineFeatures(features, this.projScratch_, specs, transformFn);
    return features;
  }

  getLabels(_extent: Extent, _resolution: number, _viewProjection: ProjectionLike): GridLabel[] {
    return [];
  }

  getCellLabels(extent: Extent, resolution: number, viewProjection: ProjectionLike): GridCellLabel[] {
    const ctx = this.renderContext_(extent, resolution, viewProjection);
    if (ctx.geoExtent[3] - ctx.geoExtent[1] <= 0) return [];

    const level = this.levels_[ctx.deepestLevel]!;
    const cellPx = level.latSpan / ctx.degPerPx;
    if (cellPx < this.minLabelPx_) return [];

    const labels: GridCellLabel[] = [];
    this.collectCellLabels_(labels, level, ctx.geoExtent, cellPx, viewProjection);
    return labels;
  }

  formatCoordinate(coordinate: [number, number], viewProjection: ProjectionLike): FormattedCoordinate {
    const [rawLon, lat] = transform(coordinate, viewProjection, 'EPSG:4326');
    if (rawLon === undefined || lat === undefined) return { combined: '-' };
    const lon = normalizeAntimeridian(rawLon);
    const zzg = zzgFor(lat, lon);
    if (!zzg) return { combined: '-' };

    const parts: string[] = [`${zzg.digits} ${zzg.suffix}`];

    if (this.system_ === 'jmn') {
      if (this.maxDepth_ >= 1) {
        const half = jagdtrapezHalfFor(zzg, lat);
        parts.push(half);
        if (this.maxDepth_ >= 2) {
          const letters = jmnMtLettersFor(lat, lon, zzg, half);
          if (!letters) return { combined: parts.join(' ') };
          parts.push(letters);
        }
      }
    } else if (this.maxDepth_ >= 1) {
      parts.push(gtDigitsFor(lat, lon));
      if (this.maxDepth_ >= 2) parts.push(String(mtDigitFor(lat, lon)));
    }
    if (this.maxDepth_ >= 3) parts.push(String(ktDigitFor(lat, lon)));
    if (this.maxDepth_ >= 4) parts.push(String(meltDigitFor(lat, lon, this.era_)));
    if (this.maxDepth_ >= 5) parts.push(atLabelFor(lat, lon, this.era_));

    return { combined: parts.join(' ') };
  }

  parseCoordinate(text: string, viewProjection: ProjectionLike): [number, number] {
    const { decoded } = parseRef(text, this.era_);
    const [lat, lon] = decoded.center;
    const projected = transform([lon, lat], 'EPSG:4326', viewProjection);
    const px = projected[0];
    const py = projected[1];
    if (px === undefined || py === undefined || !Number.isFinite(px) || !Number.isFinite(py)) {
      throw new ParseError(text, 'transform produced non-finite coordinate');
    }
    return [px, py];
  }

  private collectCellLabels_(
    out: GridCellLabel[],
    level: LevelDef,
    geoExtent: Extent,
    cellPx: number,
    viewProjection: ProjectionLike,
  ): void {
    const minLon = geoExtent[0];
    const maxLon = geoExtent[2];
    const minLat = Math.max(geoExtent[1], -89);
    const maxLat = Math.min(geoExtent[3], 89);
    if (minLon >= maxLon || minLat >= maxLat) return;
    const kLatStart = Math.floor((minLat - ZZG_BASELINE_LAT) / level.latSpan);
    const kLatEnd = Math.ceil((maxLat - ZZG_BASELINE_LAT) / level.latSpan);
    const kLonStart = Math.floor(minLon / level.lonSpan);
    const kLonEnd = Math.ceil(maxLon / level.lonSpan);

    const flat: number[] = [];
    const texts: string[] = [];
    for (let kLat = kLatStart; kLat < kLatEnd; kLat++) {
      const lat = ZZG_BASELINE_LAT + kLat * level.latSpan;
      const cellCenterLat = lat + level.latSpan / 2;
      if (cellCenterLat < minLat || cellCenterLat > maxLat) continue;
      for (let kLon = kLonStart; kLon < kLonEnd; kLon++) {
        const lon = kLon * level.lonSpan;
        const cellCenterLon = lon + level.lonSpan / 2;
        if (cellCenterLon < minLon || cellCenterLon > maxLon) continue;
        const text = this.cellLabelText_(level, cellCenterLat, normalizeLon(cellCenterLon));
        if (!text) continue;
        flat.push(cellCenterLon, cellCenterLat);
        texts.push(text);
      }
    }
    if (texts.length === 0) return;
    const toView = getTransform('EPSG:4326', viewProjection);
    transformBatchCached(flat, flat, 2, toView, this.transformCache_);
    for (let i = 0; i < texts.length; i++) {
      out.push({
        point: new Point([flat[i * 2]!, flat[i * 2 + 1]!]),
        text: texts[i]!,
        cellSizePx: cellPx,
      });
    }
  }

  private cellLabelText_(level: LevelDef, lat: number, rawLon: number): string | undefined {
    const lon = normalizeAntimeridian(rawLon);
    const zzg = zzgFor(lat, lon);
    if (!zzg) return undefined;
    if (level.depth === 0) return `${zzg.digits} ${zzg.suffix}`;

    const isJmn = this.system_ === 'jmn';
    if (isJmn && level.depth === 1) {
      const half = jagdtrapezHalfFor(zzg, lat);
      return `${zzg.digits} ${zzg.suffix} ${half}`;
    }

    let out = '';
    if (isJmn) {
      const half = jagdtrapezHalfFor(zzg, lat);
      const letters = jmnMtLettersFor(lat, lon, zzg, half);
      if (!letters) return undefined;
      out += letters;
    } else {
      out += gtDigitsFor(lat, lon);
      if (level.depth >= 2) out += String(mtDigitFor(lat, lon));
    }
    if (level.depth >= 3) out += String(ktDigitFor(lat, lon));
    if (level.depth >= 4) out += String(meltDigitFor(lat, lon, this.era_));
    if (level.depth >= 5) out += atLabelFor(lat, lon, this.era_);
    return out;
  }

  private renderContext_(extent: Extent, resolution: number, viewProjection: ProjectionLike): RenderContext {
    return this.ctxCache_.get(extent, resolution, viewProjection, () => {
      const geoExtent = transformExtent(extent, viewProjection, 'EPSG:4326');
      const transformFn = getTransform('EPSG:4326', viewProjection);
      const fallback = geoExtent[2] - geoExtent[0];
      const targetResolution = measureTargetResolution(geoExtent, transformFn, resolution) ?? fallback;
      const degPerPx = targetResolution > 0 ? targetResolution : 1;

      let deepestLevel = 0;
      for (let depth = 0; depth <= this.maxDepth_; depth++) {
        const cellPx = this.levels_[depth]!.latSpan / degPerPx;
        if (cellPx < this.minCellPx_) break;
        deepestLevel = depth;
      }

      const cap = this.densificationPoints_;
      const xTs = adaptiveAxisTs('x', geoExtent, transformFn, resolution, cap);
      const yTs = adaptiveAxisTs('y', geoExtent, transformFn, resolution, cap);
      return { geoExtent, degPerPx, deepestLevel, xTs, yTs };
    });
  }
}

function buildLevels(system: LuftwaffeSystem, era: LuftwaffeEra): LevelDef[] {
  const meltDims = meldetrapezDims(era);
  const atDims = arbeitstrapezDims(era);
  const level1 = system === 'jmn'
    ? { depth: 1, latSpan: JAGDTRAPEZ_LAT_DEG, lonSpan: ZZG_LON_DEG, tag: 'jagdtrapez' }
    : { depth: 1, latSpan: GT_LAT_DEG, lonSpan: GT_LON_DEG, tag: 'gt' };
  return [
    { depth: 0, latSpan: ZZG_LAT_DEG, lonSpan: ZZG_LON_DEG, tag: 'zzg' },
    level1,
    { depth: 2, latSpan: MT_LAT_DEG, lonSpan: MT_LON_DEG, tag: 'mt' },
    { depth: 3, latSpan: KT_LAT_DEG, lonSpan: KT_LON_DEG, tag: 'kt' },
    { depth: 4, latSpan: meltDims.latDeg, lonSpan: meltDims.lonDeg, tag: 'melt' },
    { depth: 5, latSpan: atDims.latDeg, lonSpan: atDims.lonDeg, tag: 'at' },
  ];
}

function clampInt(value: number, lo: number, hi: number): number {
  const n = Math.floor(value);
  return n < lo ? lo : n > hi ? hi : n;
}


/** Determine which (shallowest) level a coordinate value naturally belongs to. */
function shallowestLevelForLat(lat: number, levels: LevelDef[], deepest: number): number {
  const offset = lat - ZZG_BASELINE_LAT;
  for (let d = 0; d <= deepest; d++) {
    const span = levels[d]!.latSpan;
    if (isOnMajorLine(offset, span, span * 1e-6)) return d;
  }
  return deepest;
}

function shallowestLevelForLon(lon: number, levels: LevelDef[], deepest: number): number {
  for (let d = 0; d <= deepest; d++) {
    const span = levels[d]!.lonSpan;
    if (isOnMajorLine(lon, span, span * 1e-6)) return d;
  }
  return deepest;
}

function pushAxisSpecs(
  out: FlatLineSpec[],
  ctx: RenderContext,
  levels: LevelDef[],
  finest: LevelDef,
  axis: 'h' | 'v',
  ts: number[],
): void {
  const [minLon, minLat, maxLon, maxLat] = ctx.geoExtent;
  if (axis === 'h') {
    const span = finest.latSpan;
    const startK = Math.ceil((minLat - ZZG_BASELINE_LAT) / span);
    const endK = Math.floor((maxLat - ZZG_BASELINE_LAT) / span);
    for (let k = startK; k <= endK; k++) {
      const lat = ZZG_BASELINE_LAT + k * span;
      const depth = shallowestLevelForLat(lat, levels, finest.depth);
      out.push({
        startX: minLon, startY: lat,
        endX: maxLon,   endY: lat,
        ts,
        props: { gridAxis: 'y', gridValue: lat, gridDepth: depth, gridLineType: depth === 0 ? 'major' : 'minor' },
      });
    }
  } else {
    const span = finest.lonSpan;
    const start = Math.ceil(minLon / span) * span;
    const end = Math.floor(maxLon / span) * span;
    for (let lon = start; lon <= end + span * 0.5e-9; lon += span) {
      const depth = shallowestLevelForLon(lon, levels, finest.depth);
      out.push({
        startX: lon, startY: minLat,
        endX: lon,   endY: maxLat,
        ts,
        props: { gridAxis: 'x', gridValue: lon, gridDepth: depth, gridLineType: depth === 0 ? 'major' : 'minor' },
      });
    }
  }
}

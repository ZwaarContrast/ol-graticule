/**
 * Gauß-Krüger 3°-Streifen grid system: the kilometre grid printed on German
 * Reich map sheets before the 6° Deutsches Heeresgitter, e.g. sheet 5503
 * Elsenborn (Planblatt A, Geheim, 1.10.1939), whose corner labels read
 * `2512`/`5585` km, Kennziffer 2 on the 6° E central meridian.
 *
 * One `ProjectedGridSystem` per visible strip, each clipped to its own 3° band.
 */

import type { Extent } from 'ol/extent';
import type { Feature } from 'ol';
import type { Geometry } from 'ol/geom';
import type { ProjectionLike } from 'ol/proj';
import { transform } from 'ol/proj';

import type {
  FormattedCoordinate,
  GridLabel,
  GridSystem,
  LabelFormatter,
  PolygonClip,
} from '@zwaarcontrast/ol-graticule';
import {
  BoundedCache,
  ParseError,
  PolygonClippedGridSystem,
  RenderCache,
  SteppingIntervalStrategy,
} from '@zwaarcontrast/ol-graticule';
import { ProjectedGridSystem } from '@zwaarcontrast/ol-graticule-projected';

import { formatEasting, formatNorthing, parseDrg } from '../drg/codec.js';
import { DEFAULT_DATUM_SHIFT, registerZone } from '../drg/projection.js';
import type { DatumShift, DrgZone } from '../drg/types.js';
import {
  MAX_KENNZIFFER,
  STRIP_HALF_WIDTH_DEG,
  STRIP_OVERLAP_DEG,
  zoneByKennziffer,
  zoneForLon,
} from '../drg/zones.js';
import { cursorKey, sampleCornerLons, toFiniteLonLat } from './sharedViewport.js';

const KM = 1_000;
/** Every step divides the 500 000 m false easting, so lines land on true grid values. */
const DRG_INTERVALS = [KM, 2 * KM, 5 * KM, 10 * KM, 25 * KM, 50 * KM, 100 * KM];

/** Latitude span of a strip clip polygon. The projection itself has no latitude limit. */
const CLIP_SOUTH_LAT = -80;
const CLIP_NORTH_LAT = 84;

export type DrgZoneBoundaryMode = 'tiled' | 'overlap' | 'single';

export interface DrgGridSystemOptions {
  /**
   * Behaviour at 3° strip boundaries.
   *  - `'tiled'` (default): hard cuts at the exact strip edges, one grid each.
   *  - `'overlap'`: both strips render across the 20' overlap band, the way a
   *    sheet straddling a boundary prints two grids.
   *  - `'single'`: only the strip nearest the viewport centre.
   */
  zoneBoundary?: DrgZoneBoundaryMode;
  /** Override the WGS 84 → Bessel-Potsdam datum shift. */
  datumShift?: DatumShift;
  /** Maximum points per grid line. Default: 60. */
  densificationPoints?: number;
  /** Target screen pixels between adjacent grid lines. Default: 80. */
  targetScreenPx?: number;
  /** `'short'` prints the sheet's "kurz" labels (last 2 km digits). Default `'long'`. */
  labelForm?: 'long' | 'short';
  /**
   * Maximum view resolution at which to draw the grid. Above it nothing is
   * drawn: this is a large-scale sheet grid, not a world overview.
   * Default 2000 m/px (~zoom 6).
   */
  maxRenderResolution?: number;
}

/** Sheet-style labels: kilometres on grid lines, metres under the cursor. */
class DrgFormatter implements LabelFormatter {
  private readonly form_: 'long' | 'short';
  private readonly cache_ = new BoundedCache<number, string>(1024);

  constructor(form: 'long' | 'short') {
    this.form_ = form;
  }

  format(value: number, _axis: 'x' | 'y'): string {
    const cached = this.cache_.get(value);
    if (cached !== undefined) return cached;
    const result = formatEasting({ kennziffer: 0, easting: value, northing: 0 }, { form: this.form_ });
    this.cache_.set(value, result);
    return result;
  }

  formatCoordinate(x: number, y: number): FormattedCoordinate {
    return {
      x: formatEasting({ kennziffer: 0, easting: x, northing: 0 }, { form: this.form_, unit: 'm' }),
      y: formatNorthing({ kennziffer: 0, easting: 0, northing: y }, { form: this.form_, unit: 'm' }),
    };
  }
}

export class DrgGridSystem implements GridSystem {
  private readonly zoneBoundary_: DrgZoneBoundaryMode;
  private readonly datumShift_: DatumShift;
  private readonly densificationPoints_: number;
  private readonly labelForm_: 'long' | 'short';
  private readonly maxRenderResolution_: number;
  private readonly intervals_: SteppingIntervalStrategy;
  private readonly formatter_: DrgFormatter;

  private readonly delegates_ = new Map<number, GridSystem>();
  private readonly cursorCache_ = new BoundedCache<string, FormattedCoordinate>(512);
  private readonly activeZonesCache_ = new RenderCache<number[]>();

  constructor(options: DrgGridSystemOptions = {}) {
    this.zoneBoundary_ = options.zoneBoundary ?? 'tiled';
    this.datumShift_ = options.datumShift ?? DEFAULT_DATUM_SHIFT;
    this.densificationPoints_ = options.densificationPoints ?? 60;
    this.labelForm_ = options.labelForm ?? 'long';
    this.maxRenderResolution_ = options.maxRenderResolution ?? 2000;
    this.intervals_ = new SteppingIntervalStrategy(DRG_INTERVALS, options.targetScreenPx ?? 80);
    this.formatter_ = new DrgFormatter(this.labelForm_);
  }

  getFeatures(
    extent: Extent,
    resolution: number,
    viewProjection: ProjectionLike,
  ): Feature<Geometry>[] {
    if (resolution > this.maxRenderResolution_) return [];
    const features: Feature<Geometry>[] = [];
    for (const kennziffer of this.activeZones_(extent, viewProjection)) {
      for (const f of this.delegateFor_(kennziffer).getFeatures(extent, resolution, viewProjection)) {
        features.push(f);
      }
    }
    return features;
  }

  getLabels(
    extent: Extent,
    resolution: number,
    viewProjection: ProjectionLike,
  ): GridLabel[] {
    if (resolution > this.maxRenderResolution_) return [];
    const labels: GridLabel[] = [];
    // Hochwerte are equator-referenced, so neighbouring strips repeat them.
    const seenNorthings = new Set<string>();
    const westToEast = [...this.activeZones_(extent, viewProjection)].sort((a, b) => a - b);
    for (const kennziffer of westToEast) {
      for (const label of this.delegateFor_(kennziffer).getLabels(extent, resolution, viewProjection)) {
        if (label.axis === 'y') {
          if (seenNorthings.has(label.text)) continue;
          seenNorthings.add(label.text);
        }
        labels.push(label);
      }
    }
    return labels;
  }

  formatCoordinate(
    coordinate: [number, number],
    viewProjection: ProjectionLike,
  ): FormattedCoordinate {
    const key = cursorKey(coordinate, viewProjection);
    const cached = this.cursorCache_.get(key);
    if (cached !== undefined) return cached;
    const lonLat = toFiniteLonLat(coordinate, viewProjection);
    const result = lonLat
      ? this.delegateFor_(zoneForLon(lonLat[0]).kennziffer).formatCoordinate(coordinate, viewProjection)
      : { x: '-', y: '-' };
    this.cursorCache_.set(key, result);
    return result;
  }

  isValidCoordinate(coordinate: [number, number], viewProjection: ProjectionLike): boolean {
    return toFiniteLonLat(coordinate, viewProjection) !== null;
  }

  parseCoordinate(text: string, viewProjection: ProjectionLike): [number, number] {
    const parsed = parseDrg(text);
    if (!parsed) throw new ParseError(text, 'not a recognised Gauß-Krüger 3° reference');
    const { kennziffer, easting, northing } = parsed.coord;
    const crs = registerZone(zoneByKennziffer(kennziffer), this.datumShift_);
    const [vx, vy] = transform([easting, northing], crs, viewProjection);
    if (vx === undefined || vy === undefined || !Number.isFinite(vx) || !Number.isFinite(vy)) {
      throw new ParseError(text, 'transform produced non-finite coordinate');
    }
    return [vx, vy];
  }

  get datumShift(): DatumShift {
    return this.datumShift_;
  }

  get zoneBoundaryMode(): DrgZoneBoundaryMode {
    return this.zoneBoundary_;
  }

  private activeZones_(extent: Extent, viewProjection: ProjectionLike): number[] {
    return this.activeZonesCache_.get(extent, 0, viewProjection, () => {
      const overlapDeg = this.zoneBoundary_ === 'overlap' ? STRIP_OVERLAP_DEG : 0;
      const lons = sampleCornerLons(extent, viewProjection);
      if (lons.length === 0) return [];
      if (this.zoneBoundary_ === 'single') {
        const centreLon = (Math.min(...lons) + Math.max(...lons)) / 2;
        return [zoneForLon(centreLon).kennziffer];
      }
      const minLon = Math.min(...lons);
      const maxLon = Math.max(...lons);
      const halfWidth = STRIP_HALF_WIDTH_DEG + overlapDeg;
      const first = Math.max(0, Math.ceil((minLon - halfWidth) / 3));
      const last = Math.min(MAX_KENNZIFFER, Math.floor((maxLon + halfWidth) / 3));
      const result: number[] = [];
      for (let k = first; k <= last; k++) result.push(k);
      return result;
    });
  }

  private delegateFor_(kennziffer: number): GridSystem {
    const cached = this.delegates_.get(kennziffer);
    if (cached) return cached;

    const zone = zoneByKennziffer(kennziffer);
    const delegate = new PolygonClippedGridSystem({
      source: new ProjectedGridSystem({
        crs: registerZone(zone, this.datumShift_),
        intervals: this.intervals_,
        formatter: this.formatter_,
        densificationPoints: this.densificationPoints_,
      }),
      clipPolygon: stripClipPolygon(zone, this.zoneBoundary_ === 'overlap' ? STRIP_OVERLAP_DEG : 0),
      emitBoundary: true,
    });
    this.delegates_.set(kennziffer, delegate);
    return delegate;
  }
}

/** Clip polygon for a strip's 3° band, optionally widened by the overlap. */
function stripClipPolygon(zone: DrgZone, overlapDeg: number): PolygonClip {
  const west = zone.cm - STRIP_HALF_WIDTH_DEG - overlapDeg;
  const east = zone.cm + STRIP_HALF_WIDTH_DEG + overlapDeg;
  return {
    crs: 'EPSG:4326',
    rings: [[
      [west, CLIP_SOUTH_LAT],
      [east, CLIP_SOUTH_LAT],
      [east, CLIP_NORTH_LAT],
      [west, CLIP_NORTH_LAT],
    ]],
  };
}

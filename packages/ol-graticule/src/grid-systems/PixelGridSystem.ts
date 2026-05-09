import Point from 'ol/geom/Point';
import type Feature from 'ol/Feature';
import type { Extent } from 'ol/extent';
import type { Geometry } from 'ol/geom';
import type { ProjectionLike } from 'ol/proj';
import type { GridSystem, GridLabel, IntervalStrategy, LabelFormatter, FormattedCoordinate } from '../types.js';
import { PixelIntervals } from '../intervals/PixelIntervals.js';
import { PixelFormatter } from '../formatters/PixelFormatter.js';
import { buildStraightGridLine, isOnMajorLine } from '../util/gridlines.js';
import { parsePairViaFormatter } from '../util/parseCoordinatePair.js';

const MAJOR_SKIP_EPSILON_RATIO = 0.01;

export interface PixelGridSystemOptions {
  /** If true, image Y increases downward (IIIF zDirection: -1). */
  yInverted?: boolean | undefined;
  /** Override the default interval strategy */
  intervals?: IntervalStrategy | undefined;
  /** Override the default label formatter */
  formatter?: LabelFormatter | undefined;
  /** Target minimum screen pixels between grid lines (default: 120) */
  targetScreenPx?: number | undefined;
}

/** Maps between OL view-space Y (upward) and the image's display-space Y. */
interface YAxisMapping {
  toDisplayY(olY: number): number;
  clampOLRange(olMinY: number, olMaxY: number): [number, number] | null;
}

function makeYMapping(yInverted: boolean): YAxisMapping {
  if (yInverted) {
    return {
      toDisplayY: (y) => -y,
      clampOLRange: (min, max) => {
        if (min > 0) return null;
        return [min, Math.min(0, max)];
      },
    };
  }
  return {
    toDisplayY: (y) => y,
    clampOLRange: (min, max) => {
      if (max < 0) return null;
      return [Math.max(0, min), max];
    },
  };
}

export class PixelGridSystem implements GridSystem {
  private readonly intervals_: IntervalStrategy;
  private readonly formatter_: LabelFormatter;
  private readonly yMap_: YAxisMapping;

  constructor(options?: PixelGridSystemOptions) {
    this.yMap_ = makeYMapping(options?.yInverted ?? false);
    this.intervals_ = options?.intervals ?? new PixelIntervals(options?.targetScreenPx ?? 120);
    this.formatter_ = options?.formatter ?? new PixelFormatter();
  }

  getFeatures(extent: Extent, resolution: number, _viewProjection: ProjectionLike): Feature<Geometry>[] {
    const features: Feature<Geometry>[] = [];
    const interval = this.intervals_.getInterval(resolution);
    const minorInterval = this.intervals_.getMinorInterval?.(interval);

    this.generateLines_(features, extent, interval, 'major');
    if (minorInterval !== undefined) {
      this.generateLines_(features, extent, minorInterval, 'minor', interval);
    }
    return features;
  }

  private generateLines_(
    features: Feature<Geometry>[],
    extent: Extent,
    interval: number,
    type: 'major' | 'minor',
    majorInterval?: number | undefined,
  ): void {
    const [minX, minY, maxX, maxY] = extent;
    const epsilon = interval * MAJOR_SKIP_EPSILON_RATIO;
    const skipMinor = (v: number) =>
      type === 'minor' && majorInterval !== undefined && isOnMajorLine(v, majorInterval, epsilon);

    const startX = Math.max(0, Math.floor(minX / interval) * interval);
    for (let x = startX; x <= maxX; x += interval) {
      if (skipMinor(x)) continue;
      features.push(buildStraightGridLine(x, minY, maxY, 'x', type));
    }

    const rawStartY = Math.floor(minY / interval) * interval;
    const yRange = this.yMap_.clampOLRange(rawStartY, maxY);
    if (yRange) {
      const [startY, endY] = yRange;
      for (let y = startY; y <= endY; y += interval) {
        if (skipMinor(y)) continue;
        features.push(buildStraightGridLine(y, minX, maxX, 'y', type));
      }
    }
  }

  getLabels(extent: Extent, resolution: number, _viewProjection: ProjectionLike): GridLabel[] {
    const labels: GridLabel[] = [];
    const interval = this.intervals_.getInterval(resolution);

    const [minX, minY, maxX, maxY] = extent;

    const startX = Math.floor(minX / interval) * interval;
    for (let x = startX; x <= maxX; x += interval) {
      if (x < 0) continue;
      labels.push({
        point: new Point([x, maxY]),
        text: this.formatter_.format(x, 'x'),
        axis: 'x',
      });
    }

    const rawStartY = Math.floor(minY / interval) * interval;
    const yRange = this.yMap_.clampOLRange(rawStartY, maxY);
    if (yRange) {
      const [startY, endY] = yRange;
      for (let y = startY; y <= endY; y += interval) {
        labels.push({
          point: new Point([minX, y]),
          text: this.formatter_.format(this.yMap_.toDisplayY(y), 'y'),
          axis: 'y',
        });
      }
    }

    return labels;
  }

  formatCoordinate(coordinate: [number, number], _viewProjection: ProjectionLike): FormattedCoordinate {
    const [x, y] = coordinate;
    return {
      x: this.formatter_.format(x, 'x'),
      y: this.formatter_.format(this.yMap_.toDisplayY(y), 'y'),
    };
  }

  parseCoordinate(text: string, _viewProjection: ProjectionLike): [number, number] {
    const [x, displayY] = parsePairViaFormatter(this.formatter_, text);
    return [x, this.yMap_.toDisplayY(displayY)];
  }
}

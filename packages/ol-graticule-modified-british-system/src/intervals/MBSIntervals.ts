import type { IntervalStrategy } from '@zwaarcontrast/ol-graticule';
import type { ProjectionLike } from 'ol/proj';

/** Fixed interval strategy for the Modified British System grid: 100 km major, 20 km minor. */
export class MBSIntervals implements IntervalStrategy {
  getInterval(_resolution: number, _viewProjection: ProjectionLike): number {
    return 100_000;
  }

  getMinorInterval(_majorInterval: number): number {
    return 20_000;
  }
}

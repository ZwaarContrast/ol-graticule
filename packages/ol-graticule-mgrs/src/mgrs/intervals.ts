import type { IntervalStrategy } from '@zwaarcontrast/ol-graticule';

const MGRS_INTERVALS = [1, 10, 100, 1_000, 10_000, 100_000];

/** Pick an MGRS interval (power of 10 metres) closest to `targetScreenPx`, never tighter than `minScreenPx`. */
export class MgrsIntervals implements IntervalStrategy {
  private readonly targetScreenPx_: number;
  private readonly minScreenPx_: number;

  constructor(targetScreenPx = 100, minScreenPx = 50) {
    this.targetScreenPx_ = targetScreenPx;
    this.minScreenPx_ = minScreenPx;
  }

  getInterval(resolution: number): number {
    const target = resolution * this.targetScreenPx_;
    const minTarget = resolution * this.minScreenPx_;

    let best = MGRS_INTERVALS[MGRS_INTERVALS.length - 1]!;
    let bestLogDist = Infinity;

    for (const v of MGRS_INTERVALS) {
      if (v < minTarget) continue;
      const logDist = Math.abs(Math.log(v) - Math.log(target));
      if (logDist < bestLogDist) {
        bestLogDist = logDist;
        best = v;
      }
    }
    return best;
  }

  getMinorInterval(): undefined {
    return undefined;
  }
}

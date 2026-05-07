import type { IntervalStrategy } from '../types.js';

/** Table-driven interval strategy returning the smallest entry ≥ target. */
export class SteppingIntervalStrategy implements IntervalStrategy {
  private readonly intervals_: readonly number[];
  private readonly targetScreenPx_: number;

  constructor(intervals: readonly number[], targetScreenPx: number) {
    this.intervals_ = intervals;
    this.targetScreenPx_ = targetScreenPx;
  }

  getInterval(resolution: number): number {
    const target = resolution * this.targetScreenPx_;
    const table = this.intervals_;
    for (let i = 0; i < table.length; i++) {
      if (table[i]! >= target) return table[i]!;
    }
    return table[table.length - 1]!;
  }

  getMinorInterval(majorInterval: number): number {
    return majorInterval / 5;
  }
}

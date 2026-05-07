import { SteppingIntervalStrategy } from '../util/SteppingIntervalStrategy.js';

const METRIC_INTERVALS = [
  1, 2, 5, 10, 20, 50, 100, 200, 500,
  1000, 2000, 5000, 10000, 20000, 50000,
  100000, 200000, 500000, 1000000,
];

/** Stepped-interval strategy for grids measured in linear units. */
export class MetricIntervals extends SteppingIntervalStrategy {
  constructor(targetScreenPx = 100) {
    super(METRIC_INTERVALS, targetScreenPx);
  }
}

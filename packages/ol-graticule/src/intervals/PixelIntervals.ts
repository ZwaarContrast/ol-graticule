import { SteppingIntervalStrategy } from '../util/SteppingIntervalStrategy.js';

const PIXEL_INTERVALS = [
  1, 2, 5, 10, 20, 50, 100, 200, 500,
  1000, 2000, 5000, 10000, 20000, 50000, 100000,
];

export class PixelIntervals extends SteppingIntervalStrategy {
  constructor(targetScreenPx = 120) {
    super(PIXEL_INTERVALS, targetScreenPx);
  }
}

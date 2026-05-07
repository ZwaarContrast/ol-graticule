import { SteppingIntervalStrategy } from '../util/SteppingIntervalStrategy.js';

const DEGREE_INTERVALS = [
  1 / 3600,       // 1"
  1 / 1800,       // 2"
  1 / 720,        // 5"
  1 / 360,        // 10"
  1 / 180,        // 20"
  1 / 120,        // 30"
  1 / 60,         // 1'
  1 / 30,         // 2'
  1 / 12,         // 5'
  1 / 6,          // 10'
  1 / 3,          // 20'
  1 / 2,          // 30'
  1, 2, 5, 10, 20, 30, 45, 90,
];

export class DegreeIntervals extends SteppingIntervalStrategy {
  constructor(targetScreenPx = 100) {
    super(DEGREE_INTERVALS, targetScreenPx);
  }
}

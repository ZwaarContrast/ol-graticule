import {
  BoundedCache,
  formatDecimal,
  type LabelFormatter,
  type FormattedCoordinate,
} from '@zwaarcontrast/ol-graticule';
import type { MBSLetterScheme } from './schemes.js';

/** Modified British System letter-grid formatter, parameterised by an {@link MBSLetterScheme}. */

const GRID_SIZE_MAJOR_KM = 500;
const GRID_SIZE_MINOR_KM = 100;
const METRES_PER_KM = 1000;

interface MBSCell {
  gridSquare: string;
  baseE: number;
  baseN: number;
}

export class MBSFormatter implements LabelFormatter {
  private readonly edgeCache_ = new BoundedCache<number, string>();
  private readonly scheme_: MBSLetterScheme;

  constructor(scheme: MBSLetterScheme) {
    this.scheme_ = scheme;
  }

  format(value: number, _axis: 'x' | 'y'): string {
    const cached = this.edgeCache_.get(value);
    if (cached !== undefined) return cached;
    const result = `${formatDecimal(value / METRES_PER_KM, 1)} km`;
    this.edgeCache_.set(value, result);
    return result;
  }

  formatCoordinate(x: number, y: number): FormattedCoordinate {
    return { combined: this.formatMBS(x, y) };
  }

  formatCellLabel(x: number, y: number): string | undefined {
    return this.locate_(x / METRES_PER_KM, y / METRES_PER_KM)?.gridSquare;
  }

  /** Full MBS coordinate string (e.g. `"vK 617 517"`); falls back to metric notation when out of grid. */
  formatMBS(eastingM: number, northingM: number): string {
    const eastingKm = eastingM / METRES_PER_KM;
    const northingKm = northingM / METRES_PER_KM;
    const cell = this.locate_(eastingKm, northingKm);
    if (!cell) return metricFallback(eastingM, northingM);

    const relE = clamp999(Math.round((eastingKm - cell.baseE) * 10));
    const relN = clamp999(Math.round((northingKm - cell.baseN) * 10));

    return `${cell.gridSquare} ${pad3(relE)} ${pad3(relN)}`;
  }

  /** Resolve the grid-square label and the base of the enclosing 100 km cell. */
  private locate_(eastingKm: number, northingKm: number): MBSCell | undefined {
    const { eOriginKm, nOriginKm, firstLetterGrid, secondLetterGrid } = this.scheme_;
    const relE = eastingKm - eOriginKm;
    const relN = northingKm - nOriginKm;
    if (relE < 0 || relN < 0) return undefined;

    const firstCol = Math.floor(relE / GRID_SIZE_MAJOR_KM);
    const firstRow = Math.floor(relN / GRID_SIZE_MAJOR_KM);
    if (firstCol >= 5 || firstRow >= 5) return undefined;

    const secondCol = Math.floor((relE % GRID_SIZE_MAJOR_KM) / GRID_SIZE_MINOR_KM);
    const secondRow = Math.floor((relN % GRID_SIZE_MAJOR_KM) / GRID_SIZE_MINOR_KM);

    const firstLetter = firstLetterGrid[firstRow]![firstCol]!;
    const secondLetter = secondLetterGrid[secondRow]![secondCol]!;
    if (firstLetter === '-' || secondLetter === '-') return undefined;
    const gridSquare = firstLetter.toLowerCase() + secondLetter.toUpperCase();

    const baseE = eOriginKm + firstCol * GRID_SIZE_MAJOR_KM + secondCol * GRID_SIZE_MINOR_KM;
    const baseN = nOriginKm + firstRow * GRID_SIZE_MAJOR_KM + secondRow * GRID_SIZE_MINOR_KM;

    return { gridSquare, baseE, baseN };
  }
}

function metricFallback(eastingM: number, northingM: number): string {
  return `${formatDecimal(eastingM / METRES_PER_KM, 1)}, ${formatDecimal(northingM / METRES_PER_KM, 1)} km`;
}

function clamp999(n: number): number {
  return n < 0 ? 0 : n > 999 ? 999 : n;
}

function pad3(n: number): string {
  return n.toString().padStart(3, '0');
}

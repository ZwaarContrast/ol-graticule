import {
  BoundedCache,
  ParseError,
  formatDecimal,
  parseLinear,
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

  parse(text: string, _axis?: 'x' | 'y'): number {
    return parseLinear(text, 'm');
  }

  /**
   * Lenient parse of an MBS reference back to view-projection metres at the
   * cell centre. Accepts:
   *   - `"vK"`, `"vK6175"`, `"vK 617 517"`, `"VK90449926"`, case-insensitive
   *     two-letter prefix + 0/2/4/6/8/10 digits, with optional whitespace.
   *     Returns the centre of the cell at the precision implied by the digit
   *     count (100 km, 10 km, 1 km, 100 m, 10 m, 1 m respectively).
   *   - `"309.02 296.80"` / `"309.02, 296.80"`, bare numeric pairs in km.
   *     Add `"km"` or `"m"` suffix to disambiguate.
   */
  parseCoordinate(text: string): [number, number] {
    if (text.trim().length === 0) throw new ParseError(text, 'empty input');
    const trimmed = text.trim();

    const compound = trimmed.match(/^([a-zA-Z])\s*([a-zA-Z])([\d\s]*)$/);
    if (compound) {
      return this.parseCompound_(text, compound[1]!, compound[2]!, compound[3]!);
    }

    return parseNumericPair_(text);
  }

  private parseCompound_(
    text: string,
    firstLetter: string,
    secondLetter: string,
    digitsBlock: string,
  ): [number, number] {
    const digits = digitsBlock.replace(/\s+/g, '');
    if (digits.length % 2 !== 0) {
      throw new ParseError(text, 'digit count must be even');
    }
    if (digits.length > 10) {
      throw new ParseError(text, 'digit count exceeds 10 (1 m precision)');
    }

    const { eOriginKm, nOriginKm, firstLetterGrid, secondLetterGrid } = this.scheme_;
    const first = findInGrid_(firstLetterGrid, firstLetter, text);
    const second = findInGrid_(secondLetterGrid, secondLetter, text);

    const baseEastingM =
      (eOriginKm + first.col * GRID_SIZE_MAJOR_KM + second.col * GRID_SIZE_MINOR_KM) *
      METRES_PER_KM;
    const baseNorthingM =
      (nOriginKm + first.row * GRID_SIZE_MAJOR_KM + second.row * GRID_SIZE_MINOR_KM) *
      METRES_PER_KM;

    if (digits.length === 0) {
      const halfCellM = (GRID_SIZE_MINOR_KM * METRES_PER_KM) / 2;
      return [baseEastingM + halfCellM, baseNorthingM + halfCellM];
    }

    const half = digits.length / 2;
    const cellSizeM = (GRID_SIZE_MINOR_KM * METRES_PER_KM) / Math.pow(10, half);
    const offsetE = Number.parseInt(digits.slice(0, half), 10) * cellSizeM;
    const offsetN = Number.parseInt(digits.slice(half), 10) * cellSizeM;
    return [baseEastingM + offsetE, baseNorthingM + offsetN];
  }
}

interface LetterPos {
  row: number;
  col: number;
}

function findInGrid_(grid: readonly string[], letter: string, text: string): LetterPos {
  const upper = letter.toUpperCase();
  for (let row = 0; row < grid.length; row++) {
    const col = grid[row]!.indexOf(upper);
    if (col !== -1) return { row, col };
  }
  throw new ParseError(text, `letter "${letter}" not found in grid`);
}

function parseNumericPair_(text: string): [number, number] {
  const trimmed = text.trim();
  const unitMatch = trimmed.match(/(km|m)\s*$/i);
  let unit: 'km' | 'm' = 'km';
  if (unitMatch) {
    const tag = unitMatch[1]!.toLowerCase();
    if (tag === 'km' || tag === 'm') unit = tag;
  }
  const numericPart = unitMatch ? trimmed.slice(0, unitMatch.index).trim() : trimmed;

  const parts = numericPart
    .split(/[\s,]+/)
    .filter((p) => p.length > 0);
  if (parts.length !== 2) {
    throw new ParseError(text, 'expected two numeric components');
  }
  const a = Number.parseFloat(parts[0]!);
  const b = Number.parseFloat(parts[1]!);
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new ParseError(text, 'invalid numeric value');
  }
  const factor = unit === 'km' ? METRES_PER_KM : 1;
  return [a * factor, b * factor];
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

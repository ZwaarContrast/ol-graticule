/** 100,000-metre square identifier letters for MGRS (modern WGS84 "AA" scheme). */

const COLUMN_SETS = ['ABCDEFGH', 'JKLMNPQR', 'STUVWXYZ'] as const;
const ROW_LETTERS = 'ABCDEFGHJKLMNPQRSTUV';
const ROW_CYCLE = ROW_LETTERS.length;

/** Column letter set for a given UTM zone number (1-60). */
export function columnSetForZone(zone: number): string {
  return COLUMN_SETS[(zone - 1) % 3]!;
}

/** Row letter origin offset for a UTM zone: 0 for odd zones, 5 for even zones. */
export function rowOffsetForZone(zone: number): number {
  return zone % 2 === 0 ? 5 : 0;
}

/** Column letter for a UTM easting inside `zone`. */
export function columnLetter(zone: number, easting: number): string | undefined {
  const idx = Math.floor(easting / 100_000) - 1;
  if (idx < 0 || idx >= 8) return undefined;
  return columnSetForZone(zone)[idx];
}

/** Row letter for a UTM northing inside `zone`. */
export function rowLetter(zone: number, northing: number): string {
  const stepFromOrigin = Math.floor(northing / 100_000);
  const offset = rowOffsetForZone(zone);
  const idx = ((stepFromOrigin + offset) % ROW_CYCLE + ROW_CYCLE) % ROW_CYCLE;
  return ROW_LETTERS[idx]!;
}

/** Two-letter 100 km cell id for `(easting, northing)` in `zone`. */
export function squareLetters(
  zone: number,
  easting: number,
  northing: number,
): string | undefined {
  const col = columnLetter(zone, easting);
  if (col === undefined) return undefined;
  return col + rowLetter(zone, northing);
}

/** Inverse of {@link columnLetter}: easting of the SW corner of the column's 100 km strip. */
export function columnLetterToEasting(zone: number, letter: string): number | undefined {
  const idx = columnSetForZone(zone).indexOf(letter);
  if (idx < 0) return undefined;
  return (idx + 1) * 100_000;
}

/** Inverse of {@link rowLetter}: row index within the 2,000 km cycle (0..{@link ROW_CYCLE}-1). */
export function rowLetterToCycleIndex(zone: number, letter: string): number | undefined {
  const rowIdx = ROW_LETTERS.indexOf(letter);
  if (rowIdx < 0) return undefined;
  const offset = rowOffsetForZone(zone);
  return ((rowIdx - offset) % ROW_CYCLE + ROW_CYCLE) % ROW_CYCLE;
}

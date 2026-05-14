/**
 * Heeresmeldenetz Kleinquadrat alphabet: A..Z with `I` skipped (25 letters).
 *
 * The omission is documented in the Planheft cross-references and matches
 * what every wartime sheet prints: e.g. Kolosjoki shows `JP / JQ / JR` going
 * south with no `IP / IQ / IR` between `H` and `J`. Same convention as the
 * Modified British System.
 */
const ALPHABET = 'ABCDEFGHJKLMNOPQRSTUVWXYZ' as const;

/** Number of letters in the HMN alphabet (25). */
export const HMN_LETTER_COUNT = ALPHABET.length;

/** Letter at `index`, or `undefined` if out of range. */
export function letterFromIndex(index: number): string | undefined {
  if (!Number.isInteger(index) || index < 0 || index >= HMN_LETTER_COUNT) return undefined;
  return ALPHABET[index];
}

/** Index of `letter`, or `-1` if not present. Case-insensitive. */
export function letterToIndex(letter: string): number {
  if (letter.length !== 1) return -1;
  return ALPHABET.indexOf(letter.toUpperCase());
}

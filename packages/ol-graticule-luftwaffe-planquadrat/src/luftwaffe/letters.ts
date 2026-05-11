/**
 * Jägermeldenetz Mitteltrapez 20×20 letter alphabet.
 *
 * "The letter 'I' was not used to avoid confusion with the letter J."
 * Source: prwg.co.uk Halifax JB837 page; aircrewremembered.com.
 */
const JMN_LETTERS = 'ABCDEFGHJKLMNOPQRSTU' as const;

/** Number of letters in the Jägermeldenetz alphabet (20). */
const JMN_LETTER_COUNT = JMN_LETTERS.length;

/** Letter at `index` in the Jägermeldenetz alphabet, or `undefined` if out of range. */
export function letterFromIndex(index: number): string | undefined {
  if (!Number.isInteger(index) || index < 0 || index >= JMN_LETTER_COUNT) return undefined;
  return JMN_LETTERS[index];
}

/** Index of `letter` in the Jägermeldenetz alphabet, or `-1` if not present. */
export function letterToIndex(letter: string): number {
  if (letter.length !== 1) return -1;
  return JMN_LETTERS.indexOf(letter.toUpperCase());
}

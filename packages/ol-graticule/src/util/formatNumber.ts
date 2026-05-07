/** Format a number with up to `decimals` fractional digits, stripping trailing zeros. */
export function formatDecimal(value: number, decimals: number): string {
  if (value % 1 === 0) return value.toFixed(0);
  return value.toFixed(decimals).replace(/\.?0+$/, '');
}

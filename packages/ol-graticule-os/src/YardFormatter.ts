import { ParseError } from '@zwaarcontrast/ol-graticule/headless';
import type { LabelFormatter } from '@zwaarcontrast/ol-graticule/headless';

function groupThousands(n: number): string {
  return String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Full-figure yard labels as the sheets print them: `813,800 yd`. */
export class YardFormatter implements LabelFormatter {
  format(value: number): string {
    return `${value < 0 ? '-' : ''}${groupThousands(value)} yd`;
  }

  /** Accepts `813800`, `813,800`, `E 813,800 yd` and similar. */
  parse(text: string, axis: 'x' | 'y'): number {
    const prefix = axis === 'x' ? /^[Ee]\.?\s*/ : /^[Nn]\.?\s*/;
    const digits = text
      .trim()
      .replace(prefix, '')
      .replace(/\s*(yd|yds|yards)\.?$/i, '')
      .replace(/,/g, '');
    if (!/^-?\d+(\.\d+)?$/.test(digits)) {
      throw new ParseError(text, 'expected a distance in yards');
    }
    return Number(digits);
  }
}

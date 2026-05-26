/**
 * Build a decimal-degree value from degrees / minutes / seconds. Test-only;
 * makes wartime-sheet coordinates (`52°04'46"N`) readable as
 * `dms(52, 4, 46)`. The framework's `DegreeFormatter` parses DMS *text*, but
 * does not offer a numeric constructor.
 */
export function dms(deg: number, min: number, sec = 0): number {
  return deg + (min * 60 + sec) / 3600;
}

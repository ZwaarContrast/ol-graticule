/**
 * Build a decimal-degree value from degrees / minutes / seconds. Test-only;
 * makes wartime-sheet coordinates (`52°04'46"N`) readable as
 * `dms(52, 4, 46)`. The library's `DegreeFormatter` parses DMS text, but
 * does not offer a numeric constructor.
 */
export function dms(deg: number, min: number, sec = 0): number {
  return deg + (min * 60 + sec) / 3600;
}

/** Signed-DMS for southern/western inputs: `dmsSigned(-1, 52, 4, 46)`. */
export function dmsSigned(sign: 1 | -1, deg: number, min: number, sec = 0): number {
  return sign * dms(deg, min, sec);
}

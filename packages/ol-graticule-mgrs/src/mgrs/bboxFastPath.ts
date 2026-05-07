/**
 * Walk a list of points once to record their bbox AND check membership in
 * `[xLo,xHi] × [yLo,yHi]`. Used by `clipPolygonToRect` and `clipPolylineToRect`
 * to short-circuit the clip when the input is fully inside or fully outside.
 */
export function inspectBboxRelToRect(
  points: ReadonlyArray<readonly [number, number]>,
  xLo: number,
  yLo: number,
  xHi: number,
  yHi: number,
): { allInside: boolean; outsideRect: boolean } {
  let allInside = true;
  let pMinX = Infinity, pMinY = Infinity;
  let pMaxX = -Infinity, pMaxY = -Infinity;
  for (const p of points) {
    const x = p[0];
    const y = p[1];
    if (x < pMinX) pMinX = x;
    if (x > pMaxX) pMaxX = x;
    if (y < pMinY) pMinY = y;
    if (y > pMaxY) pMaxY = y;
    if (x < xLo || x > xHi || y < yLo || y > yHi) {
      allInside = false;
    }
  }
  const outsideRect = pMaxX < xLo || pMinX > xHi || pMaxY < yLo || pMinY > yHi;
  return { allInside, outsideRect };
}

import { getTransform } from 'ol/proj';
import type { ProjectionLike, TransformFunction } from 'ol/proj';

/** `getTransform` that throws when OpenLayers has no transform between the two. */
export function requireTransform(
  source: ProjectionLike,
  destination: ProjectionLike,
): TransformFunction {
  const fn = getTransform(source, destination);
  if (!fn) {
    throw new Error(`No transform from ${code(source)} to ${code(destination)}`);
  }
  return fn;
}

function code(projection: ProjectionLike): string {
  return typeof projection === 'string'
    ? projection
    : (projection?.getCode() ?? 'undefined');
}

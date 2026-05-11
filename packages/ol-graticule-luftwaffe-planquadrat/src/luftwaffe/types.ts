import type { LatLon } from '@zwaarcontrast/ol-graticule';

export type { LatLon };

/** Which Luftwaffe grid system. */
export type LuftwaffeSystem = 'gnmv' | 'jmn';

/**
 * Era of the system. The pre-1943 form has only 4 (2×2) Meldetrapeze and
 * Arbeitstrapeze; from 1 May 1943 these were each refined to 9 (3×3).
 */
export type LuftwaffeEra = 'pre-1943' | 'post-1943';

/** ZZG hemisphere/half suffix. */
export type ZzgSuffix = 'Ost' | 'West' | 'Südost' | 'Südwest';

/** JMN Jagdtrapez half: northern or southern half of a ZZG. */
export type JmnHalf = 'N' | 'S';

/** A geographic bounding box `[minLon, minLat, maxLon, maxLat]`. */
export type GeoBox = [number, number, number, number];

/** Resolved decoded reference: bbox of the cell + its centre + the canonical text. */
export interface DecodedRef {
  /** Canonical text form (whitespace-free, normalised case). */
  canonical: string;
  /** Display-formatted text. */
  formatted: string;
  /** Geographic bounding box of the cell, `[minLon, minLat, maxLon, maxLat]`. */
  bbox: GeoBox;
  /** Geographic centre of the cell, `[lat, lon]`. */
  center: LatLon;
  /** Depth of the resolved reference. 0 = ZZG only, 5 = full Arbeitstrapez. */
  depth: number;
}

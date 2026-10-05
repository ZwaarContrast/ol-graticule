import { describe, it, expect } from 'vitest';
import proj4 from 'proj4';
import { get as getProjection } from 'ol/proj';
import { registerCRS } from '../registerCRS.js';
import { registerProj4 } from '../registerProj4.js';

// Use obscure/unassigned EPSG codes so we can't collide with anything the
// ProjectedGridSystem test file might have registered first.
const TEST_CODE_A = 'EPSG:990001';
const TEST_CODE_B = 'EPSG:990002';

// Two distinct valid proj4 definitions: UTM zone 33N and UTM zone 34N.
const PROJ4_A = '+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs +type=crs';
const PROJ4_A_ALT =
  '+proj=utm +zone=34 +datum=WGS84 +units=m +no_defs +type=crs';
const PROJ4_B = '+proj=utm +zone=10 +datum=WGS84 +units=m +no_defs +type=crs';

describe('registerCRS', () => {
  it('registers a CRS with both proj4 and OpenLayers', () => {
    registerCRS(TEST_CODE_A, PROJ4_A);

    // proj4 should now resolve the code.
    expect(() => proj4(TEST_CODE_A)).not.toThrow();

    // OL's projection registry should know the code.
    expect(getProjection(TEST_CODE_A)).toBeTruthy();
  });

  it('is idempotent for the same (code, proj4Def) pair', () => {
    // Second call with identical input should be a no-op and not throw.
    registerCRS(TEST_CODE_B, PROJ4_B);
    const first = proj4.defs(TEST_CODE_B);
    registerCRS(TEST_CODE_B, PROJ4_B);
    const second = proj4.defs(TEST_CODE_B);
    expect(second).toStrictEqual(first);
  });

  it('updates the registration when the proj4Def changes for the same code', () => {
    registerCRS(TEST_CODE_A, PROJ4_A);
    const before = proj4.defs(TEST_CODE_A) as { proj?: string; zone?: number };
    expect(before.zone).toBe(33);

    registerCRS(TEST_CODE_A, PROJ4_A_ALT);
    const after = proj4.defs(TEST_CODE_A) as { proj?: string; zone?: number };
    expect(after.zone).toBe(34);
  });
});

describe('registerCRS after registerProj4', () => {
  const CODE = 'TEST:HEADLESS_THEN_OL';
  const DEF =
    '+proj=sterea +lat_0=52.1561605555556 +lon_0=5.38763888888889 ' +
    '+k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +units=m +no_defs';

  it('still tells OpenLayers about a code the headless path registered first', () => {
    // registerProj4 reports "no change" for a code it already holds, so a
    // registerCRS that trusts that report would skip the OpenLayers half and
    // leave the code resolvable by proj4 but invisible to ol/proj.
    registerProj4(CODE, DEF);
    registerCRS(CODE, DEF);
    expect(getProjection(CODE)).not.toBeNull();
  });
});

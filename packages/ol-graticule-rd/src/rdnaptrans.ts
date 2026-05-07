import proj4 from 'proj4';
import { RDTRANS2018_BASE64 } from './rdtrans2018Base64.js';

/**
 * The key under which the RDNAPTRANS 2018 NTv2 grid is registered with proj4.
 * Must match the `+nadgrids=@rdtrans2018,@null` reference embedded in
 * {@link RD_NEW_PROJ4} and {@link RD_OLD_PROJ4}.
 */
export const RDNAPTRANS2018_GRID_NAME = 'rdtrans2018';

let registered = false;

/**
 * Register the bundled RDNAPTRANS 2018 NTv2 grid with proj4 under the name
 * `rdtrans2018`. Required for the RD New / RD Old proj4 definitions shipped
 * by this package to produce accurate coordinates — the `+towgs84` Helmert
 * fallback has ~1 m residual error, while RDNAPTRANS 2018 gives
 * sub-centimetre accuracy across the Netherlands.
 *
 * Synchronous — the grid is base64-inlined, no bundler config / network /
 * asset file needed. First call decodes ~80 KB; subsequent calls are no-ops.
 * The RD factories call this automatically; call it yourself only when
 * constructing a `ProjectedGridSystem` with `RD_NEW_PROJ4`/`RD_OLD_PROJ4` by
 * hand, or to pre-warm decoding at a known quiet moment.
 */
export function registerRDNAPTRANS2018(): void {
  if (registered) return;
  const binary = atob(RDTRANS2018_BASE64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  proj4.nadgrid(RDNAPTRANS2018_GRID_NAME, buffer);
  registered = true;
}

/** Test-only: forget the registration flag so the next call re-registers. */
export function __resetRDNAPTRANS2018(): void {
  registered = false;
}

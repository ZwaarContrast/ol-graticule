import proj4 from 'proj4';

/**
 * Per-name cache of in-flight or completed nadgrid loads. Concurrent callers
 * share the same promise; repeat callers after resolution get the settled
 * promise back so they don't re-fetch or re-register.
 */
const inFlight = new Map<string, Promise<void>>();

export interface LoadNadgridOptions {
  /**
   * Re-load and re-register even if a grid is already registered under
   * `name`. Useful if the caller wants to swap in a newer grid file at
   * runtime. Defaults to `false`.
   */
  force?: boolean;
}

/**
 * Load an NTv2 datum-shift grid and register it with proj4 under `name`,
 * so proj4 strings that reference `+nadgrids=@name` can resolve it.
 *
 * `source` accepts:
 *   - `ArrayBuffer`, used directly
 *   - `URL`        , passed to `fetch`
 *   - `string`     , passed to `fetch` (absolute URL or page-relative path)
 *
 * File-URL fetching depends on the runtime: modern browsers and Node 21+
 * handle `file:` URLs via `fetch`. On older Node versions, read the grid
 * with your preferred fs API and pass the `ArrayBuffer` directly.
 *
 * Calls are cached per-`name`: concurrent callers share one load, and
 * post-resolution callers return immediately. Failed loads drop from the
 * cache so callers can retry with a different source. Pass
 * `{ force: true }` to force a re-load/re-register.
 *
 * ```ts
 * const gridUrl = new URL('./rdtrans2018.gsb', import.meta.url);
 * await loadNadgrid('rdtrans2018', gridUrl);
 * ```
 */
export function loadNadgrid(
  name: string,
  source: string | URL | ArrayBuffer,
  options?: LoadNadgridOptions,
): Promise<void> {
  if (!options?.force) {
    const cached = inFlight.get(name);
    if (cached) return cached;
  }

  const promise = (async () => {
    const buffer = source instanceof ArrayBuffer ? source : await fetchAsArrayBuffer(source);
    proj4.nadgrid(name, buffer);
  })();

  promise.catch(() => {
    // Only evict if this is still the cached promise, a concurrent
    // `force: true` call may have replaced it with a fresh attempt.
    if (inFlight.get(name) === promise) inFlight.delete(name);
  });
  inFlight.set(name, promise);
  return promise;
}

async function fetchAsArrayBuffer(input: string | URL): Promise<ArrayBuffer> {
  const res = await fetch(input);
  if (!res.ok) {
    throw new Error(
      `Failed to load nadgrid from ${String(input)}: ${res.status} ${res.statusText}`,
    );
  }
  return res.arrayBuffer();
}

/**
 * Test-only: drop all cached nadgrid load promises so the next call re-runs
 * the loader. Does not unregister grids from proj4, that's owned by proj4
 * and persists for the process lifetime.
 */
export function __resetNadgridLoadCache(): void {
  inFlight.clear();
}

/**
 * Place-name lookup against the OSM Nominatim public endpoint.
 *
 * Falls back when a demo's primary parser doesn't recognise the input.
 * Lets a user type "Leiden" or "Hadres" into the same box they'd type a
 * grid reference.
 *
 * Usage policy (https://operations.osmfoundation.org/policies/nominatim):
 *   - absolute max 1 request per second per IP; we debounce client-side.
 *   - no bulk / batch use.
 *   - must identify the calling app via `Referer` or `User-Agent`. From a
 *     browser `fetch` we can't set `User-Agent`, but the `Referer` header
 *     is sent automatically.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const MIN_INTERVAL_MS = 1100;

let lastRequestAt = 0;

interface NominatimResult {
  /** Decimal degrees, WGS84. */
  lat: number;
  lon: number;
  /** Human-readable label from Nominatim, e.g. "Leiden, Zuid-Holland, NL". */
  displayName: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Look up the top hit for a place-name query. Returns `undefined` when
 * Nominatim returns no results or the network call fails. Honours the
 * 1 req/sec rate limit by client-side debouncing.
 */
/**
 * Try the typed input as a place name when a primary parser has rejected
 * it. Updates the status line with a "Searching…" hint, calls `onHit` with
 * the resolved hit (caller projects + drops the marker), and on miss reports
 * a combined error message including the original parser reason.
 *
 * Bails without hitting the network when the input doesn't look like a
 * place name (cheap heuristic: needs two or more letters).
 */
export async function tryNominatimFallback(
  text: string,
  parserReason: string,
  onHit: (hit: NominatimResult) => void,
  setStatus: (text: string, isError: boolean) => void,
): Promise<void> {
  const looksLikePlace = /[A-Za-z].*[A-Za-z]/.test(text);
  if (!looksLikePlace) {
    setStatus(parserReason, true);
    return;
  }
  setStatus(`Searching “${text}”…`, false);
  const hit = await nominatimLookup(text);
  if (!hit) {
    setStatus(`${parserReason}; no place “${text}” found either`, true);
    return;
  }
  onHit(hit);
  setStatus(`📍 ${hit.displayName}`, false);
}

async function nominatimLookup(query: string): Promise<NominatimResult | undefined> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return undefined;

  const now = Date.now();
  const wait = Math.max(0, lastRequestAt + MIN_INTERVAL_MS - now);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('q', trimmed);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '0');

  let response: Response;
  try {
    response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  } catch {
    return undefined;
  }
  if (!response.ok) return undefined;

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return undefined;
  }
  if (!Array.isArray(payload) || payload.length === 0) return undefined;
  const first = payload[0];
  if (!isRecord(first)) return undefined;
  const latStr = first['lat'];
  const lonStr = first['lon'];
  const displayName = first['display_name'];
  if (typeof latStr !== 'string' || typeof lonStr !== 'string') return undefined;
  const lat = Number.parseFloat(latStr);
  const lon = Number.parseFloat(lonStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
  return {
    lat,
    lon,
    displayName: typeof displayName === 'string' ? displayName : trimmed,
  };
}

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
  /** Short "place, country" label, e.g. "Valkenburg ZH, Netherlands". */
  displayName: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Condense a Nominatim hit to a short "place, country" label. Nominatim's
 * `display_name` is a long comma-separated address chain (e.g. "Valkenburg
 * ZH, 1B, J. Pellenbargweg, …, South Holland, Netherlands"). Prefer the
 * structured `name` / `address.country` fields (addressdetails=1), falling
 * back to the first and last segments of `display_name`.
 */
function shortLabel(result: Record<string, unknown>): string {
  const displayName =
    typeof result['display_name'] === 'string' ? result['display_name'] : '';
  const parts = displayName
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const rawName = result['name'];
  const name =
    typeof rawName === 'string' && rawName.length > 0
      ? rawName
      : (parts[0] ?? '');

  const address = isRecord(result['address']) ? result['address'] : undefined;
  const rawCountry = address?.['country'];
  const country =
    typeof rawCountry === 'string' && rawCountry.length > 0
      ? rawCountry
      : parts.length > 1
        ? parts[parts.length - 1]
        : '';

  if (name && country && name !== country) return `${name}, ${country}`;
  return name || country || displayName;
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

async function nominatimLookup(
  query: string,
): Promise<NominatimResult | undefined> {
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
  url.searchParams.set('addressdetails', '1');

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });
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
  if (typeof latStr !== 'string' || typeof lonStr !== 'string')
    return undefined;
  const lat = Number.parseFloat(latStr);
  const lon = Number.parseFloat(lonStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
  const label = shortLabel(first);
  return {
    lat,
    lon,
    displayName: label.length > 0 ? label : trimmed,
  };
}

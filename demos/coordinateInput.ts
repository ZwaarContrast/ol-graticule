/**
 * Styled coordinate-input widget that uses {@link GridSystem.parseCoordinate}
 * (or a custom `parse` callback) to fly the map to a typed reference and drop
 * a marker. Demo-only.
 */

import type Map from 'ol/Map';
import type { Coordinate } from 'ol/coordinate';
import Overlay from 'ol/Overlay';
import type { ProjectionLike } from 'ol/proj';
import { transform } from 'ol/proj';
import { ParseError } from '@zwaarcontrast/ol-graticule';
import type { GridSystem } from '@zwaarcontrast/ol-graticule';

import { tryNominatimFallback } from './nominatim';

type ParseFn = (text: string, projection: ProjectionLike) => Coordinate | Promise<Coordinate>;

interface CoordinateInputOptions {
  map: Map;
  /** Host element the widget is appended to (typically the demo's `.badge`). */
  host: HTMLElement;
  /** Placeholder text, what kind of input do we expect? */
  placeholder: string;
  /** Optional one-line hint shown beneath the input. */
  hint?: string | undefined;
  /** Grid system whose `parseCoordinate` is called on submit. Provide this OR `parse`. */
  gridSystem?: GridSystem;
  /** Custom parser. Takes precedence over `gridSystem.parseCoordinate`. */
  parse?: ParseFn;
}

export interface CoordinateInputHandle {
  destroy(): void;
  setPlaceholder(text: string): void;
}

/**
 * Append a labelled input + Go button to `host`, parse on submit, fly the
 * view to the result, and drop a small terracotta marker. Returns `null`
 * when neither a custom `parse` nor a grid system with `parseCoordinate`
 * is provided.
 */
export function createCoordinateInput(
  opts: CoordinateInputOptions,
): CoordinateInputHandle | null {
  const { map, host, placeholder, hint } = opts;
  const parseCandidate: ParseFn | undefined =
    opts.parse ?? opts.gridSystem?.parseCoordinate?.bind(opts.gridSystem);
  if (!parseCandidate) return null;
  const parse = parseCandidate;

  const wrap = document.createElement('div');
  wrap.className = 'coord-input';

  const row = document.createElement('div');
  row.className = 'coord-input__row';

  const input = document.createElement('input');
  input.type = 'text';
  input.spellcheck = false;
  input.autocomplete = 'off';
  input.autocapitalize = 'off';
  input.placeholder = placeholder;
  input.className = 'coord-input__field';

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Go';
  button.className = 'coord-input__button';

  row.append(input, button);

  const status = document.createElement('p');
  status.className = 'coord-input__status';
  status.setAttribute('aria-live', 'polite');
  if (hint) status.textContent = hint;

  wrap.append(row, status);
  host.append(wrap);

  const markerEl = document.createElement('div');
  markerEl.className = 'coord-input__marker';
  const overlay = new Overlay({
    element: markerEl,
    positioning: 'center-center',
    stopEvent: false,
  });
  map.addOverlay(overlay);

  function setStatus(text: string, isError: boolean): void {
    status.textContent = text;
    status.classList.toggle('coord-input__status--error', isError);
  }

  async function go(): Promise<void> {
    const text = input.value.trim();
    if (text.length === 0) return;
    const projection = map.getView().getProjection();
    try {
      const coord = await parse(text, projection);
      overlay.setPosition(coord);
      map.getView().animate({ center: coord, duration: 400 });
      setStatus(hint ?? '', false);
      return;
    } catch (err) {
      const parserReason =
        err instanceof ParseError ? err.reason :
        err instanceof Error ? err.message :
        'parse failed';
      await tryNominatimFallback(text, parserReason, (hit) => {
        const coord = transform([hit.lon, hit.lat], 'EPSG:4326', projection);
        overlay.setPosition(coord);
        map.getView().animate({ center: coord, duration: 400 });
      }, setStatus);
    }
  }

  button.addEventListener('click', () => { void go(); });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void go();
    }
  });

  return {
    destroy: () => {
      map.removeOverlay(overlay);
      wrap.remove();
    },
    setPlaceholder: (text: string) => {
      input.placeholder = text;
    },
  };
}

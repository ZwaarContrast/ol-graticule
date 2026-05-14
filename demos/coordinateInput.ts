/**
 * Styled coordinate-input widget that uses {@link GridSystem.parseCoordinate}
 * to fly the map to a typed reference and drop a marker. Demo-only.
 */

import type Map from 'ol/Map';
import Overlay from 'ol/Overlay';
import { ParseError } from '@zwaarcontrast/ol-graticule';
import type { GridSystem } from '@zwaarcontrast/ol-graticule';

interface CoordinateInputOptions {
  map: Map;
  gridSystem: GridSystem;
  /** Host element the widget is appended to (typically the demo's `.badge`). */
  host: HTMLElement;
  /** Placeholder text, what kind of input do we expect? */
  placeholder: string;
  /** Optional one-line hint shown beneath the input. */
  hint?: string | undefined;
}

export interface CoordinateInputHandle {
  destroy(): void;
}

/**
 * Append a labelled input + Go button to `host`, parse on submit, fly the
 * view to the result, and drop a small terracotta marker. Returns `null`
 * when the grid system has no `parseCoordinate` method (no UI rendered).
 */
export function createCoordinateInput(
  opts: CoordinateInputOptions,
): CoordinateInputHandle | null {
  const { map, gridSystem, host, placeholder, hint } = opts;
  if (!gridSystem.parseCoordinate) return null;
  const parse = gridSystem.parseCoordinate.bind(gridSystem);

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

  function go(): void {
    const text = input.value.trim();
    if (text.length === 0) return;
    try {
      const coord = parse(text, map.getView().getProjection());
      overlay.setPosition(coord);
      map.getView().animate({ center: coord, duration: 400 });
      setStatus(hint ?? '', false);
    } catch (err) {
      if (err instanceof ParseError) {
        setStatus(err.reason, true);
      } else if (err instanceof Error) {
        setStatus(err.message, true);
      } else {
        setStatus('parse failed', true);
      }
    }
  }

  button.addEventListener('click', go);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      go();
    }
  });

  return {
    destroy: () => {
      map.removeOverlay(overlay);
      wrap.remove();
    },
  };
}

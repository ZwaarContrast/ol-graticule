import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import Overlay from 'ol/Overlay';
import OSM from 'ol/source/OSM';
import { fromLonLat, transform } from 'ol/proj';
import {
  UniversalGraticule,
  CursorPositionControl,
  ParseError,
  createDefaultCellLabelHandler,
} from '@zwaarcontrast/ol-graticule';
import {
  LuftwaffeGridSystem,
  parseRef,
} from '@zwaarcontrast/ol-graticule-luftwaffe-planquadrat';
import type { LuftwaffeSystem } from '@zwaarcontrast/ol-graticule-luftwaffe-planquadrat';
import { gridLine, cursorStyle } from '../shared';
import { tryNominatimFallback } from '../nominatim';

const snapCellLabelHandler = createDefaultCellLabelHandler({
  fontWeight: 700,
  fillColor: (o) => `rgba(254, 215, 170, ${o.toFixed(2)})`,
  strokeColor: (o) => `rgba(194, 65, 12, ${o.toFixed(2)})`,
  strokeWidth: 3,
  peakOpacity: 0.85,
  fadeStops: [0, 1, 799, 800],
});

let activeSystem: LuftwaffeSystem = 'gnmv';
let gridSystem = new LuftwaffeGridSystem({ system: activeSystem });
let graticule = buildGraticule();
let cursorControl = new CursorPositionControl({ gridSystem, style: cursorStyle });

const map = new Map({
  target: 'map',
  layers: [new TileLayer({ source: new OSM() }), graticule],
  controls: [cursorControl],
  view: new View({
    center: fromLonLat([13.4, 52.5]),
    zoom: 7,
  }),
});

const badge = document.querySelector<HTMLElement>('.badge');
const controls = document.getElementById('system-controls');

const input = createInputUi();

controls?.querySelectorAll<HTMLButtonElement>('button').forEach((btn) => {
  btn.addEventListener('click', () => {
    const system = btn.dataset['system'] as LuftwaffeSystem | undefined;
    if (!system || system === activeSystem) return;
    setActiveSystem(system);
  });
});

function setActiveSystem(system: LuftwaffeSystem): void {
  if (system === activeSystem) return;
  activeSystem = system;
  controls?.querySelectorAll('button').forEach((b) => {
    const target = b as HTMLButtonElement;
    target.classList.toggle('active', target.dataset['system'] === system);
  });

  map.removeLayer(graticule);
  map.removeControl(cursorControl);
  gridSystem = new LuftwaffeGridSystem({ system });
  graticule = buildGraticule();
  cursorControl = new CursorPositionControl({ gridSystem, style: cursorStyle });
  map.addLayer(graticule);
  map.addControl(cursorControl);

  input.setPlaceholder(
    system === 'gnmv' ? '15 Ost 33 3 9 7 c' : '05 Ost S NO 3 2 a',
  );
}

function buildGraticule(): UniversalGraticule {
  return new UniversalGraticule({
    gridSystem,
    style: { line: { major: gridLine }, cellLabel: snapCellLabelHandler },
    maxLines: 600,
  });
}

interface InputUi {
  setPlaceholder(text: string): void;
}

function createInputUi(): InputUi {
  if (!badge) return { setPlaceholder() {} };

  const wrap = document.createElement('div');
  wrap.className = 'coord-input';
  const row = document.createElement('div');
  row.className = 'coord-input__row';
  const field = document.createElement('input');
  field.type = 'text';
  field.spellcheck = false;
  field.autocomplete = 'off';
  field.autocapitalize = 'off';
  field.placeholder = '15 Ost 33 3 9 7 c';
  field.className = 'coord-input__field';
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Go';
  button.className = 'coord-input__button';
  row.append(field, button);
  const status = document.createElement('p');
  status.className = 'coord-input__status';
  status.setAttribute('aria-live', 'polite');
  const defaultHint = 'Try "15 Ost 33 3 9 7 c" (Reichstag, GNMV) or "05 Ost S NO 3 2 a" (Köln, JMN).';
  status.textContent = defaultHint;
  wrap.append(row, status);
  badge.append(wrap);

  const markerEl = document.createElement('div');
  markerEl.className = 'coord-input__marker';
  const overlay = new Overlay({ element: markerEl, positioning: 'center-center', stopEvent: false });
  map.addOverlay(overlay);

  function setStatus(text: string, isError: boolean): void {
    status.textContent = text;
    status.classList.toggle('coord-input__status--error', isError);
  }

  async function go(): Promise<void> {
    const text = field.value.trim();
    if (text.length === 0) return;
    const projection = map.getView().getProjection();
    let parserReason: string | undefined;
    try {
      const result = parseRef(text);
      if (result.system !== activeSystem) {
        setActiveSystem(result.system);
      }
      const [lat, lon] = result.decoded.center;
      const coord = transform([lon, lat], 'EPSG:4326', projection);
      overlay.setPosition(coord);
      map.getView().animate({ center: coord, duration: 400 });
      setStatus(defaultHint, false);
      return;
    } catch (err) {
      parserReason = err instanceof ParseError ? err.reason
        : err instanceof Error ? err.message
        : 'parse failed';
    }
    // Fall back to OSM Nominatim for place-name lookups.
    await tryNominatimFallback(text, parserReason ?? 'parse failed', (hit) => {
      const coord = transform([hit.lon, hit.lat], 'EPSG:4326', projection);
      overlay.setPosition(coord);
      map.getView().animate({ center: coord, duration: 400 });
    }, setStatus);
  }

  button.addEventListener('click', () => { void go(); });
  field.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void go();
    }
  });

  return {
    setPlaceholder(text: string): void {
      field.placeholder = text;
    },
  };
}

import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import Overlay from 'ol/Overlay';
import OSM from 'ol/source/OSM';
import Stroke from 'ol/style/Stroke';
import Fill from 'ol/style/Fill';
import Style from 'ol/style/Style';
import Text from 'ol/style/Text';
import { fromLonLat, transform } from 'ol/proj';
import {
  UniversalGraticule,
  CursorPositionControl,
  ParseError,
  createDefaultCellLabelHandler,
  createDefaultEdgeLabelHandler,
} from '@zwaarcontrast/ol-graticule';
import {
  DhgGridSystem,
  HmnGridSystem,
  decodeDhg,
  parseDhg,
  parseHmn,
} from '@zwaarcontrast/ol-graticule-heeresgitter';
import { cursorStyle } from '../shared';

// DHG: fine black grid, matching the printed kilometre grid on the sheets.
const dhgLine = new Stroke({
  color: 'rgba(20, 20, 20, 0.55)',
  width: 1,
});
const dhgMinorLine = new Stroke({
  color: 'rgba(20, 20, 20, 0.25)',
  width: 0.5,
});
// `Style` is here for parity with the other demos that style features
// directly; we don't use it in this file.
void Style;
const dhgEdgeText = new Text({
  font: '600 10px ui-monospace, "SF Mono", monospace',
  fill: new Fill({ color: 'rgba(20, 20, 20, 0.95)' }),
  stroke: new Stroke({ color: 'rgba(245, 239, 230, 0.85)', width: 3 }),
});
const dhgEdgeLabelHandler = createDefaultEdgeLabelHandler(dhgEdgeText);

// HMN: chunky orange, matching the overprint colour on the wartime sheets.
const hmnLine = new Stroke({
  color: 'rgba(234, 88, 12, 0.55)',
  width: 1.5,
});
const hmnCellLabelHandler = createDefaultCellLabelHandler({
  fontWeight: 800,
  fillColor: (o) => `rgba(249, 115, 22, ${(o * 1.0).toFixed(2)})`,
  strokeColor: (o) => `rgba(120, 53, 15, ${(o * 0.85).toFixed(2)})`,
  strokeWidth: 4,
  peakOpacity: 0.85,
  fadeStops: [10, 35, 800, 1200],
});

const dhg = new DhgGridSystem();
const hmn = new HmnGridSystem({ maxDepth: 4 });

const dhgLayer = new UniversalGraticule({
  gridSystem: dhg,
  style: {
    // The 6° strip boundary is rendered as a major grid line — same stroke
    // as the kilometre grid. The strip meridian is itself a km line in the
    // wartime grid, so reusing the major stroke keeps the seam unobtrusive.
    line: { major: dhgLine, minor: dhgMinorLine, boundary: dhgLine },
    edgeLabel: dhgEdgeLabelHandler,
  },
  maxLines: 600,
});

const hmnLayer = new UniversalGraticule({
  gridSystem: hmn,
  style: {
    line: { major: hmnLine, boundary: hmnLine },
    cellLabel: hmnCellLabelHandler,
  },
  maxLines: 1600,
});

// Cursor reads the HMN reference — that's the "feature" label users hunt for.
const cursorControl = new CursorPositionControl({ gridSystem: hmn, style: cursorStyle });

const map = new Map({
  target: 'map',
  layers: [new TileLayer({ source: new OSM() }), dhgLayer, hmnLayer],
  controls: [cursorControl],
  view: new View({
    center: fromLonLat([16.17, 48.75]), // Hadres
    zoom: 11,
  }),
});

// Debug hook — lets the playwright skill poke at HMN labels.
declare global {
  interface Window {
    __heeresgitter?: {
      map: Map;
      hmn: HmnGridSystem;
      dhg: DhgGridSystem;
    };
  }
}
window.__heeresgitter = { map, hmn, dhg };

// --- Layer toggles -----------------------------------------------------------

const hmnToggle = document.getElementById('toggle-hmn') as HTMLInputElement | null;

function syncCursor(): void {
  cursorControl.setGridSystem(hmnToggle?.checked ? hmn : dhg);
}

hmnToggle?.addEventListener('change', () => {
  hmnLayer.setVisible(hmnToggle.checked);
  syncCursor();
});
syncCursor();

// --- Coordinate input --------------------------------------------------------

createInputUi();

function createInputUi(): void {
  const badge = document.querySelector<HTMLElement>('.badge');
  if (!badge) return;

  const wrap = document.createElement('div');
  wrap.className = 'coord-input';
  const row = document.createElement('div');
  row.className = 'coord-input__row';
  const field = document.createElement('input');
  field.type = 'text';
  field.spellcheck = false;
  field.autocomplete = 'off';
  field.autocapitalize = 'off';
  field.placeholder = 'PE 1b 52  or  5 600 5760';
  field.className = 'coord-input__field';
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Go';
  button.className = 'coord-input__button';
  row.append(field, button);
  const status = document.createElement('p');
  status.className = 'coord-input__status';
  status.setAttribute('aria-live', 'polite');
  status.textContent =
    'Type a Heeresmeldenetz reference ("PE 1b 52", "JQ 4d 24") ' +
    'or a Heeresgitter Rechtswert/Hochwert ("5 600 5760", "6 383 7716").';
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

  function resolve(text: string, viewCentre: [number, number]): { lat: number; lon: number; summary: string } {
    if (/^\s*[A-Za-z]/.test(text)) {
      const ref = parseHmn(text, { near: viewCentre });
      if (!ref) throw new ParseError(text, 'not a recognised HMN reference');
      const [lat, lon] = ref.center;
      return {
        lat,
        lon,
        summary:
          `${ref.canonical} → ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E ` +
          `(Großquadrat z${ref.grossquadrat.kennziffer}/${ref.grossquadrat.gx},${ref.grossquadrat.gy})`,
      };
    }
    const parsed = parseDhg(text);
    if (!parsed) throw new ParseError(text, 'not a recognised HMN or DHG reference');
    const [lat, lon] = decodeDhg(parsed.coord);
    const { kennziffer, easting, northing } = parsed.coord;
    return {
      lat,
      lon,
      summary:
        `${parsed.canonical} → ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E ` +
        `(zone ${kennziffer}, E=${easting.toLocaleString()} m, N=${northing.toLocaleString()} m)`,
    };
  }

  function go(): void {
    const text = field.value.trim();
    if (!text) return;
    try {
      const viewCentre = map.getView().getCenter();
      if (!viewCentre) throw new Error('view has no centre');
      const [lon, lat] = transform(viewCentre, map.getView().getProjection(), 'EPSG:4326');
      const result = resolve(text, [lat ?? 0, lon ?? 0]);
      const projected = transform([result.lon, result.lat], 'EPSG:4326', map.getView().getProjection());
      overlay.setPosition(projected);
      map.getView().animate({ center: projected, duration: 400 });
      setStatus(result.summary, false);
    } catch (err) {
      if (err instanceof ParseError) setStatus(err.reason, true);
      else if (err instanceof Error) setStatus(err.message, true);
      else setStatus('parse failed', true);
    }
  }

  button.addEventListener('click', go);
  field.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      go();
    }
  });
}

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
  CursorPositionControl,
  ParseError,
  createDefaultCellLabelHandler,
  createDefaultEdgeLabelHandler,
} from '@zwaarcontrast/ol-graticule';
import {
  DhgGridSystem,
  DrgGridSystem,
  HmnGridSystem,
  GeographicHmnGridSystem,
  decodeDhg,
  parseDhg,
  decodeDrg,
  parseDrg,
  parseHmn,
  parseHmnGeo,
} from '@zwaarcontrast/ol-graticule-heeresgitter';
import { cursorStyle, hoverLens } from '../shared';
import { createGraticule, addRendererToggle } from '../renderer';
import { tryNominatimFallback } from '../nominatim';

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

// HMN (planar): chunky orange, matching the overprint colour on the
// standardised Deutsche Heereskarte sheets.
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

// HMN (geographic): same overprint palette as the planar variant. Both
// are "Heeresmeldenetz" and should read the same to the eye. Modes are
// mutually exclusive via the dropdown so there's no on-screen ambiguity.
const hmnGeoLine = hmnLine;
const hmnGeoCellLabelHandler = hmnCellLabelHandler;

const dhg = new DhgGridSystem();
const drg = new DrgGridSystem();
const hmn = new HmnGridSystem({ maxDepth: 4 });
const hmnGeo = new GeographicHmnGridSystem({ maxDepth: 4 });

const dhgLayer = createGraticule({
  gridSystem: dhg,
  style: {
    // The 6° strip boundary is rendered as a major grid line, the same stroke
    // as the kilometre grid. The strip meridian is itself a km line in the
    // wartime grid, so reusing the major stroke keeps the seam unobtrusive.
    line: { major: dhgLine, minor: dhgMinorLine, boundary: dhgLine },
    edgeLabel: dhgEdgeLabelHandler,
    hoverLens,
  },
  maxLines: 600,
});

// Reichsgitter: same fine black km lattice as the DHG, it is the same
// Gauss-Kruger family drawn on 3 degree strips instead of 6 degree ones.
const drgLayer = createGraticule({
  gridSystem: drg,
  style: {
    line: { major: dhgLine, minor: dhgMinorLine, boundary: dhgLine },
    edgeLabel: dhgEdgeLabelHandler,
    hoverLens,
  },
  maxLines: 600,
});
drgLayer.setVisible(false);

const hmnLayer = createGraticule({
  gridSystem: hmn,
  style: {
    line: { major: hmnLine, boundary: hmnLine },
    cellLabel: hmnCellLabelHandler,
    hoverLens,
  },
  maxLines: 1600,
});

const hmnGeoLayer = createGraticule({
  gridSystem: hmnGeo,
  style: {
    line: { major: hmnGeoLine, boundary: hmnGeoLine },
    cellLabel: hmnGeoCellLabelHandler,
    hoverLens,
  },
  maxLines: 1600,
});
hmnGeoLayer.setVisible(false);
addRendererToggle();

// Cursor reads whichever overlay is active. If both HMN variants are on,
// planar wins (it's the canonical one for the *Deutsche Heereskarte*).
const cursorControl = new CursorPositionControl({ gridSystem: hmn, style: cursorStyle });

const map = new Map({
  target: 'map',
  layers: [new TileLayer({ source: new OSM() }), dhgLayer, drgLayer, hmnLayer, hmnGeoLayer],
  controls: [cursorControl],
  view: new View({
    center: fromLonLat([16.17, 48.75]), // Hadres
    zoom: 11,
  }),
});

// --- Grid mode dropdown ------------------------------------------------------
//
// Three mutually-exclusive modes. The planar HMN sits on top of the DHG km
// lattice (that's how it's printed on real Heereskarte sheets), so the
// "planar HMN" mode shows both layers. The geographic HMN is anchored to
// the lat/lon graticule and doesn't depend on DHG at all, so it's shown
// alone.

type GridMode = 'dhg' | 'drg' | 'hmn' | 'hmn-geo';

function isGridMode(value: string): value is GridMode {
  return value === 'dhg' || value === 'drg' || value === 'hmn' || value === 'hmn-geo';
}

const modeSelectEl = document.getElementById('mode');
const modeSelect = modeSelectEl instanceof HTMLSelectElement ? modeSelectEl : null;

function currentMode(): GridMode {
  if (modeSelect && isGridMode(modeSelect.value)) return modeSelect.value;
  return 'hmn';
}

function applyMode(mode: GridMode): void {
  switch (mode) {
    case 'dhg':
      dhgLayer.setVisible(true);
      drgLayer.setVisible(false);
      hmnLayer.setVisible(false);
      hmnGeoLayer.setVisible(false);
      cursorControl.setGridSystem(dhg);
      break;
    case 'drg':
      dhgLayer.setVisible(false);
      drgLayer.setVisible(true);
      hmnLayer.setVisible(false);
      hmnGeoLayer.setVisible(false);
      cursorControl.setGridSystem(drg);
      break;
    case 'hmn':
      dhgLayer.setVisible(true);
      drgLayer.setVisible(false);
      hmnLayer.setVisible(true);
      hmnGeoLayer.setVisible(false);
      cursorControl.setGridSystem(hmn);
      break;
    case 'hmn-geo':
      dhgLayer.setVisible(false);
      drgLayer.setVisible(false);
      hmnLayer.setVisible(false);
      hmnGeoLayer.setVisible(true);
      cursorControl.setGridSystem(hmnGeo);
      break;
  }
}

modeSelect?.addEventListener('change', () => applyMode(currentMode()));
applyMode(currentMode());

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
  field.placeholder = 'PE 1b 52  /  TD 7c 03  /  5 600 5760  /  Hadres';
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
    'Type a Heeresmeldenetz reference (planar "PE 1b 52", geographic "TD 7c 03"), ' +
    'a Heeresgitter Rechtswert/Hochwert ("5 600 5760"), ' +
    'or a place name ("Hadres", "Den Haag"), which falls back to OSM Nominatim.';
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

  // The planar and geographic HMN share the same canonical text format
  // ("XX nA dd"), so a typed string alone is ambiguous. Resolve in this
  // priority: explicit prefix → currently-active mode → planar.
  function resolveHmnText(
    text: string,
    viewCentre: [number, number],
  ): { lat: number; lon: number; summary: string } | undefined {
    const trimmed = text.trim();
    const geoPrefix = /^(geo|geog|geographic)[\s:]+/i;
    const planarPrefix = /^(plan|planar|heer)[\s:]+/i;

    let preferGeo = currentMode() === 'hmn-geo';
    let body = trimmed;
    if (geoPrefix.test(trimmed)) {
      preferGeo = true;
      body = trimmed.replace(geoPrefix, '');
    } else if (planarPrefix.test(trimmed)) {
      preferGeo = false;
      body = trimmed.replace(planarPrefix, '');
    }

    if (preferGeo) {
      const ref = parseHmnGeo(body, { near: viewCentre });
      if (ref) {
        const [lat, lon] = ref.center;
        return {
          lat,
          lon,
          summary:
            `${ref.canonical} (geographic) → ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E ` +
            `(Großtrapez ${ref.grosstrapez.gx},${ref.grosstrapez.gy})`,
        };
      }
    }
    const planar = parseHmn(body, { near: viewCentre });
    if (planar) {
      const [lat, lon] = planar.center;
      return {
        lat,
        lon,
        summary:
          `${planar.canonical} (planar) → ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E ` +
          `(Großquadrat z${planar.grossquadrat.kennziffer}/${planar.grossquadrat.gx},${planar.grossquadrat.gy})`,
      };
    }
    if (!preferGeo) {
      const ref = parseHmnGeo(body, { near: viewCentre });
      if (ref) {
        const [lat, lon] = ref.center;
        return {
          lat,
          lon,
          summary:
            `${ref.canonical} (geographic) → ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E ` +
            `(Großtrapez ${ref.grosstrapez.gx},${ref.grosstrapez.gy})`,
        };
      }
    }
    return undefined;
  }

  function resolve(text: string, viewCentre: [number, number]): { lat: number; lon: number; summary: string } {
    if (/^\s*(?:geo|geog|geographic|plan|planar|heer)[\s:]/i.test(text) || /^\s*[A-Za-z]/.test(text)) {
      const ref = resolveHmnText(text, viewCentre);
      if (!ref) throw new ParseError(text, 'not a recognised HMN reference');
      return ref;
    }
    // A numeric pair reads as either grid, so the active mode decides which
    // strip family it belongs to.
    if (currentMode() === 'drg') {
      const drgRef = parseDrg(text);
      if (!drgRef) throw new ParseError(text, 'not a recognised Gauß-Krüger 3° reference');
      const [lat, lon] = decodeDrg(drgRef.coord);
      const { kennziffer, easting, northing } = drgRef.coord;
      return {
        lat,
        lon,
        summary:
          `${drgRef.canonical} → ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E ` +
          `(strip ${kennziffer}, CM ${kennziffer * 3}°E, R=${easting.toLocaleString()} m, ` +
          `H=${northing.toLocaleString()} m)`,
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

  async function go(): Promise<void> {
    const text = field.value.trim();
    if (!text) return;
    const projection = map.getView().getProjection();
    const viewCentre = map.getView().getCenter();
    if (!viewCentre) {
      setStatus('view has no centre', true);
      return;
    }
    const [centreLon, centreLat] = transform(viewCentre, projection, 'EPSG:4326');

    let parserReason: string | undefined;
    try {
      const result = resolve(text, [centreLat ?? 0, centreLon ?? 0]);
      const projected = transform([result.lon, result.lat], 'EPSG:4326', projection);
      overlay.setPosition(projected);
      map.getView().animate({ center: projected, duration: 400 });
      setStatus(result.summary, false);
      return;
    } catch (err) {
      parserReason = err instanceof ParseError ? err.reason
        : err instanceof Error ? err.message
        : 'parse failed';
    }

    // Fall back to OSM Nominatim for place-name lookups ("Leiden", "Hadres").
    await tryNominatimFallback(text, parserReason ?? 'parse failed', (hit) => {
      const projected = transform([hit.lon, hit.lat], 'EPSG:4326', projection);
      overlay.setPosition(projected);
      map.getView().animate({ center: projected, duration: 400 });
    }, setStatus);
  }

  button.addEventListener('click', () => { void go(); });
  field.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void go();
    }
  });
}

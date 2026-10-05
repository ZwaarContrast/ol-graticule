import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { transformExtent } from 'ol/proj';
import type { Extent } from 'ol/extent';
import {
  CursorPositionControl,
  type GridSystem,
  type UniversalGraticule,
} from '@zwaarcontrast/ol-graticule';
import {
  ProjectedGridSystem,
  createProjectedGridSystemFromEPSG,
  lookupEPSG,
} from '@zwaarcontrast/ol-graticule-projected';
import { gridLine, edgeLabelText, cursorStyle, hoverLens } from '../shared';
import { createGraticule, addRendererToggle } from '../renderer';
import {
  createCoordinateInput,
  type CoordinateInputHandle,
} from '../coordinateInput';

// UTM zone 33N is only valid within ~6° of its central meridian (15°E).
// Clip to the zone's EPSG bounding box so the graticule doesn't draw
// distorted garbage when the user zooms out to a global view.
const zoneExtent: [number, number, number, number] = [
  166_000, 0, 834_000, 9_329_005,
];

const map = new Map({
  target: 'map',
  layers: [new TileLayer({ source: new OSM() })],
  controls: [],
  view: new View({ center: [0, 0], zoom: 0 }),
});

const cursor = new CursorPositionControl({
  gridSystem: null,
  style: cursorStyle,
});
map.addControl(cursor);

addRendererToggle();

const badge = document.querySelector<HTMLElement>('.badge');
const title = badge?.querySelector('h1');
let layer: UniversalGraticule | null = null;
let coordInput: CoordinateInputHandle | null = null;

function show(
  gridSystem: GridSystem,
  crs: string,
  fitExtent: Extent | null,
): void {
  if (layer) map.removeLayer(layer);
  layer = createGraticule({
    gridSystem,
    style: { line: { major: gridLine }, edgeLabel: edgeLabelText, hoverLens },
  });
  map.addLayer(layer);
  cursor.setGridSystem(gridSystem);

  coordInput?.destroy();
  coordInput = badge
    ? createCoordinateInput({
        map,
        gridSystem,
        host: badge,
        placeholder: 'easting northing',
        hint: `${crs} easting/northing.`,
      })
    : null;

  if (fitExtent) {
    map.getView().fit(fitExtent, { padding: [40, 40, 40, 40] });
  }
}

function mountEPSGPicker(host: HTMLElement): void {
  const wrap = document.createElement('div');
  wrap.className = 'coord-input';
  const row = document.createElement('div');
  row.className = 'coord-input__row';
  const input = document.createElement('input');
  input.type = 'text';
  input.inputMode = 'numeric';
  input.spellcheck = false;
  input.autocomplete = 'off';
  input.value = '32633';
  input.placeholder = 'EPSG code, e.g. 27700';
  input.className = 'coord-input__field';
  input.setAttribute('aria-label', 'EPSG code');
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Load';
  button.className = 'coord-input__button';
  row.append(input, button);
  const status = document.createElement('p');
  status.className = 'coord-input__status';
  status.setAttribute('aria-live', 'polite');
  status.textContent =
    'Any EPSG code: definition from epsg.io, area of use from spatialreference.org.';
  wrap.append(row, status);
  host.append(wrap);

  function setStatus(text: string, isError: boolean): void {
    status.textContent = text.length > 160 ? `${text.slice(0, 159)}…` : text;
    status.title = text;
    status.classList.toggle('coord-input__status--error', isError);
  }

  async function load(): Promise<void> {
    const n = Number(input.value.trim().replace(/^EPSG:/i, ''));
    if (!Number.isInteger(n) || n <= 0) {
      setStatus('Enter a numeric EPSG code.', true);
      return;
    }
    setStatus(`Loading EPSG:${n}…`, false);
    try {
      const [gridSystem, record] = await Promise.all([
        createProjectedGridSystemFromEPSG(n),
        lookupEPSG(n),
      ]);
      const { bbox, crs, name, area } = record;
      show(
        gridSystem,
        crs,
        bbox
          ? transformExtent(
              [bbox.west, bbox.south, bbox.east, bbox.north],
              'EPSG:4326',
              'EPSG:3857',
            )
          : null,
      );
      if (title) title.textContent = name ? `${name} · ${crs}` : crs;
      setStatus(area ?? name ?? crs, false);
    } catch (err) {
      setStatus(
        err instanceof Error ? err.message : `Could not load EPSG:${n}.`,
        true,
      );
    }
  }

  button.addEventListener('click', () => {
    void load();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void load();
    }
  });
}

if (badge) mountEPSGPicker(badge);

// The initial grid is built locally so the page renders without a network lookup.
show(
  new ProjectedGridSystem({
    crs: 'EPSG:32633',
    proj4Def: '+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs',
    extent: zoneExtent,
  }),
  'EPSG:32633',
  transformExtent(zoneExtent, 'EPSG:32633', 'EPSG:3857'),
);

import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat, transform } from 'ol/proj';
import {
  CursorPositionControl,
  createDefaultCellLabelHandler,
  type UniversalGraticule,
} from '@zwaarcontrast/ol-graticule';
import {
  LuftwaffeGridSystem,
  parseRef,
} from '@zwaarcontrast/ol-graticule-luftwaffe-planquadrat';
import type { LuftwaffeSystem } from '@zwaarcontrast/ol-graticule-luftwaffe-planquadrat';
import { gridLine, cursorStyle, hoverLens } from '../shared';
import { createGraticule, addRendererToggle } from '../renderer';
import { createCoordinateInput } from '../coordinateInput';

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

addRendererToggle();

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
  return createGraticule({
    gridSystem,
    style: { line: { major: gridLine }, cellLabel: snapCellLabelHandler, hoverLens },
    maxLines: 600,
  });
}

interface InputUi {
  setPlaceholder(text: string): void;
}

function createInputUi(): InputUi {
  if (!badge) return { setPlaceholder() {} };
  const handle = createCoordinateInput({
    map,
    host: badge,
    placeholder: '15 Ost 33 3 9 7 c',
    hint: 'Try "15 Ost 33 3 9 7 c" (Reichstag, GNMV) or "05 Ost S NO 3 2 a" (Köln, JMN).',
    parse: (text, projection) => {
      const result = parseRef(text);
      if (result.system !== activeSystem) setActiveSystem(result.system);
      const [lat, lon] = result.decoded.center;
      return transform([lon, lat], 'EPSG:4326', projection);
    },
  });
  return { setPlaceholder: (text) => handle?.setPlaceholder(text) };
}

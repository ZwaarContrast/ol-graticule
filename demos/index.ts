import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import { fromLonLat } from 'ol/proj';
import { defaults as defaultInteractions } from 'ol/interaction/defaults';
import {
  UniversalGraticule,
  GeographicGridSystem,
  createDefaultCellLabelHandler,
  type GridSystem,
} from '@zwaarcontrast/ol-graticule';
import { ProjectedGridSystem, registerCRS } from '@zwaarcontrast/ol-graticule-projected';
import { MgrsGridSystem } from '@zwaarcontrast/ol-graticule-mgrs';
import { createRDNewGridSystem } from '@zwaarcontrast/ol-graticule-rd';
import { createNordDeGuerreGridSystem } from '@zwaarcontrast/ol-graticule-modified-british-system';
import { KriegsmarineGridSystem } from '@zwaarcontrast/ol-graticule-marinequadratkarte';
import { LuftwaffeGridSystem } from '@zwaarcontrast/ol-graticule-luftwaffe-planquadrat';
import Stroke from 'ol/style/Stroke';

interface Scene {
  label: string;
  build: () => GridSystem;
  centerLonLat: [number, number];
  zoom: number;
}

registerCRS('EPSG:32633', '+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs');

const scenes: Scene[] = [
  {
    label: 'lat/lon',
    build: () => new GeographicGridSystem(),
    centerLonLat: [12, 30],
    zoom: 2.6,
  },
  {
    label: 'UTM 33N',
    build: () => new ProjectedGridSystem({ crs: 'EPSG:32633' }),
    centerLonLat: [13.4, 52.5],
    zoom: 5.5,
  },
  {
    label: 'MGRS',
    build: () => new MgrsGridSystem(),
    centerLonLat: [9.5, 47.5],
    zoom: 5.0,
  },
  {
    label: 'Dutch RD',
    build: () => createRDNewGridSystem(),
    centerLonLat: [5.3, 52.2],
    zoom: 7.5,
  },
  {
    label: 'Nord de Guerre',
    build: () => createNordDeGuerreGridSystem(),
    centerLonLat: [3.0, 50.0],
    zoom: 6.5,
  },
  {
    label: 'Kriegsmarine',
    build: () => new KriegsmarineGridSystem(),
    centerLonLat: [-2.0, 51.0],
    zoom: 4.5,
  },
  {
    label: 'Luftwaffe (GNMV)',
    build: () => new LuftwaffeGridSystem({ system: 'gnmv' }),
    centerLonLat: [13.4, 52.5],
    zoom: 6.5,
  },
  {
    label: 'Luftwaffe (JMN)',
    build: () => new LuftwaffeGridSystem({ system: 'jmn' }),
    centerLonLat: [6.9, 51.0],
    zoom: 6.5,
  },
];

const blueprintLine = 'rgba(180, 215, 245, 0.45)';
const blueprintMinor = 'rgba(180, 215, 245, 0.20)';

const dimCellLabel = createDefaultCellLabelHandler({
  fontFamily: 'ui-monospace, "SF Mono", monospace',
  fontWeight: 500,
  fillColor: (o) => `rgba(180, 215, 245, ${(o * 0.35).toFixed(3)})`,
  strokeColor: () => 'rgba(0, 0, 0, 0)',
  strokeWidth: 0,
  peakOpacity: 0.55,
});

function buildGraticule(scene: Scene): UniversalGraticule {
  return new UniversalGraticule({
    gridSystem: scene.build(),
    style: {
      line: {
        major: new Stroke({ color: blueprintLine, width: 0.75 }),
        minor: new Stroke({ color: blueprintMinor, width: 0.4 }),
      },
      cellLabel: dimCellLabel,
    },
    maxLines: 250,
  });
}

const target = document.getElementById('bg-map');
if (!target) throw new Error('#bg-map missing');

const baseLayer = new TileLayer({
  source: new XYZ({
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    crossOrigin: 'anonymous',
    maxZoom: 16,
    attributions: 'Tiles © Esri, HERE, Garmin, © OpenStreetMap contributors',
  }),
  opacity: 0.42,
});

let currentScene = scenes[0]!;
let currentGraticule = buildGraticule(currentScene);

const map = new Map({
  target,
  layers: [baseLayer, currentGraticule],
  view: new View({
    center: fromLonLat(currentScene.centerLonLat),
    zoom: currentScene.zoom,
    minZoom: 1,
    maxZoom: 12,
  }),
  controls: [],
  interactions: defaultInteractions({ mouseWheelZoom: false, doubleClickZoom: false, dragPan: false }),
});

let lastIdx = 0;
function pickNextIdx(): number {
  if (scenes.length <= 1) return 0;
  let i = Math.floor(Math.random() * (scenes.length - 1));
  if (i >= lastIdx) i += 1;
  return i;
}

function rotate(): void {
  const idx = pickNextIdx();
  lastIdx = idx;
  const scene = scenes[idx]!;
  currentScene = scene;
  const view = map.getView();
  view.animate({
    center: fromLonLat(scene.centerLonLat),
    zoom: scene.zoom,
    duration: 4500,
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  window.setTimeout(() => {
    map.removeLayer(currentGraticule);
    currentGraticule = buildGraticule(scene);
    map.addLayer(currentGraticule);
  }, 700);
}

window.setInterval(rotate, 9000);

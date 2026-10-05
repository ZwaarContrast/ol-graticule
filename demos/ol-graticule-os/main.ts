import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { transformExtent } from 'ol/proj';
import { CursorPositionControl } from '@zwaarcontrast/ol-graticule';
import {
  createOSYardGridSystem,
  OS_YARD_GRID_CRS,
  OS_YARD_GRID_VALIDITY,
} from '@zwaarcontrast/ol-graticule-os';
import { gridLine, edgeLabelText, cursorStyle, hoverLens } from '../shared';
import { createGraticule, addRendererToggle } from '../renderer';
import { createCoordinateInput } from '../coordinateInput';

const gridSystem = createOSYardGridSystem();

const map = new Map({
  target: 'map',
  layers: [
    new TileLayer({ source: new OSM() }),
    createGraticule({
      gridSystem,
      style: { line: { major: gridLine }, edgeLabel: edgeLabelText, hoverLens },
    }),
  ],
  controls: [new CursorPositionControl({ gridSystem, style: cursorStyle })],
  view: new View({ center: [0, 0], zoom: 0 }),
});

const xs = OS_YARD_GRID_VALIDITY.map(([x]) => x);
const ys = OS_YARD_GRID_VALIDITY.map(([, y]) => y);
map
  .getView()
  .fit(
    transformExtent(
      [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
      OS_YARD_GRID_CRS,
      'EPSG:3857',
    ),
    { padding: [40, 40, 40, 40] },
  );

addRendererToggle();

const badge = document.querySelector<HTMLElement>('.badge');
if (badge) {
  createCoordinateInput({
    map,
    gridSystem,
    host: badge,
    placeholder: '813800 1856600',
    hint: 'Yards East and North. The sheets give Helensburgh Sta. as E 813,800 N 1,856,600.',
  });
}

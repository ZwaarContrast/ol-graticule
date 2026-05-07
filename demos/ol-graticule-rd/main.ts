import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { transformExtent } from 'ol/proj';
import {
  UniversalGraticule,
  CursorPositionControl,
} from '@zwaarcontrast/ol-graticule';
import {
  createRDNewGridSystem,
  RD_NEW_CRS,
  RD_NEW_EXTENT,
} from '@zwaarcontrast/ol-graticule-rd';
import { gridLine, edgeLabelText, cursorStyle } from '../shared';

const gridSystem = createRDNewGridSystem();

const map = new Map({
  target: 'map',
  layers: [
    new TileLayer({ source: new OSM() }),
    new UniversalGraticule({
      gridSystem,
      style: { line: { major: gridLine }, edgeLabel: edgeLabelText },
    }),
  ],
  controls: [new CursorPositionControl({ gridSystem, style: cursorStyle })],
  view: new View({ center: [0, 0], zoom: 0 }),
});

map.getView().fit(transformExtent(RD_NEW_EXTENT, RD_NEW_CRS, 'EPSG:3857'), {
  padding: [40, 40, 40, 40],
});

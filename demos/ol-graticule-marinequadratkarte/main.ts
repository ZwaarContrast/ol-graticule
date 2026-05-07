import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';
import {
  UniversalGraticule,
  CursorPositionControl,
} from '@zwaarcontrast/ol-graticule';
import { KriegsmarineGridSystem } from '@zwaarcontrast/ol-graticule-marinequadratkarte';
import { gridLine, cellLabelHandler, cursorStyle } from '../shared';

const gridSystem = new KriegsmarineGridSystem();

new Map({
  target: 'map',
  layers: [
    new TileLayer({ source: new OSM() }),
    new UniversalGraticule({
      gridSystem,
      style: { line: { major: gridLine }, cellLabel: cellLabelHandler },
      // Kriegsmarine emits many short cell-boundary segments rather than
      // a handful of full-viewport lines, so the default cap (100 * 2)
      // truncates horizontals at world zoom. 500 is plenty of headroom.
      maxLines: 500,
    }),
  ],
  controls: [new CursorPositionControl({ gridSystem, style: cursorStyle })],
  view: new View({
    center: fromLonLat([-15, 55]), // North Atlantic
    zoom: 4,
  }),
});

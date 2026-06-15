import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import {
  UniversalGraticule,
  GeographicGridSystem,
  CursorPositionControl,
} from '@zwaarcontrast/ol-graticule';
import { gridLine, edgeLabelText, cursorStyle, hoverLens } from '../shared';
import { createCoordinateInput } from '../coordinateInput';

const gridSystem = new GeographicGridSystem();

const map = new Map({
  target: 'map',
  layers: [
    new TileLayer({ source: new OSM() }),
    new UniversalGraticule({
      gridSystem,
      style: { line: { major: gridLine }, edgeLabel: edgeLabelText, hoverLens },
    }),
  ],
  controls: [new CursorPositionControl({ gridSystem, style: cursorStyle })],
  view: new View({ center: [0, 0], zoom: 2 }),
});

const badge = document.querySelector<HTMLElement>('.badge');
if (badge) {
  createCoordinateInput({
    map,
    gridSystem,
    host: badge,
    placeholder: '50°51′N 4°21′E',
    hint: 'Try DMS, DD, or "lon lat", hemisphere markers route axes.',
  });
}

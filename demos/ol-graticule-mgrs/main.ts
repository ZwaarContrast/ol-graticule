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
import { MgrsGridSystem } from '@zwaarcontrast/ol-graticule-mgrs';
import {
  gridLine,
  edgeLabelText,
  cellLabelHandler,
  cursorStyle,
} from '../shared';
import { createCoordinateInput } from '../coordinateInput';

const gridSystem = new MgrsGridSystem();

const map = new Map({
  target: 'map',
  layers: [
    new TileLayer({ source: new OSM() }),
    new UniversalGraticule({
      gridSystem,
      style: {
        line: { major: gridLine },
        edgeLabel: edgeLabelText,
        cellLabel: cellLabelHandler,
      },
      // The MGRS grid is dense at low zoom levels, there can be
      // 60 UTM zones × ~10 visible row letters × 2 axes = 1200+
      // line features in a worldwide view, plus the 4 UPS zones'
      // 100 km grids near the poles. Bump the safety cap so the
      // graticule doesn't truncate legitimate features.
      maxLines: 5000,
    }),
  ],
  controls: [new CursorPositionControl({ gridSystem, style: cursorStyle })],
  view: new View({
    // Centre on Berlin so the user sees a few zone boundaries (zone 32/33
    // crosses the centre of Germany at 12 deg E) right out of the gate.
    center: fromLonLat([12, 52]),
    zoom: 5,
  }),
});

const badge = document.querySelector<HTMLElement>('.badge');
if (badge) {
  createCoordinateInput({
    map,
    gridSystem,
    host: badge,
    placeholder: '31U FT 23234 23252',
    hint: 'GZD + 100 km square + easting/northing (1–10 digits). UPS zones Y/Z/A/B also accepted.',
  });
}

void map;

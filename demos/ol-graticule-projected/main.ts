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
import { ProjectedGridSystem } from '@zwaarcontrast/ol-graticule-projected';
import { gridLine, edgeLabelText, cursorStyle } from '../shared';
import { createCoordinateInput } from '../coordinateInput';

// UTM zone 33N is only valid within ~6° of its central meridian (15°E).
// Clip to the zone's EPSG bounding box so the graticule doesn't draw
// distorted garbage when the user zooms out to a global view.
const zoneExtent: [number, number, number, number] = [
  166_000, 0, 834_000, 9_329_005,
];

const gridSystem = new ProjectedGridSystem({
  crs: 'EPSG:32633',
  proj4Def: '+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs',
  extent: zoneExtent,
});

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

map.getView().fit(transformExtent(zoneExtent, 'EPSG:32633', 'EPSG:3857'), {
  padding: [40, 40, 40, 40],
});

const badge = document.querySelector<HTMLElement>('.badge');
if (badge) {
  createCoordinateInput({
    map,
    gridSystem,
    host: badge,
    placeholder: '500000 5000000',
    hint: 'UTM 33N easting/northing in metres.',
  });
}

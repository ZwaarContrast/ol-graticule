import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import {
  NGO_STRIPS,
  createNGOStripGridSystem,
} from '@zwaarcontrast/ol-graticule-ngo';
import { addRendererToggle } from '../renderer';
import { mountZonePicker } from '../zonePicker';

const map = new Map({
  target: 'map',
  layers: [new TileLayer({ source: new OSM() })],
  view: new View({ center: [0, 0], zoom: 0 }),
});

addRendererToggle();

mountZonePicker({
  map,
  zones: Object.values(NGO_STRIPS).map((def) => ({
    label: `Strip ${def.strip}`,
    gridSystem: createNGOStripGridSystem(def.strip),
    validityWgs84: def.printedValidityWgs84,
  })),
  allLabel: 'All strips',
  placeholder: 'easting northing (m)',
  hint: 'Easting Northing in metres, as the sheet margins print them.',
});

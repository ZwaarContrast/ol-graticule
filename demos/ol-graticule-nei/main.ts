import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import {
  NEI_EQUATORIAL_ZONE_VALIDITY_WGS84,
  NEI_SOUTHERN_ZONE_VALIDITY_WGS84,
  createNEIEquatorialZoneGridSystem,
  createNEISouthernZoneGridSystem,
} from '@zwaarcontrast/ol-graticule-nei';
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
  zones: [
    {
      label: 'Southern Zone',
      gridSystem: createNEISouthernZoneGridSystem(),
      validityWgs84: NEI_SOUTHERN_ZONE_VALIDITY_WGS84,
    },
    {
      label: 'Equatorial Zone (EPSG:3001)',
      gridSystem: createNEIEquatorialZoneGridSystem(),
      validityWgs84: NEI_EQUATORIAL_ZONE_VALIDITY_WGS84,
    },
  ],
  allLabel: 'Both zones',
  placeholder: '200000 600000 m',
  hint: 'Easting Northing in metres (Southern Zone: Jakarta is near 200000 600000).',
});

import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { transformExtent } from 'ol/proj';
import type Layer from 'ol/layer/Layer';
import {
  UniversalGraticule,
  CursorPositionControl,
} from '@zwaarcontrast/ol-graticule';
import type { GridSystem } from '@zwaarcontrast/ol-graticule';
import {
  createNordDeGuerreGridSystem,
  createFrenchLambert1GridSystem,
  createFrenchLambert2GridSystem,
  createFrenchLambert3GridSystem,
  createBritishCassiniGridSystem,
  createIrishCassiniGridSystem,
  createWarOfficeCassiniGridSystem,
  createScandinavianZone3GridSystem,
  createItalianNorthernGridSystem,
  createItalianSouthernGridSystem,
  createIberianPeninsulaGridSystem,
  NORD_DE_GUERRE_CRS,
  NORD_DE_GUERRE_EXTENT,
  FRENCH_LAMBERT_1_BBOX_WGS84,
  FRENCH_LAMBERT_2_BBOX_WGS84,
  FRENCH_LAMBERT_3_BBOX_WGS84,
  BRITISH_CASSINI_BBOX_WGS84,
  IRISH_CASSINI_BBOX_WGS84,
  WAR_OFFICE_CASSINI_BBOX_WGS84,
  SCANDINAVIAN_ZONE_3_BBOX_WGS84,
  ITALIAN_NORTHERN_BBOX_WGS84,
  ITALIAN_SOUTHERN_BBOX_WGS84,
  IBERIAN_PENINSULA_BBOX_WGS84,
} from '@zwaarcontrast/ol-graticule-modified-british-system';
import {
  gridLine,
  edgeLabelText,
  cellLabelHandler,
  cursorStyle,
} from '../shared';

interface Theatre {
  label: string;
  build: () => GridSystem;
  /** Extent to `view.fit()`. */
  fitExtent: [number, number, number, number];
  /** Source CRS of `fitExtent`. */
  fitCrs: string;
}

const theatres: Record<string, Theatre> = {
  ndg: {
    label: 'Nord de Guerre (WWI)',
    build: createNordDeGuerreGridSystem,
    fitExtent: NORD_DE_GUERRE_EXTENT,
    fitCrs: NORD_DE_GUERRE_CRS,
  },
  fl1: {
    label: 'French Lambert I — North',
    build: createFrenchLambert1GridSystem,
    fitExtent: FRENCH_LAMBERT_1_BBOX_WGS84,
    fitCrs: 'EPSG:4326',
  },
  fl2: {
    label: 'French Lambert II — Centre',
    build: createFrenchLambert2GridSystem,
    fitExtent: FRENCH_LAMBERT_2_BBOX_WGS84,
    fitCrs: 'EPSG:4326',
  },
  fl3: {
    label: 'French Lambert III — South',
    build: createFrenchLambert3GridSystem,
    fitExtent: FRENCH_LAMBERT_3_BBOX_WGS84,
    fitCrs: 'EPSG:4326',
  },
  bc: {
    label: 'British Cassini (OS Delamere)',
    build: createBritishCassiniGridSystem,
    fitExtent: BRITISH_CASSINI_BBOX_WGS84,
    fitCrs: 'EPSG:4326',
  },
  ic: {
    label: 'Irish Cassini (OSI 1825)',
    build: createIrishCassiniGridSystem,
    fitExtent: IRISH_CASSINI_BBOX_WGS84,
    fitCrs: 'EPSG:4326',
  },
  wofo: {
    label: 'War Office Cassini (Dunnose, WWII)',
    build: createWarOfficeCassiniGridSystem,
    fitExtent: WAR_OFFICE_CASSINI_BBOX_WGS84,
    fitCrs: 'EPSG:4326',
  },
  sz3: {
    label: 'Scandinavian Zone 3',
    build: createScandinavianZone3GridSystem,
    fitExtent: SCANDINAVIAN_ZONE_3_BBOX_WGS84,
    fitCrs: 'EPSG:4326',
  },
  itn: {
    label: 'Italian Northern',
    build: createItalianNorthernGridSystem,
    fitExtent: ITALIAN_NORTHERN_BBOX_WGS84,
    fitCrs: 'EPSG:4326',
  },
  its: {
    label: 'Italian Southern',
    build: createItalianSouthernGridSystem,
    fitExtent: ITALIAN_SOUTHERN_BBOX_WGS84,
    fitCrs: 'EPSG:4326',
  },
  ibp: {
    label: 'Iberian Peninsula',
    build: createIberianPeninsulaGridSystem,
    fitExtent: IBERIAN_PENINSULA_BBOX_WGS84,
    fitCrs: 'EPSG:4326',
  },
};

const map = new Map({
  target: 'map',
  layers: [new TileLayer({ source: new OSM() })],
  view: new View({ center: [0, 0], zoom: 0 }),
});

let cursorControl: CursorPositionControl | null = null;
let graticuleLayer: Layer | null = null;

function applyTheatre(key: string): void {
  const theatre = theatres[key];
  if (!theatre) return;

  const gridSystem = theatre.build();

  if (graticuleLayer) map.removeLayer(graticuleLayer);
  graticuleLayer = new UniversalGraticule({
    gridSystem,
    style: {
      line: { major: gridLine },
      edgeLabel: edgeLabelText,
      cellLabel: cellLabelHandler,
    },
    maxLines: 500,
  });
  map.addLayer(graticuleLayer);

  if (cursorControl) map.removeControl(cursorControl);
  cursorControl = new CursorPositionControl({ gridSystem, style: cursorStyle });
  map.addControl(cursorControl);

  map.getView().fit(
    transformExtent(theatre.fitExtent, theatre.fitCrs, 'EPSG:3857'),
    { padding: [40, 40, 40, 40] },
  );
}

const select = document.getElementById('theatre') as HTMLSelectElement | null;
if (select) {
  for (const [key, theatre] of Object.entries(theatres)) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = theatre.label;
    select.append(option);
  }
  select.addEventListener('change', () => applyTheatre(select.value));
}

applyTheatre('ndg');

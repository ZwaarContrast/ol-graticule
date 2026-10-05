import type Map from 'ol/Map';
import { boundingExtent } from 'ol/extent';
import { toLonLat, transformExtent } from 'ol/proj';
import { unByKey } from 'ol/Observable';
import type { EventsKey } from 'ol/events';
import {
  CursorPositionControl,
  type GridSystem,
  type UniversalGraticule,
} from '@zwaarcontrast/ol-graticule';
import { gridLine, edgeLabelText, cursorStyle, hoverLens } from './shared';
import { createGraticule } from './renderer';
import {
  createCoordinateInput,
  type CoordinateInputHandle,
} from './coordinateInput';

type Ring = ReadonlyArray<readonly [number, number]>;

export interface PickerZone {
  label: string;
  gridSystem: GridSystem;
  /** WGS84 lon/lat validity ring; picks the zone under the cursor and the fit. */
  validityWgs84: Ring;
}

interface ZonePickerOptions {
  map: Map;
  zones: PickerZone[];
  /** Label of the option that draws every zone at once. */
  allLabel: string;
  placeholder: string;
  hint: string;
}

const style = {
  line: { major: gridLine },
  edgeLabel: edgeLabelText,
  hoverLens,
};

function inside([x, y]: readonly number[], ring: Ring): boolean {
  if (x === undefined || y === undefined) return false;
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (!a || !b) continue;
    if (
      a[1] > y !== b[1] > y &&
      x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]
    ) {
      hit = !hit;
    }
  }
  return hit;
}

/**
 * Fill `#zone` with an "all zones" option plus one per zone. The all view
 * draws every zone through one layer and points the cursor readout at the
 * zone under the pointer; a single zone also gets the coordinate input.
 */
export function mountZonePicker(opts: ZonePickerOptions): void {
  const { map, zones } = opts;
  const cursor = new CursorPositionControl({
    gridSystem: null,
    style: cursorStyle,
  });
  map.addControl(cursor);

  let layer: UniversalGraticule | null = null;
  let pointerKey: EventsKey | null = null;
  let input: CoordinateInputHandle | null = null;

  function apply(selected: PickerZone[]): void {
    if (layer) map.removeLayer(layer);
    if (pointerKey) unByKey(pointerKey);
    pointerKey = null;
    input?.destroy();
    input = null;

    const only = selected.length === 1 ? selected[0] : undefined;
    layer = only
      ? createGraticule({ gridSystem: only.gridSystem, style })
      : createGraticule({
          grids: selected.map((z) => ({ gridSystem: z.gridSystem, style })),
        });
    map.addLayer(layer);

    if (only) {
      cursor.setGridSystem(only.gridSystem);
      const badge = document.querySelector<HTMLElement>('.badge');
      if (badge) {
        input = createCoordinateInput({
          map,
          gridSystem: only.gridSystem,
          host: badge,
          placeholder: opts.placeholder,
          hint: opts.hint,
        });
      }
    } else {
      cursor.setGridSystem(null);
      let current: PickerZone | undefined;
      pointerKey = map.on('pointermove', (evt) => {
        const lonLat = toLonLat(evt.coordinate);
        const zone = selected.find((z) => inside(lonLat, z.validityWgs84));
        if (zone === current) return;
        current = zone;
        cursor.setGridSystem(zone?.gridSystem ?? null);
      });
    }

    const extent = boundingExtent(
      selected.flatMap((z) => z.validityWgs84.map(([x, y]) => [x, y])),
    );
    map.getView().fit(transformExtent(extent, 'EPSG:4326', 'EPSG:3857'), {
      padding: [40, 40, 40, 40],
    });
  }

  const select = document.getElementById('zone');
  if (select instanceof HTMLSelectElement) {
    const options = [opts.allLabel, ...zones.map((z) => z.label)];
    for (const [i, label] of options.entries()) {
      const option = document.createElement('option');
      option.value = String(i);
      option.textContent = label;
      select.append(option);
    }
    select.addEventListener('change', () => {
      const zone = zones[Number(select.value) - 1];
      apply(zone ? [zone] : zones);
    });
  }

  apply(zones);
}

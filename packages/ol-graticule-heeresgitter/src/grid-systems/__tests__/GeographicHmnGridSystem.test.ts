import { describe, expect, it } from 'vitest';

import { GeographicHmnGridSystem } from '../GeographicHmnGridSystem.js';

// 4.00..4.62°E, 52.00..52.35°N. Puts Den Haag (TD) and Scheveningen (SD)
// in view, and crosses two Großtrapez rows so multiple horizontal lines
// must be emitted.
const DEN_HAAG_EXTENT: [number, number, number, number] = [4.0, 52.0, 4.62, 52.35];
const KLEIN_RES_DEG = 0.0005;

describe('GeographicHmnGridSystem render smoke', () => {
  it('emits both x and y grid line features over Den Haag', () => {
    const grid = new GeographicHmnGridSystem();
    const features = grid.getFeatures(DEN_HAAG_EXTENT, KLEIN_RES_DEG, 'EPSG:4326');
    expect(features.length).toBeGreaterThan(0);
    const axes = new Set(features.map((f) => f.get('gridAxis')));
    expect(axes.has('x')).toBe(true);
    expect(axes.has('y')).toBe(true);
  });

  it('emits cell labels matching primary-source Den Haag and Scheveningen cells', () => {
    const grid = new GeographicHmnGridSystem();
    const labels = grid.getCellLabels(DEN_HAAG_EXTENT, KLEIN_RES_DEG, 'EPSG:4326');
    const texts = new Set(labels.map((l) => l.text));
    expect(texts.has('TD')).toBe(true);
    expect(texts.has('SD')).toBe(true);
    expect(texts.has('TC')).toBe(true);
    expect(texts.has('TE')).toBe(true);
  });

  it('emits a horizontal line at every Kleintrapez boundary inside the view', () => {
    const grid = new GeographicHmnGridSystem();
    const features = grid.getFeatures(DEN_HAAG_EXTENT, KLEIN_RES_DEG, 'EPSG:4326');

    const expected: number[] = [];
    const anchorMin = 40;
    const stepMin = 4;
    for (let totalMin = anchorMin; totalMin / 60 <= DEN_HAAG_EXTENT[3]; totalMin += stepMin) {
      const lat = totalMin / 60;
      if (lat >= DEN_HAAG_EXTENT[1] && lat <= DEN_HAAG_EXTENT[3]) expected.push(lat);
    }
    expect(expected.length).toBeGreaterThan(0);

    const seenLats = features
      .filter((f) => f.get('gridAxis') === 'y')
      .map((f) => f.get('gridValue') as number);

    for (const expectedLat of expected) {
      const hit = seenLats.some((v) => Math.abs(v - expectedLat) < 1e-6);
      expect(hit, `missing horizontal line at lat ${expectedLat}°`).toBe(true);
    }
  });
});

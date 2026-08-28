import type Feature from 'ol/Feature';
import type Geometry from 'ol/geom/Geometry';
import type Style from 'ol/style/Style';

/**
 * The slice of `ol/render/VectorContext` the label placers actually use. An
 * OpenLayers immediate `VectorContext` satisfies it structurally (canvas path),
 * and so does the DOM-emitting sink used by the WebGL graticule.
 */
export interface LabelSink {
  setStyle(style: Style): void;
  drawFeature(feature: Feature, style: Style): void;
  drawGeometry(geometry: Geometry): void;
}

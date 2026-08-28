import { bench, describe } from 'vitest';
import VectorSource from 'ol/source/Vector';
import Projection from 'ol/proj/Projection';
import { compose as composeTransform, create as createTransform, makeInverse } from 'ol/transform';
import type { Extent } from 'ol/extent';
import { PixelGridSystem } from '../grid-systems/PixelGridSystem.js';
import { LabelCollector } from '../labels/LabelCollector.js';
import { EdgeLabelPlacer, edgeLabelFrame, type EdgeLabelConfig } from '../labels/EdgeLabelPlacer.js';
import { resolveEdgeLabelHandler } from '../style.js';
import type { LabelSink } from '../labels/LabelSink.js';

// The live per-frame edge-label path: collect the grid system's labels across
// world copies, then anchor + draw each against the viewport border. This is
// what CanvasGraticuleLayer.handlePostrender_ runs every frame via LabelEngine.

// Non-wrapping projection so pixel-space coords aren't world-shifted.
const PROJ = new Projection({ code: 'BENCH:PX', units: 'pixels', extent: [0, 0, 20_000, 20_000] });
const RESOLUTION = 1;
const EXTENT: Extent = [0, 0, 20_000, 20_000];

const EDGE_CONFIG: EdgeLabelConfig = {
  xLabelPosition: 'top',
  yLabelPosition: 'left',
  xLabelOffset: 2,
  yLabelOffset: 2,
  edgeLabelCoverage: 'all',
  edgeLabelLeader: 'none',
  edgeLabelExtend: 'line',
};

const gridSystem = new PixelGridSystem();
const source = new VectorSource({ useSpatialIndex: false });
source.addFeatures(gridSystem.getFeatures(EXTENT, RESOLUTION, PROJ));

const handler = resolveEdgeLabelHandler(true);
if (!handler) throw new Error('bench setup: expected an edge-label handler for `true`');
const placer = new EdgeLabelPlacer(EDGE_CONFIG, handler, source, undefined);
const collector = new LabelCollector();

const center = [10_000, 10_000];
const size = [20_000, 20_000];
const toPixel = composeTransform(
  createTransform(), size[0] / 2, size[1] / 2, 1 / RESOLUTION, -1 / RESOLUTION, 0, -center[0], -center[1],
);
const fromPixel = makeInverse(createTransform(), toPixel);
const screen = { toPixel, fromPixel, viewW: size[0], viewH: size[1] };
const frame = edgeLabelFrame(center, size, RESOLUTION, 0, PROJ);
const offsets = [0];

const sink: LabelSink = {
  setStyle: () => {},
  drawFeature: () => {},
  drawGeometry: () => {},
};

const lineCount = source.getFeatures().length;

describe(`LabelEngine edge path: ${lineCount} lines`, () => {
  bench('collect + place edge labels', () => {
    const { xBuf, xCount, yBuf, yCount } = collector.collectEdge(
      offsets, EXTENT,
      (shifted) => gridSystem.getLabels(shifted, RESOLUTION, PROJ),
    );
    placer.place(sink, frame, screen, EXTENT, RESOLUTION, xBuf, xCount, yBuf, yCount);
  });
});

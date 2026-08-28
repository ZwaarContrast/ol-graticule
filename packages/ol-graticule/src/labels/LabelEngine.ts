import type VectorSource from 'ol/source/Vector';
import type { FrameState } from 'ol/Map';
import type Feature from 'ol/Feature';
import type Geometry from 'ol/geom/Geometry';
import type { GridSystem } from '../types.js';
import type {
  EdgeLabelStyleHandler,
  CellLabelStyleHandler,
  GraticuleLineStyle,
} from '../style.js';
import type { LabelSink } from './LabelSink.js';
import { visibleWorldOffsets } from '../util/worldWrap.js';
import { LabelCollector } from './LabelCollector.js';
import { EdgeLabelPlacer, edgeLabelFrame, type EdgeLabelConfig, type ScreenFrame } from './EdgeLabelPlacer.js';
import { CellLabelRenderer } from './CellLabelRenderer.js';

export interface LabelEngineOptions {
  edgeLabelHandler: EdgeLabelStyleHandler | null;
  cellLabelHandler: CellLabelStyleHandler | null;
  edgeConfig: EdgeLabelConfig;
  lineStyle: GraticuleLineStyle | undefined;
  maxLines: number;
  /** Source the edge placer scans for grid-line endpoints (nearestLine_). */
  source: VectorSource;
}

/**
 * Runs the graticule label placers ({@link EdgeLabelPlacer},
 * {@link CellLabelRenderer}) against a frame and feeds their output to a
 * {@link LabelSink} — an OpenLayers `VectorContext` (canvas) or a placement
 * capturer (WebGL). This is the single source of label placement logic shared by
 * both graticule variants.
 */
export class LabelEngine {
  private readonly maxLines_: number;
  private readonly source_: VectorSource;
  private readonly collector_ = new LabelCollector();
  private readonly edgePlacer_: EdgeLabelPlacer | null;
  private readonly cellRenderer_: CellLabelRenderer | null;

  constructor(options: LabelEngineOptions) {
    this.maxLines_ = options.maxLines;
    this.source_ = options.source;
    this.edgePlacer_ = options.edgeLabelHandler
      ? new EdgeLabelPlacer(options.edgeConfig, options.edgeLabelHandler, this.source_, options.lineStyle)
      : null;
    this.cellRenderer_ = options.cellLabelHandler
      ? new CellLabelRenderer(options.cellLabelHandler)
      : null;
  }

  get hasEdgeLabels(): boolean {
    return this.edgePlacer_ !== null;
  }

  get hasCellLabels(): boolean {
    return this.cellRenderer_ !== null;
  }

  /** Place this frame's labels, drawing each into `sink`. */
  run(
    frameState: FrameState,
    gridSystem: GridSystem | null,
    sink: LabelSink,
    features?: Feature<Geometry>[],
  ): void {
    const extent = frameState.extent;
    const size = frameState.size;
    if (!gridSystem || !extent || !size) return;

    const { center, resolution, rotation, projection } = frameState.viewState;

    if (features) {
      // WebGL path: keep the placer's nearestLine_ source current each frame.
      const ceiling = this.maxLines_ * 2;
      this.source_.clear(true);
      this.source_.addFeatures(features.length > ceiling ? features.slice(0, ceiling) : features);
    }

    const screen: ScreenFrame = {
      toPixel: frameState.coordinateToPixelTransform,
      fromPixel: frameState.pixelToCoordinateTransform,
      viewW: size[0] ?? 0,
      viewH: size[1] ?? 0,
    };
    const offsets = visibleWorldOffsets(extent, projection);

    if (this.edgePlacer_) {
      const { xBuf, xCount, yBuf, yCount } = this.collector_.collectEdge(
        offsets, extent,
        (shifted) => gridSystem.getLabels(shifted, resolution, projection),
      );
      if (xCount > 0 || yCount > 0) {
        const frame = edgeLabelFrame(center, size, resolution, rotation, projection);
        this.edgePlacer_.place(sink, frame, screen, extent, resolution, xBuf, xCount, yBuf, yCount);
      }
    }

    const getCellLabels = gridSystem.getCellLabels;
    if (this.cellRenderer_ && getCellLabels) {
      const { buf, count } = this.collector_.collectCells(
        offsets, extent,
        (shifted) => getCellLabels.call(gridSystem, shifted, resolution, projection),
      );
      if (count > 0) this.cellRenderer_.draw(sink, screen, buf, count);
    }
  }
}


import Control from 'ol/control/Control';
import { unByKey } from 'ol/Observable';
import type { Map as OLMap } from 'ol';
import type { Coordinate } from 'ol/coordinate';
import type { EventsKey } from 'ol/events';
import type { Pixel } from 'ol/pixel';
import type { GridSystem } from './types.js';
import { isCombinedFormatted } from './types.js';
import {
  DEFAULT_CURSOR_COLOR,
  DEFAULT_CURSOR_LABEL_CSS,
  type CursorStyle,
} from './style.js';

export interface CursorPositionControlOptions {
  /** Grid system whose `formatCoordinate` produces the x/y label strings. */
  gridSystem?: GridSystem | null;
  /** Style config, CSS color and typography for the indicator. */
  style?: CursorStyle;
  /** CSS class name applied to the control's root element. */
  className?: string | undefined;
}

/** OpenLayers Control that shows formatted cursor-position indicators. */
export class CursorPositionControl extends Control {
  private gridSystem_: GridSystem | null;
  private readonly color_: string;
  private readonly labelCss_: string;

  private xIndicator_: HTMLDivElement;
  private yIndicator_: HTMLDivElement;
  private xLabel_: HTMLSpanElement;
  private yLabel_: HTMLSpanElement;
  private combinedIndicator_: HTMLDivElement;
  private combinedLabel_: HTMLSpanElement;

  private pointerMoveKey_: EventsKey | null = null;
  private pointerLeaveHandler_: (() => void) | null = null;
  private pointerLeaveTarget_: HTMLElement | null = null;

  private lastMode_: 'axis' | 'combined' | 'hidden' = 'hidden';
  private lastXText_ = '';
  private lastYText_ = '';
  private lastCombinedText_ = '';
  private lastPointerCoord_: Coordinate | null = null;

  private rafId_: number | null = null;
  private pendingCoordinate_: Coordinate | null = null;
  private pendingPixel_: Pixel | null = null;
  private pendingMap_: OLMap | null = null;

  constructor(options: CursorPositionControlOptions = {}) {
    const container = document.createElement('div');
    container.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:20;';
    container.setAttribute('aria-hidden', 'true');
    if (options.className) container.className = options.className;

    super({ element: container });

    this.gridSystem_ = options.gridSystem ?? null;
    if (this.gridSystem_ === null) container.style.display = 'none';
    this.color_ = options.style?.color ?? DEFAULT_CURSOR_COLOR;
    this.labelCss_ = options.style?.labelCss ?? DEFAULT_CURSOR_LABEL_CSS;

    const labelCss = (radius: string, padding: string, blockDisplay = true): string =>
      `${blockDisplay ? 'display:block;' : ''}white-space:nowrap;padding:${padding};border-radius:${radius};background:${this.color_};${this.labelCss_}`;
    const lineCss = (width: string, height: string, extra = ''): string =>
      `${extra}width:${width};height:${height};background:${this.color_};`;

    const indicatorBase =
      'position:absolute;top:0;left:0;will-change:transform;transform:translate3d(0,0,0);';

    this.xIndicator_ = document.createElement('div');
    this.xIndicator_.style.cssText = `${indicatorBase}display:none;`;

    this.xLabel_ = document.createElement('span');
    this.xLabel_.style.cssText = labelCss('0 0 3px 3px', '1px 6px');

    const xLine = document.createElement('div');
    xLine.style.cssText = lineCss('1px', '12px', 'margin:0 auto;');

    this.xIndicator_.appendChild(this.xLabel_);
    this.xIndicator_.appendChild(xLine);
    container.appendChild(this.xIndicator_);

    this.yIndicator_ = document.createElement('div');
    this.yIndicator_.style.cssText = `${indicatorBase}display:flex;align-items:center;visibility:hidden;`;

    this.yLabel_ = document.createElement('span');
    this.yLabel_.style.cssText = labelCss('0 3px 3px 0', '1px 6px', false);

    const yLine = document.createElement('div');
    yLine.style.cssText = lineCss('12px', '1px', 'flex-shrink:0;');

    this.yIndicator_.appendChild(this.yLabel_);
    this.yIndicator_.appendChild(yLine);
    container.appendChild(this.yIndicator_);

    this.combinedIndicator_ = document.createElement('div');
    this.combinedIndicator_.style.cssText = `${indicatorBase}display:none;`;

    this.combinedLabel_ = document.createElement('span');
    this.combinedLabel_.style.cssText = labelCss('3px', '2px 8px');

    this.combinedIndicator_.appendChild(this.combinedLabel_);
    container.appendChild(this.combinedIndicator_);
  }

  getGridSystem(): GridSystem | null {
    return this.gridSystem_;
  }

  /** Activate or deactivate the control. */
  setGridSystem(gridSystem: GridSystem | null): void {
    const wasActive = this.gridSystem_ !== null;
    this.gridSystem_ = gridSystem;
    this.lastXText_ = '';
    this.lastYText_ = '';
    this.lastCombinedText_ = '';

    if (gridSystem === null) {
      this.element.style.display = 'none';
      this.detach_();
      this.hide_();
      this.lastPointerCoord_ = null;
      return;
    }

    const map = this.getMap();
    if (!wasActive) {
      this.element.style.display = '';
      if (map) this.attach_(map);
    }

    if (map && this.lastPointerCoord_) {
      const pixel = map.getPixelFromCoordinate(this.lastPointerCoord_);
      if (pixel) this.update_(this.lastPointerCoord_, pixel, map);
    } else {
      this.hide_();
    }
  }

  override setMap(map: OLMap | null): void {
    this.detach_();
    super.setMap(map);
    if (map && this.gridSystem_ !== null) this.attach_(map);
    else this.hide_();
  }

  private attach_(map: OLMap): void {
    this.pointerMoveKey_ = map.on('pointermove', (evt) => {
      this.lastPointerCoord_ = evt.coordinate;
      this.pendingCoordinate_ = evt.coordinate;
      this.pendingPixel_ = evt.pixel;
      this.pendingMap_ = map;
      this.scheduleFlush_();
    });
    const viewport = map.getViewport();
    this.pointerLeaveTarget_ = viewport;
    this.pointerLeaveHandler_ = () => {
      this.lastPointerCoord_ = null;
      this.cancelFlush_();
      this.hide_();
    };
    viewport.addEventListener('pointerleave', this.pointerLeaveHandler_);
  }

  private detach_(): void {
    if (this.pointerMoveKey_) {
      unByKey(this.pointerMoveKey_);
      this.pointerMoveKey_ = null;
    }
    if (this.pointerLeaveHandler_ && this.pointerLeaveTarget_) {
      this.pointerLeaveTarget_.removeEventListener('pointerleave', this.pointerLeaveHandler_);
      this.pointerLeaveHandler_ = null;
      this.pointerLeaveTarget_ = null;
    }
    this.cancelFlush_();
  }

  private scheduleFlush_(): void {
    if (this.rafId_ !== null) return;
    this.rafId_ = requestAnimationFrame(() => {
      this.rafId_ = null;
      const coord = this.pendingCoordinate_;
      const pixel = this.pendingPixel_;
      const map = this.pendingMap_;
      if (coord && pixel && map) this.update_(coord, pixel, map);
    });
  }

  private cancelFlush_(): void {
    if (this.rafId_ !== null) {
      cancelAnimationFrame(this.rafId_);
      this.rafId_ = null;
    }
    this.pendingCoordinate_ = null;
    this.pendingPixel_ = null;
    this.pendingMap_ = null;
  }

  private update_(coordinate: Coordinate, pixel: Pixel, map: OLMap): void {
    const gridSystem = this.gridSystem_;
    if (!gridSystem) return;

    const [cx, cy] = coordinate;
    if (cx === undefined || cy === undefined) return;
    const [px, py] = pixel;
    if (px === undefined || py === undefined) return;

    const projection = map.getView().getProjection();
    const coord: [number, number] = [cx, cy];

    if (gridSystem.isValidCoordinate && !gridSystem.isValidCoordinate(coord, projection)) {
      this.hide_();
      return;
    }

    const formatted = gridSystem.formatCoordinate(coord, projection);

    if (isCombinedFormatted(formatted)) {
      if (this.lastMode_ !== 'combined') {
        this.xIndicator_.style.display = 'none';
        this.yIndicator_.style.visibility = 'hidden';
        this.combinedIndicator_.style.display = '';
        this.lastMode_ = 'combined';
      }
      this.combinedIndicator_.style.transform = `translate3d(${px + 12}px, ${py + 12}px, 0)`;
      if (formatted.combined !== this.lastCombinedText_) {
        this.combinedLabel_.textContent = formatted.combined;
        this.lastCombinedText_ = formatted.combined;
      }
    } else {
      if (this.lastMode_ !== 'axis') {
        this.combinedIndicator_.style.display = 'none';
        this.xIndicator_.style.display = '';
        this.yIndicator_.style.visibility = 'visible';
        this.lastMode_ = 'axis';
      }
      this.xIndicator_.style.transform = `translate3d(${px}px, 0, 0) translateX(-50%)`;
      this.yIndicator_.style.transform = `translate3d(0, ${py}px, 0) translateY(-50%)`;
      if (formatted.x !== this.lastXText_) {
        this.xLabel_.textContent = formatted.x;
        this.lastXText_ = formatted.x;
      }
      if (formatted.y !== this.lastYText_) {
        this.yLabel_.textContent = formatted.y;
        this.lastYText_ = formatted.y;
      }
    }
  }

  private hide_(): void {
    this.xIndicator_.style.display = 'none';
    this.yIndicator_.style.visibility = 'hidden';
    this.combinedIndicator_.style.display = 'none';
    this.lastMode_ = 'hidden';
  }

  override disposeInternal(): void {
    this.detach_();
    super.disposeInternal();
  }
}

/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Map from 'ol/Map';
import View from 'ol/View';
import { CursorPositionControl } from '../CursorPositionControl.js';
import type { GridSystem, FormattedCoordinate } from '../types.js';

function makeAxisGridSystem(formatted: FormattedCoordinate = { x: 'X', y: 'Y' }): GridSystem {
  return {
    getFeatures: vi.fn().mockReturnValue([]),
    getLabels: vi.fn().mockReturnValue([]),
    formatCoordinate: vi.fn().mockReturnValue(formatted),
  };
}

function makeCombinedGridSystem(combined = 'BF 6175'): GridSystem {
  return {
    getFeatures: vi.fn().mockReturnValue([]),
    getLabels: vi.fn().mockReturnValue([]),
    formatCoordinate: vi.fn().mockReturnValue({ combined }),
  };
}

/** Access private/protected fields for assertions — tests are the one legitimate caller. */
type Internals = {
  element: HTMLElement;
  xIndicator_: HTMLDivElement;
  yIndicator_: HTMLDivElement;
  xLabel_: HTMLSpanElement;
  yLabel_: HTMLSpanElement;
  combinedIndicator_: HTMLDivElement;
  combinedLabel_: HTMLSpanElement;
  pointerMoveKey_: unknown;
  lastPointerCoord_: [number, number] | null;
  update_: (coord: [number, number], pixel: [number, number], map: Map) => void;
};
const peek = (c: CursorPositionControl) => c as unknown as Internals;

/**
 * Build a minimal map-like stub that satisfies what the control reads:
 * pointer event subscription is not used here (we drive `update_` directly),
 * so the map needs a view with a projection and a pixel mapper.
 */
function stubMap(pixel: [number, number] = [100, 200]): Map {
  const container = document.createElement('div');
  const map = new Map({
    target: container,
    view: new View({ projection: 'EPSG:3857', center: [0, 0], zoom: 1 }),
  });
  vi.spyOn(map, 'getPixelFromCoordinate').mockReturnValue(pixel);
  return map;
}

describe('CursorPositionControl', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  describe('construction', () => {
    it('creates a container div and child indicators in the DOM', () => {
      const control = new CursorPositionControl({ gridSystem: makeAxisGridSystem() });
      const el = peek(control).element;
      expect(el.tagName).toBe('DIV');
      expect(el.getAttribute('aria-hidden')).toBe('true');
      expect(peek(control).xIndicator_.parentElement).toBe(el);
      expect(peek(control).yIndicator_.parentElement).toBe(el);
      expect(peek(control).combinedIndicator_.parentElement).toBe(el);
    });

    it('hides all indicators by default', () => {
      const control = new CursorPositionControl({ gridSystem: makeAxisGridSystem() });
      expect(peek(control).xIndicator_.style.display).toBe('none');
      expect(peek(control).yIndicator_.style.visibility).toBe('hidden');
      expect(peek(control).combinedIndicator_.style.display).toBe('none');
    });

    it('applies a caller-supplied className to the root element', () => {
      const control = new CursorPositionControl({
        gridSystem: makeAxisGridSystem(),
        className: 'custom-cursor',
      });
      expect(peek(control).element.className).toBe('custom-cursor');
    });

    it('uses caller-supplied color in indicator styles', () => {
      const control = new CursorPositionControl({
        gridSystem: makeAxisGridSystem(),
        style: { color: 'rgb(0, 128, 255)' },
      });
      const xLabelStyle = peek(control).xLabel_.getAttribute('style') ?? '';
      expect(xLabelStyle).toContain('rgb(0, 128, 255)');
    });
  });

  describe('getGridSystem / setGridSystem', () => {
    it('returns the grid system supplied at construction', () => {
      const gs = makeAxisGridSystem();
      const control = new CursorPositionControl({ gridSystem: gs });
      expect(control.getGridSystem()).toBe(gs);
    });

    it('swaps the underlying grid system', () => {
      const first = makeAxisGridSystem();
      const second = makeCombinedGridSystem();
      const control = new CursorPositionControl({ gridSystem: first });
      control.setGridSystem(second);
      expect(control.getGridSystem()).toBe(second);
    });

    it('hides the previous indicator state on swap when no cursor is cached', () => {
      const axis = makeAxisGridSystem({ x: 'X', y: 'Y' });
      const control = new CursorPositionControl({ gridSystem: axis });
      peek(control).xIndicator_.style.display = '';
      peek(control).yIndicator_.style.visibility = 'visible';

      control.setGridSystem(makeCombinedGridSystem());
      expect(peek(control).xIndicator_.style.display).toBe('none');
      expect(peek(control).yIndicator_.style.visibility).toBe('hidden');
    });

    it('re-renders immediately with the new grid system when the cursor is live', () => {
      // Simulate a live cursor: control attached to a map with a cached pointermove.
      const control = new CursorPositionControl({
        gridSystem: makeAxisGridSystem({ x: 'old-x', y: 'old-y' }),
      });
      const map = stubMap([150, 250]);
      control.setMap(map);
      peek(control).lastPointerCoord_ = [10, 20];
      // Prime the axis display as if a pointermove already rendered.
      peek(control).update_([10, 20], [150, 250], map);

      control.setGridSystem(makeAxisGridSystem({ x: 'new-x', y: 'new-y' }));

      // Without waiting for another pointermove, labels should reflect the new grid.
      expect(peek(control).xLabel_.textContent).toBe('new-x');
      expect(peek(control).yLabel_.textContent).toBe('new-y');
      expect(peek(control).xIndicator_.style.display).toBe('');
      expect(peek(control).yIndicator_.style.visibility).toBe('visible');
    });
  });

  describe('setGridSystem(null) — deactivation', () => {
    it('allows null at construction and starts hidden + detached', () => {
      const control = new CursorPositionControl();
      expect(control.getGridSystem()).toBeNull();
      expect(peek(control).element.style.display).toBe('none');
      const map = stubMap();
      control.setMap(map);
      // Listeners should NOT attach while grid system is null.
      expect(peek(control).pointerMoveKey_).toBeNull();
    });

    it('hides the root element, detaches listeners, and clears cached cursor when set to null', () => {
      const control = new CursorPositionControl({ gridSystem: makeAxisGridSystem() });
      const map = stubMap();
      control.setMap(map);
      peek(control).lastPointerCoord_ = [10, 20];
      expect(peek(control).pointerMoveKey_).not.toBeNull();

      control.setGridSystem(null);

      expect(control.getGridSystem()).toBeNull();
      expect(peek(control).element.style.display).toBe('none');
      expect(peek(control).pointerMoveKey_).toBeNull();
      expect(peek(control).lastPointerCoord_).toBeNull();
      expect(peek(control).xIndicator_.style.display).toBe('none');
    });

    it('re-activates when a grid system is set after null', () => {
      const control = new CursorPositionControl();
      const map = stubMap();
      control.setMap(map);

      control.setGridSystem(makeAxisGridSystem({ x: 'X', y: 'Y' }));

      expect(peek(control).element.style.display).toBe('');
      expect(peek(control).pointerMoveKey_).not.toBeNull();
    });

    it('does not attach listeners when setMap runs while inactive', () => {
      const control = new CursorPositionControl();
      const map = stubMap();
      control.setMap(map);
      expect(peek(control).pointerMoveKey_).toBeNull();
    });
  });

  describe('update_', () => {
    it('renders axis indicators for an axis-separable grid system', () => {
      const gs = makeAxisGridSystem({ x: '5°E', y: '50°N' });
      const control = new CursorPositionControl({ gridSystem: gs });
      const map = stubMap([120, 240]);

      peek(control).update_([0, 0], [120, 240], map);

      expect(peek(control).xIndicator_.style.display).toBe('');
      expect(peek(control).xIndicator_.style.transform).toBe(
        'translate3d(120px, 0, 0) translateX(-50%)',
      );
      expect(peek(control).xLabel_.textContent).toBe('5°E');

      expect(peek(control).yIndicator_.style.visibility).toBe('visible');
      expect(peek(control).yIndicator_.style.transform).toBe(
        'translate3d(0, 240px, 0) translateY(-50%)',
      );
      expect(peek(control).yLabel_.textContent).toBe('50°N');

      expect(peek(control).combinedIndicator_.style.display).toBe('none');
    });

    it('renders the combined indicator (and hides axis ones) for compound grids', () => {
      const gs = makeCombinedGridSystem('BF 6175');
      const control = new CursorPositionControl({ gridSystem: gs });
      const map = stubMap([300, 400]);

      peek(control).update_([0, 0], [300, 400], map);

      expect(peek(control).combinedIndicator_.style.display).toBe('');
      // +12 px offset from the cursor; see CursorPositionControl.update_.
      expect(peek(control).combinedIndicator_.style.transform).toBe(
        'translate3d(312px, 412px, 0)',
      );
      expect(peek(control).combinedLabel_.textContent).toBe('BF 6175');

      expect(peek(control).xIndicator_.style.display).toBe('none');
      expect(peek(control).yIndicator_.style.visibility).toBe('hidden');
    });

    it('hides indicators and skips formatCoordinate when isValidCoordinate returns false', () => {
      const formatCoordinate = vi.fn().mockReturnValue({ x: 'X', y: 'Y' });
      const gs: GridSystem = {
        getFeatures: vi.fn().mockReturnValue([]),
        getLabels: vi.fn().mockReturnValue([]),
        formatCoordinate,
        isValidCoordinate: () => false,
      };
      const control = new CursorPositionControl({ gridSystem: gs });
      const map = stubMap();

      peek(control).xIndicator_.style.display = '';
      peek(control).update_([0, 0], [0, 0], map);

      expect(formatCoordinate).not.toHaveBeenCalled();
      expect(peek(control).xIndicator_.style.display).toBe('none');
      expect(peek(control).yIndicator_.style.visibility).toBe('hidden');
      expect(peek(control).combinedIndicator_.style.display).toBe('none');
    });

    it('passes the map view projection to formatCoordinate', () => {
      const gs = makeAxisGridSystem();
      const control = new CursorPositionControl({ gridSystem: gs });
      const map = stubMap();

      peek(control).update_([42, -7], [0, 0], map);
      expect(gs.formatCoordinate).toHaveBeenCalledTimes(1);
      const args = (gs.formatCoordinate as ReturnType<typeof vi.fn>).mock.calls[0]!;
      expect(args[0]).toEqual([42, -7]);
      expect(args[1]).toBe(map.getView().getProjection());
    });
  });

  describe('setMap / attach / detach', () => {
    it('subscribes to pointermove when attached to a map', () => {
      const control = new CursorPositionControl({ gridSystem: makeAxisGridSystem() });
      const map = stubMap();
      control.setMap(map);
      expect(peek(control).pointerMoveKey_).not.toBeNull();
    });

    it('unsubscribes from pointermove when detached (setMap(null))', () => {
      const control = new CursorPositionControl({ gridSystem: makeAxisGridSystem() });
      const map = stubMap();
      control.setMap(map);
      control.setMap(null);
      expect(peek(control).pointerMoveKey_).toBeNull();
    });

    it('clears any visible indicator when detached', () => {
      const control = new CursorPositionControl({ gridSystem: makeAxisGridSystem() });
      const map = stubMap();
      control.setMap(map);
      peek(control).combinedIndicator_.style.display = '';
      control.setMap(null);
      expect(peek(control).combinedIndicator_.style.display).toBe('none');
    });
  });
});

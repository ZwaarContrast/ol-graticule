/** One active pointer's lens: position in CSS px (viewport-relative) and fade. */
export interface LensPointer {
  x: number;
  y: number;
  intensity: number;
}

/**
 * Tracks every active pointer (mouse + each touch) over the map viewport and
 * eases a per-pointer fade, so a lens can be drawn under each finger. Shared by
 * the canvas and WebGL lenses so both behave identically. `attach` wires raw
 * pointer events (OL's map `pointermove` only surfaces the primary pointer) to
 * the pure {@link set}/{@link lift} API.
 */
export class LensPointers {
  private readonly pointers_ = new Map<
    number, { x: number; y: number; intensity: number; target: number }
  >();
  private viewport_: HTMLElement | null = null;
  private onChange_: (() => void) | null = null;

  private readonly onMove_ = (event: PointerEvent): void => this.fromEvent_(event);
  private readonly onDown_ = (event: PointerEvent): void => this.fromEvent_(event);
  private readonly onUp_ = (event: PointerEvent): void => {
    // A mouse keeps hovering after its button is released (a click, or the end of
    // a drag), so its lens must stay; only touch/pen actually leave the surface
    // on up. The mouse's lens is removed by pointerleave when it exits the map.
    if (event.pointerType === 'mouse') return;
    this.lift(event.pointerId);
  };
  private readonly onLift_ = (event: PointerEvent): void => {
    this.lift(event.pointerId);
  };

  attach(viewport: HTMLElement, onChange: () => void): void {
    // Idempotent: the canvas lens re-attaches every postrender, so a repeat call
    // for the same viewport must not wipe the tracked pointers.
    if (this.viewport_ === viewport) {
      this.onChange_ = onChange;
      return;
    }
    if (this.viewport_) this.detach();
    this.viewport_ = viewport;
    this.onChange_ = onChange;
    viewport.addEventListener('pointermove', this.onMove_);
    viewport.addEventListener('pointerdown', this.onDown_);
    viewport.addEventListener('pointerup', this.onUp_);
    viewport.addEventListener('pointercancel', this.onLift_);
    viewport.addEventListener('pointerleave', this.onLift_);
  }

  detach(): void {
    const viewport = this.viewport_;
    if (viewport) {
      viewport.removeEventListener('pointermove', this.onMove_);
      viewport.removeEventListener('pointerdown', this.onDown_);
      viewport.removeEventListener('pointerup', this.onUp_);
      viewport.removeEventListener('pointercancel', this.onLift_);
      viewport.removeEventListener('pointerleave', this.onLift_);
    }
    this.pointers_.clear();
    this.viewport_ = null;
    this.onChange_ = null;
  }

  /** Add or move a pointer's lens to (x, y) in viewport CSS px, fading it in. */
  set(pointerId: number, x: number, y: number): void {
    const existing = this.pointers_.get(pointerId);
    if (existing) {
      existing.x = x;
      existing.y = y;
      existing.target = 1;
    } else {
      this.pointers_.set(pointerId, { x, y, intensity: 0, target: 1 });
    }
    this.onChange_?.();
  }

  /** Start fading a pointer's lens out (pointer lifted or left the map). */
  lift(pointerId: number): void {
    const p = this.pointers_.get(pointerId);
    if (p) {
      p.target = 0;
      this.onChange_?.();
    }
  }

  /** Ease every pointer toward its target and drop settled ones. Returns whether
   * any lens is still easing (so the caller keeps the frame loop alive). */
  step(): boolean {
    let fading = false;
    for (const [id, p] of this.pointers_) {
      const di = p.target - p.intensity;
      p.intensity += di * 0.3;
      if (p.target === 0 && p.intensity < 0.01) {
        this.pointers_.delete(id);
        continue;
      }
      if (Math.abs(di) > 0.004) fading = true;
    }
    return fading;
  }

  get count(): number {
    return this.pointers_.size;
  }

  /** Visit each pointer whose lens is currently visible. */
  forEach(cb: (pointer: LensPointer) => void): void {
    for (const p of this.pointers_.values()) {
      if (p.intensity >= 0.01) cb(p);
    }
  }

  private fromEvent_(event: PointerEvent): void {
    const viewport = this.viewport_;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    this.set(event.pointerId, event.clientX - rect.left, event.clientY - rect.top);
  }
}

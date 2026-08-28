import { describe, it, expect } from 'vitest';
import { LensPointers, type LensPointer } from '../LensPointers.js';

/** Ease a tracker until its fades settle, so assertions see the resting state. */
function settle(pointers: LensPointers, steps = 60): void {
  for (let i = 0; i < steps; i++) pointers.step();
}

function visible(pointers: LensPointers): LensPointer[] {
  const out: LensPointer[] = [];
  pointers.forEach((p) => out.push({ ...p }));
  return out;
}

describe('LensPointers', () => {
  it('tracks one pointer and eases its lens in', () => {
    const pointers = new LensPointers();
    pointers.set(1, 50, 60);
    expect(pointers.count).toBe(1);
    // Not yet visible on the first frame (intensity starts at 0).
    settle(pointers);
    const [p] = visible(pointers);
    expect(p).toMatchObject({ x: 50, y: 60 });
    expect(p?.intensity).toBeGreaterThan(0.98);
  });

  it('tracks several pointers at once (multi-touch)', () => {
    const pointers = new LensPointers();
    pointers.set(1, 10, 10);
    pointers.set(2, 200, 120);
    pointers.set(3, 400, 300);
    settle(pointers);
    expect(pointers.count).toBe(3);
    expect(visible(pointers)).toHaveLength(3);
  });

  it('moves an existing pointer instead of adding a new lens', () => {
    const pointers = new LensPointers();
    pointers.set(1, 10, 10);
    pointers.set(1, 90, 90);
    settle(pointers);
    expect(pointers.count).toBe(1);
    expect(visible(pointers)[0]).toMatchObject({ x: 90, y: 90 });
  });

  it('fades a lifted pointer out and drops it', () => {
    const pointers = new LensPointers();
    pointers.set(1, 10, 10);
    settle(pointers);
    pointers.lift(1);
    // Still present while easing out...
    expect(pointers.count).toBe(1);
    settle(pointers);
    // ...then removed once the fade reaches zero.
    expect(pointers.count).toBe(0);
    expect(visible(pointers)).toHaveLength(0);
  });

  it('reports still-fading while a lens eases and idle once settled', () => {
    const pointers = new LensPointers();
    pointers.set(1, 10, 10);
    expect(pointers.step()).toBe(true);
    settle(pointers);
    expect(pointers.step()).toBe(false);
  });

  it('lifting an unknown pointer is a no-op', () => {
    const pointers = new LensPointers();
    pointers.lift(99);
    expect(pointers.count).toBe(0);
  });
});

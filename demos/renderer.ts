/**
 * Which graticule backend the demos construct, and the button that switches it.
 * The e2e suite forces a backend by setting the same `localStorage` key.
 */

import { UniversalGraticule } from '@zwaarcontrast/ol-graticule';
import type {
  GraticuleRenderer,
  UniversalGraticuleOptions,
} from '@zwaarcontrast/ol-graticule';
import { palette } from './shared';

const RENDERER_KEY = 'demo-renderer';

/** Throws outright in a sandboxed iframe or with site data blocked. */
function storedRenderer(): string | null {
  try {
    return localStorage.getItem(RENDERER_KEY);
  } catch {
    return null;
  }
}

type Choice = 'auto' | 'webgl' | 'canvas';

const NEXT: Record<Choice, Choice> = { auto: 'webgl', webgl: 'canvas', canvas: 'auto' };
const LABEL: Record<Choice, string> = { auto: 'Auto', webgl: 'WebGL', canvas: 'Canvas' };

function choice(): Choice {
  const c = storedRenderer();
  return c === 'canvas' || c === 'webgl' ? c : 'auto';
}

/** `'auto'` lets the facade probe for WebGL and fall back to canvas. */
export function rendererSetting(): GraticuleRenderer {
  const c = choice();
  return c === 'canvas' ? 'canvas' : c === 'webgl' ? 'gl' : 'auto';
}

export function createGraticule(options: UniversalGraticuleOptions): UniversalGraticule {
  return new UniversalGraticule({ ...options, renderer: rendererSetting() });
}

/** Floating button cycling auto -> WebGL -> Canvas; reloads so demos rebuild cleanly. */
export function addRendererToggle(): void {
  const current = choice();
  const btn = document.createElement('button');
  // The visual-regression tests hide this by class.
  btn.className = 'renderer-toggle';
  btn.textContent = `Renderer: ${LABEL[current]}`;
  btn.title = `Switch the graticule renderer to ${LABEL[NEXT[current]]} (reloads the page)`;
  Object.assign(btn.style, {
    position: 'fixed', bottom: '12px', right: '12px', zIndex: '1000',
    font: '700 11px system-ui, -apple-system, sans-serif', color: palette.paper,
    background: palette.ink, border: `1px solid ${palette.accent}`,
    borderRadius: '6px', padding: '6px 10px', cursor: 'pointer',
    letterSpacing: '0.03em',
  });
  btn.addEventListener('click', () => {
    const next = NEXT[current];
    try {
      // 'auto' is the absence of a choice.
      if (next === 'auto') localStorage.removeItem(RENDERER_KEY);
      else localStorage.setItem(RENDERER_KEY, next);
    } catch {
      // Nothing to persist to.
    }
    location.reload();
  });
  document.body.appendChild(btn);
}

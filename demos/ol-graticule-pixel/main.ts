import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import ImageLayer from 'ol/layer/Image';
import ImageStatic from 'ol/source/ImageStatic';
import Projection from 'ol/proj/Projection';
import {
  UniversalGraticule,
  PixelGridSystem,
  CursorPositionControl,
} from '@zwaarcontrast/ol-graticule';
import { gridLine, edgeLabelText, cursorStyle } from '../shared';
import { createCoordinateInput } from '../coordinateInput';

const WIDTH = 2000;
const HEIGHT = 1200;

function buildBackground(): string {
  const c = document.createElement('canvas');
  c.width = WIDTH;
  c.height = HEIGHT;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('canvas 2d unavailable');

  ctx.fillStyle = '#0a1428';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.strokeStyle = 'rgba(180, 215, 245, 0.10)';
  ctx.lineWidth = 1;
  for (let x = 100; x < WIDTH; x += 100) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, HEIGHT);
    ctx.stroke();
  }
  for (let y = 100; y < HEIGHT; y += 100) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(WIDTH, y + 0.5);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(234, 88, 12, 0.85)';
  for (const [x, y] of [
    [400, 300], [1200, 300], [800, 800], [1600, 900],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x, y, 60, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(245, 239, 230, 0.92)';
  ctx.font = '600 56px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PixelGridSystem', WIDTH / 2, HEIGHT / 2 - 40);

  ctx.fillStyle = 'rgba(245, 239, 230, 0.55)';
  ctx.font = '400 22px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.fillText('image-coordinate ruler  ·  yInverted: y grows downward', WIDTH / 2, HEIGHT / 2 + 20);

  ctx.fillStyle = 'rgba(180, 215, 245, 0.7)';
  ctx.font = '500 18px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('(0, 0) — top-left', 24, 28);
  ctx.textAlign = 'right';
  ctx.fillText(`(${WIDTH}, 0) — top-right`, WIDTH - 24, 28);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`(0, ${HEIGHT}) — bottom-left`, 24, HEIGHT - 16);
  ctx.textAlign = 'right';
  ctx.fillText(`(${WIDTH}, ${HEIGHT}) — bottom-right`, WIDTH - 24, HEIGHT - 16);

  return c.toDataURL('image/png');
}

const extent = [0, -HEIGHT, WIDTH, 0];
const projection = new Projection({
  code: 'pixel',
  units: 'pixels',
  extent,
});

const gridSystem = new PixelGridSystem({ yInverted: true });

const map = new Map({
  target: 'map',
  layers: [
    new ImageLayer({
      source: new ImageStatic({ url: buildBackground(), projection, imageExtent: extent }),
    }),
    new UniversalGraticule({
      gridSystem,
      style: { line: { major: gridLine }, edgeLabel: edgeLabelText },
    }),
  ],
  controls: [new CursorPositionControl({ gridSystem, style: cursorStyle })],
  view: new View({
    projection,
    center: [WIDTH / 2, -HEIGHT / 2],
    extent,
    resolution: Math.max(WIDTH, HEIGHT) / 800,
    maxResolution: Math.max(WIDTH, HEIGHT) / 400,
    minResolution: 0.25,
  }),
});

const badge = document.querySelector<HTMLElement>('.badge');
if (badge) {
  createCoordinateInput({
    map,
    gridSystem,
    host: badge,
    placeholder: '800 600 px',
    hint: 'X Y in image pixels (top-left origin).',
  });
}

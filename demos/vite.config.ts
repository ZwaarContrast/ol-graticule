import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// GitHub Pages serves this repo at /ol-graticule/. Override with
// DEMO_BASE=/ when previewing from the repo root locally without a sub-path.
const base = process.env.DEMO_BASE ?? '/ol-graticule/';

export default defineConfig({
  base,
  root: __dirname,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        'ol-graticule': resolve(__dirname, 'ol-graticule/index.html'),
        'ol-graticule-projected': resolve(__dirname, 'ol-graticule-projected/index.html'),
        'ol-graticule-modified-british-system': resolve(
          __dirname,
          'ol-graticule-modified-british-system/index.html',
        ),
        'ol-graticule-rd': resolve(__dirname, 'ol-graticule-rd/index.html'),
        'ol-graticule-mgrs': resolve(__dirname, 'ol-graticule-mgrs/index.html'),
        'ol-graticule-marinequadratkarte': resolve(
          __dirname,
          'ol-graticule-marinequadratkarte/index.html',
        ),
      },
    },
  },
});

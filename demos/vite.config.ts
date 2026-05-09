import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'node:path';

const base = process.env.DEMO_BASE ?? '/ol-graticule/';
const GA_ID = 'G-BJJQSZZZGV';

const gtag: Plugin = {
  name: 'inject-ga4',
  apply: 'build',
  transformIndexHtml(html) {
    const snippet = `\n    <script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>\n    <script>\n      window.dataLayer = window.dataLayer || [];\n      function gtag(){dataLayer.push(arguments);}\n      gtag('js', new Date());\n      gtag('config', '${GA_ID}');\n    </script>`;
    return html.replace('</head>', `${snippet}\n  </head>`);
  },
};

export default defineConfig({
  base,
  root: __dirname,
  plugins: [gtag],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        'ol-graticule': resolve(__dirname, 'ol-graticule/index.html'),
        'ol-graticule-pixel': resolve(__dirname, 'ol-graticule-pixel/index.html'),
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

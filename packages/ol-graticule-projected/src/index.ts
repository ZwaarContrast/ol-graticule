export { ProjectedGridSystem } from './grid-systems/ProjectedGridSystem.js';
export type { ProjectedGridSystemOptions } from './grid-systems/ProjectedGridSystem.js';

// Re-exported from core so existing imports from this package keep working.
// `MetricIntervals` / `MetricFormatter` are proj4-agnostic and now live in
// `@zwaarcontrast/ol-graticule`, new code should import them from there.
export { MetricIntervals, MetricFormatter } from '@zwaarcontrast/ol-graticule';
export type { MetricFormatterOptions } from '@zwaarcontrast/ol-graticule';

export { registerCRS } from './registerCRS.js';
export { loadNadgrid } from './loadNadgrid.js';
export type { LoadNadgridOptions } from './loadNadgrid.js';

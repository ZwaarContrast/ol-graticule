// Schemes, theatre constants and the formatter: all ol-free and separately
// importable from the `/headless` subpath.
export * from './headless.js';

export { MBSIntervals } from './intervals/MBSIntervals.js';

export { createNordDeGuerreGridSystem } from './grids/NordDeGuerre.grid.js';

export type { NordDeGuerreGridSystemOptions } from './grids/NordDeGuerre.grid.js';

export {
  createFrenchLambert1GridSystem,
  createFrenchLambert2GridSystem,
  createFrenchLambert3GridSystem,
} from './grids/FrenchLambert.grid.js';

export type { FrenchLambertGridSystemOptions } from './grids/FrenchLambert.grid.js';

export { createBritishCassiniGridSystem } from './grids/BritishCassini.grid.js';

export type { BritishCassiniGridSystemOptions } from './grids/BritishCassini.grid.js';

export { createIrishCassiniGridSystem } from './grids/IrishCassini.grid.js';

export type { IrishCassiniGridSystemOptions } from './grids/IrishCassini.grid.js';

export { createWarOfficeCassiniGridSystem } from './grids/WarOfficeCassini.grid.js';

export type { WarOfficeCassiniGridSystemOptions } from './grids/WarOfficeCassini.grid.js';

export { createScandinavianZone3GridSystem } from './grids/ScandinavianZone3.grid.js';

export type { ScandinavianZone3GridSystemOptions } from './grids/ScandinavianZone3.grid.js';

export { createItalianNorthernGridSystem } from './grids/ItalianNorthern.grid.js';

export type { ItalianNorthernGridSystemOptions } from './grids/ItalianNorthern.grid.js';

export { createItalianSouthernGridSystem } from './grids/ItalianSouthern.grid.js';

export type { ItalianSouthernGridSystemOptions } from './grids/ItalianSouthern.grid.js';

export { createIberianPeninsulaGridSystem } from './grids/IberianPeninsula.grid.js';

export type { IberianPeninsulaGridSystemOptions } from './grids/IberianPeninsula.grid.js';

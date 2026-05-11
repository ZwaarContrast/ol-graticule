/**
 * Letter schemes and grid origins for known MBS theatres.
 *
 * Every theatre's first-letter and second-letter grid, including the cyclic
 * rotations that identify each letter family, is reconstructed from Thierry
 * Arsicaud's Echo Delta site (https://www.echodelta.net/mbs/eng-welcome.php).
 * Echo Delta has done decades of patient archival work that this package
 * would not exist without. See the package README for the full credit.
 */

/** Indexing: `[geoRow][geoCol]`; `geoRow=0` is south, `geoCol=0` is west. */
export interface MBSLetterGrids {
  /** Labels the 500 km squares; A–Z minus I, arranged 5 × 5. */
  firstLetterGrid: readonly string[];
  /** Labels the 100 km cells within a 500 km square. */
  secondLetterGrid: readonly string[];
}

/** Per-theatre scheme: letter grids plus grid origin. */
export interface MBSLetterScheme extends MBSLetterGrids {
  /** SW corner easting of the 2 500 km × 2 500 km grid, in polygon-CRS km. */
  eOriginKm: number;
  /** SW corner northing. */
  nOriginKm: number;
}

/**
 * Letter grids shared by Nord de Guerre and the three French Lambert zones.
 *
 *   First letter             Second letter
 *   north │ A B C D E         north │ F G H J K
 *         │ F G H J K               │ L M N O P
 *         │ L M N O P               │ Q R S T U
 *         │ Q R S T U               │ V W X Y Z
 *   south │ V W X Y Z         south │ A B C D E
 */
export const NORD_DE_GUERRE_FAMILY_LETTERS: MBSLetterGrids = {
  firstLetterGrid: ['VWXYZ', 'QRSTU', 'LMNOP', 'FGHJK', 'ABCDE'],
  secondLetterGrid: ['ABCDE', 'VWXYZ', 'QRSTU', 'LMNOP', 'FGHJK'],
};

/** Nord de Guerre. */
export const NORD_DE_GUERRE_SCHEME: MBSLetterScheme = {
  ...NORD_DE_GUERRE_FAMILY_LETTERS,
  eOriginKm: -100,
  nOriginKm: 0,
};

/** French Lambert Zone I (Nord, EPSG:27561). */
export const FRENCH_LAMBERT_1_SCHEME: MBSLetterScheme = {
  ...NORD_DE_GUERRE_FAMILY_LETTERS,
  eOriginKm: 0,
  nOriginKm: -100,
};

/** French Lambert Zone II (Centre, EPSG:27562). */
export const FRENCH_LAMBERT_2_SCHEME: MBSLetterScheme = {
  ...NORD_DE_GUERRE_FAMILY_LETTERS,
  eOriginKm: 0,
  nOriginKm: -100,
};

/** French Lambert Zone III (Sud, EPSG:27563); Zone III territory falls in the NORTH row of the letter grid. */
export const FRENCH_LAMBERT_3_SCHEME: MBSLetterScheme = {
  ...NORD_DE_GUERRE_FAMILY_LETTERS,
  eOriginKm: 0,
  nOriginKm: -2100,
};

/**
 * Letter grids for British Cassini and Irish Cassini.
 *
 *   First letter             Second letter
 *   north │ A B C D E         north │ A B C D E
 *         │ F G H J K               │ F G H J K
 *         │ L M N O P               │ L M N O P
 *         │ Q R S T U               │ Q R S T U
 *   south │ V W X Y Z         south │ V W X Y Z
 */
export const BRITISH_CASSINI_FAMILY_LETTERS: MBSLetterGrids = {
  firstLetterGrid: ['VWXYZ', 'QRSTU', 'LMNOP', 'FGHJK', 'ABCDE'],
  secondLetterGrid: ['VWXYZ', 'QRSTU', 'LMNOP', 'FGHJK', 'ABCDE'],
};

/** British Cassini, Cassini-Soldner on the OS Delamere origin, Airy 1830. Tile SW at projected (100 km, −300 km). */
export const BRITISH_CASSINI_SCHEME: MBSLetterScheme = {
  ...BRITISH_CASSINI_FAMILY_LETTERS,
  eOriginKm: 100,
  nOriginKm: -300,
};

/**
 * Irish Cassini, 1825 OSI Cassini-Soldner. Cassini origin 53°30'N, 8°W on
 * Airy 1830; false E/N = 200/250 km. Ireland fits inside a single 500 km
 * square labelled `i` (lowercase, theatre-specific). Other 24 first-letter
 * positions use `-` sentinel for "no cell here". Grid origin (0, 0).
 */
export const IRISH_CASSINI_SCHEME: MBSLetterScheme = {
  firstLetterGrid: ['i----', '-----', '-----', '-----', '-----'],
  secondLetterGrid: ['VWXYZ', 'QRSTU', 'LMNOP', 'FGHJK', 'ABCDE'],
  eOriginKm: 0,
  nOriginKm: 0,
};

/**
 * War Office Cassini Grid ("WOFO" / "Purple Grid"), Dunnose-origin
 * Cassini-Soldner on Airy 1830; false E/N 500 km W and 100 km S of Dunnose.
 * Letter arrangement shared with {@link BRITISH_CASSINI_FAMILY_LETTERS}.
 * Tile SW coincides with the WOFO false origin.
 */
export const WAR_OFFICE_CASSINI_SCHEME: MBSLetterScheme = {
  ...BRITISH_CASSINI_FAMILY_LETTERS,
  eOriginKm: 0,
  nOriginKm: 0,
};

/**
 * Letter grids for Scandinavian Zone 3.
 *
 *   First letter             Second letter
 *   north │ A B C D E         north │ Q R S T U
 *         │ F G H J K               │ V W X Y Z
 *         │ L M N O P               │ A B C D E
 *         │ Q R S T U               │ F G H J K
 *   south │ V W X Y Z         south │ L M N O P
 */
export const SCANDINAVIAN_ZONE_3_FAMILY_LETTERS: MBSLetterGrids = {
  firstLetterGrid: ['VWXYZ', 'QRSTU', 'LMNOP', 'FGHJK', 'ABCDE'],
  secondLetterGrid: ['LMNOP', 'FGHJK', 'ABCDE', 'VWXYZ', 'QRSTU'],
};

/** Scandinavian Zone 3, LCC, lat_1=55°, lat_2=60°, lat_0=57.5°, lon_0=20°, Bessel 1841. Tile SW at (0, 0). */
export const SCANDINAVIAN_ZONE_3_SCHEME: MBSLetterScheme = {
  ...SCANDINAVIAN_ZONE_3_FAMILY_LETTERS,
  eOriginKm: 0,
  nOriginKm: 0,
};

/**
 * Letter grids for Italian Northern.
 *
 *   First letter             Second letter
 *   north │ A B C D E         north │ L M N O P
 *         │ F G H J K               │ Q R S T U
 *         │ L M N O P               │ V W X Y Z
 *         │ Q R S T U               │ A B C D E
 *   south │ V W X Y Z         south │ F G H J K
 */
export const ITALIAN_NORTHERN_FAMILY_LETTERS: MBSLetterGrids = {
  firstLetterGrid: ['VWXYZ', 'QRSTU', 'LMNOP', 'FGHJK', 'ABCDE'],
  secondLetterGrid: ['FGHJK', 'ABCDE', 'VWXYZ', 'QRSTU', 'LMNOP'],
};

/** Italian Northern, LCC, lat_1=43°20', lat_2=48°30', lat_0=45°55', lon_0=14°, Bessel 1841. Tile SW at (0, 0). */
export const ITALIAN_NORTHERN_SCHEME: MBSLetterScheme = {
  ...ITALIAN_NORTHERN_FAMILY_LETTERS,
  eOriginKm: 0,
  nOriginKm: 0,
};

/** Italian Southern, LCC, lat_1=37°, lat_2=42°, lon_0=14°, Bessel 1841. Reuses {@link BRITISH_CASSINI_FAMILY_LETTERS}. Tile SW at (0, 0). */
export const ITALIAN_SOUTHERN_SCHEME: MBSLetterScheme = {
  ...BRITISH_CASSINI_FAMILY_LETTERS,
  eOriginKm: 0,
  nOriginKm: 0,
};

/** Iberian Peninsula, tangent LCC at lat_0=40°N on Hayford 1924, Madrid Royal Observatory meridian. Reuses {@link BRITISH_CASSINI_FAMILY_LETTERS}. Tile SW at (0, 0). */
export const IBERIAN_PENINSULA_SCHEME: MBSLetterScheme = {
  ...BRITISH_CASSINI_FAMILY_LETTERS,
  eOriginKm: 0,
  nOriginKm: 0,
};

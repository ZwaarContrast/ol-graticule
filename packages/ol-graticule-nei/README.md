# @zwaarcontrast/ol-graticule-nei

Netherlands East Indies WWII grids for
[`@zwaarcontrast/ol-graticule`](../ol-graticule), both on Bessel 1841 / Batavia
datum (EPSG:8452 shift to WGS84):

- **NEI Southern Zone** (`NEI:SOUTHERN_ZONE`): Java and the Lesser Sundas.
  Lambert Conformal Conic, one standard parallel, origin 8°S 110°E, k0 0.9997,
  false origin 550 000 m E / 400 000 m N. Not in EPSG.
- **NEI Equatorial Zone** (`EPSG:3001`, Batavia / NEIEZ): the rest of the
  archipelago. Mercator, lon_0 110°E, k0 0.997, false origin 3 900 000 m E /
  900 000 m N.

![NEI Southern and Equatorial Zone grids over the Indonesian archipelago, each clipped to its limits](https://github.com/ZwaarContrast/ol-graticule/raw/main/packages/ol-graticule-nei/images/preview.jpg)

**Live demo:** <https://zwaarcontrast.nl/ol-graticule/ol-graticule-nei/>

Zone parameters and limits: C. J. Mugnier, "Grids & Datums: Netherlands East
Indies", citing US Army Map Service "Notes on East Indies Maps" (1945). The
Southern Zone is checked against the Batavia Military Guide Map 1:20 000
(HIND/SEA/B/951, Dec 1945), whose 195 to 206 km E × 595 to 609 km N frame lands
on Jakarta.

Each zone is clipped to Mugnier's limits. The source leaves the Equatorial
Zone's western limit open, so it is closed at 94°E past Sumatra's coast; unlike
EPSG:3001's area of use, the Equatorial Zone here excludes Java, which the
Southern Zone covers.

The datum shift is EPSG:8452, "Batavia to WGS 84 (1)": three translations with
6 m accuracy, which EPSG defines only for Bali, Java and western Sumatra.
Both zones apply it throughout; outside that area its accuracy is unknown.

Early 1942 British DSvy Java sheets print the Southern Zone grid with
+3 000 000 m E and +1 000 000 m N; that variant is not registered.

## Usage

```ts
import { UniversalGraticule } from '@zwaarcontrast/ol-graticule';
import { createNEISouthernZoneGridSystem } from '@zwaarcontrast/ol-graticule-nei';

map.addLayer(
  new UniversalGraticule({ gridSystem: createNEISouthernZoneGridSystem() }),
);
```

Both factories take the `ProjectedGridSystem` options except `crs`, `proj4Def`
and `extent`, which the zone fixes. `NEI_GRIDS` holds every zone keyed by CRS (`crs`, `name`, `proj4`,
`validityWgs84`, `createGridSystem()`). The CRS codes, proj4 strings and WGS84
validity rings are also exported ol-free from `@zwaarcontrast/ol-graticule-nei/headless`.

# LICENSE status: TODO

This package is **not yet licensed for public distribution**.

The grid data and subdivision logic in `src/kriegsmarine/` are ported from
[cljs-navalgrid](https://github.com/Nylle/cljs-navalgrid) by Jan (GitHub
user [Nylle](https://github.com/Nylle)). The upstream project has no
`LICENSE` file and no declared license in its `package.json` or README,
which means under default copyright the code is "all rights reserved" and
cannot be redistributed.

Before publishing this package to npm:

1. Contact Jan (GitHub: Nylle) to request a permissive license (MIT/Apache-2.0)
   or written permission to redistribute the port.
2. Alternatively, re-derive the grid data (square IDs, corner coordinates,
   subdivision schemes, polygonal squares) from primary historical sources
   (original Kriegsmarine `Marinequadratkarte` charts and handbooks) so no
   code is derived from cljs-navalgrid.
3. Document the outcome here and replace this file with a proper `LICENSE`
   once the provenance is clean.

Until then: the package is functional for internal use but must not be
published to the public npm registry or linked from the other published
packages in this monorepo.

## Third-party notices (already settled)

Regardless of how the cljs-navalgrid provenance question above resolves,
the following third-party code is already under a permissive licence and
its attribution must be carried into the final `LICENSE` / `NOTICE` when
this package is eventually published.

### Shortest-longitude-difference — Chris Veness (MIT)

`src/kriegsmarine/latlon.ts` contains a `smallestLonDiff` helper
(antimeridian-aware shortest longitude difference, used by the Kriegsmarine
subdivision shift math) adapted from:

> Chris Veness, "Latitude/Longitude spherical geodesy formulae"
> <https://www.movable-type.co.uk/scripts/latlong.html>
> © 2002-2022 Chris Veness

Licence: [MIT](https://opensource.org/licenses/MIT).
Upstream requirement: retain the copyright notice and a link to the
source page above. This is done in the file header of
`src/kriegsmarine/latlon.ts` and must stay there in all distributed
builds (including `dist/`).

The isometric-latitude, Mercator-compensated rhumb-distance, and
per-latitude compensation formulae previously adapted from the same
Veness page were removed in a subsequent cleanup (they were unused
outside tests), so only `smallestLonDiff` remains under this attribution.

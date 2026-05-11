# LICENSE status: permission granted, upstream license question open

The grid data and subdivision logic in `src/kriegsmarine/` are ported from
[cljs-navalgrid](https://github.com/Nylle/cljs-navalgrid) by Jan Kockrow
(GitHub user [Nylle](https://github.com/Nylle)). Jan's upstream project
has no `LICENSE` file at the time of writing.

## Permission grant (2026-05-11)

Jan replied to a permission request by email on 2026-05-11 and gave
explicit consent for this package to use his data. He asked for citation
in `src/kriegsmarine/data.ts`; that citation is in place at the top of
the file.

## Open question

Whether Jan intends to attach an explicit license to cljs-navalgrid
itself is still open. Until that question resolves, the package remains
`"private": true` in its `package.json`, sits in the changesets `ignore`
list, and is listed as not-yet-published in the root README.

## Third-party notices (already settled)

Regardless of how the cljs-navalgrid provenance question above resolves,
the following third-party code is already under a permissive licence and
its attribution must be carried into the final `LICENSE` / `NOTICE` when
this package is eventually published.

### Shortest-longitude-difference, Chris Veness (MIT)

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

---
'@zwaarcontrast/ol-graticule-projected': minor
---

Add `createProjectedGridSystemFromEPSG(code, options)`: a projected grid for
any EPSG code, fetched at runtime. The proj4 definition comes from epsg.io
(datum shifts included) and the EPSG area of use from spatialreference.org;
the grid is clipped to that area. Lookups are cached per code for the session,
and a code already registered with proj4 is not fetched again. A `+nadgrids`
shift becomes `+nadgrids=@grid,@null`, so it applies once `loadNadgrid` has
loaded the grid and falls back to no shift until then. `sources` overrides
where definitions and areas of use are fetched from.

`lookupEPSG(code)` returns the spatialreference.org record for a code, through
the same cache: name, type, area of use in words and as a box, scope, and the
axes with their units. A CRS that lists several usages reports the first, so
its grid is clipped too. A code neither service knows rejects with
`Unknown EPSG code: <code>`.

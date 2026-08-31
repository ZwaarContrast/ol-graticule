---
"@zwaarcontrast/ol-graticule-mgrs": minor
"@zwaarcontrast/ol-graticule-modified-british-system": minor
"@zwaarcontrast/ol-graticule-projected": minor
"@zwaarcontrast/ol-graticule-rd": minor
---

Raise the `proj4` peer range from `^2.9.0` to `^2.12.0`, matching the `^2.12.0`
that `ol-graticule-heeresgitter` already declares.

proj4 keeps its CRS registry in module-level state, so a consumer combining
heeresgitter (which depends on proj4 directly) with these packages could resolve
two proj4 copies when the ranges did not overlap, leaving definitions registered
through one copy invisible to the other. A single range across the monorepo
dedupes to one instance.

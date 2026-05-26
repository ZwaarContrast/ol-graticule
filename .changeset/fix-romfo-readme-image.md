---
"@zwaarcontrast/ol-graticule-heeresgitter": patch
---

Fix broken Romfo image on the npm package page. The Geographic HMN
section of the README used a relative path (`images/romfo-geogr-hmn.jpg`)
which works on GitHub but not on npm's package page (npm doesn't resolve
relative links to the source repo). Switched to the same absolute
`https://github.com/ZwaarContrast/ol-graticule/raw/main/...` URL pattern
the rest of the README's images use.

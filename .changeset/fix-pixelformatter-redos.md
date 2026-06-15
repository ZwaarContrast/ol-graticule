---
"@zwaarcontrast/ol-graticule": patch
---

fix: remove redundant unanchored `\s*` from PixelFormatter pixel-suffix strip, eliminating a polynomial-ReDoS backtracking path (no behavior change)

---
"@zwaarcontrast/ol-graticule": patch
---

Relax the adaptive densification tolerance from 0.25 px to 0.5 px. Grid lines
are densified until they sit within this distance of the true projected curve,
so this halves the vertex count on curved lines at the cost of up to half a
pixel of deviation. Pass a smaller `maxDevPx` to `adaptiveAxisTs` to restore the
previous fidelity.

`LruCache.get` also skips MRU promotion while the cache is below capacity, where
nothing can be evicted yet.

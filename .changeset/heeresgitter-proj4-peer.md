---
"@zwaarcontrast/ol-graticule-heeresgitter": major
---

**Breaking:** `proj4` moves from `dependencies` to `peerDependencies`, matching
every other package in the monorepo. Install it alongside this package:

```bash
npm install @zwaarcontrast/ol-graticule-heeresgitter proj4
```

proj4 keeps its CRS registry in module-level state. This package registers its
Gauß-Krüger strip definitions through `registerCRS` from
`@zwaarcontrast/ol-graticule-projected` (a peer, so it uses the caller's proj4),
then projects through its own `proj4` import. As a plain dependency those two
could resolve to separate copies, leaving the strip definition registered on one
instance and looked up on the other, so the transform failed. A peer guarantees
one shared instance.

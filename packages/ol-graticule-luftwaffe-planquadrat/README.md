# @zwaarcontrast/ol-graticule-luftwaffe-planquadrat

WWII Luftwaffe **Planquadrat** map reference grids for
[`@zwaarcontrast/ol-graticule`](../ol-graticule).

Renders both Luftwaffe grid systems used during the Second World War:

- **Gradnetzmeldeverfahren (GNMV)**, also called *Gradnetz* or "grid network",
  in use from before the war until April 1943 and (in a refined form) for
  the rest of the war. Six hierarchical levels from the 10° **Zusatzzahlgebiet**
  down to the ~1 km **Arbeitstrapez** (post-1943; pre-1943 ≈ 2.3 km).
- **Jägermeldenetz (JMN)**, the fighter reporting network introduced on
  1 May 1943 to support the air defence of the Reich. Replaces the GNMV's
  1° Großtrapez with a 5°×10° Jagdtrapez (Nord/Süd halves) and a 20×20
  letter-pair Mitteltrapez (AA..UU, no I); shares Kleintrapez, Meldetrapez,
  and Arbeitstrapez with the post-1943 GNMV.

> **Cross-service:** the Heer used the metric
> [Deutsches Heeresgitter](../ol-graticule-heeresgitter) (Gauß-Krüger),
> often printed alongside GNMV on shared sheets. The Kriegsmarine used
> the unrelated [Marinequadratkarte](../ol-graticule-marinequadratkarte).

![Luftwaffe GNMV ZZG cells (05 Ost, 15 Ost, 25 Ost) over northern Europe](https://github.com/ZwaarContrast/ol-graticule/raw/main/packages/ol-graticule-luftwaffe-planquadrat/images/preview.jpg)

**Live demo:** <https://zwaarcontrast.nl/ol-graticule/ol-graticule-luftwaffe-planquadrat/>

## Install

```bash
npm install @zwaarcontrast/ol-graticule @zwaarcontrast/ol-graticule-luftwaffe-planquadrat ol
```

Peers: `ol ^10`, `@zwaarcontrast/ol-graticule`. **No proj4 dependency** -
all transforms go through OL's built-in 4326 ↔ view-projection conversion.

## Usage

```ts
import { UniversalGraticule } from '@zwaarcontrast/ol-graticule';
import { LuftwaffeGridSystem } from '@zwaarcontrast/ol-graticule-luftwaffe-planquadrat';

const gridSystem = new LuftwaffeGridSystem({ system: 'gnmv' });
map.addLayer(new UniversalGraticule({ gridSystem }));
```

The grid draws cell-centered codes (not edge-axis labels) and progressively
subdivides as you zoom in.

### Options

| Option | Type | Default | What it does |
|---|---|---|---|
| `system` | `'gnmv'` \| `'jmn'` | `'gnmv'` | Which Luftwaffe grid to render. |
| `era` | `'pre-1943'` \| `'post-1943'` | `'post-1943'` | GNMV only. `pre-1943` uses the 4-cell Meldetrapez and `lo`/`ro`/`lu`/`ru` Arbeitstrapez labels. JMN ignores this option (JMN only existed in its post-1943 form). |
| `maxDepth` | `0`-`5` | `5` | How deep to go: 0 = ZZG only, 5 = full Arbeitstrapez. |
| `minCellPx` | `number` | `40` | A level becomes the deepest visible only once its cells are at least this big in pixels. |
| `minLabelPx` | `number` | `40` | Labels for cells smaller than this aren't drawn. |
| `densificationPoints` | `number` | `50` | Vertices per line for non-affine view projections (e.g. Web Mercator at high latitude). |

## Levels and reference format

| Level | Size | GNMV token | JMN token |
|---|---|---|---|
| Zusatzzahlgebiet (ZZG) | 10° × 10° | 2-3 digits + `O`/`W`/`SO`/`SW` | same |
| Großtrapez | 1° × 1° | 2 digits | (does not exist; replaced by Jagdtrapez + letter MT) |
| Jagdtrapez | 5° × 10° | (does not exist) | `N` or `S` |
| Mitteltrapez | 15' × 30' | 1 digit (1-8, 4×2 layout) | 2 letters AA..UU (no I) |
| Kleintrapez | 5' × 10' | 1 digit (1-9) | same |
| Meldetrapez | 1'40" × 3'20" (post-1943) <br> 2'30" × 5' (pre-1943) | 1 digit (1-9 or 1-4) | 1 digit (1-9) |
| Arbeitstrapez | 33.33" × 1'06.67" (post-1943) <br> 1'15" × 2'30" (pre-1943) | `a`-`i` or `lo`/`ro`/`lu`/`ru` | `a`-`i` |

### Worked examples

Berlin Reichstag (52.518720° N, 13.376257° E) under post-1943 GNMV:

```
15   Ost   33   3   9   7    c
ZZG  hemi  GT   MT  KT  MelT AT
```

ZZG `15` (lon ten-count `1` + lat ten-count `5` for the 10°×10° box at
NW corner 59° N, 10° E), Ost (E hemisphere, N hemisphere); Großtrapez `33`
(NW corner 53° N, 13° E); Mitteltrapez `3`; Kleintrapez `9`; Meldetrapez
`7`; Arbeitstrapez `c`.

Köln-Butzweilerhof (50°59'28" N, 6°53'42" E) under JMN:

```
05   Ost   S    NO   3   2     a
ZZG  hemi  JTr  LMT  KT  MelT  AT
```

ZZG `05`, Ost; Jagdtrapez `Süd` (south half of the 49°-59° N band);
Mitteltrapez `NO` (row N, col O of the 20×20 letter grid inside the
5°×10° Süd half); KT `3`, MelT `2`, AT `a`.

### Looking up a grid reference for a coordinate

```ts
import {
  encodeGnmv,
  encodeJmn,
} from '@zwaarcontrast/ol-graticule-luftwaffe-planquadrat';

encodeGnmv([52.518720, 13.376257]);              // -> "15O33397c"
encodeGnmv([52.518720, 13.376257], 'pre-1943');  // -> "15O33393ru" (depth 5)
encodeGnmv([52.518720, 13.376257], 'post-1943', 1); // -> "15O33"  (cap depth)

encodeJmn([50.991111, 6.895]);                   // -> "05OSNO32a"
```

Input order is `[latitude, longitude]`. Returns `undefined` for points
above 89° N.

### Reverse: parse a reference back to a coordinate

```ts
import {
  parseRef,
  LuftwaffeGridSystem,
} from '@zwaarcontrast/ol-graticule-luftwaffe-planquadrat';
import { ParseError } from '@zwaarcontrast/ol-graticule';

parseRef('15 Ost 33 3 9 7 c');
//   -> { system: 'gnmv',
//        decoded: { canonical: '15O33397c', formatted: '15 Ost 33 3 9 7 c',
//                   bbox: [13.370370..., 52.518519..., 13.388889..., 52.527778...],
//                   center: [52.523148..., 13.379630...],
//                   depth: 5 } }

parseRef('05 Ost S NO 3 2 a');
//   -> { system: 'jmn',
//        decoded: { canonical: '05OSNO32a', ..., depth: 5 } }

// Or, via the GridSystem (returns view-projection coords for the cell centre):
const grid = new LuftwaffeGridSystem({ system: 'jmn' });
try {
  const center = grid.parseCoordinate('05OSNO32a', map.getView().getProjection());
  map.getView().animate({ center });
} catch (err) {
  if (err instanceof ParseError) console.warn(err.reason);
}
```

`parseRef` auto-detects the system (JMN is preferred when both grammars
accept the input). Lenient input: case-insensitive, whitespace and `/`
separators ignored, umlauts (`Süd`/`Sud`/`Sued`) all accepted, full words
(`Ost`/`Süd`) and abbreviations (`O`/`SO`) both work.

## Primary-source validation

The encoding is cross-checked against four wartime primary sources:
a NARA Luftwaffe *Abschussmeldung* (`HJ 26` near Katwijk), the
*Generalstab der Luftwaffe* *Weltkarte K-34 Sofia* (1942), the
*Deutsche Heereskarte* sheet *I 35 NW Kreta* with its explicit
*"Zusatzzahl 23 ost"* annotation, and a Bundesarchiv RL 12/143 GNMV
planning plate. See [VALIDATION.md](./VALIDATION.md) for the worked
cross-checks at each level.

## Credits and attribution

Reconstructing how a long-disused military reference system actually
worked is patient archival research. This package's encoding and
decoding rules are entirely derived from the work of others:

- **Ron Birch** and the *Halifax JB837* researchers at
  [prwg.co.uk](https://www.prwg.co.uk/Halifax_JB837/Luftwaffe_Map_Reference.asp)
  have the most thorough public write-up of the GNMV and JMN levels,
  including the pre/post-1943 distinction and the worked Reichstag
  example used as a reference test in this package.
- The Aircrew Remembered article
  [*Luftwaffe Grid Reference System for Action Locations*](https://aircrewremembered.com/luftwaffe-grid-reference-system.html)
  documents the Köln-Butzweilerhof worked example used as the JMN
  reference test, and credits the (now defunct)
  <http://www.stormbirds.com> site for the original write-up.
- Both pages cite earlier work by **Andreas Brekken**, an archived
  edition of *Flugzeug* magazine, and the <https://www.gykes.dk> site.

If you publish work that uses this package, please cite the prwg.co.uk
and aircrewremembered.com pages alongside this implementation.

## License

MIT. See [LICENSE](./LICENSE).

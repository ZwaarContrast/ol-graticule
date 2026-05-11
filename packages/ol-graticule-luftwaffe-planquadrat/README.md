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

> **Note:** GNMV was the geographic grid used primarily by the
> Luftwaffe. The Heer (army) had its own metric system, the
> *Deutsches Heeresgitter* (a Gauß-Krüger kilometre grid), but printed
> GNMV labels alongside it on cross-service sheets, e.g.
> *Heereskarte I 35 NW Kreta* (1942) carries the explicit margin note
> *"Zusatzzahl 23 ost"*. The Kriegsmarine's *Marinequadratkarte* is a
> fundamentally different lettered system, not interoperable with
> GNMV; for that, see
> [`@zwaarcontrast/ol-graticule-marinequadratkarte`](../ol-graticule-marinequadratkarte).

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

Four independent wartime documents cross-check different levels of the
encoding implemented here.

**JMN, all six levels**: a Luftwaffe action report at the US National
Archives ([NARA catalog 131506123](https://catalog.archives.gov/id/131506123?objectPage=3))
locates an event "**5 km nordw. Katwijk, HJ 26**". Decoding
`05 Ost S HJ 26` under JMN with this package places the cell in the
North Sea immediately north-west of Katwijk aan Zee on the Dutch coast,
matching the prose description. That single reference exercises the
ZZG identity (`05 Ost`: lat ten-count 5, lon ten-count 0, NW corner
59°N/0°E), the post-1943 Jagdtrapez split (`S` = 49°-54°N inside `05 Ost`),
the 20×20 letter-pair Mitteltrapez with `I` omitted (`H` = row index 7,
`J` = col index 8), and the Kleintrapez / Meldetrapez subdivision all at
once.

![NARA Abschussmeldung naming "HJ 26" near Katwijk](https://github.com/ZwaarContrast/ol-graticule/raw/main/packages/ol-graticule-luftwaffe-planquadrat/images/NARA-abschussmeldung.jpg)

**GNMV, ZZG + Großtrapez + Mitteltrapez**: the *Generalstab der
Luftwaffe*'s 1942 *Weltkarte 1:1 000 000*, sheet K-34 *Sofia* (the
German military edition of the Internationale Weltkarte), prints the
GNMV Großtrapez grid across the southern Adriatic, Albania, and the
western Balkans. The printed cell digits match this package's rendering
across the boundary between ZZG `14 Ost` (lon 10°-20°E) and ZZG
`24 Ost` (lon 20°-30°E), confirming the Großtrapez digit ordering
(lon-ones followed by lat-ones within the parent ZZG); inside the GT
`91` cell around Valona / Vlorë the sheet also carries the MT `5`
overprint, locating it in the 15' × 30' Mitteltrapez with NW corner at
40°30'N / 19°00'E. Available at
[mapywig.org](http://maps.mapywig.org/m/German_maps/series/M1_WK/Weltkarte@M1@K_34@Sofia@Generalstab_der_Luftwaffe@1942@univparis8id27819.jpg)
and on
[Wikimedia Commons](https://upload.wikimedia.org/wikipedia/commons/1/1c/1942_German_military_map_-_Internationale_Weltkarte_-_Sofia.jpg).

![Generalstab der Luftwaffe Weltkarte K-34 Sofia (1942)](https://github.com/ZwaarContrast/ol-graticule/raw/main/packages/ol-graticule-luftwaffe-planquadrat/images/mapywig-weltkarte-sofia.jpg)

**GNMV, explicit ZZG label + Großtrapez**: the *Deutsche Heereskarte*
sheet **I 35 NW Kreta** (1:500 000, *Fliegerausgabe Europa*, OKH /
Gen.St.d.H., 1942) carries the explicit marginal annotation
"**Zusatzzahl 23 ost**" and prints GT digits `36` / `46` / `56` / `66`
/ `76` across Crete's middle latitude band, exactly the cells this
package renders for ZZG `23 Ost` (NW corner 39°N / 20°E, covering
29°-39°N and 20°-30°E). Available on
[Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Deutsche_Heereskarte_-_Blatt-Nr._I_35_NW_KRETA.jpg).

![Deutsche Heereskarte I 35 NW Kreta, "Zusatzzahl 23 ost"](https://github.com/ZwaarContrast/ol-graticule/raw/main/packages/ol-graticule-luftwaffe-planquadrat/images/WikimediaCommons-heereskarte-kreta.jpg)

**GNMV, ZZG roll-over + Großtrapez + Mitteltrapez**: a Luftwaffe
planning plate held by the German Federal Archives
([Bundesarchiv RL 12/143](https://invenio.bundesarchiv.de/invenio/direktlink/04b51708-8125-45b6-b18d-adf52ab30ebd/))
prints the full GNMV layout across Northern Germany and the Baltic.
The red GT digits run `93` / `94` / `95` along lon 9°-10°E and then
flip to `03` / `04` / `05` at lon 10°-11°E, the exact ZZG `05 Ost`
→ `15 Ost` boundary this package places at lon=10°E. Each GT cell
carries the 4 × 2 Mitteltrapez subdivision (`1`-`8`) printed in
miniature, and the sheet's *Unterteilung* legend explains the
subdivision scheme used at the deeper levels.

![Bundesarchiv RL 12/143 plate showing the full GNMV layout for Northern Germany and the Baltic](https://github.com/ZwaarContrast/ol-graticule/raw/main/packages/ol-graticule-luftwaffe-planquadrat/images/Bundesarchiv-gradnetz-meldeverfahren.jpg)

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

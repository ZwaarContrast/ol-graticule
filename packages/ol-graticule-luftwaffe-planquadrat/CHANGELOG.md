# @zwaarcontrast/ol-graticule-luftwaffe-planquadrat

## 2.1.3

## 2.1.2

### Patch Changes

- 7feec96: Docs: every package now ships with a 1200 × 675 preview image at the
  top of its README (and as `og:image` / `twitter:image` on its demo page,
  so npm and Twitter / Open Graph cards render a proper visual). Image
  URLs are absolute GitHub raw URLs so they resolve on npmjs.com.

## 2.1.1

### Patch Changes

- 0c94209: First public release of `@zwaarcontrast/ol-graticule-luftwaffe-planquadrat`:
  WWII Luftwaffe Planquadrat reference grids for the `UniversalGraticule`.

  Two grid systems:
  - **Gradnetzmeldeverfahren (GNMV)**, the Luftwaffe's hierarchical
    geographic grid. Six levels from the 10° Zusatzzahlgebiet (ZZG) down
    to the ~33" Arbeitstrapez, with selectable `pre-1943` (2×2 MelT and
    AT) and `post-1943` (3×3 MelT and AT) era.
  - **Jägermeldenetz (JMN)**, the fighter reporting network introduced
    on 1 May 1943. Replaces the GNMV Großtrapez with a 5°×10° Jagdtrapez
    (Nord / Süd halves) and a 20×20 letter-pair Mitteltrapez (AA..UU,
    with `I` omitted). Shares Kleintrapez, Meldetrapez, and Arbeitstrapez
    with the post-1943 GNMV.

  Public API: `LuftwaffeGridSystem` (renders both systems, progressively
  subdividing on zoom), `encodeGnmv([lat, lon], era?, depth?)`,
  `encodeJmn([lat, lon], depth?)`, `parseRef(text, era?)` for round-trip
  parsing back to a cell bbox plus centre, and the supporting types
  `LuftwaffeSystem`, `LuftwaffeEra`, `DecodedRef`, `GeoBox`, `LatLon`,
  `ParseResult`. Lenient input: case-insensitive, whitespace and `/`
  ignored, umlauts (`Süd` / `Sud` / `Sued`) and abbreviations (`O` / `SO`)
  all accepted. Auto-detects GNMV vs JMN when both grammars accept the
  input.

  No proj4 dependency; all transforms go through OL's built-in 4326
  conversion. Peers on `ol ^10` and `@zwaarcontrast/ol-graticule ^2`.

  Reference rules sourced from prwg.co.uk's Halifax JB837 page
  (Ron Birch) and aircrewremembered.com's "Luftwaffe Grid Reference
  System" article. Primary-source validation across NARA Abschussmeldung
  references near Katwijk (JMN, all six levels), Generalstab der
  Luftwaffe _Weltkarte K-34 Sofia_ (1942), Deutsche Heereskarte
  _I 35 NW Kreta_ (1942), and Bundesarchiv RL 12/143. See the package
  README for the worked examples and citation details.

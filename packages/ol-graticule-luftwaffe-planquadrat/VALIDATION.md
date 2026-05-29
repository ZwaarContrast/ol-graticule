# Primary-source validation

Four independent wartime documents cross-check different levels of the
encoding implemented here.

## JMN, all six levels: NARA Abschussmeldung near Katwijk

A Luftwaffe action report at the US National Archives
([NARA catalog 131506123](https://catalog.archives.gov/id/131506123?objectPage=3))
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

## GNMV, ZZG + Großtrapez + Mitteltrapez: Weltkarte K-34 Sofia (1942)

The *Generalstab der Luftwaffe*'s 1942 *Weltkarte 1:1 000 000*, sheet
K-34 *Sofia* (the German military edition of the Internationale
Weltkarte), prints the GNMV Großtrapez grid across the southern
Adriatic, Albania, and the western Balkans. The printed cell digits
match this package's rendering across the boundary between ZZG
`14 Ost` (lon 10°-20°E) and ZZG `24 Ost` (lon 20°-30°E), confirming the
Großtrapez digit ordering (lon-ones followed by lat-ones within the
parent ZZG); inside the GT `91` cell around Valona / Vlorë the sheet
also carries the MT `5` overprint, locating it in the 15' × 30'
Mitteltrapez with NW corner at 40°30'N / 19°00'E. Available at
[mapywig.org](http://maps.mapywig.org/m/German_maps/series/M1_WK/Weltkarte@M1@K_34@Sofia@Generalstab_der_Luftwaffe@1942@univparis8id27819.jpg)
and on
[Wikimedia Commons](https://upload.wikimedia.org/wikipedia/commons/1/1c/1942_German_military_map_-_Internationale_Weltkarte_-_Sofia.jpg).

![Generalstab der Luftwaffe Weltkarte K-34 Sofia (1942)](https://github.com/ZwaarContrast/ol-graticule/raw/main/packages/ol-graticule-luftwaffe-planquadrat/images/mapywig-weltkarte-sofia.jpg)

## GNMV, explicit ZZG label + Großtrapez: Heereskarte I 35 NW Kreta

The *Deutsche Heereskarte* sheet **I 35 NW Kreta** (1:500 000,
*Fliegerausgabe Europa*, OKH / Gen.St.d.H., 1942) carries the explicit
marginal annotation "**Zusatzzahl 23 ost**" and prints GT digits `36` /
`46` / `56` / `66` / `76` across Crete's middle latitude band, exactly
the cells this package renders for ZZG `23 Ost` (NW corner 39°N / 20°E,
covering 29°-39°N and 20°-30°E). Available on
[Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Deutsche_Heereskarte_-_Blatt-Nr._I_35_NW_KRETA.jpg).

![Deutsche Heereskarte I 35 NW Kreta, "Zusatzzahl 23 ost"](https://github.com/ZwaarContrast/ol-graticule/raw/main/packages/ol-graticule-luftwaffe-planquadrat/images/WikimediaCommons-heereskarte-kreta.jpg)

## GNMV, ZZG roll-over + Großtrapez + Mitteltrapez: Bundesarchiv RL 12/143

A Luftwaffe planning plate held by the German Federal Archives
([Bundesarchiv RL 12/143](https://invenio.bundesarchiv.de/invenio/direktlink/04b51708-8125-45b6-b18d-adf52ab30ebd/))
prints the full GNMV layout across Northern Germany and the Baltic.
The red GT digits run `93` / `94` / `95` along lon 9°-10°E and then
flip to `03` / `04` / `05` at lon 10°-11°E, the exact ZZG `05 Ost`
→ `15 Ost` boundary this package places at lon=10°E. Each GT cell
carries the 4 × 2 Mitteltrapez subdivision (`1`-`8`) printed in
miniature, and the sheet's *Unterteilung* legend explains the
subdivision scheme used at the deeper levels.

![Bundesarchiv RL 12/143 plate showing the full GNMV layout for Northern Germany and the Baltic](https://github.com/ZwaarContrast/ol-graticule/raw/main/packages/ol-graticule-luftwaffe-planquadrat/images/Bundesarchiv-gradnetz-meldeverfahren.jpg)

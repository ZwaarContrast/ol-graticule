---
'@zwaarcontrast/ol-graticule-heeresgitter': patch
---

Document that the default Potsdam datum shift is only right for sheets drawn
from German survey: German sheets of other countries carry the local survey's
datum (a Finnish sheet is about 445 m off with the Potsdam shift). Also
documents `setDhgDatumShift`, the ellipsoid limit of a substituted
`datumShift`, and the rotation convention `DatumShift` expects.

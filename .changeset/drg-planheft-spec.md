---
'@zwaarcontrast/ol-graticule-heeresgitter': minor
---

Anchor the DRG (3° Reichsgitter) specification to the Planheft. Its _Das Deutsche Reichsgitter_ section (Planheft Schweiz OKH g 23/1 p. C 3, same text in Planheft Osteuropa Merkblatt 34/31b) states every projection parameter the package already used, so the DRG now rests on two independent sources rather than on sheet 5503 Elsenborn alone. The Planheft also tabulates exactly five strips, central meridians 3° to 15°E against Kennziffern 1-5, in the Osteuropa edition too, so `DRG_PUBLISHED_KENNZIFFERN` and `isPublishedDrgKennziffer()` are exported to separate a strip the sources attest from one the formula merely admits. The 10' strip overlap is now marked as the one unsourced DRG constant, with the Planheft passage that appears to contradict it recorded beside it.

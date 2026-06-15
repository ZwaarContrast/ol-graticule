---
"@zwaarcontrast/ol-graticule-modified-british-system": patch
---

fix: remove `\s*` that overlapped `[\d\s]*` in the MBS compound-reference pattern, eliminating a polynomial-ReDoS backtracking path (no behavior change)

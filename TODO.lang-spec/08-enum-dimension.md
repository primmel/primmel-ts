# 08 — The dimension declares its enum

**Status: RESOLVED (2026-10-27) — `enum` stays, by the corpus's own evidence.**
No realized model declares a standalone enum, but the mechanism the
item's rule asks for already exists: the classification dimension
references the value-set primitive (`enumRef`, the C3 resolution leg —
check.ts's enumDef lookup), so a dimension's values MAY be a declared
enum's. `enum` is the value-set primitive and the dimension references
it; Annex D gains nothing.

## The gap
`enum` (member fields) and the classification `dimension` values are two
closed-value-set mechanisms.

## The resolution
The dimension's values ARE the enum (the dimension declares the value set; the
applicability entries cite it). The standalone `enum` either becomes the
dimension's value registry or retires to Annex D. The corpus decides: if a
non-dimension enum exists in the models, `enum` stays as the value-set
primitive and the dimension references it.

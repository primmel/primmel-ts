# 16 — Model/value transforms as language artifacts

**Status: RESOLVED BY DECLARED ARTIFACTS (2026-10-28) — three
transform planes are in-language; the automap's working state stays
ephemeral BY DESIGN.** Model→model: `maps_to { … }` on the
product_reference manifest (aspect-by-aspect, the doctrine ch. 15
mapping — validated, coverage-computed). Template→flavor: module-slot
overlays (spec#28). Class→wire: `mapping <fmt> <class>` (v3.2,
TODO.lang-gaps/09). All three are reviewable, versioned, re-runnable
from source. What does NOT become language: the Studio automap's
in-flight state (scores, candidate pairs, rejections) — the recorded
design decision stands ("mapping rejections live in their own stores —
never the AST, never serialized"): working state is runtime evidence,
not source; the ACCEPTED result is the declared artifact. Value
transforms slot into the datum conversions (04) when that wave lands.**

**LML (model-transform).** Declared transforms between source and
target models (model transform) and over values (value transform).

**Primmel today.** The Studio HAS the transform plane — the Model
Mapper: automap, map-diff, edition-crossed profiles, transitive
adoption — but it is EPHEMERAL: "mapping rejections live in their own
stores — never the AST, never serialized." No mapping artifact exists
in the language; a mapping cannot be reviewed, versioned, or re-run
deterministically from source.

**Fix shape.** The mapping becomes a declared ARTIFACT (a .primmel
map file): source/target packages, the accepted pairs (with the
automap's evidence — scores, rejections), value transforms for the
datum conversions. The Studio's mapper then OPENS/SAVES artifacts
instead of holding ephemeral state; the kernel validates coverage of
the mapping (mapping-coverage already exists kernel-side). LML's
value transforms slot into the datum conversions (04).

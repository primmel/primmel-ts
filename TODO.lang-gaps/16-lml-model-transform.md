# 16 — Model/value transforms as language artifacts

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

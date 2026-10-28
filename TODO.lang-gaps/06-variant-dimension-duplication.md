# 06 — Variants vs dimensions: the classification said twice

**Status (2026-10-28): RESOLVED (1.21.43).** The subject-level
`variant` facet is a parse error naming this file; dimension values
carry the typed `ref` (derives-from folds onto the value's
provenance). The corpus folded all 6 packages' variants into
dimensions: r60/r129/r144 enriched the carrying dimension's values
(definition, note, URN); r138 prepended the kind definitions to the
MPE descriptions; r91's `subject MovingSpeedMeter` structure edge
became `subject SpeedMeter` + `applicability { mode_of_use: [moving] }`
(the corpus's own doctrine: categories are dimensions, not
subclasses); r49 declared the missing `measuring_principle` dimension.
r60-lml's coverage.json dropped the 8 stale variant-pair
adjudications (C73). The calculation `variant` (C125 formula variants)
is a DIFFERENT construct and stays.

**Gap.** r60's instrument.prl declares FOUR variants
(analogue-passive/analogue-active/digital/digital-with-processing, 3.1.3.x)
AND a `technology` dimension whose FOUR typed values carry the same
descriptions. The same fact modeled twice — they will drift.

**Fix shape.** The dimension is the truth; a variant is a named
COMBINATION of dimension values (or, for single-dimension cases, an
alias onto one value). The variant list derives; it is not declared.

**Verify.** model/instrument.prl variants block vs the technology
dimension's values block — dedupe by keyed identity on value ids.

# 06 — Variants vs dimensions: the classification said twice

**Gap.** r60's instrument.prl declares FOUR variants
(analogue-passive/analogue-active/digital/digital-with-processing, 3.1.3.x)
AND a `technology` dimension whose FOUR typed values carry the same
descriptions. The same fact modeled twice — they will drift.

**Fix shape.** The dimension is the truth; a variant is a named
COMBINATION of dimension values (or, for single-dimension cases, an
alias onto one value). The variant list derives; it is not declared.

**Verify.** model/instrument.prl variants block vs the technology
dimension's values block — dedupe by keyed identity on value ids.

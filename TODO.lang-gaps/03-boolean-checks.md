# 03 — The boolean-verdict consolidation → `check`

**Status (2026-10-28): PRIMITIVE LANDED; SURFACE FOLD QUEUED.** The
`check` construct exists (kernel parser + spec C160/C161); the corpus
still spells the verdict five ways (208 pass_fail, 576
acceptance_criteria, 217 limit blocks, 475 pass_if, 9
validate_measurement). The spec C161 fold (canonical serializer) is
not yet implemented.

**Gap.** "Evaluate an expression and compare" is spelled five ways:
requirement `limit { expression "ocl{…}" }`, `acceptance_criteria`
(type/operator/threshold triple), process
`validate_measurement "every([within_mpe]) = true"` (string), form
`pass_fail { pass_if "ocl{…}" }`, and `specification/constraints.prl`.
A learner must know four chances of being wrong per concept.

**Fix shape.** One `check` primitive: expression + operator + threshold
(+ provenance urn), returning boolean; the five spellings become
surface syntax over it. Numeric evaluations stay `calculation`. The
acceptance-criteria triple is sugar over a check with a declared
threshold expression.

**Consistency requirement.** Every check's names resolve to declared
datums (see 04) — no undeclared identifiers, no prose constants (02).

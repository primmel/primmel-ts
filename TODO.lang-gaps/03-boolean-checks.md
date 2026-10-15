# 03 — The boolean-verdict consolidation → `check`

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

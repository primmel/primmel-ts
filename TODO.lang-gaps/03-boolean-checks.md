# 03 — The boolean-verdict consolidation → `check`

**Status (2026-10-29): RESOLVED (1.21.48–1.21.52).** Wave 03, five
PRs: PR 1 (#240, 1.21.48) — the parse-side fold: every retired
spelling materializes a canonical `check` into `standard.checks`
(fold module `ser-des/config/check-fold.ts`, ids
`<owner-kind>:<owner-id>:<facet-slot>`, `Check.folds` provenance,
byte-identical serialization, C161 = the fold-completeness walk, the
misnamed datum leg re-homed to C189). PRs 2–4 (#241 + 1.21.49,
#242 + 1.21.50, #243 + 1.21.51) — the corpus migrations: `pass_fail`
and `pass_if` (683 sites), `validate_measurement` (9 sites, the
bracket-aggregate idiom carried VERBATIM — it is not OCL), and the
`acceptance_criteria` block in both carriers (the typed test block
and the requirement's raw block; threshold verdicts declare
`expression` + `operator`, judgment blocks the quarantined
description) — each spelling refusing at parse naming the canonical
check; the retrieval export assembles the acceptance facet from the
owner's checks with the `retrieval-facet/2` keys unmoved.
**PR 5 — the limit disposition: the requirement `limit` block STAYS.**
The census (216 blocks / 53 files): 29 carry `args { }` (the named
lambda bindings of the predicate's expression), 19 carry the typed
`accepts { verdict op limit }` triple, 0 carry `when`. The limit is
the requirement's STRUCTURED PREDICATE carrier — the same class as
`constraint { check … }` — not a boolean spelling; its verdict triple
is typed data (first-class since the structured-acceptance wave,
read by the retrieval projection), never a string form. Nothing
retires; no parse refusal; the C161 fold's `limit:<n>` slot covers
any limit verdict triple an author declares as a check beside the
predicate. The corpus is untouched (no library bump).

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

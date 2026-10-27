# 06 — The assertion triad: check, invariant, constraint

**Status: RESOLVED (2026-10-27) under (b) — the semantics are stated, and
they differ in kind, not spelling.** The three constructs assert over
different planes with different evaluation semantics:

1. **`check`** — the run plane's evaluation primitive (inputs +
completion; the LML-aligned check): EVALUATED at run time, its verdict
feeds the step's completion contract. The engine runs it.

2. **`constraint`** — the v3 domain constraint (TODO.roadmap/51): a
declared structural bound over the subject's data, carried with its
violation semantics (`check` expression, `violation_meaning`,
`on_violation`). JUDGED on the data plane when the bound's evidence is
weighed — never a run-time input.

3. **`invariant`** — the platform's named architecture invariant (gap
E9): NEVER evaluated by any engine. It is a governance claim whose
`enforcement` facet is a cross-toolchain REGISTRY (kernel:C32,
linker:quantity-coherence, gate:schema-quantity-value — each claim
names the leg that discharges it), with severity and the aspirational
marker for undischarged claims (C90/C91 judge the shape and the
grammar). No single evaluation semantics subsumes a registry.

One primitive with an assertion kind cannot carry the registry: the
kind vocabulary would have to include "claims its own enforcement
elsewhere" — a different beast from continuous/event-time/structural
evaluation. The triad stands as three constructs with stated, distinct
semantics.

## The gap
Three constructs assert "a condition over declared names": `check` (inputs +
completion, the LML-aligned check), `invariant` (the process invariants),
`constraint` (the geometry/structural bounds).

## The resolution
Either (a) `check` is the primitive and invariant/constraint become checks
with an assertion kind — continuous vs event-time vs structural — or (b) each
carries a written justification of why its evaluation semantics need its own
construct. (b) is acceptable ONLY with the semantics stated; otherwise (a).

# 06 — The assertion triad: check, invariant, constraint

## The gap
Three constructs assert "a condition over declared names": `check` (inputs +
completion, the LML-aligned check), `invariant` (the process invariants),
`constraint` (the geometry/structural bounds).

## The resolution
Either (a) `check` is the primitive and invariant/constraint become checks
with an assertion kind — continuous vs event-time vs structural — or (b) each
carries a written justification of why its evaluation semantics need its own
construct. (b) is acceptable ONLY with the semantics stated; otherwise (a).

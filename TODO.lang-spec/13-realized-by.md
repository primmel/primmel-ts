# 13 — The behaviour–process link is declared

**Status: RESOLVED (2026-10-27) — the convention became a check (C186).**
`realized_by` is the explicit C2-resolved form on the behavior; the
checker leg makes the id-matching convention checkable: a process
whose id names a declared behavior MUST be declared in that
behavior's `realized_by` (the corpus's one id-match — r60-lml's
load_weight — declares it). The process-side `realizedBy` is a
DIFFERENT relation (the abstract→concrete process link, C121) —
untouched.

## The gap
`process load_weight` realizes `behavior load_weight` by an ID-MATCHING
CONVENTION (the corpus's own comment says so); `realizedBy` exists beside the
convention.

## The resolution
`realizedBy` is the explicit, C2-resolved form; the id-convention retires or
becomes a checker-checked convention (a process whose id matches a behavior id
MUST declare realizedBy — the convention made explicit).

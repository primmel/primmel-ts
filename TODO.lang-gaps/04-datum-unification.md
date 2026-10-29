# 04 — The datum unification

**Status (2026-10-28): PR 1 LANDED (1.21.53) — the capability
`has_parameters` plane reads the datum substrate; three carriers
queued.** The composition plane's list members name DATUMS: a bare id
resolves against the declared datum register or the legacy
`attribute_definition` alias (the C190 capability-parameters-resolve
leg, error, normal level), and `datum <id> [: <type>] { … }` declares
one INLINE — the parse delegates to the top-level datum parser, the
resolved list stays string ids, and the dump normalizes the inline
declaration to a top-level datum (the fixpoint holds). The corpus
census: 26 has_parameters lines, 158 id instances; the one undeclared
site (iso-iec-17021-1's cb-lifecycle: audit_programme_interval,
stage1_stage2_gap, surveillance_frequency) declared its three
attribute_definitions with clause-9 provenance (model-library#144); the
other 140 instances already resolved by full id against declared
attribute_definitions — the alias resolution covers them, no datum was
invented. No new conformance case: the carrier stays, this is a
resolution leg (checker2 mirrors C190). Remaining: the identity_slot
(PR 2), form field (PR 3), and attribute_definition (PR 4) carriers —
the corpus has 0 top-level `datum` declarations yet.

**Gap.** "A named, typed, unit-ed value" is declared four ways:
`attribute_definition` (model plane), `identity_slot` (inscription
plane), capability `has_parameters` (composition plane), form `field`
(run plane) — plus dimension values and TABLE columns. Same concept,
four grammars, four validators.

**Fix shape.** One `datum` primitive — named, typed, unit-ed —
parameterized by exactly two axes:
- ORIGIN (epistemic — where the value's authority comes from):
  declared (manufacturer asserts) / design-fixed (invariant by
  construction) / observed (measured in a run, by whatever executor)
  / computed (derived by the model's calculations)
- SCOPE (where it lives): model / family / sample / run

identity_slot = a datum with presentation facets; form field = a
run-scoped datum; capability parameter = a composition-scoped datum.
NOTE: origin SURVIVES the actor/executor dissolution (05) — it is
about the VALUE's provenance, never about who executed.

**Payoff.** One validator, one cardinality story, one default/nil
policy (see 10), and the form plane's fields stop being a second
type system.

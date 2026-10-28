# 04 — The datum unification

**Status (2026-10-28): DATUM CONSTRUCT LANDED; CARRIER UNIFICATION
QUEUED.** The kernel parses `datum` (origin/scope/renders axes, spec
§16); the four carriers remain the corpus reality — the corpus has 0
top-level `datum` declarations yet. The unification is a corpus
migration, not a kernel gap.

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

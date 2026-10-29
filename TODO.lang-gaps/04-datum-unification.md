# 04 — The datum unification

**Status (2026-10-28): PR 2 LANDED (1.21.54) — the identity_slot
inscription value rides the datum substrate; two carriers queued.**
PR 1 (1.21.53): the capability `has_parameters` plane reads the datum
substrate — bare ids resolve against the declared datum register or the
legacy `attribute_definition` alias (the C190
capability-parameters-resolve leg, error, normal level), and
`datum <id> [: <type>] { … }` declares one INLINE. PR 2: the
identity_slot is the inscription plane of the substrate — the construct
STAYS (the alias doctrine), and its value core reads the datum: an
inline `datum { … }` block (NO id — the slot's id names the datum; NO
type parg — the type rides the `type` facet, the slot's parse-enforced
vocabulary) carries the substrate facets
type/unit/quantity_kind/origin/scope that override/extend the slot's
flat `type`; the plane extras (presentation channels,
metamodel_class, optional) are untouched — extras on the substrate.
The slot exposes its datum view through `identitySlotDatumView` (the
block's facets override, the flat facets stand in where the block is
silent, origin defaults to `declared`); the wire shape does not move —
the dump re-emits the authored `datum { … }` block (facet defaults
normalize away, the datum-dump convention), so the fixpoint holds. One
new leg: C191 identity-slot-datum-coherence (error, normal level,
following C190) — a type the block restates must AGREE with the slot's
flat `type` (the two spellings name ONE value); the absent block (or a
block silent on the type) carries no leg. checker2 mirrors C191 over
the shape tree (the nested `datum` construct, the open block's greedy
facet runs). The corpus census (15 slots, 5 files: oiml-r144 6,
oiml-r60-lml 5, oiml-r91 2, iso-iec-17021-1 1, iso-17011 1): every
slot types string/designation/serial/year/mark/map — ZERO
quantity-bearing (marked quantities stay attribute_definitions, INV-3,
never redeclared in a slot), so no inline datum block is authored and
the corpus PR is skipped; the extended grammar only adds an optional
block and all 15 sites parse clean (the corpus smoke: 68 packages,
0 errors). No new conformance case: the carrier stays, this is a
value-core leg (checker2 mirrors C191). Remaining: the form field
(PR 3) and attribute_definition (PR 4) carriers — the corpus has 0
top-level `datum` declarations yet.

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

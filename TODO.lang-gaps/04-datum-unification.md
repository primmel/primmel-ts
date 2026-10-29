# 04 — The datum unification

**Status (2026-10-28): PR 3 LANDED (1.21.55, DOCUMENT-ONLY) — the
table-columns rung resolved BY THE DOCTRINE: the column is the
substrate's PROJECTION, not a carrier.** PR 1 (1.21.53): the capability
`has_parameters` plane reads the datum
substrate — bare ids resolve against the declared datum register or the
legacy `attribute_definition` alias (the C190
capability-parameters-resolve leg, error, normal level), and
`datum <id> [: <type>] { … }` declares one INLINE. PR 2 (1.21.54): the
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
facet runs). PR 2's corpus census (15 slots, 5 files: oiml-r144 6,
oiml-r60-lml 5, oiml-r91 2, iso-iec-17021-1 1, iso-17011 1): every
slot types string/designation/serial/year/mark/map — ZERO
quantity-bearing (marked quantities stay attribute_definitions, INV-3,
never redeclared in a slot), so no inline datum block is authored and
the corpus PR was skipped (the corpus smoke: 68 packages, 0 errors).

**PR 3 — the table-columns rung: the column is DOCUMENT-ONLY; the rung
carries the substrate head-type capture fix.** The task asked for the
table-columns carrier; the doctrine itself answers the question.
`[[datum-unification]]` (spec#87) enumerates exactly FOUR plane
carriers — attribute_definition (model), identity_slot (inscription),
capability `has_parameters` (composition), form `field` (run) — and
then excludes the table column in the same breath as the dimension
value: "Dimension values and table columns state VALUES of declared
axes; they are not value declarations of their own. A dimension value
names the dimension and states the value; a table column types the
column and states the cells — both reference the substrate, never
re-declare it." The column is a value-stater, not a carrier — the
kernel-side sentence, spec-consistent: **the typed column entry is the
datum substrate's projection, not a second declaration of it —
`columns { <name>: <type> ["<unit>"] }` spells the datum's value core
verbatim (`TableColumnDef {name, type, unit}` ≅ `Datum {id, type,
unit}`), carries no plane extras of its own (there is nothing "on the
substrate" to separate), and states the cells' shape — it references
the substrate, never re-declares it.** The two rung-forcing surfaces
the earlier carriers had are both absent here: no SECOND spelling of
one value can contradict (C191's surface — the column has exactly one
spelling), and no bare-id member needs resolving (C190's surface — the
type token is a value type, never a datum reference). The corpus
census settles the demand side: 133 typed `columns {` blocks, the type
vocabulary exclusively value types (`string` ×301 entries, `number`
×~70 mostly with unit tokens ("km/h", "kg", "v", "d"), `integer`
×~13), ZERO datum references, and ZERO datum declarations corpus-wide
(still true after waves 04 PR 1–2) — a reference grammar (`x: datum`,
or a `datum <id>` facet) would have zero sites and zero referents,
plus a real bare-name ambiguity (a type token naming a datum id is
indistinguishable from a value type without new syntax). So for the
COLUMN: no grammar extension, no leg, no checker2 mirror, corpus PR
skipped.

The pinning, though, exposed a SUBSTRATE defect the rung's own claim
depends on: the datum's head type — the spec's canonical spelling
("the type rides the head") — was stripped-and-DROPPED at parse (the
payload-head comment promised a capture the code never did), and a
`type` facet inside the block was silently swallowed — so a top-level
datum could not carry its type through ANY spelling, and the
projection's type axis was unverifiable. Fixed in passing (the one
assignment the comment always described): parseDatum captures the
`\S+` head token it already stripped (lmlAligned.ts), and the shape
front end folds the `: <type>` pair into the payload head instead of
skipping it — the two-front-ends-agree invariant (the file-by-file
conformance walk) holds byte-for-byte; dumpDatum's ` : <type>`
emission now carries the authored spelling, so the fixpoint strictly
improves (PR 1's inline-datum dump expectation updated — the authored
`: ratio` now re-emits). PR 1's conformance cases expect only
`parse: ok` — unchanged; no C-row, no checker2 mirror. The pinning
tests (lml-aligned-check.test.ts) assert the projection (the parsed
column triple equals the same-named datum's value core, type axis
included), the clean column↔datum coexistence (the full checker: no
invented leg fires), and the combined-model fixpoint. Recorded
follow-up (not acted on): the block-facet `type` spelling still no-ops
silently — loud-refusal vs capture is a grammar-policy decision for
the owner; the head stays the canonical spelling. The old `colN`
dialect's loud refusal (table.ts) is the END-STATE template and stays.
Remaining carriers: the form field (PR 4) and attribute_definition
(PR 5) — the corpus has 0 top-level `datum` declarations yet.

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

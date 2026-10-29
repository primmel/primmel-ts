# 04 — The datum unification

**Status (2026-10-30): WAVE COMPLETE — PR 5 LANDED (1.21.57): the form
field carrier, the RUN plane of the substrate reads the datum. The
wave's rungs are done: all FOUR plane carriers ALIAS the one "named,
typed, unit-ed value" primitive.** The field STAYS the carrier (the
alias doctrine) and its value core reads the datum: an optional inline
`datum { … }` block (NO id — the field's name names the datum; NO type
parg — the type rides the `type` facet or the flat head type) carries
the substrate facets type/unit/quantity_kind/origin/scope over the flat
head type + `unit` — which already ARE the datum's type/unit (the wave
04 PR 3 finding, `{name, type, unit}` ≅ `{id, type, unit}`). The field
exposes its datum view through `fieldDatumView` (the block's facets
override, the flat facets stand in where the block is silent, origin
defaults to `declared` — the field has no flat origin; the field's flat
`scope` facet is the FORM's presentation scope, a different axis, and
never stands in). The wire shape does not move — the dump re-emits the
authored `datum { … }` block (facet defaults normalize away,
`origin declared` omitted), so the fixpoint holds. THE SILENTLY-SKIP
FINDING: the field body's unknown-cmd fallback (field-parser.ts)
`unwrapBlock`-skipped any unknown keyword, so a `datum { … }` block was
SILENTLY DROPPED before this rung — the skip is now the parse+store
(the fail-closed malformed-spelling error follows the PR 2/PR 4
precedent, and the closed origin vocabulary is enforced inside the
block). One new leg: C193 field-datum-coherence (error, normal level,
following C190/C191/C192) — a type the block RESTATES must AGREE with
the field's EXPLICITLY DECLARED head type (the untyped head's `string`
is the parse default, not a spelling — a block type over an untyped
head is the override the view resolves, never a contradiction); a block
silent on the type, or the absent block, carries no leg; subform fields
share the grammar and are judged with the same rule. checker2 mirrors
C193 over the shape tree — where the field arrives TWO ways (the
untyped head rides a `field` construct, the typed head
`field x : T { … }` rides an entry line whose key is the name and whose
first token is the head type) and the datum block rides a `datum` LINE
(a head-less `datum` is not a named construct) — the walker takes both,
nested fields and subforms included. The corpus census: 2,501
`field` sites in 220 files (262 `form` + 6 `subform` carriers), typed
heads ×2,491 (string 743, number 680, boolean 389, text 294, array 189
…), 522 `unit` facets — the quantity-bearing run plane — and ZERO
inline datum blocks (the keyword is new), so no site is incoherent
under the new leg (no block ⇒ no restatement ⇒ no leg) and the corpus
PR is skipped; the extended grammar only adds an optional block and
every site parses unchanged (the corpus smoke: 68 packages, 0 errors).

**WAVE SUMMARY (04, the register's record).** The datum unification is
COMPLETE at 1.21.57: PR 1 (1.21.53) the capability `has_parameters`
composition plane (C190); PR 2 (1.21.54) the identity_slot inscription
plane (C191); PR 3 (1.21.55, document-only) the table column is the
substrate's PROJECTION, not a carrier, plus the substrate head-type
capture fix; PR 4 (1.21.56) the attribute_definition model plane (C192);
PR 5 (1.21.57) the form field run plane (C193). One substrate, four
carriers, three coherence legs (C191/C192/C193 — type restatement
agreement), one resolution leg (C190), one datum view accessor per
carrier (`identitySlotDatumView` / `attributeDefinitionDatumView` /
`fieldDatumView`; the projection reads the datum directly per PR 3).
The corpus authored ZERO inline datum blocks across every carrier
census (15 slots, 359 attribute sites, 0 table datum references, 2,501
field sites) — the demand side of the unification is the VALIDATOR and
the VIEWS, not new authoring: the corpus's flat facets already are datum
vocabulary. The axis conversation (the closed origin/scope vocabulary
on the FLAT facets — PR 4's free-form finding) remains the recorded
follow-up, deliberately not taken in this wave.

**Prior rungs.** PR 4 (1.21.56) — the
attribute_definition carrier: the MODEL plane of the substrate reads the datum. The
attribute STAYS the carrier (the alias doctrine) and its value core
reads the datum: an optional inline `datum { … }` block (NO id — the
attribute's id names the datum; NO type parg — the type rides the
`type` facet or the flat `value_type`) carries the substrate facets
type/unit/quantity_kind/origin/scope that override/extend the flat
value_type/unit/quantity_kind/origin/scope; the plane extras (category,
enum, is_dimension, correspondences) are untouched — extras on the
substrate. The attribute exposes its datum view through
`attributeDefinitionDatumView` (the block's facets override, the flat
facets stand in where the block is silent — the attribute's flat origin
is the authored truth, never silently defaulted to `declared`); the
wire shape does not move — the dump re-emits the authored `datum { … }`
block beside the flat facets it extends (facet defaults normalize away,
the datum-dump convention; `origin declared` omitted), so the fixpoint
holds. One new leg: C192 attribute-definition-datum-coherence (error,
normal level, following C190/C191) — a facet the block RESTATES must
AGREE with its flat spelling (the block's `type` against the flat
`value_type`, `origin`, `scope`; the two spellings name ONE value); a
facet the block leaves silent carries no leg, and the absent block
carries no leg. checker2 mirrors C192 over the shape tree (the nested
`datum` construct rides the generic block items — no grammar change,
the attribute_definition block was already open; the flat facets are
the attribute's own lines). The corpus census (359 attribute_definition
lines in 34 files): ZERO inline datum blocks (the keyword is new), and
the flat facets ALREADY ARE datum vocabulary — the corpus writes
`origin design-fixed scope model` on quantity-bearing attributes — so
no site is incoherent under the new leg (no block ⇒ no restatement ⇒
no leg) and the corpus PR is skipped; the extended grammar only adds an
optional block and every site parses unchanged. Census nuance, recorded
for the axis conversation: the flat `origin` tokens spread beyond the
datum's closed axis (declared ×122, design-fixed ×65, test-dependent
×35, measured ×35, observed ×22, derived ×7, computed ×4; scopes
model ×127, sample ×65, family ×43, group ×17) — the flat facets stay
FREE-FORM (tightening them is the axis conversation, not this rung);
the closed origin vocabulary is enforced inside the block (the
fail-closed precedent PR 2 set), where an author deliberately speaks
the substrate's language.

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
Remaining carriers at PR 3's close: the form field and
attribute_definition (PR 4 took the attribute_definition and PR 5 the
form field — see the status header; the wave is complete) — the corpus
has 0 top-level `datum` declarations yet.

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

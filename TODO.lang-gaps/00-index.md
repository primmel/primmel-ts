# Primmel language gaps — the LML-alignment audit + the consolidation register

The relationship: **LML (RS 3001/3010) is the data-modelling substrate —
classes, attributes, enums, instances, mappings, paths, registers,
transforms, evolution. Primmel is strictly greater: the same substrate
PLUS the metrology loop's higher constructs (subjects, promises,
requirements, processes, tests, evidence, attestation).** Strict
supremacy means every LML construct has a Primmel counterpart — declared
in the package surface, not implicit in the kernel.

Each file: the gap, the evidence, the fix shape, the verification.

## The LML-alignment audit (files 09–19)

## The 2026-10-28 sweep — every row dispositioned (issue #203)

| LML construct (doc) | Disposition | File |
|---|---|---|
| serialization `mapping <fmt> <class>` (declarations) | RESOLVED v3.2 — `WireMapping`, the wireMappings collection | 09 |
| attribute defaults, nil policy, `isa` (declarations) | DECLINED — zero corpus use; semantics recorded verbatim for reopen | 10 |
| `string_format` grammar-backed formats (declarations) | RESOLVED v3.3 — `StringFormat` | 11 |
| enum `member_fields` + table-driven `from_table` (declarations) | RESOLVED BY THE EXISTING SHAPE — enum_values + dimension-bound profiles; `from_table` declined | 12 |
| namespaces with uri + prefix (lang §namespacing) | RESOLVED v3.3 (lang-spec/20) — `NamespaceDecl`, the two-sense MECE | 13 |
| LutaML path expressions (lutaml-path) | DECLINED — expressions navigate internally, urns cite externally; two owners already | 14 |
| model registers, attribute substitution (model-register) | RESOLVED — the locator plane (lang-spec/15) + edition lifecycle + slot overlays + pins | 15 |
| model/value transforms (model-transform) | RESOLVED BY DECLARED ARTIFACTS — maps_to, slot overlays, wire mappings; automap state ephemeral by design | 16 |
| source-declared version, change levels (model-evolution) | RESOLVED — manifest version + C163 + C77–C80 + the lockstep discipline | 17 |
| operations (UML round-trip metadata) (declarations) | DECLINED (posture b) — subjects-and-loops, not class diagrams; reopen on a real XMI source | 18 |
| validation rules (lang §validation) | RESOLVED — Annex B is the contract; the family mapping holds; Primmel strictly greater | 19 |

Four RESOLVED by landing (09/11/13 in v3.2/3.3; 15 by the
2026-10-28 locator wave), four RESOLVED by the existing shape's
justification (12, 16, 17, 19), four DECLINED with recorded
reasons and reopen triggers (10, 14, 18, 12's `from_table`). The
register is closed: the supremacy claim — every LML
construct has a Primmel counterpart or a recorded refusal — holds
verifiably at 2026-10-28.

## The consolidation register (files 01–08 + 20)

The audit of Primmel's OWN primitives: similar constructs that grew out
differently across the three planes (specification / evaluation /
execution). One loop, one primitive per role; MECE. Dispositioned
2026-10-28; each file carries the dated status mark with the evidence.

| # | Gap | Disposition (2026-10-28) |
|---|---|---|
| 01 | the computation family: steps with signatures; machine_steps and calculation_bindings dissolve into step + binding | RESOLVED (1.21.44) — typed steps 1.21.35 (467 corpus steps, 13 bindings); machine_steps retired via `gates { machine_service }` (07); the form-plane rename maps (36 sites, 93 pairs) retired — each input binds through its own `binding { from … to … }` edge |
| 02 | THE PROSE QUARANTINE (critical): no prose outside label/description{} | ENFORCED (parse-level; 1.21.45–47) — the five bare carriers dual-parsed then refused; the corpus rebaked to the block form (~4,000 occurrences); items 3/5 remain as per-package CONTENT debt |
| 03 | the boolean-verdict consolidation: limit / acceptance_criteria / validate_measurement / pass_fail / constraints → check | RESOLVED (1.21.48–52) — the parse-side fold + four corpus migrations (pass_fail/pass_if, validate_measurement verbatim, acceptance_criteria both carriers); limit STAYS as the structured predicate carrier (census: 29 args, 19 typed accepts triples, 0 when) — its verdict triple is typed data, not a spelling |
| 04 | the datum unification: attribute_definition / identity_slot / parameter / field → datum(origin, scope) | DATUM CONSTRUCT LANDED; CARRIER UNIFICATION QUEUED — origin/scope/renders axes in; four carriers remain; 0 top-level corpus `datum` declarations |
| 05 | the actor/executor dissolution: accountability vs implementation vs qualification evidence; digital twins are subjects | RESOLVED (1.21.42) — step-level `executor` is a parse error; the step names its `role`, the RUN binds the executor; process-level `executor` facet remains; 145 actor-less processes are a content gap |
| 06 | variants vs dimensions: the same classification declared twice | RESOLVED (1.21.43) — subject `variant` is a parse error; dimension values carry the typed `ref`; all 6 corpus packages folded (r49 gained `measuring_principle`) |
| 07 | the process vocabularies: abstract vs realized vs workflows; gateways are steps | RESOLVED BY THE EXISTING SHAPE — all corpus workflows are `process` declarations; `realized_by` is the edge (C121/C186); `exclusive_gateway` is the applicability cascade (WF-02) |
| 08 | record templates: form/subform/header vs class X#data; registries are pairings, not a data shape | RESOLVED BY THE EXISTING SHAPE — one shared field grammar (spec §10); `subform_ref`/`header` composition; registries are C157 pairings |
| 20 | calculations are declared math bound to declared symbols | BLOCKED EXTERNALLY (#201 — plurimath/unitsml); C165/C166 reserved; notation vocabulary + C161 render check in place |

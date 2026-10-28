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

## The consolidation gaps already discovered (files 01–08)

The audit of Primmel's OWN primitives: similar constructs that grew out
differently across the three planes (specification / evaluation /
execution). One loop, one primitive per role; MECE.

- 01 the computation family: steps with signatures; machine_steps and
  calculation_bindings dissolve into step + binding
- 02 THE PROSE QUARANTINE (critical): no prose outside label/description{}
- 03 the boolean-verdict consolidation: limit / acceptance_criteria /
  validate_measurement / pass_fail / constraints → check
- 04 the datum unification: attribute_definition / identity_slot /
  parameter / field → datum(origin, scope)
- 05 the actor/executor dissolution: accountability vs implementation vs
  qualification evidence; digital twins are subjects
- 06 variants vs dimensions: the same classification declared twice
- 07 the process vocabularies: abstract vs realized vs workflows; gateways
  are steps
- 08 record templates: form/subform/header vs class X#data; registries are
  pairings, not a data shape

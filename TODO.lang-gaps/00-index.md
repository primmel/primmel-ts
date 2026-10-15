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

| LML construct (doc) | Primmel today | File |
|---|---|---|
| serialization `mapping <fmt> <class>` (declarations) | kernel MapProfile exists; NOT declared in package surface | 09 |
| attribute defaults, nil policy, `isa` (declarations) | cardinality + modality only | 10 |
| `string_format` grammar-backed formats (declarations) | none (value-types.prl is plain) | 11 |
| enum `member_fields` + table-driven `from_table` (declarations) | dimension values carry payloads, but no enum primitive with member schema | 12 |
| namespaces with uri + prefix (lang §namespacing) | single namespace string in metadata | 13 |
| LutaML path expressions (lutaml-path) | urns are citations, not navigable paths | 14 |
| model registers, attribute substitution (model-register) | packages repo + git tags, de facto | 15 |
| model/value transforms (model-transform) | the Studio's mapper is ephemeral — no language artifact | 16 |
| source-declared version, change levels (model-evolution) | model-diff exists; no in-source version declaration | 17 |
| operations (UML round-trip metadata) (declarations) | none — adopt or declare out of scope | 18 |
| validation rules (lang §validation) | check + linter (C/R rules) — parity check needed | 19 |

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

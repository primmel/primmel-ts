# 02 — Provision parity: the MMEL requirement unit

**Status: RESOLVED (2026-10-27) — the parity audit passes.** Primmel's
`Provision` carries the MMEL triad field-for-field: `subject` (the
Map of registry bindings — the `subject#1 StandardRegistry` form),
`condition` (the stated obligation), `modality`, plus the reference
channel (the class-field citation ids, opaque by design). The C5
coverage walk keeps `validate_provision` as test-plane coverage. The
converted models' `validate_provision` entries now cite `/req/*`
requirements — the triad preserved in the superseding form (statement
= condition, obligation = modality, subjects/binds_to = the registry
binding), verified continuously by the fidelity apparatus. No new
primitive; the audit is this note.

## The evidence
MMEL's requirement unit is the compact

```mmel
provision StandardMeetEnvironment {
  subject#1 StandardRegistry
  condition "{ Standards (Data) } selected meet environmental requirements"
  modality SHALL
}
```

bound to processes by `validate_provision { X }`, and to the clause sources by
the class fields' `reference { ISO14971-doc-ref3-4 }`. Primmel's registry
carries `provision` and the process plane carries `validate_provision`, but
the parity of the subject/condition/modality triad against the MMEL form is
unverified since the flattening.

## The resolution
1. Audit Primmel's `provision` against this triad: subject (the registry
   binding), condition (the stated obligation), modality.
2. The C5 coverage walk already treats `validate_provision` as test-plane
   coverage — keep; the provision's own field parity is the gap.
3. Where Primmel's `requirement` superseded the provision, the conversion
   must have preserved the triad; spot-check the converted models
   (r60-lml's provisions versus their MMEL ancestors).

## Disposition
the parity audit note + the spec's provision section; no new primitive.

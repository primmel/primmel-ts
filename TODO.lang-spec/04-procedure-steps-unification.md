# 04 — One procedure step form (and its labels resolve)

**Status: LANDED (2026-10-26, phase 1 — the typed form).** The named typed
step parses and dumps: `procedure { step <id> ["prose"] [inputs { ... }] [outputs { ... }] }`
— the declaration order IS the sequence. C147's new legs reject a procedure
mixing the typed form with the numbered facet and duplicate ids (the kernel
half and the checker2 mirror agree; the conformance corpus carries the
round-trip fixture; spec §Conformance classes and conformance tests documents
the facet). Phase 2 — the corpus/library migration re-spells the numbered
procedures and retires `procedure_steps` (parse-refuse) — travels with the
consumers.

**Phase 2 LANDED (2026-10-26, model-library#119 + tag v0.33.11, smart#743).**
The 19 r60-lml tests re-spelled as the typed skeleton (the explicit
per-test mapping table rides as the library's
scripts/migrate-typed-procedures.mjs); the app's run plane (the
procedure panel, the leg alignment — identity by id in the typed world,
the lab-coverage skeleton, the wizard) re-sourced from `steps[].id`.

**Phase 3 — the deprecation rung LANDED** (the retired spellings warned
C154 while the sweep ran).

**Phase 4 LANDED — the refusal.** The corpus-wide sweep completed first
(model-library#121, tag v0.33.12): the remaining 185 numbered steps
across the 14 conformance files re-spelled as the typed skeleton (the
id = the slug of the step's own prose; the r49/r138 tables.prl numbered
lines are table data rows — untouched). With zero numbered steps left
in the corpus, `procedure_steps { … }` and the numbered facet refuse at
parse; the dead surfaces (the type fields, the dump replay, the C154
legs, the strict exemption) are gone; checker2's mirror flags the
retired facet for documents that reach it untyped; the spec's facet
section states the refusal.

## The gap
Requirements and tests carry BOTH `procedure { 1 "…" outputs { … } }` (numbered
text) and `procedure_steps { labels }` (the named sequence) — the labels
resolve to nothing; C171 closes the expression plane but the sequence-label
plane still names freely (verified: r134's `apply_power_interruption_20ms`).

## The resolution
The named typed step is the one form, writable inline:

```prl
procedure {
  step record_reference_indication outputs { indication_without_disturbance }
  step apply_power_interruption_20ms outputs { indication_with_disturbance }
}
```

The numbered text form retires to Annex D; `procedure_steps` dies (the step
ids are the sequence); C171's sequence leg resolves the labels to the typed
steps.

## Phase 2 — the migration design (the 19 sites)

The r60-lml conformance tests carry three granularities: the numbered
macro-arc (`procedure { 1..5 "…" }`), the SOP skeleton
(`procedure_steps { ids }` — the app's run-procedure panel renders it),
and the executable programs (`preparation`/`stimulus`). The migration
re-spells each test's `procedure` as the TYPED SKELETON — the
`procedure_steps` ids in order — and distributes the numbered arc's
prose, `inputs`, and `outputs` onto the matching ids (the prep ids
map onto the `preparation` program's discipline; where the arc has an
act no id names, the id joins the skeleton, e.g. `return_to_dmin`).
The `procedure_steps` lines drop. Files:
`oiml-r60-lml/specification/conformance/{metrological,electronic,examination}.prl`.

After the library release + the app's `run-procedure.ts` re-source
(the panel derives from `procedure[].id` instead of
`procedure_steps`), the kernel refuses both retired spellings
(parse-error, the #207 ladder) — phase 3.

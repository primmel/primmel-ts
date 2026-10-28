# 05 — The actor/executor dissolution

**Status (2026-10-28): RESOLVED (1.21.42).** The step-level `executor
machine | actor` facet is a parse error naming this file; the step
names its `role` and the RUN binds the executor (spec §11
executor-dissolution; 13 corpus sites migrated in
oimlsmart/model-library). The process-level `executor` facet remains
the default run binding. 145 processes declaring `executor actor`
with no `actor` facet remain a content-modeling gap, not a language
gap.

**Gap.** `executor: actor | machine` (and `machine_steps`) conflates
three axes: ACCOUNTABILITY (who answers — institutional, never
disappears), IMPLEMENTATION (what performs the step — run-time
binding), QUALIFICATION (what makes the implementer allowed).

**Fix shape.** The step names its `actor` (accountable role). The RUN
binds an executor that acts-AS the actor, carrying qualification
evidence appropriate to its kind: person → accreditation; rig → cal
cert (TestRunEquipment.cal_cert is the precedent); API → service
qualification; DIGITAL TWIN → twin-validation attestation. No
executor-kind enum in the step primitive — the kind is a
classification of executors, relevant only to which evidence applies.

**The recursion.** A digital twin is a SUBJECT in the loop (identity,
attributes, behavior, claims) whose claims are validated against the
physical rig; its attestation IS its cal cert. A twin-executed run is
traceable through the twin's validation. No new primitives; the loop
applies to its own executors (the platform's SST is exactly this).

**Datum origin note.** `origin: observed` stays — a twin-measured
reading is still observed. Origin is epistemic; executor kind is not.

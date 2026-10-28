# 01 — The computation family: steps with signatures

**Status (2026-10-29): RESOLVED (1.21.44).** Typed steps landed 1.21.35
(the corpus carries 467 `step` declarations and 13 `binding` edges);
`machine_steps` retired via the `gates { machine_service … }` facet
(1.21.39/40 — see 07); the form-plane `calculation_bindings` rename
maps (36 corpus sites, 93 bound pairs) retired in 1.21.44 — each
calculation input binds through its own `binding { from <source> to
<input> }` edge (the form projection of §11's one dataflow edge; the
corpus migrated in model-library v0.33.19).

**Gap.** The computation wiring is split across three vocabularies that
grew in three planes: `calculation` (declared signature: inputs/output/
expression — the only one with a signature), `machine_steps { name }`
(a bare pointer into runtime code — verdict.service.ts), and form-level
`calculation_bindings` (a rename map between calculation input names and
report field ids). No layer declares the STEP's dataflow; `within_mpe`
is computed by runtime TS, stored as a boolean form field, and checked
by a string expression — invisible to the linker, unprovable in the
package, split across two engines.

**Fix shape.** Two and a half primitives:
- `calculation` stays — the reusable, context-free function.
- `step` becomes the situated computation: named inputs → computation
  (inline expression or calculation reference) → named outputs. The
  OUTPUT SIGNATURE is the step's declared product. Step flavors are one
  primitive distinguished by output kind: conditioning (state
  assertions), measurement (readings), computation (derived values),
  decision (branches).
- `binding` is the one edge: any named source (step output, reading
  field, declared parameter) → any named input. `calculation_bindings`
  dissolves into it (field-level case). `machine_steps` dissolves
  entirely (it has no signature and no kind — see 05).

**Payoff.** The linker proves the dataflow closes; computations like
`within_mpe` become declared calculations bound at a step (one engine —
the kernel); run completeness = mechanical signature coverage (the
INADMISSIBLE check). A check is arbitrary exactly when a name, a
constant, or a semantics inside it is undeclared.

**Verify.** `evaluation/processes.prl` (machine_steps), `execution/forms/
sec-6-performance-tests/repeatability.prl` (calculation_bindings),
`specification/mpe-calculation.prl` (the signature to keep).

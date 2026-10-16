# 19 — The step plane: the process steps and their inputs/outputs, accessed

**Status: LANDED (2026-10-17, the core).** The signature steps type in
place — the named ios, the completion carrier (the same string-vs-block
doctrine), the calls bindings into C76's existing machinery. C173
`step-plane-refs-resolve`: the completion reads the step's own ios, the
dot-descent `process:<p>.<step>.<io>` resolves against the declared
structure (the limits' args, the carriers' args). CHK-173 fixtures;
both implementations judge them (checker2's process-kind resolution).
**Remaining:** the retrieval unit addresses (`process:step.io`), the
calls-binding callee-side leg for the SIGNATURE steps' `with` blocks
(the flow dialect's ride C76), the coverage addresses.

## The access grammar (the name grammar composes)

The `.` = structural descent within one declared thing; the `:` hops land on
the element. The process plane's access paths:

```prl
# the process
oiml-r60-lml:process:load_weight

# a step of the process (the dot descends)
oiml-r60-lml:process:load_weight.scale

# a declared output of that step (the dot descends to the declared name)
oiml-r60-lml:process:load_weight.scale.indication

# a register of the flow dialect (declared at the process level)
oiml-r60-lml:process:load_weight.raw_signal
```

Every existing rule composes: the C2 targets, the C171 expression scope (an
expression's args may bind `…:process:load_weight.scale.indication`), the
coverage addresses, the retrieval unit addresses, the diff's field paths.

## The gap: the step io plane is raw strings

The io declaration forms that exist today, verified in the corpus:

1. **The flow dialect**: `registers { raw_signal : voltage = 0 V … }` (typed,
   defaulted, process-scoped) + `read { … } / write { … }` per action — the
   registers ARE the named ios; the references resolve (the process-local
   plane).
2. **The abstract dialect**: `signature { in { arranged_eut } out {
   exposed_eut } }` — the named phase ios.
3. **The calls**: `calls <p> { with { in { … : … } out { … } } }` — the named
   bindings to the callee.
4. **The signature steps** (TODO.lang-gaps 01): `step <id> { inputs { … }
   outputs { … } completion … }` — parsed as the RAW `signatureBlock` string;
   **the typing plane never materialized**. Nothing resolves them; nothing
   can access them.

## The resolution: one step-io grammar, typed

The signature steps become the typed plane (TODO.lang-gaps 01's completion):

```prl
step scale {
  inputs  { filtered_counts e_lim }
  outputs { indication overload_flag }
  completion "ocl-free expression: overload_flag = filtered_counts > e_lim"
  calls scale_indication with {
    in  { filtered_counts : filtered_counts e_lim : e_lim }
    out { indication : indication overload_flag : overload_flag }
  }
}
```

- A step's `inputs`/`outputs` declare **named ios** — the names are the
  structural-descent leaves (`process.step.name`).
- The **completion** is the expression language (TODO.lang-spec/18) — the
  args are the step's ios.
- The **calls bindings** (`callee_name : local_name`) resolve against the
  callee's declared ios — the callee's `inputs`/`outputs` (or its signature
  `in`/`out`), the same names the dot-descent accesses.

## The checker

**C173 step-plane-refs-resolve**:
1. A step io referenced by the dot-descent (in an expression arg, a coverage
   address, a calls binding, a diff path) resolves to a DECLARED io of that
   step — nothing linked to air.
2. A `calls` binding's callee-side name resolves to the callee's declared io.
3. The flow dialect's `read`/`write` names resolve to the process's declared
   registers.
4. The completion expression's identifiers resolve to the step's own ios
   (C171's scope = the step).

## The retrieval

The steps and their ios project as retrieval unit addresses
(`process:step`, `process:step.io`), so a consumer retrieves "the output of
R 60's scaling step" — the executable anatomy becomes addressable, not just
the declarative plane.

## The sizing
The signature typing (the parse → the typed ios), C173, the dot-descent
resolution, the retrieval addresses, the conformance fixtures: ~3–4 kernel
days. This completes TODO.lang-gaps/01's deferred plane.

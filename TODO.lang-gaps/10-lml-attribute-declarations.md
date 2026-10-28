# 10 — LML attribute facets missing at the surface: default, nil policy, isa

**Status: DECLINED (2026-10-28) — out of scope, recorded: zero corpus
use.** Across the whole library (every package.primmel): no
`default` on attributes, no `render_nil`, no `isa` — the corpus
never asked. The datum plane stays cardinality + modality
(TODO.lang-gaps/04's family); `of <Model>` stays the instance-type
fix, not overridable. The LML semantics are recorded verbatim for the
day a real source demands them: absent ≠ nil; defaults apply on ABSENT
input only and never overwrite explicit values; a declared literal
beats the 0..1 marker's nil. Reopen on first corpus demand — never
before (the never-hand-roll rule applies to language surface too: no
speculative facets).**

**LML (RS 3010).** attribute blocks carry `default "{literal}"`
(literal-only, applied only on ABSENT input — an explicit nil stays
explicit; a declared literal beats the 0..1 optional-marker nil),
`render_nil {true|false}` (serialization nil policy), and instances
carry `isa` (instance-type override; a `type` ATTRIBUTE stays ordinary
data).

**Primmel today.** Cardinality and modality exist; default/nil policy
do not appear in the package corpus (verify: grep packages for
default/render_nil on attributes — the kernel's `default` hits are
vocabulary-internal). `isa` equivalent: instances fix `of <Model>`.

**Fix shape.** Fold into the datum primitive (04): `default` (literal,
absent-only semantics), `render_nil` per mapping format (feeds 09).
Decide `isa` — either the `of` slot becomes overridable or we declare
instance-type override out of scope with a recorded reason.

**LML semantics to preserve exactly.** absent ≠ nil; defaults never
overwrite explicit values.

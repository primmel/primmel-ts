# 10 — LML attribute facets missing at the surface: default, nil policy, isa

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

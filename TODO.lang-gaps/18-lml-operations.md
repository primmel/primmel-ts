# 18 — Operations (UML round-trip structural metadata)

**LML (RS 3010 §Operations).** Classes may carry operations — name,
visibility (+,-,#,~), parameters (direction/type/default), return
type + cardinality, property modifiers (ordered/unique/query) —
carrying NO executable semantics: they exist so UML/XMI models
round-trip without losing their behavioral surface.

**Primmel today.** No operation construct. Primmel's "behavior" is
domain behavior (behaviors verified by tests), not methods.

**Decision needed (owner).** Two coherent postures:
(a) ADOPT — operations as inert structural metadata, for corpus
sources that arrive from EA/XMI (the terminology/metadata round-trip
world lutaml serves); zero runtime semantics, checker-validated
signatures only.
(b) DECLINE — declare out of scope with a recorded reason: Primmel
models subjects-and-loops, not class diagrams; XMI sources convert
behavior into behaviors/processes at adoption time.
Either is MECE; neither is silent. Default recommendation: (b) unless
a real corpus source demands (a).

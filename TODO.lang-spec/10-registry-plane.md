# 10 — One registry construct

**Status: RESOLVED (2026-10-27) — the registers are justified per plane.**
The three constructs carry different planar objects with different
checkers, and the corpus is built on them:
`quantity_register` is the metrological ontology (units with symbol/
kind/SI conversion, kinds with dimension vectors — the C32/C33
coherence machinery and the unitsdb adapter read it); `data_registry`
is the data-class catalog (the MMEL spelling itself — `data_registry
{ data_class X#data }` — verified against acme.mmel per this item's
own evidence); the competence kinds ride the package-file register.
A kind-parameterized mega-construct would be a union type wearing a
trench coat: one keyword, three unrelated content grammars. The
registers stay; the plane is MECE by content.

## The gap
`quantity_register`, `data_registry`, `registries` — three registry
constructs, plus the package-file acting as a registry (competence-kinds).

## The resolution
One registry construct parameterized by register kind (quantities, data,
terms, competences). The MMEL `data_registry { data_class X#data }` maps onto
the data kind (verified: acme.mmel).

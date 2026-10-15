# 17 — The SDU SMART superset: two verification items

## The verified coverage
Quantity/Unit/Dimension (ISO 80000) → the quantity plane + C167; TermEntry
labels/definitions → term + §14; BindingnessType → modality; the
Annotation/Selector/Derivation chain → the provenance fragment grammar (§14's
document mapping); SHACL's structural constraints → the class declarations +
the checker. The superset holds on existing primitives.

## The two items
1. **TermFormType** (the typed term forms: abbreviation/acronym/short/full)
   versus the untyped `abbreviations` list — a corpus search decides whether a
   typed form field earns its keep.
2. **The SKOS term hierarchy** (broader/narrower) — if any corpus encodes a
   term hierarchy, `refines` on terms reuses the requirement containment edge
   (TODO.lang-spec/01); otherwise seeAlso carries it.

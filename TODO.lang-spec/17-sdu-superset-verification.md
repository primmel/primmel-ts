# 17 — The SDU SMART superset: two verification items

**Status: RESOLVED (2026-10-28) — both items decided by the corpus, no new
fields.** (1) **TermFormType does not earn its keep**: the realized
models carry 18 `abbreviations { … }` uses and every one is a bare
short-form list — no abbreviation/acronym/short/full classification
exists in any source. The untyped list is the honest carrier. (2) **The
SKOS hierarchy rides `see_also`**: no corpus encodes a broader/narrower
term hierarchy (zero refines uses); the term cross-references already
run through `see_also` (r60-lml, r129). The superset holds on existing
primitives — the two verification items close with the corpus as the
witness.

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

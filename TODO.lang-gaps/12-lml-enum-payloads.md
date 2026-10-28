# 12 — Enum member payloads and table-driven enums

**Status: RESOLVED BY THE EXISTING SHAPE (2026-10-28) — the dimension
IS the enum primitive; the payload rides the table profiles.** The
corpus's own answer (oiml-r60-lml): plain vocabularies declare
`enum_values { … }` on the attribute (TODO.lang-spec/08's resolution);
payload-bearing "enums" are the accuracy-class pattern — a `dimension
accuracy_class` whose values carry their definitions THROUGH the
dimension-bound table profiles (`binding { A: [{ min … factor … }] … }`,
specification/tables.prl): a class value IS its definition, the r60
correction. member_fields as a separate enum primitive would duplicate
the dimension+profile pair (violates 06 variants-vs-dimensions).
`from_table` (compile-time expansion from a grammar artifact's tables):
DECLINED — zero corpus demand; tables are declared in-language, and a
runtime dependency on grammar artifacts inverts the artifact direction
(the grammar is derived FROM the language, never a data source TO it).**

**LML (RS 3010).** `enum Stage { member_fields { abbreviation String
urn_segment String } draft10 { abbreviation = "WD" … } }` — a typed
payload schema shared by all members, inline payloads validated at
compile time (undeclared field = error, missing optional = nil).
`from_table "<name>" { artifact "…" }` expands members from a grammar
artifact's tables at COMPILE time (deterministic; no runtime data
dependency).

**Primmel today.** The accuracy-class DIMENSION values already carry
typed payloads (the r60 correction: a class value IS its definition) —
the payload concept exists, but as dimension-value ad-hoc syntax, not
as the enum primitive; no member_fields schema; no table-driven
expansion.

**Fix shape.** The enum primitive gains member_fields + inline
payloads + from_table (feeds 04's datum and 06's dimensions-vs-
variants). The r60 tiered-class data and any TABLE-driven enum in the
corpus migrate to it.

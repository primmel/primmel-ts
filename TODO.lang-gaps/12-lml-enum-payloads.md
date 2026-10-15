# 12 — Enum member payloads and table-driven enums

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

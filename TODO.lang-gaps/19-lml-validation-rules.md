# 19 — Validation rules parity

**Status: RESOLVED (2026-10-28) — Annex B IS the validation
contract; the family mapping holds.** The language spec enumerates
every rule (91-annex-b-rule-catalog: C1–C188 with severities — 183
kernel rows; the catalog is the section this item asked for). The LML
spine maps: attribute constraints → the datum/quantity families
(C32–C36, C177…); class constraints → the construct families
(state machines C37–C41, promises C42–C44, tests C147–C148…);
reference validity → C2 + the refs-resolve family (C169, C173…). Most
rules EXCEED the spine (provisions, coverage C51–C55/C71–C73,
composition C27–C31/C119/C187/C188, edition C77–C80) — Primmel
strictly greater, the supremacy claim of this register's head
verified. Two-implementation guarantee: checker2 (177 mirrored, 6
outOfSurface with recorded reasons); the legs pin agreement in CI.**

**LML (lang §Validation).** Attribute constraints, class constraints,
reference validity — the checker's mandate is IN the language spec:
what makes a model valid is specified, not incidental.

**Primmel today.** The check system is real and stronger in scope:
check-rules (C-codes), R-rules (the typing gate class), reference
resolution, coverage (C157 pairing, composed gates). But the rule
SET is kernel-internal; the language spec does not enumerate the
validation contract per construct, and LML's three named rule
families are a useful MECE spine to check ours against.

**Fix shape.** An alignment pass, not a rewrite: map every Primmel
check rule to LML's attribute-constraint / class-constraint /
reference-validity families (or record why it exceeds them — most
do: provisions, coverage, composition). Gaps found → new rules;
surplus → document as Primmel-strictly-greater. Output: a
validation-contract section in the language spec.

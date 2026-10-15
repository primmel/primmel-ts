# 19 — Validation rules parity

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

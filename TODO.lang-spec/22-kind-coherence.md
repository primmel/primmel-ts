# 22 — The kind coherence on the expression comparisons

**Status: LANDED (2026-10-16, phase 1 — the check).** C177
(`kind-coherence`) walks the inline expression ASTs: every comparison
sets operands of the same declared quantity kind. Phased per the
meta-critique (C5): the coherence check is the language's; the unit
ALGEBRA (the conversions, the affine scales, the inference) is
plurimath's evaluation plane (the mandate, plurimath#488) — never the
kernel's.

## The rule

- The kinds come from the args' declared sources: `symbol:`/`attribute:`
  declarations carrying `quantity_kind`, `verdict:` quantity kinds, and
  the table columns (`string` columns are TEXT — a text operand against
  a quantity kind is a conflict).
- **An operand of unknown kind or a bare number never conflicts** — the
  check is exact where the declarations are, silent everywhere else. No
  false positives by construction; the corpus exercises the rule as its
  declarations gain kinds.
- The kind rides the arithmetic (`0.5 * cap` keeps cap's kind) and the
  kinded calls (`abs`, `max`, `min`, `floor`, `ceil`, `round`, `sqrt`,
  `exp`, `ln`, `log`, `mod`); the comparisons produce booleans; mixing
  two known kinds anywhere is one C177 per conflicting node, naming the
  rendered operands.

## The remaining phases

- Phase 2: the args' declared DOMAINS (the symbol ranges, the D 11 class
  bounds) — the domain-partition check on the named limits (register 18's
  `when { }` guards) rides the same declarations.
- Phase 3 (plurimath's plane): the unit expressions, the dimension
  vectors, the conversions — the evaluation types the kernel's kind
  strings only name.

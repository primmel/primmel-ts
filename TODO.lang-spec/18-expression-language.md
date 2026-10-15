# 18 — The Primmel expression language: first-class expressions, not OCL strings

## The gap
Every machine-executable expression in the language — requirement limits, the
class laws, derivations, derives — is a QUOTED STRING: `"ocl{abs(e) <= mpe}"`.
The consequences, all verified this session:
1. Double escaping (two round-trip dump bugs came from expression-string
   handling).
2. C171 validates identifiers by REGEX over the string — the grammar cannot
   see inside it; a typo surfaces at check time, not parse time.
3. OCL is borrowed ceremony: the corpus's expressions are arithmetic
   comparisons; the wrapper carries no semantics the language lacks.
4. No highlighting, no editor support, no parse-time errors.

## The design
The expression is FIRST-CLASS SYNTAX — the block content:

```prl
requirement /req/metrological/mpe-vehicle-mass {
  limit {
    abs(e_vehicle) <= mpe_class
  }
}

requirement_class /req/electronic/software-protection {
  limit {
    sealing or signalling
  }
}

verdict drift_error {
  derive {
    indication - cgm_certified_value
  }
  inputs { indication cgm_certified_value }
}
```

The grammar (PARG rules, the precedence climbing):
`implies` < `or` < `xor` < `and` < comparison (`<= >= < > = ≠`) <
additive (`+ -`) < multiplicative (`* /`) < unary (`- not`) <
primary (the dotted paths, the calls `abs/max/min/floor/…`, the literals,
the parenthesised groups).

## The semantics
- The identifiers resolve at PARSE TIME against the scope: the expression's
  `uses`/`inputs` entries, the test's variables, the package's symbols,
  datums, verdicts, tables, the contained members (the algebra). The air is a
  parse error — C171's check becomes the parser's name resolution; the rule
  remains as the checker's restatement for the legacy string form.
- C172's law check walks the AST: the identifiers ⊆ the contained members;
  the top-level connectives are the algebra.
- plurimath stays on the PRESENTATION plane: the render hints (§12) carry the
  display math; the semantic expressions are Primmel's own.

## The migration
- Phase 1: the expression grammar + the AST + the parse — the inline form is
  accepted EVERYWHERE an `ocl{}` string is accepted today (limit, derive,
  derivation, constraint, invariant, check completion).
- Phase 2: C171/C172 walk the AST; the string form still parses (the legacy).
- Phase 3: the corpus migrates mechanically (the `ocl{X}` strings → the
  inline `X` — a dumper-side rewrite plus the model transform); the string
  form deprecates to Annex D.
- checker2 inherits the expression grammar as its parity target.

## The sizing
The grammar rules + the AST + the checker walk: ~3–4 kernel days; the corpus
migration: mechanical; the deprecation: one release after the migration.

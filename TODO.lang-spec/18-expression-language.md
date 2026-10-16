# 18 — The Primmel expression language: first-class expressions, not OCL strings

**Status: LANDED (2026-10-16, phase 1+2 on limits and class laws).**
`src/expressions/` — the lexer, the precedence-climbing parser, the AST,
`freeIdentifiers`/`renderExpression`; the limit parses the inline
`expression { … }` block (parse-time syntax gate, canonical render, dump
fixpoint); C171/C172 walk the AST. The r134 corpus carries the pilot (8
limits migrated). Remaining: the derive/derivation/constraint/invariant
carriers (phase 1's rest), the named multiple limits with `when { }`
guards (below), the PARG artifact handoff to plurimath, the legacy-string
deprecation.

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

The expression is FIRST-CLASS SYNTAX — and the limit is a FUNCTION: it takes
**declarative arguments**, and the scope is passed into it. The formula is
wrapped in an **`expression { … }` block** (the owner's ruling, 2026-10-16):
the body is delimited, never floating between the args and the facets —
which also makes the parse unambiguous (no head-detection heuristics; the
legacy carrier is `expression "ocl{…}"` — a STRING, the v3.3 carrier is
`expression { … }` — a BLOCK; string-vs-block is the whole decision):

```prl
requirement /req/metrological/mpe-vehicle-mass {
  limit {
    args {
      e_vehicle  <- symbol:e_vehicle
      mpe_class  <- table:vehicle_mpe.mpe_initial
      d          <- attribute:scale_interval
      n_axles    <- observable:n_axles
    }
    expression {
      abs(e_vehicle) <= max(mpe_class, 1 * d * n_axles)
    }
    notes "Table 2 percentage of the conventional value (6.7)."
  }
}

requirement_class /req/c {
  limit {
    # no args: the CONTAINMENT is the scope (C172 names members only)
    expression {
      mpe_mass or d_floor
    }
  }
  requirement mpe_mass { … }
  requirement d_floor { … }
}
```

The binding forms (as shipped, r134-verified):
`<kind>:<id>` in-package (`symbol:` `table:` `datum:` `verdict:`
`attribute:`, resolved against the package's own registries; a dotted id
rides the declared object — `table:vehicle_mpe.mpe_initial`), `observable:`
(the dispatch context), `self.<path>` (the subject aspect), and
`<package>:<kind>:<id>` across a `uses` edge (the composed gate resolves
it). The dispatch-context roots (`sample family group model instrument
specimen`) are allowed as PATH roots — the pronouns of the dispatch —
never as bare scalars.

The grammar (PARG rules, the precedence climbing):
`implies` < `or` < `xor` < `and` < comparison (`<= >= < > = ≠`) <
additive (`+ -`) < multiplicative (`* /`) < unary (`- not`) <
primary (the bound names, the calls `abs/max/min/floor/…`, the dotted
table calls `table.method(a, b)`, the literals, the parenthesised groups).
The call vocabulary is CLOSED (C171 flags unknown callees; an arg bound to
a table is a callable). `renderExpression` canonicalizes (the unary over
a binary re-parenthesizes) — the dump emits the canonical source and the
re-parse is a fixpoint.

## The semantics
- **`args { name <- source }` is the scope**: the local name binds to a
  declared source (the binding forms above). The body's identifiers are
  the args and nothing else — plus `self`-rooted paths and the
  dispatch-context path roots. The SYNTAX gate is parse-time (a malformed
  body fails the load); the BINDING is C171/C172 walking the AST — the
  exact-resolution contract, the air cannot hide.
- **The provenance is in the expression's own header**: the reader sees where
  every name comes from; two imported packages declaring the same id
  disambiguate by their qualified sources; the closure report names the
  packages an expression's scope actually reaches.
- **The legacy string form** (`"ocl{…}"`) is accepted through the transition
  with its `uses { }` list as the (ambient, deprecated) scope, and deprecates
  to Annex D with the corpus migration.
- plurimath stays on the PRESENTATION plane: the render hints (§12) carry the
  display math; the semantic expressions are Primmel's own.

## Multiple limits — the list, the guard, and the domain coverage

A requirement carries a LIST of limits: real standards bound different
sub-domains differently (R 60's MPE varies across the weighing range — one
bound per e-interval). Each limit is a complete function: its own args, its
own **applicability guard**, its own assertion:

```prl
requirement /req/metrological/mpe-ranges {
  limit "mpe-low-range" {
    args {
      e  <- oiml-r134:observable:e
      mu <- oiml-r134:table:vehicle_mpe.mpe_low
    }
    when {
      e <= 5000
    }
    expression {
      abs(e) <= mu
    }
  }

  limit "mpe-high-range" {
    args {
      e  <- oiml-r134:observable:e
      mu <- oiml-r134:table:vehicle_mpe.mpe_high
    }
    when {
      e > 5000
    }
    expression {
      abs(e) <= mu
    }
  }
}
```

- **The limits are named** — the name is the public handle: the tests
  target it, the coverage/retrieval/diff/mappings cite it, the
  diagnostics name the failing limit. Multiple limits are a conjunction:
  every limit whose guard holds must hold. `when { … }` is an expression over the same args (the domain guard —
  not prose, not a comment).
- **No guard** = the limit applies over the whole domain (the simple case
  stays one-line writable).
- **The domain-coverage check** (the SOTA payoff, phased): when the bound
  args declare their domains (the symbol's range — the D 11 class bounds, the
  R 60 e-axis), the checker verifies the guards PARTITION the domain — no
  gap where no limit applies, no overlap where two do (an error, because the
  assertion is ambiguous there). Phase 1: the parse + the guard resolution;
  phase 2: the partition check once the args' domains carry declared ranges.

## The migration
- Phase 1: the expression grammar + the AST + the parse — the inline form is
  accepted everywhere an `ocl{}` string is accepted today (limit, derive,
  derivation, constraint, invariant, check completion).
- Phase 2: C171/C172 walk the AST; the string form still parses (the legacy).
- Phase 3: the corpus migrates mechanically (the `ocl{X}` strings → the
  inline form); the string form deprecates to Annex D.
- checker2 inherits the expression grammar as its parity target.
- **The evaluation engine is plurimath** — the mandate issued
  (plurimath#488, docs/MANDATE-semantic-math.md): the QuantityValue type
  system with the unit algebra and the dimension vectors, the GUM
  uncertainty propagation, the series aggregations, and the constraint
  evaluation with the residuals — and the expression grammar is
  formalized in PARG (expressions.parg in plurimath, per the mandate):
  one compiled artifact, every runtime (the Ruby reference, the
  plurimath-js/ts wasm, and this kernel's limit blocks embed the same
  artifact). The kernel parses the model, builds the scope, and delegates
  the evaluation; the .pgtest vectors are the cross-implementation gate.



## The sizing
The grammar rules + the AST + the checker walk: ~3–4 kernel days; the corpus
migration: mechanical; the deprecation: one release after the migration.

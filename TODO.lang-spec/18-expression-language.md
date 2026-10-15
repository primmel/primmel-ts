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
The expression is FIRST-CLASS SYNTAX — and the limit is a FUNCTION: it takes
**declarative arguments**, and the scope is passed into it. Every name in the
body is a declared argument bound to its qualified source — the local scope is
explicit, never ambient, never global:

```prl
requirement /req/metrological/mpe-vehicle-mass {
  limit {
    args {
      e_vehicle  <- oiml-r134:symbol:e_vehicle
      mpe_class  <- oiml-r134:table:two_axle_mpe.mpe
      d          <- oiml-r134:symbol:d
      n_axles    <- oiml-r134:symbol:n_axles
    }
    abs(e_vehicle) <= max(mpe_class, d * n_axles)
  }
}

requirement_class /req/electronic/software-protection {
  limit {
    args {
      sealing    <- member:sealing
      signalling <- member:signalling
    }
    sealing or signalling
  }
}

verdict drift_error {
  args {
    indication         <- observable:indication
    cgm_certified_value <- observable:cgm_certified_value
  }
  derive {
    indication - cgm_certified_value
  }
  inputs { indication cgm_certified_value }
}
```

The grammar (PARG rules, the precedence climbing):
`implies` < `or` < `xor` < `and` < comparison (`<= >= < > = ≠`) <
additive (`+ -`) < multiplicative (`* /`) < unary (`- not`) <
primary (the bound names, the calls `abs/max/min/floor/…`, the literals,
the parenthesised groups).

## The semantics
- **`args { name <- qualified-source }` is the scope**: the local name binds
  to the package-scoped declaration (`package:kind:id` — the same
  scoped-reference grammar as the locator-qualified imports and the scoped
  requires). `member:` names the containment's own members (the algebra law).
- **The body's identifiers are the args and nothing else**: the resolution is
  exact at parse time — a name outside the args is a parse error, the air
  cannot even be written. C171 becomes the parser's binding check; the rule
  remains as the checker's restatement for the legacy string form.
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
  limit mpe_low_range {
    args {
      e  <- observable:e
      mu <- table:vehicle_mpe.mpe_low
    }
    when {
      e <= 5000
    }
    abs(e) <= mu
  }

  limit mpe_high_range {
    args {
      e  <- observable:e
      mu <- table:vehicle_mpe.mpe_high
    }
    when {
      e > 5000
    }
    abs(e) <= mu
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



## The sizing
The grammar rules + the AST + the checker walk: ~3–4 kernel days; the corpus
migration: mechanical; the deprecation: one release after the migration.

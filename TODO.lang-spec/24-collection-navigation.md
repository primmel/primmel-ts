# 24 — The collection navigation in the expression grammar

**Status: OPEN — the arming blocker.** The scheme-lifecycle completion
constraints (oiml-smart-core `constraints.prl`: `completion_fees_settled`,
`completion_custody_closed`, `completion_threads_resolved`,
`completion_reports_finalized`, `completion_certificate_registered`)
express the CASCO completion gates as OCL collection navigation:
`fees->forAll(f | f.status = 'MARKED_PAID')`. The v1 expression grammar
has no `->` navigation, no iterators, no lambda parameters — these five
constraints are legal legacy carriers that CANNOT migrate to the inline
blocks until the grammar grows the collection plane.

## The design (when picked up)

`collection -> forAll(v | expr)` / `-> exists(v | expr)` /
`-> select(v | expr)` — the AST node
`{ type: 'navigation', source, op, var, body }`; the lambda parameter
scopes the body exactly like `args` (the same resolution doctrine);
C171/C177 walk the body with the parameter added to the scope. The
arithmetic/comparison grammar is unchanged; the navigation rides the
postfix position after a name.

## What it blocks

- oiml-r134's `language v3.4` arming: C178 counts the whole COMPOSED
  standard, and r134's closure (via oiml-smart-core) carries these five
  legacy carriers. r134's own limits are fully migrated; the arming
  lands when the collection plane does.

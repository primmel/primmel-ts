# 21 — The critique-series residue (the audit's actionable ledger)

**Status (2026-10-30): OPEN — the audit's residue, registered so nothing
is silently dropped.** The language program's waves (1.21.42–59) closed
the consolidation register and the LML audit; the prior critique series
(LANGUAGE-CRITIQUE 1–3 + REVIEW, PRIMITIVE-AUDIT, the two PROPOSALs)
left the items below open. Each is one line with its source; none
blocks the language surface — they are backlog the owner schedules.

## Defect leads (verify, then fix or close)

- **C171's observable guard** (CRITIQUE-2 #4): RESOLVED
  (2026-10-30, kernel + model-library#154). Verified: an
  `observable:never-declared` arg escaped C171 at both args walks
  (the requirement-limit walk and the constraints walk) — the
  differential probe fired C171 on an undeclared `symbol:` control
  and stayed silent on the undeclared observable. The fix resolves
  `observable:` like every declaration kind: the prefix joins
  DECLARATION_KINDS, the id resolves against the expression registry,
  and the measurement plane (`standard.variables`, MN 113 §2.3's
  canonical test-quantity keyword) joins the registry. The corpus
  sites the escape was hiding: ten r49 measurements (test-quantities),
  the r49 relative-error Vi/Va re-spells, and the core's five
  completion collections (oiml-smart-core
  `specification/symbols.prl`). All gates green: unit 1922, suite
  281/281, checker2 138, corpus 68/0.

## Register-less items (the critique series dropped them; now they live here)

- **~~Condition-set → table migration~~** (CRITIQUE-3 REVIEW's top
  register item): **RESOLVED before it was ever scheduled** — the
  register entry was stale when written. The typed-table migration
  landed as C154; the corpus carries zero live `condition_set` blocks
  (the severity/levels registers of the IEC and R packages are typed
  tables, the rows bind via `table:<id>.<column>`; every migrated file
  names the migration in its header). Verified 2026-10-30 by census.
- **~~The numeric-semantics declaration~~** (CRITIQUE-3 REVIEW's other
  register-worthy item): **RESOLVED** — spec §12 `[[numeric-semantics]]`
  declares exact-decimal surface literals (trailing zeros are
  precision statements, preserved verbatim on the wire — the
  round-trip gate is the proof), auxiliary numerics canonicalize, and
  comparisons are binary double (IEEE 754) by doctrine.
- **~~Variable ↔ subform type link~~** (CRITIQUE-3 REVIEW watch
  item): **RESOLVED** (2026-10-31, kernel#266 → 1.21.68,
  library#164 v0.33.41, spec#97): `type collection<Row>` — the
  parameterized element type, opt-in (a bare `collection` stays
  untyped). The navigation's lambda parameter reads against the
  declared class's attributes; an unknown member is air (C194,
  checker2-mirrored; CHK-194 in the suite).
- **The four suppression ledgers** (CRITIQUE-2 #5 — never registered
  until this pass): a package's known debt lives in four places (the
  package allowlist, coverage.json's sentence allowances, the fidelity
  gate's inline EXPLAINED map — 10 packages, 49 tokens — and
  link-method-refs' KNOWN_ABSENCES — empty since its one entry went
  STALE), with three suppression semantics, two of them in code — the
  debt is not portable with the package. The design proposal is
  written: `PROPOSAL-debt-ledger.md` (2026-10-31) — Option A extends
  the allowlist with typed `fidelity_entry`/`method_ref_entry` shapes
  (the STALE walk transfers), coverage.json STAYS as the measurement's
  input; awaits the ruling.
- **~~C171's remaining watch legs~~** (CRITIQUE-2 #4) — FULLY
  DISPOSITIONED (2026-10-30, three PRs):
  the core leg — the observable declaration check — closed (above);
  the forms' `bind observable:X` leg closed (C1 resolves the bind
  against the same registries the limits' args use; it surfaced r49's
  two stale Va/Vi binds, re-spelled to the declared measurements);
  and the dispatch-context leaf leg closed — the DECLARABLE planes
  resolve their leaves (the attribute planes
  `{model,family,group}.{parameters,attributes}.X` join the attribute
  registry, `*.classification.X` joins the dimensions; corpus 68/0
  clean on landing). The run-context roots (`sample.*`, `instrument.*`,
  `specimen.*`) stay open BY DOCTRINE — runtime data, no registry to
  join ("a body over pure dispatch-context paths binds nothing and is
  legal"). CRITIQUE-2 #4 is closed end to end.
- **CLAUDE-2 residue**: ~~the derived-plane annotation~~ (**RESOLVED
  2026-10-31**: `ser-des/derived-planes.ts` declares the derived
  planes — the C160 hoist and the C161 folds — each with its doctrine,
  and the fixpoint guard asserts the declaration against the dumpers
  both ways: the wire carries no declared plane,
  dump(load(dump(x))) is dump(x) — kernel#270 → 1.21.70, spec#99);
  ~~one list shape (applicability vs enum_values
  vs values)~~ (**RESOLVED 2026-10-31** — and it was a defect, not an
  ambiguity: the manifest's line-run spelling parsed `provides a b` as
  `['alpha']`, silently truncating. The six list facets take the block
  list form; the line-run spelling refuses at parse (kernel#261,
  1.21.66; spec §9, spec#95). the facet-level residue is
  RESOLVED too (kernel#264, 1.21.67; spec §10.6, spec#96): the
  construct-level value-set facets (dimension `values`, attribute and
  calculation-input `enum_values`, form-field `values`) take the
  block or bracket form, the truncating line-run spelling refuses at
  parse — the applicability bracket-list vocabulary stays);
  derived-plane annotation; ~~`--explain` + the truth table~~
  (**RESOLVED 2026-10-31**: `primmel check --explain <rule-id>` prints
  the rule's adjudication from the checker's own constants; spec §17.4
  `[[adjudication-matrix]]` states the five-step composition as law);
  ~~spelling normalization as a layer~~ (**RESOLVED 2026-10-31**:
  `spelling_variants [ … ]` on the register unit — the declared
  normalization layer; the register's resolution reads the variants, a
  collision refuses at parse both ways; opt-in, the corpus carries
  zero variant sites, the gates' string massaging migrates with the
  debt-ledger ruling — kernel#272 → 1.21.71, library#167 v0.33.44,
  spec#100); ~~the manifest schema~~ (**RESOLVED
  2026-10-31**: the facet registry — `ser-des/config/manifestSchema.ts`
  — declares every manifest facet's keyword, aliases, arity, closed
  vocabulary, and judging rules; `primmel check --manifest-schema`
  publishes it; the tests pin it against the parser's handler set in
  both directions — kernel#268 → 1.21.69, spec#98);
  ~~family invariants~~ (**RESOLVED 2026-10-31**:
  FAMILY_INVARIANTS in the registry — one ownership sentence per
  family, the MECE boundary a new rule declares against; Annex B's
  section intros carry them (spec#94), --rules and --explain print
  them, and the tests assert the map covers every rule-bearing family
  and vice versa — kernel#259, 1.21.65); the manifest schema.
- **Merge tooling** (PROPOSAL-model-separation): the prerequisites
  (model diff, locators, the closure report) landed; the tool itself
  is backlog.

## Owner-demoted or -deferred (recorded, not scheduled)

- LSP/query, the playground, EBNF↔PARG conformance, vector measurand
  (`measurand_kind` stays singular), dual comparison semantics, §54's
  signature↔register binding, the manifest head-id, NOTICE files, the
  v3.4 bump (activates C178), L2 `primmel/models-demo`.
- The datum origin-axis conversation — PROPOSAL-origin-axis.md
  (2026-10-30) awaits the ruling.

## Doc-sync (fixed by the 2026-10-30 audit)

- The kernel CLAUDE.md's rule count said "148 rules C1–C148" — synced
  to the registry (188 rows, C1–C193, pinned by `annex-b --check`).

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
- **Variable ↔ subform type link** (CRITIQUE-3 REVIEW watch item): a
  variable's type and the subform field it feeds share no declared
  linkage — `type collection` carries no element type, so C177 goes
  silent exactly where data is most structured. The remedy sketched:
  `type collection<Row>` against a declared row shape. Watch — not
  scheduled.
- **The four suppression ledgers** (CRITIQUE-2 #5 — never registered
  until this pass): a package's known debt lives in four places (the
  package allowlist, coverage.json's sentence allowances, the fidelity
  gate's inline EXPLAINED map, link-method-refs' KNOWN_ABSENCES), with
  three suppression semantics, two of them in code — the debt is not
  portable with the package. The remedy sketched: one typed ledger per
  package, structured keys, the gates as readers; message-glob
  matching dies last. Tooling-scale; owner schedules.
- **C171's remaining watch legs** (CRITIQUE-2 #4's residue after this
  round's closure): the dispatch-context roots (`model.*`,
  `family.*`, `sample.*`) ride as path roots without their leaves
  resolving. The forms' `bind observable:X` leg CLOSED (2026-10-30):
  C1 resolves the bind against the same registries the limits' args
  use — a typo on the form side can no longer agree with a limit-side
  typo by both being unchecked (the closure surfaced r49's two stale
  Va/Vi binds, re-spelled to the declared measurements). The core leg
  — the observable declaration check — is closed (above).
- **CLAUDE-2 residue**: one list shape (applicability vs enum_values vs
  values); derived-plane annotation; `--explain` + the truth table;
  spelling normalization as a layer (spelling.ts is ISO 24229 tagging,
  not normalization); family invariants; the manifest schema.
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

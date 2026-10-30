# 21 — The critique-series residue (the audit's actionable ledger)

**Status (2026-10-30): OPEN — the audit's residue, registered so nothing
is silently dropped.** The language program's waves (1.21.42–59) closed
the consolidation register and the LML audit; the prior critique series
(LANGUAGE-CRITIQUE 1–3 + REVIEW, PRIMITIVE-AUDIT, the two PROPOSALs)
left the items below open. Each is one line with its source; none
blocks the language surface — they are backlog the owner schedules.

## Defect leads (verify, then fix or close)

- **C171's observable guard** (CRITIQUE-2 #4, partial): `observable:`
  prefixed args skip C171's declaration check — the `kind !==
  'observable'` guard at check.ts:1547 is the named hole. The symbols
  registry carries observables (check.ts:734); the escape should close
  or be documented as deliberate.

## Register-less items (the critique series dropped them; now they live here)

- **Condition-set → table migration** (CRITIQUE-3 REVIEW's top register
  item): `DECLARATION_KINDS` unchanged (symbol|table|datum|verdict|
  attribute|process, check.ts:1398) — the migration the review rated
  first was never scheduled.
- **Variable ↔ subform type link** (CRITIQUE-3 REVIEW watch item): a
  variable's type and the subform field it feeds share no declared
  linkage.
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

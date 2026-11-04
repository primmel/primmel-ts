// ─────────────────────────────────────────────────────────────────────
// The documentary-registers family (C124–C128, smart TODO.roadmap/40
// batch 4, the packages-as-SSOT epic): the declaration-shape legs over
// the documentary registers — pair_list (C124), calculation variants
// (C125), the formula_note register's reverse applicability (C126),
// common_test_condition (C127), and part_annex (C128). Shape-only:
// where a leg quantifies over app-side records (the pair keys over
// values), it stays app-side — the kernel checks the declaration
// shape only. Per-register gating throughout (the C58 doctrine): a
// resolve leg runs only when its target register is in composition
// scope.
//
// THE FAMILY-MODULE PATTERN (the check.ts decomposition, one family
// at a time): the family takes the context record it actually uses —
// `standard`, the precomputed id sets it reads, and the emit closure
// — and nothing else. The bodies move verbatim from check.ts; the
// compiler and the suite pin the move.
// ─────────────────────────────────────────────────────────────────────

import type Standard from '../types/Standard';

export interface DocumentaryRegistersContext {
  standard: Standard;
  dimIds: Map<string, Set<string> | null>;
  symbolIds: Set<string>;
  err: (check: string, message: string) => void;
}

export function runDocumentaryRegistersFamily({
  standard,
  dimIds,
  symbolIds,
  err,
}: DocumentaryRegistersContext): void {
  // ── C124: pair-list-shape (smart TODO.roadmap/40 batch 4; the ──────
  // packages-as-SSOT epic) ────────────────────────────────────────────
  // The pair_list block's declaration shape: the key and value slots are
  // required, the component ids are unique within the block, and the
  // key_dimension names a declared applicability dimension WHEN the
  // dimension register is in composition scope (per-register gating, the
  // C58 doctrine). The closed-registry-over-VALUES leg (pair keys drawn
  // from the dimension's values ∪ the declared components) quantifies
  // over app-side records, so it stays app-side — the kernel checks the
  // declaration shape only.
  for (const a of standard.attributeDefinitions ?? []) {
    const pl = a.pairList;
    if (!pl) {
      continue;
    }
    const where = `attribute_definition ${a.id}: pair_list`;
    if (!pl.key) {
      err('C124', `${where}: the key slot is required (pair-list-shape)`);
    }
    if (!pl.value) {
      err('C124', `${where}: the value slot is required (pair-list-shape)`);
    }
    const seen = new Set<string>();
    for (const c of pl.components) {
      if (seen.has(c.id)) {
        err(
          'C124',
          `${where}: component "${c.id}" is declared twice (pair-list-shape)`,
        );
      }
      seen.add(c.id);
    }
    if (pl.keyDimension && dimIds.size > 0 && !dimIds.has(pl.keyDimension)) {
      err(
        'C124',
        `${where}: key_dimension "${pl.keyDimension}" is not a declared applicability dimension (pair-list-shape)`,
      );
    }
  }

  // ── C125: formula-variant-shape (smart TODO.roadmap/40 batch 4; the ─
  // packages-as-SSOT epic) ────────────────────────────────────────────
  // The variant block's declaration shape (the top-level calculation
  // shape discipline mirrored onto the realization): variant ids are
  // unique within the owning calculation, and the type-conditional
  // facets are present — an expression variant carries its expression,
  // a table_lookup variant its lookup block, a profile_lookup variant
  // its profile path. The variant's params are engine call-site names
  // and deliberately do NOT resolve against the calculation's inputs —
  // there is no params-resolve leg (the block stays documentary/
  // engine-facing).
  for (const c of standard.calculations ?? []) {
    const seen = new Set<string>();
    for (const v of c.variants ?? []) {
      const where = `calculation ${c.id}: variant ${v.id}`;
      if (seen.has(v.id)) {
        err(
          'C125',
          `${where}: the variant id is declared twice (formula-variant-shape)`,
        );
      }
      seen.add(v.id);
      if (v.type === 'expression' && !v.expression) {
        err(
          'C125',
          `${where}: type expression requires the expression facet (formula-variant-shape)`,
        );
      }
      if (v.type === 'table_lookup' && !v.lookup) {
        err(
          'C125',
          `${where}: type table_lookup requires the lookup block (formula-variant-shape)`,
        );
      }
      if (v.type === 'profile_lookup' && !v.profile) {
        err(
          'C125',
          `${where}: type profile_lookup requires the profile facet (formula-variant-shape)`,
        );
      }
    }
  }

  // ── C126: formula-note-targets-resolve (smart TODO.roadmap/40 ──────
  // batch 4; the packages-as-SSOT epic) ────────────────────────────────
  // The formula_note register's reverse applicability resolves: every
  // applies_to entry names a declared symbol WHEN the symbol register
  // is in composition scope (per-register gating, the C58 doctrine).
  if (symbolIds.size > 0) {
    for (const n of standard.formulaNotes ?? []) {
      for (const s of n.appliesTo ?? []) {
        if (!symbolIds.has(s)) {
          err(
            'C126',
            `formula_note ${n.id}: applies_to "${s}" is not a declared symbol (formula-note-targets-resolve)`,
          );
        }
      }
    }
  }

  // ── C127: common-test-condition-shape (smart TODO.roadmap/40 ───────
  // batch 4; the packages-as-SSOT epic) ────────────────────────────────
  // The register's declaration shape: the description is the one facet
  // BOTH YAML shapes carry (the r60/r144/r129 array entries and the r91
  // keyed-map entries alike) — a condition without its text is a
  // carrier with no content. The title stays OPTIONAL (the r91 map
  // entries carry none; requiring it would force content invention at
  // migration) and the reference stays a free citation string (the
  // linker owns the citation semantics — no kernel leg).
  for (const c of standard.commonTestConditions ?? []) {
    if (!c.description) {
      err(
        'C127',
        `common_test_condition ${c.id}: the description is required — a condition entry carries its normative text (common-test-condition-shape)`,
      );
    }
  }

  // ── C128: part-annex-shape (smart TODO.roadmap/40 batch 4; the ─────
  // packages-as-SSOT epic) ────────────────────────────────────────────
  // The annex-volume register's declaration shape: letters are unique
  // per package (the index keys on the printed letter) and every entry
  // carries its clause-URN provenance. The obligation vocabulary is
  // parse-enforced upstream (the fail-closed precedent), so it carries
  // no check leg.
  {
    const seenLetters = new Map<string, string>();
    for (const a of standard.partAnnexes ?? []) {
      if (a.letter) {
        const prior = seenLetters.get(a.letter);
        if (prior !== undefined) {
          err(
            'C128',
            `part_annex ${a.id}: letter "${a.letter}" is already declared by ${prior} — the annex-volume index keys on the printed letter (part-annex-shape)`,
          );
        } else {
          seenLetters.set(a.letter, a.id);
        }
      }
      if (!a.source?.doc) {
        err(
          'C128',
          `part_annex ${a.id}: the source provenance is required — a documentary register entry cites its part (part-annex-shape)`,
        );
      }
    }
  }
}

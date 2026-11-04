// ─────────────────────────────────────────────────────────────────────
// The LML-aligned substrate (C158–C162 + C164 + C167 + C189,
// TODO.lang-gaps; the spec's validation contract, language-v3 §16) —
// moved wholesale from check.ts (the family-module decomposition): the
// five constructs (wireMappings / stringFormats / namespaces / datums /
// checks) carry their declared data; the checker does the discipline.
// The compiler and the suite pin the move.
// ─────────────────────────────────────────────────────────────────────

import { MAPPING_FORMATS, MATH_NOTATIONS } from '../ser-des/config/lmlAligned';
import { expectedFoldIds } from '../ser-des/config/check-fold';
import type { CheckIssue } from '../check';
import type Standard from '../types/Standard';

/**
 * C158–C162 + C164 + C167 + C189 — the LML-aligned substrate
 * (TODO.lang-gaps; the spec's validation contract, language-v3 §16).
 * The five constructs (wireMappings / stringFormats / namespaces /
 * datums / checks) carry their declared data; the checker does the
 * discipline:
 *
 *   C158 prose-quarantine: free text stays in the description block — a
 *      clause citation inside a datum's description is a reference in
 *      prose, and the reference belongs in a urn (the deletion test's
 *      kernel-side proxy: the citation patterns are exactly the prose a
 *      re-locator would trip over). An unfinished-prose TODO.roadmap
 *      marker warns.
 *   C159 urn-only-refs: a wire mapping's namespace names a declared
 *      namespace block (the serializer emits the prefix/uri pair).
 *   C160 signature-closure: every name a CANONICAL check consumes (its
 *      inputs) is a declared datum or symbol — a check over an
 *      undeclared input is uncomputable. A check FOLDED from a retired
 *      spelling (it carries `folds`) is exempt: the fold is the
 *      parse-side view of its owner, and the spelling's names are
 *      judged at the construct that carries them.
 *   C161 check-surface: the retired boolean spellings fold into the
 *      checks collection (spec §16 C161, TODO.lang-gaps/03) — the
 *      completeness walk re-derives the expected folds from the
 *      Standard's forms / requirements / conformance tests / processes
 *      (the same per-construct derivations the parsers registered by,
 *      ser-des/config/check-fold.ts) and errors on a spelling whose
 *      folded check never materialized (a Standard built by hand or by
 *      an older parser).
 *   C162 namespace-coherence: the metadata namespace string names a
 *      declared namespace block when one is declared at all.
 *   C164 wire-mapping-coverage: a mapping's format is in the wire
 *      vocabulary and its class names a declared dataclass when
 *      dataclasses are declared.
 *   C167 qualified-unit-reference: a datum's unit and quantity kind use
 *      the closed qualified `<namespace>:<id>` form (si:…, unitsdb:…) —
 *      a bare unit token is exactly the ambiguity the registries exist
 *      to close.
 *   C189 datum-render-notation: a datum's render hints name their
 *      notation, and the notation vocabulary is closed. (The parser
 *      silently drops an unknown notation token, so parsed models never
 *      carry one — this leg guards programmatically built Standards and
 *      pins the closed vocabulary against renderer growth. Formerly
 *      carried under the C161 id, which predates the spec's C161
 *      check-surface rule; the render walk stands here under its own
 *      id.)
 *
 * C163 change-levels runs over `primmel diff --exit-code` (the existing
 * diff classifier — model-diff.ts); C165/C166 await the calculation
 * math plane. All three are catalog-only entries (check-rules.ts) with
 * no kernel leg here — deliberately, not by omission.
 */
export function checkLmlAligned(standard: Standard): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const err = (check: string, message: string) =>
    issues.push({ check, severity: 'error', message });
  const warn = (check: string, message: string) =>
    issues.push({ check, severity: 'warning', message });

  const namespaceIds = new Set((standard.namespaces ?? []).map(n => n.id));
  // The mapping targets the LML class name as authored (`mapping xml
  // Ceramic`); a registerable class declares `Ceramic#data`, so the
  // target matches the id or the id with its `#data` register suffix
  // stripped (spec §Serialization's authored shape).
  const dataclassIds = new Set<string>();
  for (const c of standard.dataclasses ?? []) {
    dataclassIds.add(c.id);
    dataclassIds.add(c.id.replace(/#data$/, ''));
  }
  const symbolIds = new Set((standard.symbols ?? []).map(s => s.id));
  const datumIds = new Set((standard.datums ?? []).map(d => d.id));

  // ── C158 prose-quarantine ──────────────────────────────────────────
  // A datum with a label and an empty description is the FINE form; the
  // quarantine breaks only when the description smuggles a citation.
  const CLAUSE_CITATION = /clause-\d|§\d/i;
  for (const d of standard.datums ?? []) {
    if (!d.description) {
      continue;
    }
    if (CLAUSE_CITATION.test(d.description)) {
      err(
        'C158',
        `datum ${d.id}: the description cites a clause — a reference in prose belongs in a urn reference, not the quarantined free text (prose-quarantine)`,
      );
    } else if (d.description.includes('TODO.roadmap')) {
      warn(
        'C158',
        `datum ${d.id}: the description carries the unfinished-prose marker TODO.roadmap (prose-quarantine)`,
      );
    }
  }

  // ── C159 urn-only-refs ─────────────────────────────────────────────
  for (const w of standard.wireMappings ?? []) {
    if (w.namespaceRef && !namespaceIds.has(w.namespaceRef)) {
      err(
        'C159',
        `mapping ${w.id}: namespace "${w.namespaceRef}" names no declared namespace block (urn-only-refs)`,
      );
    }
  }

  // ── C160 signature-closure ─────────────────────────────────────────
  // A folded check is the parse-side view of its owner spelling: the
  // names it carries were never the canonical signature contract, and
  // the owner construct is where their discipline lives. C160 judges
  // canonical checks only.
  for (const c of standard.checks ?? []) {
    if (c.folds) {
      continue;
    }
    for (const inp of c.inputs ?? []) {
      if (!(datumIds.has(inp) || symbolIds.has(inp))) {
        err(
          'C160',
          `check ${c.id}: input "${inp}" resolves to no declared datum or symbol — the check consumes an undeclared name (signature-closure)`,
        );
      }
    }
  }

  // ── C161 check-surface ─────────────────────────────────────────────
  // The retired boolean spellings fold into the checks collection at
  // parse (ser-des/config/check-fold.ts — the one derivation the
  // parsers and this walk share). Every spelling a Standard carries
  // must have materialized its folded check(s); a miss means the
  // Standard was built by hand or by an older parser.
  const foldedIds = new Set(
    (standard.checks ?? []).filter(c => c.folds).map(c => c.id),
  );
  for (const id of expectedFoldIds(standard)) {
    if (!foldedIds.has(id)) {
      err(
        'C161',
        `check ${id}: the retired boolean spelling it folds from is present, but no folded check carries its id — every boolean spelling materializes its check (check-surface)`,
      );
    }
  }

  // ── C162 namespace-coherence ───────────────────────────────────────
  const metaNamespace = standard.meta?.namespace ?? '';
  if (
    metaNamespace &&
    namespaceIds.size > 0 &&
    !namespaceIds.has(metaNamespace)
  ) {
    err(
      'C162',
      `metadata namespace "${metaNamespace}" names no declared namespace block (namespace-coherence)`,
    );
  }

  // ── C164 wire-mapping-coverage ─────────────────────────────────────
  for (const w of standard.wireMappings ?? []) {
    if (!MAPPING_FORMATS.includes(w.format)) {
      err(
        'C164',
        `mapping ${w.id}: format "${w.format}" is outside the wire vocabulary (${MAPPING_FORMATS.join('|')}) (wire-mapping-coverage)`,
      );
    }
    if (dataclassIds.size > 0 && !dataclassIds.has(w.target)) {
      err(
        'C164',
        `mapping ${w.id}: the class "${w.target}" is no declared dataclass — a class serialized to a format carries the declared mapping (wire-mapping-coverage)`,
      );
    }
  }

  // ── C167 qualified-unit-reference ──────────────────────────────────
  const QUALIFIED_REF = /^[a-z]+:[A-Za-z0-9_-]+$/;
  for (const d of standard.datums ?? []) {
    if (d.unit && !QUALIFIED_REF.test(d.unit)) {
      err(
        'C167',
        `datum ${d.id}: unit "${d.unit}" is bare — a unit reference uses the qualified <namespace>:<id> form (si:…, unitsdb:…) (qualified-unit-reference)`,
      );
    }
    if (d.quantityKind && !QUALIFIED_REF.test(d.quantityKind)) {
      err(
        'C167',
        `datum ${d.id}: quantity_kind "${d.quantityKind}" is bare — a quantity-kind reference uses the qualified <namespace>:<id> form (si:…, unitsdb:…) (qualified-unit-reference)`,
      );
    }
  }

  // ── C189 datum-render-notation ─────────────────────────────────────
  // Formerly carried under the C161 id — a row that predates the spec's
  // C161 check-surface rule; the render walk stands here under its own
  // id (the re-homing rode the boolean-fold fold, TODO.lang-gaps/03).
  for (const d of standard.datums ?? []) {
    for (const r of d.renders ?? []) {
      if (!MATH_NOTATIONS.includes(r.notation)) {
        err(
          'C189',
          `datum ${d.id}: render notation "${r.notation}" is outside the closed vocabulary (${MATH_NOTATIONS.join('|')}) (datum-render-notation)`,
        );
      }
    }
  }

  return issues;
}

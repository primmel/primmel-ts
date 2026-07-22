// ─────────────────────────────────────────────────────────────────────
// primmel check — the rule catalog (TODO.roadmap/17).
//
// The machine-readable registry of every check `primmel check` runs —
// the single source the CLI prints (`primmel check --rules`) and the
// docs reference. Each rule has:
//   id       — the per-rule id (C1…C57) issues report under;
//   name     — the rule's short name (as used in issue messages);
//   family   — base | anatomy | process | instantiation | mapping |
//              composition | quantities | state | promises | artifacts |
//              characteristics | coverage;
//   severity — the rule's DEFAULT severity at the normal level
//              ('warning' rules escalate to errors under --strict;
//              individual legs of a rule may escalate — see check.ts);
//   level    — 'normal' rules always run; 'audit' rules additionally run
//              at --audit strictness (the coverage audits + C25);
//   docs     — the doctrine/plan pointer backing the rule.
// ─────────────────────────────────────────────────────────────────────

export type CheckFamily =
  | 'base'
  | 'anatomy'
  | 'process'
  | 'instantiation'
  | 'mapping'
  | 'composition'
  | 'quantities'
  | 'state'
  | 'promises'
  | 'artifacts'
  | 'characteristics'
  | 'coverage';

export type CheckLevel = 'normal' | 'audit';

export interface CheckRule {
  id: string;
  name: string;
  family: CheckFamily;
  severity: 'error' | 'warning';
  level: CheckLevel;
  docs: string;
}

const R = (
  id: string,
  name: string,
  family: CheckFamily,
  severity: 'error' | 'warning',
  level: CheckLevel,
  docs: string,
): CheckRule => ({ id, name, family, severity, level, docs });

/** The full catalog, in id order. */
export const CHECK_RULES: CheckRule[] = [
  // ── base (C1–C5 + the allowlist self-checks) ──────────────────────
  R(
    'C1',
    'attribute-bind-scope',
    'base',
    'error',
    'normal',
    'concept doc §11.4',
  ),
  R(
    'C2',
    'reference-targets-resolve',
    'base',
    'error',
    'normal',
    'concept doc §11.4',
  ),
  R('C3', 'dimension-enums', 'base', 'error', 'normal', 'concept doc §11.4'),
  R('C4', 'store-uniqueness', 'base', 'error', 'normal', 'concept doc §11.4'),
  R(
    'C5',
    'req-test-coverage',
    'base',
    'warning',
    'normal',
    'concept doc §11.4–11.5',
  ),
  R(
    'C56',
    'allowlist-malformed',
    'base',
    'error',
    'normal',
    'concept doc §11.9',
  ),
  R(
    'C57',
    'allowlist-stale',
    'base',
    'error',
    'normal',
    'concept doc §11.3/§11.9',
  ),
  // ── anatomy (subject is/has/does, TODO.roadmap/01) ────────────────
  R('C6', 'anatomy-family', 'anatomy', 'error', 'normal', 'TODO.roadmap/01'),
  R(
    'C7',
    'anatomy-characteristic-derivation',
    'anatomy',
    'error',
    'normal',
    'TODO.roadmap/01',
  ),
  R(
    'C8',
    'anatomy-behavior-resolves',
    'anatomy',
    'error',
    'normal',
    'TODO.roadmap/01',
  ),
  R(
    'C9',
    'subject-extends-resolves',
    'anatomy',
    'warning',
    'normal',
    'TODO.roadmap/01',
  ),
  // ── process (executable bodies, TODO.roadmap/02) ──────────────────
  R(
    'C10',
    'process-one-start',
    'process',
    'error',
    'normal',
    'TODO.roadmap/02',
  ),
  R(
    'C11',
    'process-terminal-end',
    'process',
    'error',
    'normal',
    'TODO.roadmap/02',
  ),
  R(
    'C12',
    'process-flow-names-resolve',
    'process',
    'error',
    'normal',
    'TODO.roadmap/02',
  ),
  R(
    'C13',
    'process-signature-realized',
    'process',
    'error',
    'normal',
    'TODO.roadmap/02',
  ),
  R(
    'C14',
    'process-timer-recurrence',
    'process',
    'error',
    'normal',
    'TODO.roadmap/02',
  ),
  R(
    'C15',
    'process-timer-period',
    'process',
    'error',
    'normal',
    'TODO.roadmap/02',
  ),
  R(
    'C16',
    'process-step-ids-unique',
    'process',
    'error',
    'normal',
    'TODO.roadmap/02',
  ),
  // ── instantiation (TODO.roadmap/03) ───────────────────────────────
  R(
    'C17',
    'instance-scope',
    'instantiation',
    'error',
    'normal',
    'TODO.roadmap/03',
  ),
  R(
    'C18',
    'instance-version-pin',
    'instantiation',
    'error',
    'normal',
    'TODO.roadmap/03',
  ),
  R(
    'C19',
    'chain-acyclic',
    'instantiation',
    'error',
    'normal',
    'TODO.roadmap/03',
  ),
  R(
    'C20',
    'instance-of-resolves',
    'instantiation',
    'error',
    'normal',
    'TODO.roadmap/03',
  ),
  // ── mapping (TODO.roadmap/04) ─────────────────────────────────────
  R(
    'C21',
    'mapping-resolves',
    'mapping',
    'error',
    'normal',
    'TODO.roadmap/04, concept doc §5.2',
  ),
  R(
    'C22',
    'mapping-direction',
    'mapping',
    'error',
    'normal',
    'TODO.roadmap/04, concept doc §5.6',
  ),
  R(
    'C23',
    'mapping-calculus-consistency',
    'mapping',
    'error',
    'normal',
    'TODO.roadmap/04, concept doc §5.8',
  ),
  R(
    'C24',
    'import-not-mapping',
    'mapping',
    'error',
    'normal',
    'TODO.roadmap/04, concept doc §5.6',
  ),
  R(
    'C25',
    'mapping-description',
    'mapping',
    'warning',
    'audit',
    'TODO.roadmap/04',
  ),
  R('C26', 'view-read-only', 'mapping', 'error', 'normal', 'TODO.roadmap/04'),
  // ── composition (TODO.roadmap/05) ─────────────────────────────────
  R(
    'C27',
    'uses-resolves',
    'composition',
    'error',
    'normal',
    'TODO.roadmap/05',
  ),
  R(
    'C28',
    'uses-no-redefine',
    'composition',
    'error',
    'normal',
    'TODO.roadmap/05',
  ),
  R('C29', 'uses-cycle', 'composition', 'error', 'normal', 'TODO.roadmap/05'),
  R(
    'C30',
    'provides-consumed-or-waived',
    'composition',
    'warning',
    'normal',
    'TODO.roadmap/05',
  ),
  R(
    'C31',
    'requires-satisfied',
    'composition',
    'error',
    'normal',
    'TODO.roadmap/05',
  ),
  // ── quantities / time / duality (TODO.roadmap/06) ─────────────────
  R(
    'C32',
    'inv1-no-bare-quantity',
    'quantities',
    'error',
    'normal',
    'TODO.roadmap/06, INV-1',
  ),
  R(
    'C33',
    'quantity-coherence',
    'quantities',
    'error',
    'normal',
    'TODO.roadmap/06',
  ),
  R(
    'C34',
    'duality-coherence',
    'quantities',
    'error',
    'normal',
    'TODO.roadmap/06',
  ),
  R('C35', 'time-format', 'quantities', 'error', 'normal', 'TODO.roadmap/06'),
  R('C36', 'map-type', 'quantities', 'error', 'normal', 'TODO.roadmap/06'),
  // ── operational state (TODO.roadmap/07) ───────────────────────────
  R(
    'C37',
    'state-fires-resolve',
    'state',
    'error',
    'normal',
    'TODO.roadmap/07',
  ),
  R(
    'C38',
    'state-family-separation',
    'state',
    'error',
    'normal',
    'TODO.roadmap/07',
  ),
  R(
    'C39',
    'state-machine-states-referenced',
    'state',
    'error',
    'normal',
    'TODO.roadmap/07',
  ),
  R(
    'C40',
    'anatomy-state-resolves',
    'state',
    'error',
    'normal',
    'TODO.roadmap/07',
  ),
  R(
    'C41',
    'precondition-on-violation-known',
    'state',
    'warning',
    'normal',
    'TODO.roadmap/07',
  ),
  // ── promises (TODO.roadmap/08) ────────────────────────────────────
  R(
    'C42',
    'promise-target-resolves',
    'promises',
    'error',
    'normal',
    'TODO.roadmap/08',
  ),
  R(
    'C43',
    'promise-verifiable',
    'promises',
    'warning',
    'normal',
    'TODO.roadmap/08',
  ),
  R(
    'C44',
    'promise-not-bare-value',
    'promises',
    'error',
    'normal',
    'TODO.roadmap/08',
  ),
  // ── artifacts (TODO.roadmap/09) ───────────────────────────────────
  R(
    'C45',
    'artifact-def-contract',
    'artifacts',
    'error',
    'normal',
    'TODO.roadmap/09',
  ),
  R(
    'C46',
    'artifact-instance-resolves',
    'artifacts',
    'error',
    'normal',
    'TODO.roadmap/09',
  ),
  R(
    'C47',
    'artifact-evidence-separation',
    'artifacts',
    'error',
    'normal',
    'TODO.roadmap/09',
  ),
  // ── characteristics (TODO.roadmap/10) ─────────────────────────────
  R(
    'C48',
    'characteristic-one-home',
    'characteristics',
    'error',
    'normal',
    'TODO.roadmap/10',
  ),
  R(
    'C49',
    'characteristic-behavior-link',
    'characteristics',
    'error',
    'normal',
    'TODO.roadmap/10',
  ),
  R(
    'C50',
    'characteristic-derivation-inputs',
    'characteristics',
    'error',
    'normal',
    'TODO.roadmap/10',
  ),
  // ── coverage audits (TODO.roadmap/17, concept doc §11.5) ──────────
  // The aspect↔requirement↔test↔form↔verdict closure: the requirement→test
  // link is C5 (base); the closure's remaining links are the audit-level
  // C51/C52; the anchoring legs (uses bound, lookup tables) are
  // normal-level errors; the per-package budget is C55.
  R(
    'C51',
    'coverage-test-evidence',
    'coverage',
    'warning',
    'audit',
    'TODO.roadmap/17, concept doc §11.5',
  ),
  R(
    'C52',
    'coverage-form-judgment',
    'coverage',
    'warning',
    'audit',
    'TODO.roadmap/17, concept doc §11.5',
  ),
  R(
    'C53',
    'coverage-uses-bound',
    'coverage',
    'error',
    'normal',
    'TODO.roadmap/17, concept doc §11.7',
  ),
  R(
    'C54',
    'coverage-lookup-table-exists',
    'coverage',
    'error',
    'normal',
    'TODO.roadmap/17, concept doc §11.7',
  ),
  // C55 is audit-level: it fires only when the budgeted rules C51/C52
  // run (audit) — cataloguing it as normal would judge a C55 allowlist
  // entry STALE at the default level, where no C55 issue can exist.
  R('C55', 'coverage-budget', 'coverage', 'error', 'audit', 'TODO.roadmap/17'),
];

const byId = new Map(CHECK_RULES.map(r => [r.id, r]));

/** The catalog entry for a rule id, or undefined for an unknown id. */
export function checkRule(id: string): CheckRule | undefined {
  return byId.get(id);
}

/** Rule ids active at a level ('audit' includes the normal rules). */
export function activeRuleIds(level: CheckLevel): Set<string> {
  return new Set(
    CHECK_RULES.filter(r => level === 'audit' || r.level === 'normal').map(
      r => r.id,
    ),
  );
}

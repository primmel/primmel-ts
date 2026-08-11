// ─────────────────────────────────────────────────────────────────────
// primmel check — the rule catalog (TODO.roadmap/17).
//
// The machine-readable registry of every check `primmel check` runs —
// the single source the CLI prints (`primmel check --rules`) and the
// docs reference. Each rule has:
//   id       — the per-rule id (C1…C103) issues report under;
//   name     — the rule's short name (as used in issue messages);
//   family   — base | anatomy | process | instantiation | mapping |
//              composition | quantities | state | promises | artifacts |
//              characteristics | twins | coverage | edition |
//              supply-chain;
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
  | 'twins'
  | 'coverage'
  | 'edition'
  | 'supply-chain';

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
  // C58 (TODO.roadmap/39): the ISO/IEC 17000 activity-kind classification
  // facet on processes — every tagged kind resolves against a declared
  // activity_archetype register when one is in scope, and the register's
  // own parent references resolve within the register.
  R(
    'C58',
    'activity-kind-resolves',
    'process',
    'error',
    'normal',
    'TODO.roadmap/39',
  ),
  // C59 (TODO.roadmap/39b): the ISO/IEC 17065 role-segregation facet on
  // processes — every pair member resolves to a declared process (or the
  // reserved case_personnel token), the two members are distinct, and the
  // owning process is a member of its own pair.
  R(
    'C59',
    'segregation-members-resolve',
    'process',
    'error',
    'normal',
    'TODO.roadmap/39',
  ),
  // C74–C76 (TODO.roadmap/38): typed transition boundaries — composition
  // is sound only when the upstream output signature covers the
  // downstream input signature (∘: t₁: A→B, t₂: B→C ⊢ t₂∘t₁: A→C).
  // C74: one name carries ONE type across the signature/register
  // declaration positions (kind/unit-coherent through the quantity
  // register). C75: the step-chain dataflow covers every read (a writer
  // on every incoming path, or a provided IN/instance/state name —
  // error) and no write is dead (warning leg). Known limitation: the
  // must-analysis intersects over all predecessors uniformly, so a
  // parallel_gateway fork's conjunctive branches are treated as
  // alternative paths — a post-join read of a single-branch write is
  // reported uncovered (pessimistic: over-reports, never misses a real
  // gap). C76: a `calls` step binds
  // the callee's declared signature completely and kind-compatibly —
  // across packages too, since processes merge over `uses`.
  R(
    'C74',
    'process-io-type-coherence',
    'process',
    'error',
    'normal',
    'TODO.roadmap/38',
  ),
  R(
    'C75',
    'process-flow-io-cover',
    'process',
    'error',
    'normal',
    'TODO.roadmap/38',
  ),
  R(
    'C76',
    'subprocess-signature-bound',
    'process',
    'error',
    'normal',
    'TODO.roadmap/38',
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
  // ── twins (TODO.roadmap/32 — doctrine ch. 14 §14.4/§14.12) ──────────
  R(
    'C60',
    'serve-targets-resolve',
    'twins',
    'error',
    'normal',
    'TODO.roadmap/32, doctrine §14.12',
  ),
  R(
    'C61',
    'payload-schema-quantity',
    'twins',
    'error',
    'normal',
    'TODO.roadmap/32, doctrine §14.4/§14.12',
  ),
  R(
    'C62',
    'access-scope-covers-serves',
    'twins',
    'error',
    'normal',
    'TODO.roadmap/32, doctrine §14.12',
  ),
  R(
    'C63',
    'freshness-required-on-live-bindings',
    'twins',
    'error',
    'normal',
    'TODO.roadmap/32, doctrine §14.12',
  ),
  R(
    'C64',
    'endpoint-profile-resolves',
    'twins',
    'error',
    'normal',
    'TODO.roadmap/32, doctrine §14.4',
  ),
  // ── twins: the monitors (TODO.roadmap/34 — doctrine ch. 14 §14.5/§14.12) ──
  R(
    'C65',
    'monitor-subject-resolves',
    'twins',
    'error',
    'normal',
    'TODO.roadmap/34, doctrine §14.5/§14.12',
  ),
  R(
    'C66',
    'monitor-trigger-wellformed',
    'twins',
    'error',
    'normal',
    'TODO.roadmap/34, doctrine §14.5 step 1',
  ),
  R(
    'C67',
    'monitor-evaluate-resolves',
    'twins',
    'error',
    'normal',
    'TODO.roadmap/34, doctrine §14.12',
  ),
  // C68 is the doctrine's verbatim warning (§14.12): a monitor without an
  // escalation path for `fail` is a warning (it escalates to an error
  // under --strict like any warning).
  R(
    'C68',
    'monitor-fail-escalation',
    'twins',
    'warning',
    'normal',
    'TODO.roadmap/34, doctrine §14.12',
  ),
  R(
    'C69',
    'monitor-escalation-resolves',
    'twins',
    'error',
    'normal',
    'TODO.roadmap/34, doctrine §14.5 step 7',
  ),
  R(
    'C70',
    'monitor-emit-sinks',
    'twins',
    'error',
    'normal',
    'TODO.roadmap/34, doctrine §14.5 step 6',
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
  // ── text coverage (TODO.roadmap/26, concept doc §11.6) ──────────────
  // Layer 5 of the validation stack: every normative sentence of the
  // source maps to at least one model element (target 100 %), no two
  // elements are semantic duplicates (target 0). C71 follows the C51/C52
  // pattern (audit-level warning, budgeted by the package's
  // text_coverage_budget — C72); C73 is the declarations' hygiene rule
  // (stale allowances/adjudications — the KNOWN/STALE spirit). Duplicate
  // pairs are REPORTED (primmel check --coverage), never auto-failed.
  R(
    'C71',
    'text-coverage-sentence-uncovered',
    'coverage',
    'warning',
    'audit',
    'TODO.roadmap/26, concept doc §11.6',
  ),
  R(
    'C72',
    'text-coverage-budget',
    'coverage',
    'error',
    'audit',
    'TODO.roadmap/26, concept doc §11.6',
  ),
  R(
    'C73',
    'text-coverage-config',
    'coverage',
    'error',
    'normal',
    'TODO.roadmap/26, concept doc §11.6',
  ),
  // ── edition lifecycle (TODO.roadmap/28, doctrine ch. 13 §13.4/§13.7) ──
  // Versioning relations live on the package manifest, never in subject
  // models: status (C77), validity windows (C78), supersedes/replaces
  // resolution + acyclicity (C79), and the INV-8 execution-side pin —
  // every instance's definition_versions resolves against the package's
  // edition register (C80).
  R(
    'C77',
    'edition-status',
    'edition',
    'error',
    'normal',
    'TODO.roadmap/28, doctrine §13.4',
  ),
  R(
    'C78',
    'edition-validity-window',
    'edition',
    'error',
    'normal',
    'TODO.roadmap/28, doctrine §13.7',
  ),
  R(
    'C79',
    'edition-supersedes-resolves',
    'edition',
    'error',
    'normal',
    'TODO.roadmap/28, doctrine §13.7',
  ),
  R(
    'C80',
    'edition-pin-resolves',
    'edition',
    'error',
    'normal',
    'TODO.roadmap/28, INV-8, doctrine §13.5',
  ),
  // ── the model supply chain (TODO.roadmap/36, doctrine ch. 15) ───────
  // Three publishers — standard (reference), manufacturer (product
  // reference), user (implementation) — with mapping as the only
  // relation between them. C81: the product reference package's
  // declaration resolves (manufacturer, product, maps_to register ⇆
  // map profiles). C82: unmapped IS promises flagged at authoring (an
  // unmapped promise is a brochure claim). C83: abstract imports pin a
  // version that resolves against the product's edition register.
  R(
    'C81',
    'product-maps-resolves',
    'supply-chain',
    'error',
    'normal',
    'TODO.roadmap/36, doctrine ch. 15 §15.9',
  ),
  R(
    'C82',
    'product-unmapped-promises',
    'supply-chain',
    'warning',
    'normal',
    'TODO.roadmap/36, doctrine ch. 15 §15.2/§15.9',
  ),
  R(
    'C83',
    'abstract-import-pinned',
    'supply-chain',
    'error',
    'normal',
    'TODO.roadmap/36, doctrine ch. 15 §15.3/§15.9',
  ),
  // ── subject-intrinsic constraints (TODO.roadmap/51, BUG.R60-SSOT gap 7)
  // The constraint construct's declaration shape — the kernel mirror of
  // the OIML SMART constraints.yaml schema (stereotype «inv», one ocl{…}
  // check, required violation_meaning, on_violation invalid|indeterminate,
  // source doc+clause). Duplicate ids are the parse-time duplicate-id
  // rule (surfaced as C96); the resolution legs stay smart-side (linker
  // R32).
  R(
    'C84',
    'constraint-shape',
    'anatomy',
    'error',
    'normal',
    'TODO.roadmap/51, BUG.R60-SSOT gap 7',
  ),
  // ── manifest base URN (TODO.roadmap/27, task-27c review Important 1) ──
  // baseUrn grounds every downstream IRI (the RDF projection's document
  // node + instance IRIs, edition-normalized provenance comparisons) but
  // the manifest field is a free string: a malformed value (`urn:bad
  // urn`) sailed through check AND produced spec-malformed export
  // documents. Same well-formedness class as C78's window check.
  R(
    'C85',
    'baseurn-wellformed',
    'edition',
    'error',
    'normal',
    'TODO.roadmap/27, task-27c review',
  ),
  // ── the model-native DPP (TODO.roadmap/35, doctrine ch. 14 §14.6, ch. 15
  // §15.6/§15.9) ──
  // The passport is the product model's public projection — "it cannot
  // drift from the model because it *is* the model" (§14.6). §15.9's
  // passport rule: "the passport projection contains only aspects that
  // resolve — public classes contain nothing marked restricted". C86:
  // every content entry's class is one of the six declared classes and a
  // qualified `<class>.<ref>` resolves against the package's declared
  // aspects/promises (sustainability refs are not kernel-resolved — the
  // ESPR delegated-act content models do not exist yet). C87: an entry
  // marked restricted/authority that a public class reaches (exact entry
  // or covering bare class) is a leak. C88: the UPI scheme declares its
  // pattern and its ESPR level (model | batch | item).
  R(
    'C86',
    'passport-content-resolves',
    'supply-chain',
    'error',
    'normal',
    'TODO.roadmap/35, doctrine ch. 15 §15.9',
  ),
  R(
    'C87',
    'passport-access-leak',
    'supply-chain',
    'error',
    'normal',
    'TODO.roadmap/35, doctrine ch. 15 §15.9',
  ),
  R(
    'C88',
    'passport-upi-scheme',
    'supply-chain',
    'error',
    'normal',
    'TODO.roadmap/35, doctrine ch. 14 §14.6',
  ),
  // ── ISO 24229 multilinguality (TODO.roadmap/25, doctrine ch. 10) ────
  // Every human-readable string is spelling-coded per ISO 24229; BCP 47
  // is not used. C89 is the SYNTAX layer: the manifest default_spelling
  // and declared spellings parse (script mandatory), every text block
  // addresses an existing element's prose field — <element-id>.<field>,
  // or <element-id>.<path…>.<field> for prose nested inside the element
  // (E13: intermediate segments name nested structures, list items key
  // by declared name/order/slot, the terminal is a prose field) — every
  // spell entry's code parses with no duplicate per set, the default
  // spelling's value stays inline (never in a text block), and every via
  // conversion code
  // parses (zz- user-assigned codes warn). Register resolution is the
  // consumer's vendored-snapshot discipline — primmel-ts stays
  // register-free (src/spelling.ts validates shape only).
  R(
    'C89',
    'spelling-code-wellformed',
    'base',
    'error',
    'normal',
    'TODO.roadmap/25, doctrine ch. 10 §10.7',
  ),
  // ── the architecture invariants (smart gap-close E9,
  // analysis/architecture-gaps-2026-07.md; smart docs/oiml-core/
  // 09-invariants.md) ──
  // The `invariant` construct is the first-class replacement for the
  // note-family encoding (pipe-delimited structure inside a message
  // string). C90 is the declaration shape: every invariant carries
  // name, statement, and severity (severity is presence-judged only —
  // the smart side owns the vocabulary), and enforcement is a non-empty
  // claim list XOR the literal `aspirational` marker. C91 is the claim
  // grammar: kernel:C<n> | linker:<kebab-name> | gate:<kebab-name>, and
  // the aspirational marker never mixes with claims. Claim TARGET
  // resolution is the smart-side linker rule R38's crosswalk — the
  // kernel checks syntax/shape only.
  R(
    'C90',
    'invariant-shape',
    'base',
    'error',
    'normal',
    'smart architecture-gaps-2026-07.md E9, docs/oiml-core/09-invariants.md',
  ),
  R(
    'C91',
    'invariant-enforcement-grammar',
    'base',
    'error',
    'normal',
    'smart architecture-gaps-2026-07.md E9, docs/oiml-core/09-invariants.md',
  ),
  // ── the required test orderings (smart gap-close E10,
  // analysis/architecture-gaps-2026-07.md; the smart contract
  // data/schemas/test-sequences.yaml) ──
  // The `test_sequence` construct is the first-class replacement for
  // the hand-authored supplemental test-sequences.yaml. C92 is the
  // declaration shape: every sequence carries name, description, and a
  // non-empty steps list; every step's order is a positive integer
  // unique in the sequence; every step carries test XOR phase; role
  // appears only on test steps and only in the baseline | follow_up
  // vocabulary; depends_on is an integer. C93 is the dependency
  // integrity: every depends_on names the order of an EARLIER step of
  // the same sequence (no self-reference, no forward reference, no
  // dangling order — with single-parent earlier-order edges a cycle is
  // impossible by construction, so the per-edge checks subsume it).
  // Test-ref RESOLUTION is the smart-side linker rule R39's crosswalk —
  // the kernel checks syntax/shape only.
  R(
    'C92',
    'test-sequence-shape',
    'base',
    'error',
    'normal',
    'smart architecture-gaps-2026-07.md E10, data/schemas/test-sequences.yaml',
  ),
  R(
    'C93',
    'test-sequence-integrity',
    'base',
    'error',
    'normal',
    'smart architecture-gaps-2026-07.md E10, data/schemas/test-sequences.yaml',
  ),
  // ── the per-test evaluation-formula traces (smart gap-close E11,
  // analysis/architecture-gaps-2026-07.md; the smart contract
  // data/schemas/formulas-used.yaml) ──
  // The `formulas_used` construct is the first-class replacement for
  // the hand-authored supplemental formulas-used.yaml. C94 is the
  // declaration shape: every trace carries a non-empty test reference
  // (the block symbol), name, description, and a non-empty formulas
  // list; every formula identifier is well-formed — the snake_case
  // shape the calculations registry uses for output names. Entry
  // uniqueness per test is the parse-time duplicate-id rule's, surfaced
  // as C96 (the collection key IS the test reference). Formula-id
  // RESOLUTION
  // (calculations ∪ formulas registries) is the smart-side linker rule
  // R41's crosswalk — the kernel checks syntax/shape only.
  R(
    'C94',
    'formulas-used-shape',
    'base',
    'error',
    'normal',
    'smart architecture-gaps-2026-07.md E11, data/schemas/formulas-used.yaml',
  ),
  // ── cascade machine routing (smart gap-close E12,
  // analysis/cascade-machine-routing-design.md §4–§5) ──
  // A status-writing cascade step (a mechanical `set` containing
  // `status`, or a semantic `submit`/`lock`) on a machinated target
  // declares `via <transition-action>` and ROUTES the write through a
  // declared transition of the target's own machine, closing the
  // raw-write leak (the walker's cascade handlers Object.assign'd
  // status onto target records with no machine consultation). C95 is
  // the whole routing contract, eight legs (§5): via-present,
  // via-resolves, via-matches-status, via-unguarded,
  // via-forbidden-elsewhere, self-consistency (a self-step writes the
  // owning transition's `to`), status-is-a-state, and fields-resolve
  // (where paths and set/with names against the target entity's
  // declared fields). The catalogued severity is the steady state —
  // error; leg 1 is de-escalated to a warning in check.ts during the
  // rollout window (the shipped corpus carries the 14 via-less steps of
  // the design's §3.2 — the smart declaration leg adds the facets),
  // the C33 de-escalation precedent. The smart-side mirror is linker
  // rule R44 cascade-routing (the C89+R43 spelling-check precedent).
  R(
    'C95',
    'cascade-transition-resolve',
    'state',
    'error',
    'normal',
    'smart architecture-gaps-2026-07.md E12, analysis/cascade-machine-routing-design.md',
  ),
  // ── id uniqueness (the parse-time rule, surfaced) ──────────────────
  // The parser stays total on a second declaration of one id in one
  // id-keyed collection (last wins the slot) and collects a duplicate-id
  // parse issue; checkPackage surfaces those under C96 — the visibility
  // half of every per-collection uniqueness delegation (C84 constraints,
  // C94 formulas-used; the E11 review finding). Parse-time detection is
  // load-bearing: the parser overwrites the ctx slot, so post-parse the
  // earlier declaration is unrecoverable.
  R(
    'C96',
    'duplicate-id',
    'base',
    'error',
    'normal',
    'src/duplicate-id.ts, the smart gap-close E11 review finding',
  ),
  // ── the certification program (TODO.v2/01, smart
  // analysis/twin-certification-design.md Q4) ──
  // A fourth publisher with the product_reference shape: the scheme
  // operator's program is related to recs (maps_to) and product packages
  // (pinned abstract imports, C83's edition-pin discipline) by mapping
  // only — composed into nothing. C97: the program's maps_to register
  // resolves (the C81-class resolution discipline) and names no program
  // or product package. C98: a no-surveillance ISO/IEC 17067 scheme
  // shape (type_1a/1b) declared alongside surveillance machinery
  // (monitors, surveillance-classified processes) is a warning — the
  // type_1a/1b shape structurally can't say "continuously".
  R(
    'C97',
    'program-maps-resolves',
    'base',
    'error',
    'normal',
    'smart TODO.v2/01, analysis/twin-certification-design.md Q4',
  ),
  R(
    'C98',
    'program-surveillance-required',
    'base',
    'warning',
    'normal',
    'smart TODO.v2/01, analysis/twin-certification-design.md Q4, ISO/IEC 17067 Table 1',
  ),
  // C99 (smart TODO.v2/01 TCD-2; analysis/twin-certification-design.md
  // Q2): the probe-channel provenance facet on a measured test variable —
  // the three-source physical channel a reference reading arrives by.
  // The kernel checks SHAPE and VOCABULARY (register-free): the channel is
  // one of reference_instrument | observer_attestation | sim_ground_truth,
  // the ref cites the channel's register entry, observed_at names a
  // declared variable of the same test, and an observer_attestation
  // channel carries the DECLARED traceability limitation ("twin ≡ display,
  // not twin ≡ mass" — never a comment). The ref's RESOLUTION against the
  // equipment/personnel/sim registers is the smart-side linker's
  // crosswalk (R45).
  R(
    'C99',
    'variable-provenance-channel',
    'twins',
    'error',
    'normal',
    'smart TODO.v2/01 TCD-2, analysis/twin-certification-design.md Q2',
  ),
  // ── the composition facet (TODO.integration/14; the YAML-side
  // declaration of TODO.v3/03 proven first) ──
  // C100: every composed_of component's product reference resolves (an
  // inline `pkg/subject` names a subject of this package; a bare package
  // id is registered for the supply-chain gate's C81-class resolution)
  // and its endpoint is named. C101: every serve of the composite
  // subject is covered by the decomposition exactly once. C102: the
  // composite state rule's vocabulary is closed
  // (any_fault_else_analyzer first — a new rule is a grammar extension,
  // never a free string).
  R(
    'C100',
    'composition-components-resolve',
    'twins',
    'error',
    'normal',
    'TODO.integration/14, the composed_of construct (TODO.v3/03 Phase 2)',
  ),
  R(
    'C101',
    'composition-decomposition-covers',
    'twins',
    'error',
    'normal',
    'TODO.integration/14, the composed_of construct (TODO.v3/03 Phase 2)',
  ),
  R(
    'C102',
    'composition-state-rule-closed',
    'twins',
    'error',
    'normal',
    'TODO.integration/14, the composed_of construct (TODO.v3/03 Phase 2)',
  ),
  // ── the relation registry (docs/primmel/18 §18.6) ──────────────────
  // C103: every ref predicate resolves against the composed registry —
  // a typo is an error, not a silent new predicate. The rule only fires
  // when the package set declares a registry: the predicate vocabulary
  // is data (the metamodel layer's predicates.prl), never grammar.
  R(
    'C103',
    'declared-predicate',
    'base',
    'error',
    'normal',
    'docs/primmel/18 §18.6 (the unified reference/relation construct)',
  ),
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

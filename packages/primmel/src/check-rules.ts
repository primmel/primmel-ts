// ─────────────────────────────────────────────────────────────────────
// primmel check — the rule catalog (TODO.roadmap/17).
//
// The machine-readable registry of every check `primmel check` runs —
// the single source the CLI prints (`primmel check --rules`) and the
// docs reference. Each rule has:
//   id       — the per-rule id (C1…C119) issues report under;
//   name     — the rule's short name (as used in issue messages);
//   family   — base | anatomy | process | instantiation | mapping |
//              composition | quantities | state | promises | artifacts |
//              characteristics | twins | coverage | edition |
//              supply-chain | dataspace;
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
  | 'supply-chain'
  | 'dataspace';

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
  // C119 (the smart AGENTS.d/07 pin doctrine, TODO.editor/05 Q3): a
  // requirement scope a composed package declares is OWNED by that
  // package — a downstream package may reference its provisions, never
  // declare a requirement class or requirement at or under the owned
  // namespace (the strict-descendant leg; the exact-id leg is C28).
  R(
    'C119',
    'namespace-pin-violation',
    'composition',
    'error',
    'normal',
    'smart AGENTS.d/07 (TODO.editor/05 Q3)',
  ),
  // C120 (smart TODO.roadmap/40; the packages-as-SSOT epic): the
  // certification-framework registers' cross-references resolve —
  // participant_kind organ/declaration/kind edges, organ sub-committee
  // and independence edges, declaration holder + gate edges (incl. the
  // gate's blocked processes), scheme-lifecycle organ edges + the
  // entry's conditions_ref + trigger actions, framework_document
  // approving organs, decision_rule organ + exemption edges. Per-
  // register gating (the C58 doctrine): an edge is checked only when
  // its target register is in composition scope. Mirror of the OIML
  // SMART linker's R25.
  R(
    'C120',
    'framework-references-resolve',
    'composition',
    'error',
    'normal',
    'smart TODO.roadmap/40 (the packages-as-SSOT epic)',
  ),
  // C121 (smart TODO.roadmap/40 batch 2; the packages-as-SSOT epic): the
  // abstract-process model's framework bindings resolve — the process's
  // roles / organs / participant_kinds lists, the decision rule, the
  // declaration kind + the sign|update action vocabulary, the discharged
  // declaration gate, realized_by → process, approved_by → approval, and
  // the calendar windows' shape (kind vocabulary; exactly one of
  // years/months); the process_model's sequence members and register
  // maintainers ride the same rule. Per-register gating (the C58
  // doctrine): an edge is checked only when its target register is in
  // composition scope.
  R(
    'C121',
    'abstract-process-references-resolve',
    'process',
    'error',
    'normal',
    'smart TODO.roadmap/40 batch 2 (the packages-as-SSOT epic)',
  ),
  // C122 (smart TODO.roadmap/40 batch 2; the packages-as-SSOT epic): the
  // ISO/IEC 17067 register is composable — a manifest's scheme_type
  // token resolves against the composed scheme_type register when one is
  // in scope, and a scheme_type's determination / attestation /
  // surveillance.activities entries resolve against the composed
  // scheme_activity_kind menus. Per-register gating (the C58 doctrine);
  // the register-free fallback stays (the C89 spelling precedent), and
  // C98's hard-coded no-surveillance set defers to the register's
  // surveillance.required when the register is in scope.
  R(
    'C122',
    'scheme-type-resolves',
    'composition',
    'error',
    'normal',
    'smart TODO.roadmap/40 batch 2 (the packages-as-SSOT epic)',
  ),
  // C123 (smart TODO.roadmap/40 batch 2; the packages-as-SSOT epic): the
  // document module's edges resolve — sequence members → process,
  // register maintainers → governance_organ (per-register gated, the C58
  // doctrine), the declared namespace is an absolute requirement-
  // namespace path (the pin C119 now prefers over the requirement_class-
  // id derivation), and the informative annex's applies_to names a known
  // package (locator-gated, the C97-class resolution discipline).
  R(
    'C123',
    'document-module-references-resolve',
    'composition',
    'error',
    'normal',
    'smart TODO.roadmap/40 batch 2 (the packages-as-SSOT epic)',
  ),
  // C124 (smart TODO.roadmap/40 batch 4; the packages-as-SSOT epic): the
  // attribute_definition pair_list block's declaration shape — the key
  // and value slots are required, component ids are unique within the
  // block, and the key_dimension names a declared applicability
  // dimension when the dimension register is in composition scope
  // (per-register gating, the C58 doctrine). The closed-registry-over-
  // values leg quantifies over app-side records and stays app-side.
  R(
    'C124',
    'pair-list-shape',
    'base',
    'error',
    'normal',
    'smart TODO.roadmap/40 batch 4 (the packages-as-SSOT epic)',
  ),
  // C125 (smart TODO.roadmap/40 batch 4; the packages-as-SSOT epic): the
  // calculation variant block's declaration shape — variant ids unique
  // within the owning calculation, and the type-conditional facets
  // present (expression ⇒ expression, table_lookup ⇒ lookup,
  // profile_lookup ⇒ profile; the top-level shape discipline mirrored
  // onto the realization). The variant's params are engine call-site
  // names and deliberately carry NO params-resolve leg.
  R(
    'C125',
    'formula-variant-shape',
    'base',
    'error',
    'normal',
    'smart TODO.roadmap/40 batch 4 (the packages-as-SSOT epic)',
  ),
  // C126 (smart TODO.roadmap/40 batch 4; the packages-as-SSOT epic): the
  // formula_note register's reverse applicability resolves — every
  // applies_to entry names a declared symbol when the symbol register is
  // in composition scope (per-register gating, the C58 doctrine).
  R(
    'C126',
    'formula-note-targets-resolve',
    'composition',
    'error',
    'normal',
    'smart TODO.roadmap/40 batch 4 (the packages-as-SSOT epic)',
  ),
  // C127 (smart TODO.roadmap/40 batch 4; the packages-as-SSOT epic): the
  // common_test_condition register's declaration shape — the description
  // is required (the one facet both YAML shapes carry); the title stays
  // optional (the r91 keyed-map entries carry none) and the reference a
  // free citation string (no kernel leg — the linker owns the citation
  // semantics).
  R(
    'C127',
    'common-test-condition-shape',
    'base',
    'error',
    'normal',
    'smart TODO.roadmap/40 batch 4 (the packages-as-SSOT epic)',
  ),
  // C128 (smart TODO.roadmap/40 batch 4; the packages-as-SSOT epic): the
  // part_annex register's declaration shape — letters unique per package
  // (the index keys on the printed letter) and the source provenance
  // required; the obligation vocabulary is parse-enforced upstream and
  // carries no check leg.
  R(
    'C128',
    'part-annex-shape',
    'base',
    'error',
    'normal',
    'smart TODO.roadmap/40 batch 4 (the packages-as-SSOT epic)',
  ),
  // C129 (smart TODO.roadmap/40 batch 4; the packages-as-SSOT epic): the
  // demo-seed shapes — the storyline's id_prefix pattern (register-free),
  // the party laboratory/authority → the demo_world participant seeds
  // (gated on that register), the record stores → the entity-class stores
  // (gated), and the in-construct record cross-references (a record field
  // keyed by a sibling record's store names a sibling of that store —
  // ungated). Field-level discipline stays app-side.
  R(
    'C129',
    'storyline-shape',
    'composition',
    'error',
    'normal',
    'smart TODO.roadmap/40 batch 4 (the packages-as-SSOT epic)',
  ),
  // C130 (smart TODO.roadmap/40 batch 3; the packages-as-SSOT epic): the
  // identity_slot / aspect registers — the ≥1-presentation shape leg, the
  // aspect reference legs (term_ref → term, component → instrument
  // component, attribute → attribute_definition, contains → identity path
  // OR bare attribute/dimension id), and the R28 bind-path consumer leg
  // (model.identity.<slot> / model.aspects.<id> in requirement/test
  // binds_to), each leg gated on its target register (the C58 doctrine).
  R(
    'C130',
    'identity-and-aspect-references',
    'composition',
    'error',
    'normal',
    'smart TODO.roadmap/40 batch 3 (the packages-as-SSOT epic)',
  ),
  // C131 (smart TODO.roadmap/40 batch 3; the packages-as-SSOT epic): the
  // promise certificate print projection — the content-binding XOR
  // (attribute | attributes | dimension | none = statement row), the
  // bindings resolving per-register gated, the renderer's closed type
  // vocabulary as a check-time error (parse-total against renderer
  // growth), and the required label. Fires on subject promises and
  // promise_set entries alike.
  R(
    'C131',
    'promise-certificate-projection',
    'composition',
    'error',
    'normal',
    'smart TODO.roadmap/40 batch 3 (the packages-as-SSOT epic)',
  ),
  // C132 (smart TODO.roadmap/40 batch 3; the packages-as-SSOT epic): the
  // application_declaration register — the declaration_form resolves
  // against the form register (per-register gated) and the document ids
  // are unique; the obligation vocabulary is parse-enforced upstream.
  R(
    'C132',
    'application-declaration-references',
    'composition',
    'error',
    'normal',
    'smart TODO.roadmap/40 batch 3 (the packages-as-SSOT epic)',
  ),
  // C133 (smart TODO.roadmap/40 batch 3; the packages-as-SSOT epic): the
  // calculation context's wiring — the subject-chain sources resolve
  // (classification.<dimension>, parameters.<attribute>, per-register
  // gated), computed ⇔ expression presence, the legacy source tokens
  // error, and the expression's free identifiers name the context's
  // fields (warning — runtime-bound inputs are legitimate).
  R(
    'C133',
    'calculation-context-references',
    'composition',
    'error',
    'normal',
    'smart TODO.roadmap/40 batch 3 (the packages-as-SSOT epic)',
  ),
  // C134 (smart TODO.roadmap/40 batch 3; the packages-as-SSOT epic): the
  // evaluation-dimension field schema — the enum facet resolves to a
  // classification dimension (error, gated); the field name resolves to
  // an is_dimension attribute OR a dimension id (warning when neither —
  // the r129 camelCase convention carries as-is, the owner decision).
  R(
    'C134',
    'evaluation-dimension-references',
    'composition',
    'error',
    'normal',
    'smart TODO.roadmap/40 batch 3 (the packages-as-SSOT epic)',
  ),
  // C135 (smart TODO.roadmap/40 batch 3; the packages-as-SSOT epic): the
  // evaluation profile's dimension-value preset is coherent — keys name
  // declared classification dimensions, values name their declared
  // values (per-register gated; the smart R4/R8 mirror).
  R(
    'C135',
    'evaluation-profile-coherence',
    'composition',
    'error',
    'normal',
    'smart TODO.roadmap/40 batch 3 (the packages-as-SSOT epic)',
  ),
  // C136 (smart TODO.roadmap/40 batch 3; the packages-as-SSOT epic): the
  // certificate template — the dimension_labels placeholders resolve
  // (gated), the characteristic bindings resolve with the XOR shape leg,
  // the type carries the renderer vocabulary (error), and the
  // number_format placeholders check against the known tokens (warning —
  // program-specific prefixes are legitimate).
  R(
    'C136',
    'certificate-template-references',
    'composition',
    'error',
    'normal',
    'smart TODO.roadmap/40 batch 3 (the packages-as-SSOT epic)',
  ),
  // C137 (smart TODO.roadmap/40 batch 3; the packages-as-SSOT epic): the
  // workflow step register — the actor resolves against the role
  // register (gated), the inputs/outputs clean tokens resolve against
  // the data-class register (gated; composite strings stay documentary),
  // the gates are prose and never resolve.
  R(
    'C137',
    'workflow-config-references',
    'composition',
    'error',
    'normal',
    'smart TODO.roadmap/40 batch 3 (the packages-as-SSOT epic)',
  ),
  // C138 (smart TODO.roadmap/40 batch 3; the packages-as-SSOT epic): the
  // verification pathways — the tests/covers resolutions (gated), the
  // trigger action against the lifecycle machines' transition actions
  // (gated), event iff kind signal, the window's ≥1-of years/months.
  R(
    'C138',
    'verification-pathway-references',
    'composition',
    'error',
    'normal',
    'smart TODO.roadmap/40 batch 3 (the packages-as-SSOT epic)',
  ),
  // C139 (smart TODO.roadmap/40 batch 3; the packages-as-SSOT epic): the
  // selection rules — the lab criterion's model_field resolutions
  // (attribute OR dimension, gated) and the operator-conditional match
  // facets; the sample/governance shape legs (rule / rationale /
  // applicability non-empty).
  R(
    'C139',
    'selection-rule-references',
    'composition',
    'error',
    'normal',
    'smart TODO.roadmap/40 batch 3 (the packages-as-SSOT epic)',
  ),
  // C140 (smart TODO.roadmap/40 batch 3; the packages-as-SSOT epic): the
  // test-report skeleton — the form/conformance_test/requirements
  // resolutions (per-register gated) and the conditional-inclusion leg
  // (applicability or notes, warning).
  R(
    'C140',
    'test-report-skeleton-references',
    'composition',
    'error',
    'normal',
    'smart TODO.roadmap/40 batch 3 (the packages-as-SSOT epic)',
  ),
  // C141 (smart TODO.roadmap/40 batch 3; the packages-as-SSOT epic): the
  // OIML-CS checklist — the element letter's a–r vocabulary (warning;
  // can grow), the per-checklist id uniqueness, and the overlay
  // orphan-entry leg (composition-side, the R2 residue failure mode).
  R(
    'C141',
    'checklist-entry-shape',
    'composition',
    'error',
    'normal',
    'smart TODO.roadmap/40 batch 3 (the packages-as-SSOT epic)',
  ),
  // C142 (smart TODO.roadmap/40 batch 5; the packages-as-SSOT epic): the
  // gateway routing cascade — edge targets resolve to declared processes
  // (gated), exactly one default edge per edge-carrying gateway, the
  // default recommended last (warning). The workflow_stage members-
  // resolve legs ride this rule (step 5d).
  R(
    'C142',
    'gateway-edges-resolve',
    'composition',
    'error',
    'normal',
    'smart TODO.roadmap/40 batch 5 (the packages-as-SSOT epic)',
  ),
  // C143 (smart TODO.roadmap/40 batch 5; the packages-as-SSOT epic): the
  // first approval rule — actor/approve_by resolve to declared roles,
  // the approval_record entries to declared entity-class stores (the
  // dataclass `store { … }` names), per-register gated (the C58
  // doctrine). Reads the raw reference ids so unresolvable ids are still
  // checked — and still round-trip.
  R(
    'C143',
    'approval-references-resolve',
    'composition',
    'error',
    'normal',
    'smart TODO.roadmap/40 batch 5 (the packages-as-SSOT epic)',
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
  // ── the v3.2 lineage edge (TODO.primmel/11; MN 114 v3.2 clause 9.3.1,
  // primmel/spec#18) ──
  // C113: the lineage graph is the union of the backward edges
  // (supersedes/replaces) and the forward edge (superseded_by); when two
  // composed packages declare opposite edges between the same pair the
  // declarations must agree — A supersedes { B } while B declares
  // superseded_by { C } without A is an error. A missing forward edge is
  // NOT an error: the backward edges remain the authored minimum.
  R(
    'C113',
    'edition-lineage-coherent',
    'edition',
    'error',
    'normal',
    'TODO.primmel/11, MN 114 clause 9.3.1 (primmel/spec#18 ask 3)',
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
  // ── the v3.2 consumption constructs (TODO.primmel/11; MN 114 v3.2,
  // primmel/spec#18) ──
  // C110: the term alias family's shape (clause 13.10.1) — duplicate
  // entries within one list are errors; the same string in two family
  // fields of one term and the label echo are warning legs during the
  // v3.2 rollout (the v2 `alt` semantics allowed the overlap; the
  // cross-field leg tightens to the spec's error when the consumer wave
  // re-authors the estate's terms — TODO.primmel/11d).
  R(
    'C110',
    'term-alias-shape',
    'base',
    'error',
    'normal',
    'TODO.primmel/11, MN 114 clause 13.10.1 (primmel/spec#18 ask 1)',
  ),
  // C111: the dimension declaration's shape (clause 10.6) — value ids
  // unique within a dimension, implies targets resolving inside their
  // own dimension and acyclic, values vs values_of never combined, an
  // undocumented values_of register warned, and one dimension identifier
  // once per applicability namespace (the is_dimension-attribute/inline
  // mirror pattern tolerated — R 144's power_supply precedent).
  R(
    'C111',
    'dimension-shape',
    'base',
    'error',
    'normal',
    'TODO.primmel/11, MN 114 clause 10.6 (primmel/spec#18 ask 2)',
  ),
  // C112: the structured reference identity (clause 14.7) — a malformed
  // urn is an error (the same well-formedness class as C85); a reference
  // carrying neither urn nor the org+document pair is a warning (a
  // display-string citation is visible debt, never silently citable).
  R(
    'C112',
    'reference-identity',
    'base',
    'error',
    'normal',
    'TODO.primmel/11, MN 114 clause 14.7 (primmel/spec#18 ask 3)',
  ),
  // C114: the limit's quantity typing agrees with the verdict it binds
  // (clause 11.1.2) — a limit and its acceptance chain can never drift
  // apart in units. C115: the calculation signature (clause 13.7.1) —
  // units and quantity kinds resolve against the merged quantity register
  // and agree in kind, a range's min never exceeds its max, and an
  // enum-typed input declares its values. The unit-resolution leg ships
  // as a WARNING during the v3.2 rollout (the C33 doctrine §6.8
  // precedent: unmapped units are warnings — the estate's R 60 declares
  // counts/v on inputs no register carries; the leg tightens to the
  // spec's error when the register catches up — TODO.primmel/11d).
  R(
    'C114',
    'limit-quantity-coherence',
    'quantities',
    'error',
    'normal',
    'TODO.primmel/11, MN 114 clause 11.1.2 (primmel/spec#18 ask 4)',
  ),
  R(
    'C115',
    'calculation-signature-shape',
    'quantities',
    'error',
    'normal',
    'TODO.primmel/11, MN 114 clause 13.7.1 (primmel/spec#18 ask 4)',
  ),
  // C116/C117: the verdict chain (clause 11.3) — a verdict's inputs may
  // name another verdict, making the acceptance chain an explicit graph.
  // Every input resolves to a declared symbol, a test variable or
  // observable, or another verdict; the verdict→verdict graph never
  // cycles. C118: the instance-parameter schema (clause 11.1.3) — a
  // parameter's bind path resolves against the subject's aspect catalog
  // (the binds_to path discipline), its unit resolves against the merged
  // quantity register (the rollout WARNING leg, the C33 §6.8 precedent —
  // tightens with C115's leg, TODO.primmel/11d), and a range's min never
  // exceeds its max.
  R(
    'C116',
    'verdict-inputs-resolve',
    'characteristics',
    'error',
    'normal',
    'TODO.primmel/11, MN 114 clause 11.3 (primmel/spec#18 ask 5)',
  ),
  R(
    'C117',
    'verdict-chain-acyclic',
    'characteristics',
    'error',
    'normal',
    'TODO.primmel/11, MN 114 clause 11.3 (primmel/spec#18 ask 5)',
  ),
  R(
    'C118',
    'requirement-parameter-shape',
    'base',
    'error',
    'normal',
    'TODO.primmel/11, MN 114 clause 11.1.3 (primmel/spec#18 ask 5)',
  ),
  // ── the dataspace family (TODO.primmel/10; MN 114 v3.1 clause 19) ──
  // The v3.1 extension set: the dataspace definition, the policy
  // construct (Primmel's own policy grammar; ODRL is a codec output),
  // the trust_ref form (opaque addressing — the checker verifies shape,
  // NEVER resolution: the trust plane's membership is runtime fact), and
  // the generalized corresponds annotations. C104: the dataspace's
  // references resolve (policy register, default policy, per-class
  // overrides, content elements, the compatibility register). C105:
  // every trust anchor carries its trust_ref with an organization
  // identifier. C106: a dataspace with no governance citation warns (an
  // orphan definition). C107: the policy shape — at least one rule,
  // every rule with its action, rule artifacts inside the governs
  // register, governed classes resolving, at most one default-posture
  // policy per class. C108: one corresponds entry per scheme per
  // element (an error — the bridges read unambiguous mappings), and the
  // irdi legacy spelling agreeing with `corresponds iec-cdd` (a warning
  // leg).
  R(
    'C104',
    'dataspace-references-resolve',
    'dataspace',
    'error',
    'normal',
    'TODO.primmel/10, MN 114 clause 19.1',
  ),
  R(
    'C105',
    'dataspace-trust-anchor-shape',
    'dataspace',
    'error',
    'normal',
    'TODO.primmel/10, MN 114 clauses 19.1/19.3',
  ),
  R(
    'C106',
    'dataspace-governance-provenance',
    'dataspace',
    'warning',
    'normal',
    'TODO.primmel/10, MN 114 clause 19.1',
  ),
  R(
    'C107',
    'policy-shape',
    'dataspace',
    'error',
    'normal',
    'TODO.primmel/10, MN 114 clause 19.2',
  ),
  R(
    'C108',
    'correspondence-shape',
    'dataspace',
    'error',
    'normal',
    'TODO.primmel/10, MN 114 clause 19.4',
  ),
  // ── C109: state-machine-initial-present (the editor wave-03 finding,
  // primmel/editor#19) ──
  // The spec's state machine syntax marks `initial` required (the
  // starting state for new entities). The parser stays total (a machine
  // without the line loads with initialState '') and the serializer
  // stays honest (it omits the line — never the dangling keyword that
  // reparsed as `initial states`), so the refusal lives HERE, at the
  // language's own validation layer — the C95 contract-ownership
  // doctrine.
  R(
    'C109',
    'state-machine-initial-present',
    'state',
    'error',
    'normal',
    'spec sources/state-machines §2 (initial: Required), primmel/editor#19 (wave-03 findings)',
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

// ─────────────────────────────────────────────────────────────────────
// primmel check — cross-layer linter (Primmel v2 plan, W8).
//
// First-class package checks beyond parse-time validation:
//   C1 attribute scope vs bind path scope (forms)
//   C2 reference targets resolve (req targets, test targets, form
//      conformance ids, capability req/test refs, behavior verified_by,
//      requirement binds_to)
//   C3 classification dimension enums (dimension ids + values referenced
//      in applicability blocks and test subjects exist; match all|exact on
//      a single-cardinality dimension warns — it reduces to match any)
//   C4 store names unique (storable classes)
//   C5 every requirement is verified — targeted by ≥1 test, provision'd
//      by a process, or declaring a non-test verification method
//      (refined, TODO.roadmap/17); every test targets ≥1 req
//   C6 subject anatomy: aspect declared under the wrong family (or
//      undeclared aspect kind) is an error (anatomy-family)
//   C7 every has.characteristics entry names its derivation
//      (anatomy-characteristic-derivation)
//   C8 every does.behavior ref resolves to a declared behavior
//      (anatomy-behavior-resolves)
//   C9 a subject's extends target is a declared subject
//      (subject-extends-resolves)
//   C10 executable process: exactly one start event (process-one-start)
//   C11 end events on every terminal path — mandatory on empty gateway
//      branches; flow edges reference declared steps (process-terminal-end)
//   C12 gateway edge conditions + step I/O name declared registers
//      (process-flow-names-resolve)
//   C13 executable steps realize the signature: OUT written (error),
//      IN read (warning) (process-signature-realized)
//   C14 a recurrence (flow cycle) passes through a timer event WITH a
//      declared period — no unguarded infinite self-loops
//      (process-timer-recurrence)
//   C15 a timer_event declares its recurrence period — a period-less
//      timer is not a loop guard (process-timer-period)
//   C16 step ids are unique within one does body
//      (process-step-ids-unique)
//   C17 instance values respect the attribute scope discipline: stated at
//      the declared scope or lower; sample-scope only in test_context of a
//      sample-level instance; test_context/classification level checks
//      (instance-scope)
//   C18 every instance carries definition_versions pins (INV-8)
//      (instance-version-pin)
//   C19 instance chain links (model/group/family) resolve and are acyclic
//      (chain-acyclic)
//   C20 every instance's `of` resolves to a declared subject or instrument
//      (instance-of-resolves)
//   C21 mapping-resolves: both ends of every mapping resolve — the source
//      is a declared component; the target's namespace matches the profile
//      namespace and a declared `Namespace#ElementID` alias element exists
//   C22 mapping-direction: mappings run implementation → reference only
//      (no namespaced source; no mapping into the model's own namespace)
//   C23 mapping-calculus-consistency: an authored coverage assertion that
//      disagrees with the computed calculus is an error
//   C24 import-not-mapping: an import (uses/extends) may not be expressed
//      as a mapping, nor a mapping as an import
//   C25 mapping-description: a mapping without description is a warning
//      at audit strictness
//   C26 view-read-only: a view names declared elements and reads against
//      a declared map namespace — it never invents or edits mappings
//   C27 uses-resolves: every uses/extends entry resolves to a package
//      (needs the resolvePackage locator); extends → uses deprecation
//      is a warning under the same rule
//   C28 uses-no-redefine: a downstream package may reference upstream ids
//      but never redeclare them
//   C29 uses-cycle: the uses graph is acyclic
//   C30 provides-consumed-or-waived: every provides entry is required by a
//      downstream package or explicitly waived (warning)
//   C31 requires-satisfied: every requires entry names a composed package
//      id or one of its provides entries
//   C32 inv1-no-bare-quantity: a value stated for a declared physical
//      quantity (attribute unit, quantity_kind, or QuantityValue
//      value_type) carries a unit — an empty-string unit token counts as
//      bare; numeric condition-set entries carry a unit too (free-text
//      values stay legal) — INV-1, no bare numbers (TODO.roadmap/06)
//   C33 quantity-coherence: register integrity (unit kinds resolve, no
//      cross-register redefinition) + comparison coherence on quantity
//      KINDS (instance values vs attribute definitions, condition-set
//      entries, symbols, verdicts) — mass vs time fails; unmapped units
//      are warnings
//   C34 duality-coherence: a dual carries ≥1 role; each stated role of a
//      dual bound to a declared physical quantity carries a unit (or an
//      explicit kind) — INV-1; both roles stated ⇒ same quantity kind
//      (compatible unit); tolerance belongs to designed, uncertainty to
//      exhibited (warnings)
//   C35 time-format: timer-event recurrence periods are ISO 8601
//      durations (closes task 02's deferred format check); instance
//      values for time-typed attributes (date/datetime/duration/period)
//      match their ISO 8601 shape
//   C36 map-type: a `map<K, V>` field/value type is well-formed
//      (K = string or enum id, V a valid type expression)
//   C37 state-fires-resolve: every step `fires` names a declared
//      transition action of the process's bound state machine
//      (TODO.roadmap/07)
//   C38 state-family-separation: no cross-references between the
//      operational and lifecycle machine families — no lifecycle cascade
//      into an operational machine, no operational cascade into a
//      lifecycle machine, no subject has.state bound to a lifecycle
//      machine
//   C39 state-machine-states-referenced: every `#state` literal in a
//      `self.state` gate resolves against the bound machine's states
//   C40 anatomy-state-resolves: a subject's has.state names a declared
//      state machine (family checked by C38)
//   C41 precondition-on-violation-known: a precondition's on_violation
//      parses as a free string; the only known outcome is "invalid"
//      (others warn) — a state gate declared on_violation fail ALWAYS
//      warns, naming the doctrine: a violated run-validity precondition
//      voids the run, it never fails the instrument
//   C42 promise-target-resolves: a promise's target is a declared
//      characteristic (of the owning subject), behavior, attribute (the
//      C44 path), classification dimension, or symbol-registry id (the
//      register doctrine — smart R15's resolution set)
//   C43 promise-verifiable: no verified_by declared AND no verifying
//      requirement/test derivable (requirements/tests binding the same
//      target) — a warning at authoring (TODO.roadmap/08)
//   C44 promise-not-bare-value: a promise that merely RESTATES a declared
//      attribute value (attribute target + bare quantity level, no
//      conditions, no verification linkage) is an error — bare parameter
//      values stay `origin: declared` attributes. Targeting an
//      attribute/dimension with a genuine claim ABOUT it (conditioned,
//      envelope/range, symbolic level, or verified) is legal.
//   C45 artifact-def-contract: an artifact definition's content contract
//      is well-formed — ≥1 named field, every field typed, no duplicate
//      fields, media entries refine declared fields, produced_when is
//      per_measurement | per_interval <ISO-8601 duration> | on_event
//      <event> (TODO.roadmap/09)
//   C46 artifact-instance-resolves: subject is.artifacts / has.
//      artifact_instances slots resolve; a conformance test's
//      produces_artifacts resolve; an instance's `of` resolves to a
//      declared artifact definition; content fields ⊆ the contract;
//      required contract fields populated; the producer (by) named;
//      per_measurement instances link a producing run/report
//   C47 artifact-evidence-separation: the MECE firewall — an artifact is
//      an output OF the instrument, an EvidenceRecord is a record OF the
//      test; no artifact contract field name doubles as a conformance-test
//      variable/observable or form field (and vice versa)
//   C48 characteristic-one-home: with subject characteristics declared,
//      a `verdict` construct carrying its own `derive` defines a
//      verdict-quantity derivation outside the primary model — an error
//      (TODO.roadmap/10; the OIML SMART verdict-no-shadow /
//      verdict-restatement spirit, re-pointed at the new home)
//   C49 characteristic-behavior-link: a characteristic's behavior ref
//      resolves to a declared behavior
//   C50 characteristic-derivation-inputs: an ocl{…} derivation's reads
//      resolve — self.<p> against the subject's parameters, bare names
//      against the behavior-I/O vocabulary (symbols, attributes,
//      subject parameters)
//   C58 activity-kind-resolves: a process's activity_kind ids resolve
//      against a declared activity_archetype register when one is in
//      scope; the register's own parent references resolve within the
//      register (TODO.roadmap/39; silent in a register-less package)
//   C59 segregation-members-resolve: a process's segregation constraints
//      (TODO.roadmap/39b — ISO/IEC 17065 role segregation) are
//      well-formed: pair members resolve to declared processes (or the
//      reserved case_personnel token), are distinct, and include the
//      owning process; the kind-conditional XOR (smart TODO.roadmap/40
//      batch 2): a disjoint constraint is ONLY a pair, a consultancy
//      bar carries barred relations (required) + an optional period and
//      never a pair
//   C74 process-io-type-coherence (TODO.roadmap/38): typed transition
//      boundaries — one name (signature in/out, registers) carries ONE
//      type; two declarations of the same name whose quantity
//      kinds/units disagree (mass vs time) make every boundary that
//      hands the name off unsound (∘: t₁: A→B, t₂: B→C ⊢ t₂∘t₁: A→C)
//   C75 process-flow-io-cover (TODO.roadmap/38): the step-chain dataflow
//      covers every read — a step read (or edge-condition read) of a
//      declared name that is neither provided (IN parameter, instance
//      value, state) nor written on every incoming flow path is an
//      error; a write no step reads, no condition references, and no
//      OUT parameter names is a dead-output warning (a capture-step
//      write lands in evidence, so it is never dead)
//   C76 subprocess-signature-bound (TODO.roadmap/38): a `calls` step
//      names a declared process (resolved on the composed package — a
//      call across a `uses` boundary is checked post-merge); when the
//      callee declares a signature, the with { in / out } block binds
//      every IN from a caller register and maps every OUT back to one,
//      kind-compatible on both legs
//   C60 serve-targets-resolve (TODO.roadmap/32, doctrine §14.12): every
//      serve binding names a declared aspect of the owning subject
//      ([level.]{parameters|classification|test_context}.<key>, a bare
//      attribute/characteristic/dimension name, state,
//      environmental_context) and a declared, unambiguous endpoint
//      operation of value-channel kind (query | subscribe); the served
//      aspect and the operation payload are unit/quantity-kind coherent.
//      The endpoint legs ride the same rule: an operation's serves names
//      resolve as subject aspects, its does names as declared behaviors
//   C61 payload-schema-quantity: every endpoint operation declares a
//      known kind (query | subscribe | invoke) and a payload schema that
//      is a QuantityValue per INV-1 — quantity kind, unit (the register's
//      dimensionless id when non-quantity), and timestamp true (a value
//      without a time is not evidence, §14.3)
//   C62 access-scope-covers-serves: every endpoint operation is covered
//      by exactly one access scope (public | registered | authority);
//      access entries name declared operations of the endpoint (§14.12:
//      every endpoint operation has an access scope)
//   C63 freshness-required-on-live-bindings: a serve binding without
//      fresh_within is an error (§14.12 — no stale semantics, no live
//      binding); the window must parse (shorthand 5s/1min/1h or ISO 8601
//      with fixed-length components)
//   C64 endpoint-profile-resolves: an endpoint's profile names a declared
//      connector_profile or a built-in (rest_json, mqtt, opc_ua,
//      file_drop) — the model is protocol-neutral; profiles bind
//      protocols (§14.4)
//   C65 monitor-subject-resolves (TODO.roadmap/34, doctrine §14.5/§14.12):
//      a monitor's over set is non-empty and every ref names a declared
//      subject (a monitor watching nothing judges nothing)
//   C66 monitor-trigger-wellformed: at least one trigger — without
//      triggers "continuous" has no clock (§14.5 step 1); a timer's every
//      window parses (the freshness-window syntax); a signal names its
//      signal; a change names an aspect resolving against a monitored
//      subject (the serve aspect vocabulary — ONE resolver)
//   C67 monitor-evaluate-resolves: evaluate refs resolve to
//      requirements/promises applicable to the monitored subjects
//      (§14.12) — all / applicable_to(…) expand per twin at runtime;
//      explicit refs resolve (requirement ids against the package's
//      requirements, promise ids against the monitored subjects'
//      promises)
//   C68 monitor-fail-escalation: a monitor without an escalation path
//      for `fail` is a warning (§14.12, verbatim) — pass accrues history;
//      fail/invalid must act
//   C69 monitor-escalation-resolves: escalation outcomes are verdict
//      outcomes (pass | fail | indeterminate | invalid); actions are
//      notify | flag_certificate | open_service_case; a notify names a
//      declared role
//   C70 monitor-emit-sinks: evidence and verdicts streams are each
//      emitted exactly once with a named sink (§14.5 step 6: appended to
//      the workspace — facts only; permanent)
//
// ── Coverage audits (TODO.roadmap/17, concept doc §11.5) ──
//   The aspect↔requirement↔test↔form↔verdict closure. The requirement→test
//   link is C5 (base, refined): a requirement is covered when a
//   conformance test targets it, a process validate_provision's it, or it
//   declares a non-test verification method (definitional / examination /
//   inspection / documentation / computational / deferred — deliberate
//   exclusions are recorded, not gaps); an undeclared gap is always a
//   finding. The remaining links are the coverage family:
//   C51 coverage-test-evidence: a conformance test leaving no evidence —
//      no form declares it (conformance_process), no result_forms, no
//      report_rows, and no form covers a requirement it targets —
//      following inherits_from chains (AUDIT level, warning)
//   C52 coverage-form-judgment: a test-evidence form (binding a
//      conformance process) with no pass_fail, no field
//      evaluation/verdict, and no requirements binding — evidence
//      gathered and never weighed (AUDIT level, warning)
//   C53 coverage-uses-bound: every requirement limit.uses input is
//      bound — unprefixed ids resolve against attributes / symbols /
//      requirements / dimensions / behaviors ('load' is the declared
//      per-load-point free variable, deep-audit-r60 F6); observable: and
//      formula: prefixes resolve against symbols and calculations
//      (NORMAL level, error)
//   C54 coverage-lookup-table-exists: table:/profile: uses prefixes and
//      calculation lookup profiles resolve to declared tables/profiles
//      (lookupMPE/lookupProfile targets) (NORMAL level, error)
//   C55 coverage-budget: the package's declared coverage_budget caps its
//      C51/C52 warning count — exceeded is an error, slack warns (the
//      allowlist only shrinks)
//   C56 allowlist-malformed: every allowlist entry names a real rule id,
//      a non-empty match glob, a reason, and an audit_ref (§11.9)
//   C57 allowlist-stale: an allowlist entry whose rule is active at the
//      current level but matches no issue is an error — the data was
//      fixed, the entry must die (§11.3)
//
// ── Edition lifecycle (TODO.roadmap/28, doctrine ch. 13 §13.4/§13.7) ──
//   Versioning relations live on the package manifest, never in subject
//   models; editions are packagings orthogonal to the core.
//   C77 edition-status: a current/preview edition packages the edition
//      register's newest entry (the status enum itself is a parser error,
//      like `kind`)
//   C78 edition-validity-window: the manifest validity window is
//      well-formed ISO 8601; `to` not before `from`
//   C79 edition-supersedes-resolves: supersedes/replaces targets are
//      well-formed URNs, never the package itself, resolve against the
//      edition register (same-document targets), and the supersedes graph
//      over sibling manifests is acyclic
//   C80 edition-pin-resolves (INV-8): every instance's
//      definition_versions pin resolves against the package's edition
//      register — an unresolvable pin breaks re-execution (§13.5)
//   C81 product-maps-resolves: a product reference package declares its
//      manufacturer, product designation, and the standards-reference
//      packages it maps to (maps_to) — the register resolves and agrees
//      with the model's map profiles (TODO.roadmap/36, doctrine ch. 15)
//   C82 product-unmapped-promises: an IS promise of a product reference
//      package that no mapping sources is a brochure claim — a warning
//      at authoring (doctrine ch. 15 §15.2)
//   C83 abstract-import-pinned: a uses edge to a product reference
//      package carries a version pin (uses { <id>@<edition> }) that
//      resolves against the product's edition register — no unpinned
//      reference consumption (doctrine ch. 15 §15.3)
//   C104–C108 the dataspace family (TODO.primmel/10; MN 114 v3.1
//      clause 19): dataspace references resolve, trust anchors shaped
//      (the trust_ref stays opaque — the checker never resolves the
//      trust plane), governance cited, policies well-formed, and one
//      correspondence per scheme per element
//   C109 state-machine-initial-present: every state machine declares
//      its initial state (the spec marks it required; the serializer
//      omits the line rather than emitting the dangling keyword — the
//      editor wave-03 finding, primmel/editor#19)
//   C110 term-alias-shape (MN 114 v3.2 clause 13.10.1, TODO.primmel/11):
//      the term alias family's shape — duplicates within one list
//      (errors), the same string in two family fields of one term and
//      label echoes (rollout warning legs; the cross-field leg tightens
//      to the spec's error when 11d re-authors the estate's terms)
//   C111 dimension-shape (MN 114 v3.2 clause 10.6, TODO.primmel/11):
//      the applicability dimension namespace's declarations — unique
//      value ids, implies resolving and acyclic, values vs values_of,
//      one identifier once per namespace; and C3's resolution widens to
//      the full namespace (clause 11.1.1: instrument dimensions +
//      is_dimension attribute mirrors + the top-level declarations,
//      values_of capabilities resolving from the capability register)
//   C120 framework-references-resolve (smart TODO.roadmap/40; the
//      packages-as-SSOT epic): the certification-framework registers'
//      cross-references resolve against the composed registers — organ
//      edges, participant-kind edges, declaration holder + gate edges
//      (incl. blocked processes), scheme-lifecycle organ/trigger edges,
//      document approving organs, decision_rule edges. Per-register
//      gating (the C58 doctrine): an edge is checked only when its
//      target register is in composition scope
//   C121 abstract-process-references-resolve (smart TODO.roadmap/40
//      batch 2): the abstract-process model's framework bindings resolve
//      — roles/organs/participant_kinds lists, decision.rule, the
//      declaration kind + sign|update action vocabulary,
//      the gate facet's discharge entries, realized_by → process,
//      approved_by → approval,
//      the calendar windows' shape (kind vocabulary; exactly one of
//      years/months), and the process_model's sequence + register
//      maintainer edges. Per-register gating (the C58 doctrine)
//   C122 scheme-type-resolves (smart TODO.roadmap/40 batch 2): the
//      ISO/IEC 17067 register is composable — a manifest's scheme_type
//      token resolves against the composed scheme_type register when one
//      is in scope; a scheme_type's determination / attestation /
//      surveillance.activities entries resolve against the composed
//      scheme_activity_kind menus. C98's no-surveillance set defers to
//      the register's surveillance.required (register-free fallback
//      stays)
//   C123 document-module-references-resolve (smart TODO.roadmap/40 batch
//      2): the document module's edges resolve — sequence → process,
//      register maintainer → governance_organ (per-register gated), the
//      declared namespace is an absolute requirement-namespace path (the
//      pin C119 prefers over the requirement_class-id derivation), and
//      the informative annex's applies_to names a known package
//      (locator-gated)
//   C124 pair-list-shape (smart TODO.roadmap/40 batch 4): the
//      attribute_definition pair_list block's declaration shape — key +
//      value slots required, component ids unique, key_dimension →
//      applicability dimension (per-register gated); the closed-registry-
//      over-values leg stays app-side
//   C125 formula-variant-shape (smart TODO.roadmap/40 batch 4): the
//      calculation variant block's declaration shape — variant ids
//      unique, the type-conditional facets present (expression /
//      table_lookup / profile_lookup); the params are engine call-site
//      names and carry no resolution leg
//   C126 formula-note-targets-resolve (smart TODO.roadmap/40 batch 4):
//      the formula_note register's reverse applicability resolves —
//      applies_to → symbol (per-register gated)
//   C127 common-test-condition-shape (smart TODO.roadmap/40 batch 4):
//      the common_test_condition register's declaration shape — the
//      description is required; the title stays optional (the r91 map
//      entries carry none) and the reference a free citation string
//   C128 part-annex-shape (smart TODO.roadmap/40 batch 4): the
//      part_annex register's declaration shape — letters unique per
//      package, the source provenance required; the obligation
//      vocabulary is parse-enforced upstream
//
// Levels (TODO.roadmap/17): the DEFAULT level runs the normal-level
// rules at their catalog severities. --audit additionally runs the
// audit-level rules (C25, C51, C52) and enforces the coverage budget.
// --strict promotes every warning to an error — EXCEPT KNOWN
// (allowlisted) issues and budget-covered C51/C52 warnings (the budget
// is their allowance). The package allowlist lives in
// <dir>/.primmel-allowlist.prl (see check-allowlist.ts); the rule
// catalog lives in check-rules.ts (`primmel check --rules`).
//
// Manifest-only stopgap (TODO.roadmap/05, until task 13 retires the
// textual-include transport): when checkPackage runs WITHOUT a
// resolvePackage locator, full composition cannot run — but the shipped
// manifests still declare uses/requires/provides, so a dangling uses id
// would go completely unreported. checkManifestResolution() closes that
// hole: it parses the package's manifest plus the manifests of its
// SIBLING package directories (id match) and verifies, WITHOUT composing
// content, that every uses/extends entry resolves, the graph is acyclic,
// and every requires entry names a closure package id or one of its
// provides entries. Issues report under the same C27/C29/C31 codes with
// a "(manifest-only …)" marker.
// Each check returns issues: { check, severity, message }.
// ─────────────────────────────────────────────────────────────────────

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, resolve } from 'path';
import {
  CompositionError,
  closureReport,
  effectiveUses,
  loadPackageWithIssues,
  readPackageManifest,
  type ResolvePackage,
} from './ser-des/package';
import { findWorkspaceLocators } from './ser-des/locators';
import type { PackageManifest } from './types/Package';
import { loadPrm, prmToMapProfiles } from './ser-des/prm';
import {
  buildProcessTree,
  componentIds,
  computeCoverage,
  mappingsFromProfile,
  parseTargetRef,
} from './mapping-coverage';
import type MapProfile from './types/MapProfile';
import type Standard from './types/Standard';
import type { AttributeDefinition, Behavior, Subject } from './types/Subject';
import Process from './types/process';

import type { Requirement } from './types/Requirement';
import { parseExpression } from './expressions';
import type { ExprAst } from './expressions';
import type ConformanceTest from './types/ConformanceTest';
import type Symbol from './types/Symbol';
import type { FormField } from './types/Form';
import {} from './unitsdb';
import { parseFreshnessWindow } from './time';
import {} from './model-diff';
import {
  BUILTIN_CONNECTOR_PROFILES,
  ENDPOINT_ACCESS_SCOPES,
  ENDPOINT_OPERATION_KINDS,
} from './types/Twin';
import { COMPOSITION_STATE_RULES } from './types/Composition';
import {
  MONITOR_ESCALATION_ACTIONS,
  MONITOR_OUTCOMES,
  MONITOR_REFSET_KINDS,
  MONITOR_STREAMS,
  type Monitor,
} from './types/Monitor';
import {
  PASSPORT_CONTENT_CLASSES,
  PASSPORT_UPI_LEVELS,
} from './types/Passport';
import { TEST_SEQUENCE_STEP_ROLES } from './types/TestSequence';

import { activeRuleIds } from './check-rules';
import { delegationSuccessors } from './instance-resolution';
import {
  applyAllowlist,
  applyProviderAllowlists,
  BUDGETED_RULES,
  loadAllowlist,
  TEXT_BUDGETED_RULES,
} from './check-allowlist';
import {} from './text-coverage';
import {} from './spelling';
import { DIM_ALIASES, isIdentityPath } from './check-paths';
import { runLicenseFacetsFamily } from './check-families/license-facets';
import { runGenerationRatchetFamily } from './check-families/generation-ratchet';
import { runUncertaintyBudgetFamily } from './check-families/uncertainty-budget';
import { runDocumentaryRegistersFamily } from './check-families/documentary-registers';
import { runIdentityAspectsFamily } from './check-families/identity-aspects';
import { runDatumCoherenceFamily } from './check-families/datum-coherence';
import { runSsotRegistersFamily } from './check-families/ssot-registers';
import { runEvaluationRegistersFamily } from './check-families/evaluation-registers';
import { runRegistryApprovalsFamily } from './check-families/registry-approvals';
import { runQuantitiesFamily } from './check-families/quantities';
import { runTransitionBoundariesFamily } from './check-families/transition-boundaries';
import { runStateMachinesFamily } from './check-families/state-machines';
import { runCoverageAuditsFamily } from './check-families/coverage-audits';
import { runDataspacesFamily } from './check-families/dataspaces';
import { checkSpellingCodes } from './check-families/spelling-codes';
import { checkDeclaredPredicates } from './check-families/declared-predicates';
import { checkTermAliases } from './check-families/term-aliases';
import { checkDimensions } from './check-families/dimensions';
import { checkVerdictChains } from './check-families/verdict-chains';
import { checkClosedDerivations } from './check-families/closed-derivations';
import { checkAttestations } from './check-families/attestations';
import { checkTypedPayloads } from './check-families/typed-payloads';
import { checkArtifactContracts } from './check-families/artifact-contracts';
import { checkRecordRunInputs } from './check-families/record-run-inputs';
import { checkFieldRange } from './check-families/field-range';
import { checkUnitsDbBindings } from './check-families/unitsdb-bindings';
import { checkEditionLifecycle } from './check-families/edition-lifecycle';
import { findCycle } from './graph';
import { runExpressionsFamily } from './check-families/expressions';
import { runSubjectAnatomyFamily } from './check-families/subject-anatomy';
import { runClaimPlaneFamily } from './check-families/claim-plane';
import { runRegistersFamily } from './check-families/registers';
import { checkLmlAligned } from './check-families/lml-aligned';
export { checkLmlAligned };
export { checkSpellingCodes };
export { checkDeclaredPredicates };
export { checkTermAliases };
export { checkDimensions };
export { checkVerdictChains };
export { checkClosedDerivations };
export { checkAttestations };
export { checkTypedPayloads };
export { checkArtifactContracts };
export { checkRecordRunInputs };
export { checkFieldRange };
export { checkUnitsDbBindings };
export { checkEditionLifecycle };

export interface CheckIssue {
  check: string;
  severity: 'error' | 'warning';
  message: string;
  /** True when an allowlist entry suppressed this issue (KNOWN — it
   *  prints, but it never counts as an error, even under --strict). */
  known?: boolean;
}

/** Options for the mapping-aware rules (C21–C26). */
export interface CheckOptions {
  /**
   * 'normal' (default) | 'audit' — audit strictness additionally warns on
   * mappings without a description (C25) and runs the audit-level
   * coverage closure rules (C51 coverage-test-evidence, C52
   * coverage-form-judgment).
   */
  strictness?: 'normal' | 'audit';
  /**
   * --strict: promote every warning to an error — EXCEPT KNOWN
   * (allowlisted) issues and budget-covered C51/C52 coverage warnings
   * (the package's coverage_budget is their allowance; exceeding it is
   * already a C55 error).
   */
  strict?: boolean;
  /**
   * Reference models by namespace. C23 computes coverage against these;
   * when a namespace is absent, the calculus falls back to the package's
   * own `Namespace#…` alias forest (the declared local copies).
   */
  references?: Record<string, Standard>;
  /**
   * Package locator for the composition rules C27–C31 (TODO.roadmap/05).
   * When provided and the manifest declares `uses`/`extends`, the whole
   * dependency closure is composed and checked; without it those rules
   * stay silent (a linter cannot verify resolution without a locator).
   */
  resolvePackage?: ResolvePackage;
  /**
   * The UnitsDB data (kernel#87) — when supplied, C185 verifies each
   * unitsdb-pinned register unit against it (the ids resolve, the
   * decomposition terminates); without it the bindings are inert
   * (parse-enforced shape only). The caller pins the snapshot.
   */
  unitsDb?: import('./unitsdb').UnitsDbData;
}

const BIND_SCOPES: Record<string, string> = {
  'family.parameters': 'family',
  'group.parameters': 'group',
  'model.parameters': 'model',
  'sample.test_context': 'sample',
};

function attrId(
  standard: Standard,
  id: string,
): AttributeDefinition | undefined {
  return (standard.attributeDefinitions ?? []).find(
    (a: AttributeDefinition) => a.id === id,
  );
}

export function checkPackage(
  dir: string,
  options: CheckOptions = {},
): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const err = (check: string, message: string) =>
    issues.push({ check, severity: 'error', message });
  const warn = (check: string, message: string) =>
    issues.push({ check, severity: 'warning', message });

  // ── C27–C31 + C119: `uses` composition (TODO.roadmap/05) ──────────
  // Composition errors are HARD load errors (the merge cannot proceed),
  // so the loader throws CompositionError; the linter reports them as
  // rule-identified issues instead. Composition WARNINGS (unconsumed
  // provides, extends deprecation) come back in the load's issue list.
  // The parse-time duplicate-id issues ride the same list — surfaced
  // under C96 (the E11 review finding: every id-keyed collection's
  // uniqueness delegation — C84 constraints, C94 formulas-used — is
  // invisible if the linter drops them here).
  const COMPOSITION_RULE_CHECKS: Record<string, string> = {
    'uses-resolves': 'C27',
    'uses-no-redefine': 'C28',
    'uses-cycle': 'C29',
    'requires-satisfied': 'C31',
    'namespace-pin-violation': 'C119',
    'locator-undeclared': 'C187',
  };
  let standard: Standard;
  let compositionProviders: NonNullable<
    import('./ser-des/package').CompositionInfo['providers']
  > = [];
  try {
    const loaded = loadPackageWithIssues(dir, {
      resolvePackage: options.resolvePackage,
    });
    standard = loaded.standard;
    compositionProviders = loaded.composition?.providers ?? [];
    for (const i of loaded.issues) {
      // The deprecation report (phase 2): the parse-time issue maps to
      // its rule.
      if (i.code === 'construct-deprecated') {
        warn('C154', i.message);
      } else if (i.code === 'provides-unconsumed') {
        warn('C30', i.message);
      } else if (i.code === 'extends-deprecated') {
        warn('C27', i.message);
      } else if (i.code === 'duplicate-id') {
        err('C96', `${i.message} (duplicate-id)`);
      } else if (i.code === 'orphan-overlay-entry') {
        // The checklist overlay's orphan-entry guard (C141's
        // composition leg — smart TODO.roadmap/40 batch 3).
        err('C141', i.message);
      }
    }
  } catch (e) {
    if (e instanceof CompositionError) {
      err(COMPOSITION_RULE_CHECKS[e.rule] ?? 'C27', e.message);
      return issues;
    }
    throw e;
  }

  // The workspace locator plane (TODO.lang-spec/15): the workspace's
  // declared endpoints are hygiene every package under it carries — a
  // malformed declaration or an inline credential is reported from every
  // package that reads the file (C187's declaration legs, C188), and a
  // qualified import naming no declared endpoint is C187. The composed
  // path throws locator-undeclared before this line (the load cannot
  // proceed); the manifest-only path would otherwise never judge the
  // qualifier plane.
  issues.push(...checkWorkspaceLocators(dir, standard.packageManifest));

  // Manifest-only stopgap: without a locator the composition rules cannot
  // run, but the declared imports can still be verified against the
  // manifests of the SIBLING package directories — a dangling uses id or
  // an unsatisfiable requires token is caught in CI without composing
  // content (TODO.roadmap/05, until task 13 retires textual includes).
  if (!options.resolvePackage) {
    const m = standard.packageManifest;
    if (m && (effectiveUses(m).length > 0 || (m.requires ?? []).length > 0)) {
      issues.push(...checkManifestResolution(dir));
    }
  }

  // ── C77–C80 + C113: edition lifecycle (TODO.roadmap/28, doctrine §13.4/§13.7;
  // v3.2 clause 9.3.1) ──
  // Versioning relations live on the package manifest, never in subject
  // models: status/register coherence (C77), validity windows (C78),
  // supersedes/replaces/superseded_by resolution + acyclicity across
  // sibling manifests (C79) and the forward-edge coherence (C113), and the
  // INV-8 pin — every instance's definition_versions
  // resolves against the package's edition register (C80).
  issues.push(...checkEditionLifecycle(dir, standard, compositionProviders));

  // ── C89: ISO 24229 spelling codes (TODO.roadmap/25, doctrine ch. 10) ──
  issues.push(...checkSpellingCodes(standard));

  // ── C103: declared-predicate (docs/primmel/18 §18.6) ───────────────
  issues.push(...checkDeclaredPredicates(standard));

  // ── C110: term-alias-shape (MN 114 v3.2, clause 13.10.1) ───────────
  issues.push(...checkTermAliases(standard));

  // ── C111: dimension-shape (MN 114 v3.2, clause 10.6) ───────────────
  issues.push(...checkDimensions(standard));

  // ── C116/C117: the verdict chain (MN 114 v3.2, clause 11.3) ────────
  issues.push(...checkVerdictChains(standard));

  // ── C158–C162 + C164 + C167: the LML-aligned substrate (the spec's
  // validation contract, language-v3 §16) ─────────────────────────────
  issues.push(...checkLmlAligned(standard));

  // ── C149: the closed-derivation rule (the typed kernel, R3) ────────
  issues.push(...checkClosedDerivations(standard));

  // ── C150/C151: the attestation's references and claim lineage ──────
  issues.push(...checkAttestations(standard));

  // ── C183: the record form's applied-input slice (spec §10, spec#57) ─
  issues.push(...checkRecordRunInputs(standard));

  // ── C184: the form field's scalar numeric range (kernel#90) ─────────
  issues.push(...checkFieldRange(standard));

  // ── C185: the UnitsDB binding coherence (kernel#87) ─────────────────
  issues.push(...checkUnitsDbBindings(standard, options.unitsDb));

  // ── C152: the typed payload rule (the typed kernel, R2) ────────────
  issues.push(...checkTypedPayloads(standard));

  // ── C153: the contract-derivation facet (the typed kernel, clause 10)
  issues.push(...checkArtifactContracts(standard));

  const reqIds = new Set(
    (standard.requirements ?? []).map((r: Requirement) => r.id),
  );
  const testIds = new Set(
    (standard.conformanceTests ?? []).map((t: ConformanceTest) => t.id),
  );
  const attrIds = new Set(
    (standard.attributeDefinitions ?? []).map((a: AttributeDefinition) => a.id),
  );
  const roleIds = new Set((standard.roles ?? []).map(r => r.id));
  const behaviorIds = new Set(
    (standard.behaviors ?? []).map((b: Behavior) => b.id),
  );
  const subjectIds = new Set((standard.subjects ?? []).map(s => s.id));
  // Observables live in the symbols registry, not the attribute layer —
  // binds_to / limit.uses may reference them (e.g. sample.test_context
  // quantities that are measured test outputs).
  const symbolIds = new Set((standard.symbols ?? []).map((s: Symbol) => s.id));
  const processIds = new Set(
    (standard.processes ?? []).map((p: Process) => p.id),
  );
  // The applicability dimension namespace (MN 114 v3.2, clause 11.1.1):
  // the union of the instruments' classification dimensions, the
  // attribute definitions declared is_dimension true (the bound enum or
  // the inline enum_values supply the domain), and the top-level
  // `dimension` declarations (clause 10.6; `values_of capabilities`
  // resolves its domain from the merged capability register). A null
  // domain means the axis is declared but its value set is open here
  // (an undocumented values_of register — C111 warns there).
  const dimIds = new Map<string, Set<string> | null>();
  const dimCardinality = new Map<string, string>();
  // Attribute-mirror dimensions carry no cardinality facet — the
  // match-mode warning (C3) only fires on a KNOWN single cardinality.
  const dimCardinalityOpen = new Set<string>();
  for (const inst of standard.instruments ?? []) {
    for (const d of inst.dimensions ?? []) {
      dimIds.set(d.id, new Set(d.values.map(v => v.id)));
      if (d.cardinality) {
        dimCardinality.set(d.id, d.cardinality);
      }
    }
  }
  for (const a of standard.attributeDefinitions ?? []) {
    if (a.isDimension !== true || dimIds.has(a.id)) {
      continue;
    }
    const enumDef = (standard.enums ?? []).find(e => e.id === a.enumRef);
    const domain = enumDef
      ? new Set(enumDef.values.map(v => v.id))
      : a.enumValues && a.enumValues.length > 0
        ? new Set(a.enumValues)
        : null;
    dimIds.set(a.id, domain);
    dimCardinalityOpen.add(a.id);
  }
  for (const d of standard.dimensions ?? []) {
    if (dimIds.has(d.id)) {
      continue; // the duplicate declaration is C111's finding
    }
    if (d.valuesOf) {
      dimIds.set(
        d.id,
        d.valuesOf === 'capabilities'
          ? new Set((standard.capabilities ?? []).map(c => c.id))
          : null,
      );
    } else {
      dimIds.set(d.id, new Set(d.values.map(v => v.id)));
    }
    if (d.cardinality) {
      dimCardinality.set(d.id, d.cardinality);
    }
  }

  // The observable bind registry (the C1 walk runs before the
  // expression registry is built): the symbols (C53's observable leg
  // resolves against the full registry — kind is not filtered) and the
  // measurement plane, full ids and leaf segments.
  const observableBindIds = new Set<string>(
    [
      ...(standard.symbols ?? []).flatMap(s => [
        s.id,
        s.id.split('/').pop() ?? '',
      ]),
      ...(standard.variables ?? []).flatMap(v => [
        v.id,
        v.id.split('/').pop() ?? '',
      ]),
    ].filter(x => x !== ''),
  );

  // C1 — bind path scope vs attribute scope
  for (const form of standard.forms ?? []) {
    const checkField = (f: FormField) => {
      if (f.bind) {
        const parts = String(f.bind).split('.');
        const prefix = parts.slice(0, 2).join('.');
        const id = parts[2];
        const scope = BIND_SCOPES[prefix];
        if (isIdentityPath(String(f.bind))) {
          // identity binds are always valid
        } else if (String(f.bind).startsWith('observable:')) {
          // the CRITIQUE-2 #4 loop's form leg: a bind observable:<id>
          // resolves like the limits' observable args do — the
          // kind-observable symbols and the measurement plane. A typo
          // on the form side can no longer agree with a typo on the
          // limit side by both being unchecked.
          const id = String(f.bind).slice('observable:'.length);
          if (!observableBindIds.has(id)) {
            err(
              'C1',
              `form ${form.id}: bind "${f.bind}" — which no declared observable names (attribute-bind-scope)`,
            );
          }
        } else if (scope) {
          if (!attrIds.has(id)) {
            err(
              'C1',
              `form ${form.id}: bind "${f.bind}" — attribute "${id}" not defined`,
            );
          } else {
            const a = attrId(standard, id);
            if (a && a.scope && a.scope !== scope) {
              err(
                'C1',
                `form ${form.id}: bind "${f.bind}" — attribute scope "${a.scope}" ≠ path scope "${scope}"`,
              );
            }
          }
        }
      }
      (f.fields ?? []).forEach(checkField);
    };
    (form.fields ?? []).forEach(checkField);
  }

  // C2 — reference targets resolve (a requirement class is a legitimate
  // verification target: a test may verify a whole regime)
  const classIds = new Set(
    (standard.requirementClasses ?? []).map(rc => rc.id),
  );
  for (const t of standard.conformanceTests ?? []) {
    for (const target of t.targets ?? []) {
      if (!reqIds.has(target) && !classIds.has(target)) {
        err(
          'C2',
          `conformance test ${t.id}: target "${target}" is not a declared requirement`,
        );
      }
    }
    if (t.inheritsFrom && !testIds.has(t.inheritsFrom)) {
      err(
        'C2',
        `conformance test ${t.id}: inherits_from "${t.inheritsFrom}" not found`,
      );
    }
  }
  for (const form of standard.forms ?? []) {
    for (const pid of form.conformanceProcessIds ??
      (form.conformanceProcessId ? [form.conformanceProcessId] : [])) {
      if (!testIds.has(pid)) {
        err('C2', `form ${form.id}: conformance_process "${pid}" not found`);
      }
    }
  }
  for (const c of standard.capabilities ?? []) {
    for (const r of c.satisfiesRequirements ?? []) {
      if (!reqIds.has(r)) {
        err(
          'C2',
          `capability ${c.id}: satisfies_requirements "${r}" not found`,
        );
      }
    }
    for (const t of c.verifiedByTests ?? []) {
      if (!testIds.has(t)) {
        err('C2', `capability ${c.id}: verified_by_tests "${t}" not found`);
      }
    }
  }
  for (const b of standard.behaviors ?? []) {
    for (const t of b.verifiedBy ?? []) {
      if (!testIds.has(t)) {
        err('C2', `behavior ${b.id}: verified_by "${t}" not found`);
      }
    }
    // The realization link, made explicit (TODO.lang-spec/13): the
    // declared process ids resolve (C2), and a process whose id names
    // the behavior MUST be declared here — the id-matching convention
    // became a check (C186).
    for (const pid of b.realizedBy ?? []) {
      if (!processIds.has(pid)) {
        err(
          'C186',
          `behavior ${b.id}: realized_by "${pid}" is not a declared process (behavior-realized-by-declared)`,
        );
      }
    }
  }
  for (const p of standard.processes ?? []) {
    const b = (standard.behaviors ?? []).find(x => x.id === p.id);
    if (b && !(b.realizedBy ?? []).includes(p.id)) {
      err(
        'C186',
        `process ${p.id}: the id names declared behavior ${b.id} — the realization must be declared explicitly (behavior ${b.id}: realized_by { ${p.id} … }) (behavior-realized-by-declared)`,
      );
    }
  }
  // A verdict's behavior link (TODO.roadmap/10) resolves to a declared
  // behavior — the transport form of C49 characteristic-behavior-link.
  for (const v of standard.verdicts ?? []) {
    if (v.behavior && !behaviorIds.has(v.behavior)) {
      err(
        'C2',
        `verdict ${v.id}: behavior "${v.behavior}" is not a declared behavior`,
      );
    }
  }
  for (const r of standard.requirements ?? []) {
    for (const p of r.bindsTo ?? []) {
      const parts = String(p).split('.');
      const id = parts[2];
      if (!id) {
        continue;
      }
      if (parts[1] === 'classification') {
        // classification paths reference DIMENSION ids (with enum-name aliases)
        const dim = DIM_ALIASES[id] ?? id;
        if (!dimIds.has(dim) && !attrIds.has(id) && !attrIds.has(dim)) {
          err(
            'C2',
            `requirement ${r.id}: binds_to "${p}" — dimension "${id}" not declared`,
          );
        }
        continue;
      }
      if (parts[1] === 'behaviors') {
        // behavior paths reference the behaviors registry (documentary binds)
        if (!behaviorIds.has(id)) {
          err(
            'C2',
            `requirement ${r.id}: binds_to "${p}" — behavior "${id}" not declared`,
          );
        }
        continue;
      }
      if (isIdentityPath(String(p))) {
        continue;
      }
      if (!attrIds.has(id) && !symbolIds.has(id)) {
        err(
          'C2',
          `requirement ${r.id}: binds_to "${p}" — attribute "${id}" not defined`,
        );
      }
    }
    // NOTE: limit.uses resolution is the coverage family's anchoring leg
    // — C53 (coverage-uses-bound), below. C2 keeps the binds_to paths.
  }

  // C3 — dimension ids + values exist
  // test_subject reserves two non-dimension annotation keys (cc.yaml keeps
  // the block open via additionalProperties): `component` names the
  // instrument component under test (e.g. R 91's ego speed meter),
  // `description` annotates the subject block. Neither is a dimension.
  const TEST_SUBJECT_RESERVED = new Set(['component', 'description']);
  for (const t of standard.conformanceTests ?? []) {
    for (const [dim, value] of Object.entries(t.testSubject ?? {})) {
      if (TEST_SUBJECT_RESERVED.has(dim)) {
        continue;
      }
      if (!dimIds.has(dim)) {
        err(
          'C3',
          `conformance test ${t.id}: test_subject dimension "${dim}" not declared`,
        );
      } else if (
        dimIds.get(dim) !== null &&
        !dimIds.get(dim)!.has(String(value))
      ) {
        err(
          'C3',
          `conformance test ${t.id}: test_subject ${dim}="${value}" not in the dimension's values`,
        );
      }
    }
  }
  for (const rc of standard.requirementClasses ?? []) {
    void rc;
  }
  for (const r of standard.requirements ?? []) {
    for (const a of r.applicability ?? []) {
      if (!dimIds.has(a.dimension)) {
        err(
          'C3',
          `requirement ${r.id}: applicability dimension "${a.dimension}" not declared`,
        );
      } else {
        const domain = dimIds.get(a.dimension) ?? null;
        for (const v of a.values ?? []) {
          if (domain !== null && !domain.has(v)) {
            err(
              'C3',
              `requirement ${r.id}: applicability ${a.dimension}="${v}" not in the dimension's values`,
            );
          }
        }
        // The parameter-mapping form ({ A: 5, C: 3 }): the map's keys
        // are listed values of the dimension (clause 11.1.1).
        for (const k of Object.keys(a.mapping ?? {})) {
          if (domain !== null && !domain.has(k)) {
            err(
              'C3',
              `requirement ${r.id}: applicability ${a.dimension} mapping key "${k}" not in the dimension's values`,
            );
          }
        }
        // Universal/exact matching is the set-dimension semantics — on a
        // single-cardinality dimension the selection holds at most one
        // value, so `match all` and `match exact` both reduce to plain
        // membership (equivalent to the default any). Flag the redundant
        // mode so the data author either sets the dimension's cardinality
        // or drops the mode. An attribute-mirror dimension carries no
        // cardinality facet: the warning only fires on a KNOWN single
        // cardinality (clause 11.1.1).
        if (
          (a.match === 'all' || a.match === 'exact') &&
          dimCardinality.get(a.dimension) !== 'set' &&
          !dimCardinalityOpen.has(a.dimension)
        ) {
          warn(
            'C3',
            `requirement ${r.id}: applicability ${a.dimension} match ${a.match} on a single-cardinality dimension — only meaningful on set dimensions ('all' reduces to 'any'; a multi-value 'exact' is unsatisfiable on one value)`,
          );
        }
      }
    }
  }

  // C4 — store names unique
  const stores = new Map<string, string>();
  for (const c of standard.dataclasses ?? []) {
    if (c.store) {
      if (stores.has(c.store)) {
        err(
          'C4',
          `store "${c.store}" declared by both ${stores.get(c.store)} and ${c.id}`,
        );
      }
      stores.set(c.store, c.id);
    }
  }

  // C5 — coverage: req ⇄ test linkage (refined, TODO.roadmap/17). A
  // requirement is COVERED — no finding — when any of:
  //   (a) a conformance test targets it (the base law);
  //   (b) a process validate_provision's it (the OIML-CS `/req/cs/*`
  //       provisions are verified BY THE PROCESS, never by a conformance
  //       test — the abstract-process doctrine of the smart linker's
  //       R19);
  //   (c) it declares a non-test verification method (definitional /
  //       examination / inspection / documentation / computational /
  //       deferred) — a deliberate exclusion is a legitimate answer,
  //       recorded, not a gap (concept doc §11.5).
  // An undeclared gap is always a finding (§11.9): a requirement with no
  // targeting test AND no recorded non-test verification warns. The
  // reverse leg is unchanged: a test targeting nothing warns.
  const covered = new Set<string>();
  const classMembers = new Map<string, string[]>();
  for (const rc of standard.requirementClasses ?? []) {
    classMembers.set(rc.id, rc.members ?? []);
  }
  const coverWithMembers = (id: string): void => {
    covered.add(id);
    for (const m of classMembers.get(id) ?? []) {
      covered.add(m);
    }
  };
  for (const t of standard.conformanceTests ?? []) {
    for (const target of t.targets ?? []) {
      coverWithMembers(target);
    }
  }
  const provisioned = new Set<string>();
  for (const p of standard.processes ?? []) {
    for (const id of p.provisionRefs ?? []) {
      provisioned.add(id);
    }
  }
  const NON_TEST_VERIFICATION = new Set([
    'definitional',
    'examination',
    'inspection',
    'documentation',
    'computational',
    'deferred',
    // The smart schema's verification-method enum (data/schemas/rc.yaml)
    // additionally allows 'implicit' — reconcile the two vocabularies so
    // an implicit-verified requirement is a recorded exclusion, never a
    // false-positive C5 (unused today).
    'implicit',
  ]);
  for (const r of standard.requirements ?? []) {
    if (covered.has(r.id) || provisioned.has(r.id)) {
      continue;
    }
    if (NON_TEST_VERIFICATION.has(r.verificationMethod)) {
      continue; // deliberate exclusion — recorded, not a gap
    }
    warn(
      'C5',
      `requirement ${r.id}: no conformance test targets it and it declares no non-test verification — an undeclared coverage gap is always a finding (req-test-coverage)`,
    );
  }
  for (const t of standard.conformanceTests ?? []) {
    if ((t.targets ?? []).length === 0) {
      warn('C5', `conformance test ${t.id}: targets no requirement`);
    }
  }

  // ── C171 + C177 + the run plane: the expressions family
  // (check-families/expressions) ──────────────────────────────────────
  runExpressionsFamily({
    standard,
    attrIds,
    dimIds,
    err,
    warn,
    resolvePackage: options.resolvePackage,
  });

  // ── C176 language-declared-wellformed + C178 legacy-carrier-deprecated:
  // the generation declaration and the legacy-carrier ratchet
  // (check-families/generation-ratchet) ─────────────────────────────
  runGenerationRatchetFamily({ dir, standard, err, warn });

  // ── C179: uncertainty-budget-resolves (check-families/uncertainty-budget) ──
  runUncertaintyBudgetFamily({ standard, err, warn });

  // ── C170 + C168 + C6–C9: the subject-anatomy plane
  // (check-families/subject-anatomy) ─────────────────────────────────
  runSubjectAnatomyFamily({
    dir,
    standard,
    behaviorIds,
    subjectIds,
    err,
    warn,
    resolvePackage: options.resolvePackage,
  });

  // ── C42–C50: the claim plane (check-families/claim-plane) ──
  runClaimPlaneFamily({
    standard,
    attrIds,
    behaviorIds,
    symbolIds,
    reqIds,
    testIds,
    dimIds,
    err,
    warn,
  });

  // ── C58/C190/C120/C59/C121/C84: the registers family
  // (check-families/registers) ───────────────────────────────────────
  runRegistersFamily({ standard, err });

  // ── The serve aspect vocabulary (TODO.roadmap/32/34) — shared by the
  // twin checks (C60) and the monitor checks (C66): ONE resolver, derived
  // from the subject's declared aspects.
  const TWIN_CHAIN_LEVELS = new Set(['family', 'group', 'model', 'sample']);

  interface ResolvedAspect {
    kind:
      | 'attribute'
      | 'characteristic'
      | 'dimension'
      | 'state'
      | 'environmental_context';
    /** The unit-bearing aspect (attribute/characteristic legs), when any. */
    unit?: string;
    quantityKind?: string;
  }

  // The `state` aspect resolves through the subject's bound machine
  // (has.state) OR through the package's operational machines: a
  // twin-interface subject block (the smart side's model/twin.yaml
  // emission, TODO.refactor/16) is PARTIAL anatomy — it carries the
  // endpoint/serve declarations without re-stating the state binding,
  // and the state channel binds at runtime (task 33).
  const packageHasOperationalMachine = (standard.stateMachines ?? []).some(
    sm => sm.kind === 'operational',
  );

  /**
   * Resolve a serve aspect path against the owning subject — the task-03
   * scope vocabulary: an optional chain-level prefix (family | group |
   * model | sample), then parameters.<attr> | test_context.<attr> |
   * classification.<dim> | characteristics.<name>, or a bare
   * attribute/characteristic/dimension name; the reserved HAS aspects
   * `state` (the subject's declared state machine) and
   * `environmental_context` (the logged actual conditions — always
   * servable, §14.3) close the vocabulary.
   */
  const resolveServeAspect = (
    path: string,
    s: Subject,
  ): ResolvedAspect | null => {
    let rest = path;
    const parts = path.split('.');
    if (parts.length > 1 && TWIN_CHAIN_LEVELS.has(parts[0])) {
      rest = parts.slice(1).join('.');
    }
    if (rest === 'state') {
      return s.has.state || packageHasOperationalMachine
        ? { kind: 'state' }
        : null;
    }
    if (rest === 'environmental_context') {
      return { kind: 'environmental_context' };
    }
    const segs = rest.split('.');
    if (segs.length === 2) {
      const [area, key] = segs;
      if (area === 'parameters' || area === 'test_context') {
        const a = attrId(standard, key);
        return a
          ? { kind: 'attribute', unit: a.unit, quantityKind: a.quantityKind }
          : null;
      }
      if (area === 'classification') {
        return dimIds.has(key) || key in (s.has.dimensions ?? {})
          ? { kind: 'dimension' }
          : null;
      }
      if (area === 'characteristics') {
        const c = (s.has.characteristics ?? {})[key];
        return c
          ? {
              kind: 'characteristic',
              unit: c.unit,
              quantityKind: c.quantityKind,
            }
          : null;
      }
      return null;
    }
    if (segs.length === 1 && rest) {
      const a = attrId(standard, rest);
      if (a) {
        return {
          kind: 'attribute',
          unit: a.unit,
          quantityKind: a.quantityKind,
        };
      }
      const c = (s.has.characteristics ?? {})[rest];
      if (c) {
        return {
          kind: 'characteristic',
          unit: c.unit,
          quantityKind: c.quantityKind,
        };
      }
      if (dimIds.has(rest) || rest in (s.has.dimensions ?? {})) {
        return { kind: 'dimension' };
      }
    }
    return null;
  };

  // ── C60–C64: the twin interface (TODO.roadmap/32 — doctrine ch. 14 §14.4) ──
  // The live twin's integration language: endpoint declarations (IS) and
  // serve bindings (HAS) on the subject anatomy, plus the connector-profile
  // registry. The doctrine's validation rules (§14.12, first/second/fifth
  // bullets): every serve names a declared aspect and a declared operation
  // with unit coherence; every endpoint operation has an access scope and a
  // payload schema (QuantityValue with timestamp); a live binding without
  // fresh_within is an error. Freshness SEMANTICS (stale ⇒ indeterminate)
  // are runtime — the smart app's verdict service owns them; these rules
  // guarantee the declarations the runtime needs.
  {
    const KNOWN_KINDS = new Set<string>(ENDPOINT_OPERATION_KINDS);
    const KNOWN_SCOPES = new Set<string>(ENDPOINT_ACCESS_SCOPES);
    const declaredProfiles = new Set([
      ...Object.keys(BUILTIN_CONNECTOR_PROFILES),
      ...(standard.connectorProfiles ?? []).map(p => p.id),
    ]);

    for (const s of standard.subjects ?? []) {
      const endpoints = s.is.endpoints ?? [];
      // Operation index across the subject's endpoints (name → owners):
      // serve bindings resolve against the subject's whole API surface.
      const operations = new Map<
        string,
        {
          endpoint: string;
          kind: string;
          payloadUnit?: string;
          payloadKind?: string;
        }[]
      >();
      for (const e of endpoints) {
        for (const op of e.operations ?? []) {
          const list = operations.get(op.name) ?? [];
          list.push({
            endpoint: e.id,
            kind: op.kind,
            ...(op.payload?.unit ? { payloadUnit: op.payload.unit } : {}),
            ...(op.payload?.quantityKind
              ? { payloadKind: op.payload.quantityKind }
              : {}),
          });
          operations.set(op.name, list);
        }

        // C64 — endpoint-profile-resolves: the model is protocol-neutral;
        // profiles bind protocols (§14.4). An endpoint with no profile, or
        // one outside the registry (declared ∪ built-in), binds nothing.
        if (!e.profile) {
          err(
            'C64',
            `subject ${s.id}: endpoint ${e.id} declares no connector profile — the model is protocol-neutral; profiles bind protocols (endpoint-profile-resolves)`,
          );
        } else if (!declaredProfiles.has(e.profile)) {
          err(
            'C64',
            `subject ${s.id}: endpoint ${e.id} profile "${e.profile}" is not a declared connector_profile nor a built-in (${Object.keys(BUILTIN_CONNECTOR_PROFILES).join(', ')}) (endpoint-profile-resolves)`,
          );
        }

        for (const op of e.operations ?? []) {
          // C61 — payload-schema-quantity: the operation's declared schema
          // is well-formed (§14.4/§14.12): a known kind, and a payload that
          // is a QuantityValue per INV-1 — quantity kind, unit (`1` when
          // dimensionless), timestamp (a value without a time is not
          // evidence).
          if (!KNOWN_KINDS.has(op.kind)) {
            err(
              'C61',
              `subject ${s.id}: endpoint ${e.id} operation ${op.name} kind "${op.kind || '(none)'}" is not one of query | subscribe | invoke (payload-schema-quantity)`,
            );
          }
          if (!op.payload) {
            err(
              'C61',
              `subject ${s.id}: endpoint ${e.id} operation ${op.name} declares no payload schema — every endpoint operation has a payload schema (QuantityValue with timestamp, §14.12) (payload-schema-quantity)`,
            );
          } else {
            if (!op.payload.quantityKind) {
              err(
                'C61',
                `subject ${s.id}: endpoint ${e.id} operation ${op.name} payload names no quantity_kind — INV-1: no bare numbers (payload-schema-quantity)`,
              );
            }
            if (!op.payload.unit) {
              err(
                'C61',
                `subject ${s.id}: endpoint ${e.id} operation ${op.name} payload names no unit — a QuantityValue always carries a unit (the register's dimensionless id when non-quantity) (payload-schema-quantity)`,
              );
            }
            if (!op.payload.timestamp) {
              err(
                'C61',
                `subject ${s.id}: endpoint ${e.id} operation ${op.name} payload does not declare timestamp true — a value without a time is not evidence (§14.3) (payload-schema-quantity)`,
              );
            }
          }
          // C60 (endpoint legs) — the operation's own targets resolve:
          // serves names against the subject's aspects, does names against
          // declared behaviors (an invoke with no resolvable process
          // triggers nothing).
          for (const name of op.serves ?? []) {
            if (!resolveServeAspect(name, s)) {
              err(
                'C60',
                `subject ${s.id}: endpoint ${e.id} operation ${op.name} serves "${name}", which is not a declared aspect of the subject (serve-targets-resolve)`,
              );
            }
          }
          for (const name of op.does ?? []) {
            if (!behaviorIds.has(name)) {
              err(
                'C60',
                `subject ${s.id}: endpoint ${e.id} operation ${op.name} does "${name}", which is not a declared behavior (serve-targets-resolve)`,
              );
            }
          }
        }

        // C62 — access-scope-covers-serves: every operation is covered by
        // exactly one access scope (§14.12: every endpoint operation has an
        // access scope); access entries name declared operations of the
        // endpoint; scopes are public | registered | authority.
        const coverage = new Map<string, number>();
        for (const [scope, ops] of Object.entries(e.access ?? {})) {
          if (!KNOWN_SCOPES.has(scope)) {
            err(
              'C62',
              `subject ${s.id}: endpoint ${e.id} access scope "${scope}" is not one of public | registered | authority (access-scope-covers-serves)`,
            );
          }
          for (const name of ops ?? []) {
            if (!e.operations.some(op => op.name === name)) {
              err(
                'C62',
                `subject ${s.id}: endpoint ${e.id} access ${scope} names "${name}", which is not a declared operation of the endpoint (access-scope-covers-serves)`,
              );
            }
            coverage.set(name, (coverage.get(name) ?? 0) + 1);
          }
        }
        for (const op of e.operations ?? []) {
          const n = coverage.get(op.name) ?? 0;
          if (n === 0) {
            err(
              'C62',
              `subject ${s.id}: endpoint ${e.id} operation ${op.name} has no access scope — every endpoint operation has an access scope (§14.12) (access-scope-covers-serves)`,
            );
          } else if (n > 1) {
            err(
              'C62',
              `subject ${s.id}: endpoint ${e.id} operation ${op.name} is covered by ${n} access scopes — exactly one scope per operation (access-scope-covers-serves)`,
            );
          }
        }
      }

      for (const b of s.has.serves ?? []) {
        // C60 — serve-targets-resolve: the binding names a declared aspect
        // and a declared operation (§14.12); the serving operation is a
        // value channel (query | subscribe — an invoke triggers a process,
        // it serves no value); the served aspect and the operation's
        // payload are unit-coherent.
        const aspect = resolveServeAspect(b.aspect, s);
        if (!aspect) {
          err(
            'C60',
            `subject ${s.id}: serve "${b.aspect}" does not resolve to a declared aspect of the subject ([level.]{parameters|classification|test_context}.<key>, a bare attribute/characteristic/dimension name, state, environmental_context) (serve-targets-resolve)`,
          );
        }
        const owners = operations.get(b.via) ?? [];
        if (owners.length === 0) {
          err(
            'C60',
            `subject ${s.id}: serve "${b.aspect}" via "${b.via}" names no declared operation of the subject's endpoints (serve-targets-resolve)`,
          );
        } else if (owners.length > 1) {
          err(
            'C60',
            `subject ${s.id}: serve "${b.aspect}" via "${b.via}" is ambiguous — the operation is declared on ${owners.length} endpoints (${owners.map(o => o.endpoint).join(', ')}) (serve-targets-resolve)`,
          );
        } else {
          const op = owners[0];
          if (op.kind === 'invoke') {
            err(
              'C60',
              `subject ${s.id}: serve "${b.aspect}" via "${b.via}" targets an invoke operation — invoke triggers a process; a serve binding binds a value channel (query | subscribe) (serve-targets-resolve)`,
            );
          }
          if (
            aspect &&
            op.payloadUnit &&
            aspect.unit &&
            op.payloadUnit !== aspect.unit
          ) {
            err(
              'C60',
              `subject ${s.id}: serve "${b.aspect}" unit "${aspect.unit}" ≠ operation ${b.via} payload unit "${op.payloadUnit}" — unit coherence between aspect and payload is required (§14.12) (serve-targets-resolve)`,
            );
          }
          if (
            aspect &&
            op.payloadKind &&
            aspect.quantityKind &&
            op.payloadKind !== aspect.quantityKind
          ) {
            err(
              'C60',
              `subject ${s.id}: serve "${b.aspect}" quantity kind "${aspect.quantityKind}" ≠ operation ${b.via} payload quantity kind "${op.payloadKind}" (serve-targets-resolve)`,
            );
          }
        }
        // C63 — freshness-required-on-live-bindings: a live binding without
        // fresh_within is an error (§14.12 — no stale semantics, no live
        // binding); the window must parse (shorthand 5s/1min/1h or ISO
        // 8601 with fixed-length components).
        if (!b.freshWithin) {
          err(
            'C63',
            `subject ${s.id}: serve "${b.aspect}" via "${b.via}" declares no fresh_within — a live binding without a freshness window is an error (§14.12: no stale semantics, no live binding) (freshness-required-on-live-bindings)`,
          );
        } else if (parseFreshnessWindow(b.freshWithin) === null) {
          err(
            'C63',
            `subject ${s.id}: serve "${b.aspect}" fresh_within "${b.freshWithin}" is not a parseable freshness window (shorthand 500ms/5s/1min/1h/1d or ISO 8601 with fixed-length components, e.g. PT5S) (freshness-required-on-live-bindings)`,
          );
        }
      }

      // C100–C102 — the composition facet (TODO.integration/14): a
      // composite subject's composed_of checks on all three legs.
      const composed = s.is.composedOf;
      if (composed) {
        const componentIds = new Set(composed.components.map(c => c.id));
        for (const c of composed.components) {
          // C100 — composition-components-resolve: an inline
          // `pkg/subject` product reference names a subject of THIS
          // package (a bare package id resolves cross-package at the
          // supply-chain gate — the C81 discipline, registered here).
          if (c.product.includes('/')) {
            const sub = c.product
              .slice(c.product.indexOf('/') + 1)
              .split('@')[0]!;
            // The reference is kebab-form, the subject id PascalCase —
            // resolve alphanumerically (sample-line ≡ SampleLine); the
            // @edition pin is the C83 discipline, stripped here.
            const norm = (x: string) =>
              x.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            if (
              !(standard.subjects ?? []).some(x => norm(x.id) === norm(sub))
            ) {
              err(
                'C100',
                `subject ${s.id}: composed_of component ${c.id} product "${c.product}" names no subject of this package (composition-components-resolve)`,
              );
            }
          }
          if (!c.endpoint) {
            err(
              'C100',
              `subject ${s.id}: composed_of component ${c.id} declares no endpoint — the component's projection must serve on a named endpoint (composition-components-resolve)`,
            );
          }
        }
        // C101 — composition-decomposition-covers: every serve of the
        // composite subject is covered by the decomposition exactly once.
        const covered = new Map<string, number>();
        for (const d of composed.decomposition) {
          covered.set(d.register, (covered.get(d.register) ?? 0) + 1);
          if (d.component !== 'composite' && !componentIds.has(d.component)) {
            err(
              'C100',
              `subject ${s.id}: decomposition ${d.register} names undeclared component "${d.component}" (composition-components-resolve)`,
            );
          }
          // C102 — composition-state-rule-closed: the vocabulary is
          // closed (any_fault_else_analyzer first — a new rule is a
          // grammar extension, never a free string).
          if (
            d.component === 'composite' &&
            !(COMPOSITION_STATE_RULES as readonly string[]).includes(
              d.rule ?? '',
            )
          ) {
            err(
              'C102',
              `subject ${s.id}: decomposition ${d.register} declares unknown composite state rule "${d.rule ?? '(none)'}" — the vocabulary is closed (${COMPOSITION_STATE_RULES.join(', ')}) (composition-state-rule-closed)`,
            );
          }
        }
        for (const serve of s.has.serves ?? []) {
          if ((covered.get(serve.aspect) ?? 0) !== 1) {
            err(
              'C101',
              `subject ${s.id}: serve "${serve.aspect}" is covered ${covered.get(serve.aspect) ?? 0} times by the decomposition — every served register decomposes exactly once (composition-decomposition-covers)`,
            );
          }
        }
      }
    }
  }

  // ── C65–C70: the monitors (TODO.roadmap/34 — doctrine ch. 14 §14.5/§14.12) ──
  // Continuous compliance: a monitor runs the standard next to the live
  // twins — triggers (the clock), evaluation refs (applicability-expanded
  // per twin at runtime), evidence sinks, escalation. The doctrine's
  // validation rules (§14.12, third/fourth bullets): every monitor's
  // evaluate refs resolve to requirements/promises applicable to the
  // monitored subjects; a monitor without an escalation path for `fail`
  // is a warning. Freshness semantics, the verdict stream, and the
  // escalation ACTIONS are runtime — the smart app's monitor service owns
  // them; these rules guarantee the declarations the runtime needs.
  {
    const KNOWN_OUTCOMES = new Set<string>(MONITOR_OUTCOMES);
    const KNOWN_ACTIONS = new Set<string>(MONITOR_ESCALATION_ACTIONS);
    const KNOWN_STREAMS = new Set<string>(MONITOR_STREAMS);
    const KNOWN_REFSET_KINDS = new Set<string>(MONITOR_REFSET_KINDS);

    for (const m of standard.monitors ?? []) {
      const subjects = (standard.subjects ?? []).filter(s =>
        m.over.includes(s.id),
      );

      // C65 — monitor-subject-resolves: the watched set is non-empty and
      // every ref names a declared subject (a monitor watching nothing
      // judges nothing).
      if (m.over.length === 0) {
        err(
          'C65',
          `monitor ${m.id}: declares no subject set — a monitor watches a subject set (over { … }) (monitor-subject-resolves)`,
        );
      }
      for (const ref of m.over) {
        if (!subjectIds.has(ref)) {
          err(
            'C65',
            `monitor ${m.id}: over "${ref}" is not a declared subject (monitor-subject-resolves)`,
          );
        }
      }

      // C66 — monitor-trigger-wellformed: without triggers "continuous"
      // has no clock (§14.5 step 1) — at least one trigger; a timer's
      // every window parses (the freshness-window syntax); a signal names
      // its signal; a change names an aspect that resolves against a
      // monitored subject (the serve aspect vocabulary — ONE resolver).
      if (m.triggers.length === 0) {
        err(
          'C66',
          `monitor ${m.id}: declares no triggers — without triggers, "continuous" has no clock (§14.5 step 1) (monitor-trigger-wellformed)`,
        );
      }
      for (const trigger of m.triggers) {
        if (trigger.kind === 'timer') {
          if (!trigger.every || parseFreshnessWindow(trigger.every) === null) {
            err(
              'C66',
              `monitor ${m.id}: timer trigger every "${trigger.every || '(none)'}" is not a parseable window (shorthand 500ms/5s/1min/1h/1d or ISO 8601 with fixed-length components, e.g. PT1H) (monitor-trigger-wellformed)`,
            );
          }
        } else if (trigger.kind === 'signal') {
          if (!trigger.signal) {
            err(
              'C66',
              `monitor ${m.id}: signal trigger names no signal (on signal <name>) (monitor-trigger-wellformed)`,
            );
          }
        } else if (trigger.kind === 'change') {
          if (!trigger.aspect) {
            err(
              'C66',
              `monitor ${m.id}: change trigger names no aspect (on change <aspect>) (monitor-trigger-wellformed)`,
            );
          } else if (
            subjects.length > 0 &&
            !subjects.some(s => resolveServeAspect(trigger.aspect, s))
          ) {
            err(
              'C66',
              `monitor ${m.id}: change trigger aspect "${trigger.aspect}" does not resolve against any monitored subject (the serve aspect vocabulary: [level.]{parameters|classification|test_context}.<key>, a bare attribute/characteristic/dimension name, state, environmental_context) (monitor-trigger-wellformed)`,
            );
          }
        } else {
          err(
            'C66',
            `monitor ${m.id}: trigger kind "${trigger.kind || '(none)'}" is not one of timer (every) | signal (on signal) | change (on change) (monitor-trigger-wellformed)`,
          );
        }
      }

      // C67 — monitor-evaluate-resolves (§14.12): the evaluate refs
      // resolve to requirements/promises applicable to the monitored
      // subjects. `all` and `applicable_to(…)` expand per twin at runtime
      // (applicability-expanded — always admissible); explicit refs must
      // resolve: requirement ids against the package's requirements,
      // promise ids against the monitored subjects' promises.
      const checkRefSet = (
        label: string,
        set: Monitor['evaluate']['requirements'],
        resolveRef: (ref: string) => boolean,
        refKind: string,
      ): void => {
        if (!set.kind) {
          err(
            'C67',
            `monitor ${m.id}: evaluate names no ${label} selector (all | applicable_to(…) | { refs… }) — a monitor judges something (monitor-evaluate-resolves)`,
          );
          return;
        }
        if (!KNOWN_REFSET_KINDS.has(set.kind)) {
          err(
            'C67',
            `monitor ${m.id}: ${label} selector "${set.kind}" is not one of all | applicable_to(…) | { refs… } (monitor-evaluate-resolves)`,
          );
          return;
        }
        if (set.kind === 'applicable_to' && !set.expression) {
          err(
            'C67',
            `monitor ${m.id}: ${label} applicable_to() carries no applicability expression (monitor-evaluate-resolves)`,
          );
        }
        if (set.kind === 'refs') {
          if (set.refs.length === 0) {
            err(
              'C67',
              `monitor ${m.id}: ${label} selector { } names no refs (monitor-evaluate-resolves)`,
            );
          }
          for (const ref of set.refs) {
            if (!resolveRef(ref)) {
              err(
                'C67',
                `monitor ${m.id}: evaluate ${label} ref "${ref}" is not a declared ${refKind} — evaluate refs resolve to requirements/promises applicable to the monitored subjects (§14.12) (monitor-evaluate-resolves)`,
              );
            }
          }
        }
      };
      checkRefSet(
        'requirements',
        m.evaluate.requirements,
        r => reqIds.has(r),
        'requirement',
      );
      const promiseIds = new Set(
        subjects
          .flatMap(s => (s.is.promises ?? []).map(p => p.id))
          .filter(id => id !== ''),
      );
      checkRefSet(
        'promises',
        m.evaluate.promises,
        p => promiseIds.has(p),
        'promise of the monitored subjects',
      );

      // C68 — monitor-fail-escalation (§14.12, verbatim): a monitor
      // without an escalation path for `fail` is a WARNING. Pass accrues
      // history; fail/invalid must act (notify, flag the certificate,
      // open a case).
      if (!m.escalate.some(r => r.outcome === 'fail')) {
        warn(
          'C68',
          `monitor ${m.id}: declares no escalation path for fail — §14.12: a monitor without an escalation path for fail is a warning (monitor-fail-escalation)`,
        );
      }

      // C69 — monitor-escalation-resolves: escalation outcomes are
      // verdict outcomes; actions are notify | flag_certificate |
      // open_service_case; a notify names a declared role.
      for (const rule of m.escalate) {
        if (!KNOWN_OUTCOMES.has(rule.outcome)) {
          err(
            'C69',
            `monitor ${m.id}: escalate on "${rule.outcome || '(none)'}" — the outcome is not one of ${MONITOR_OUTCOMES.join(' | ')} (monitor-escalation-resolves)`,
          );
        }
        if (rule.actions.length === 0) {
          err(
            'C69',
            `monitor ${m.id}: escalate on ${rule.outcome || '(none)'} names no actions — an escalation path acts (notify / flag_certificate / open_service_case) (monitor-escalation-resolves)`,
          );
        }
        for (const a of rule.actions) {
          if (!KNOWN_ACTIONS.has(a.action)) {
            err(
              'C69',
              `monitor ${m.id}: escalate on ${rule.outcome} action "${a.action}" is not one of ${MONITOR_ESCALATION_ACTIONS.join(' | ')} (monitor-escalation-resolves)`,
            );
          } else if (a.action === 'notify' && !a.role) {
            err(
              'C69',
              `monitor ${m.id}: escalate on ${rule.outcome} notify names no role (notify <role>) (monitor-escalation-resolves)`,
            );
          } else if (
            a.action === 'notify' &&
            roleIds.size > 0 &&
            !roleIds.has(a.role)
          ) {
            err(
              'C69',
              `monitor ${m.id}: escalate on ${rule.outcome} notify "${a.role}" is not a declared role (monitor-escalation-resolves)`,
            );
          } else if (a.action !== 'notify' && a.role) {
            err(
              'C69',
              `monitor ${m.id}: escalate on ${rule.outcome} ${a.action} carries a role ("${a.role}") — only notify names a role (monitor-escalation-resolves)`,
            );
          }
        }
      }

      // C70 — monitor-emit-sinks (§14.5 step 6): evidence is appended to
      // the workspace and the verdict log — both streams emitted, each
      // exactly once, with a named sink. An unknown stream kind binds
      // nothing.
      const emitted = new Map<string, number>();
      for (const sink of m.emit) {
        if (!KNOWN_STREAMS.has(sink.stream)) {
          err(
            'C70',
            `monitor ${m.id}: emit stream "${sink.stream}" is not one of ${MONITOR_STREAMS.join(' | ')} (monitor-emit-sinks)`,
          );
        }
        if (!sink.target) {
          err(
            'C70',
            `monitor ${m.id}: emit ${sink.stream} names no sink (${sink.stream} -> <sink>) (monitor-emit-sinks)`,
          );
        }
        emitted.set(sink.stream, (emitted.get(sink.stream) ?? 0) + 1);
      }
      for (const stream of MONITOR_STREAMS) {
        const n = emitted.get(stream) ?? 0;
        if (n === 0) {
          err(
            'C70',
            `monitor ${m.id}: emit declares no ${stream} sink — §14.5 step 6: values seen, rule results, verdicts, timestamps are appended to the workspace (monitor-emit-sinks)`,
          );
        } else if (n > 1) {
          err(
            'C70',
            `monitor ${m.id}: emit declares the ${stream} stream ${n} times — one sink per stream (monitor-emit-sinks)`,
          );
        }
      }
    }
  }

  // ── C10–C16: executable process bodies (TODO.roadmap/02) ──
  // These rules apply only to processes with a `does` body (the
  // executable form). Abstract processes (signature/invariants, no
  // `does`) are always valid; v2 canvas processes are untouched.
  for (const p of standard.processes ?? []) {
    const flow = p.does;
    if (!flow) {
      continue;
    }
    const steps = flow.steps ?? [];
    const edges = flow.edges ?? [];

    // C16 — step ids are unique within one does body
    // (process-step-ids-unique). Declared BEFORE the stepById map below
    // silently keeps the last duplicate.
    const seenStepIds = new Set<string>();
    for (const s of steps) {
      if (seenStepIds.has(s.id)) {
        err(
          'C16',
          `process ${p.id}: duplicate step id "${s.id}" in the does body (process-step-ids-unique)`,
        );
      }
      seenStepIds.add(s.id);
    }
    const stepById = new Map(steps.map(s => [s.id, s]));

    // The declared name vocabulary for step I/O and edge conditions:
    // registers + signature IN/OUT parameters + instance-parameter keys +
    // the process's own `state` (a declared HAS).
    const declared = new Set<string>(['state']);
    for (const r of p.registers ?? []) {
      declared.add(r.name);
    }
    for (const prm of p.signature?.inputs ?? []) {
      declared.add(prm.name);
    }
    for (const prm of p.signature?.outputs ?? []) {
      declared.add(prm.name);
    }
    for (const v of Object.values(p.instances?.values ?? {})) {
      for (const k of Object.keys(v)) {
        declared.add(k);
      }
    }

    // C10 — exactly one start event per executable process.
    const starts = steps.filter(s => s.kind === 'start_event');
    if (starts.length !== 1) {
      err(
        'C10',
        `process ${p.id}: executable process has ${starts.length} start events — exactly one required (process-one-start)`,
      );
    }

    // C11 — end events on every terminal path (mandatory on empty
    // gateway branches); flow edges reference declared steps.
    const outgoing = new Map<string, typeof edges>();
    for (const e of edges) {
      if (!stepById.has(e.from)) {
        err(
          'C11',
          `process ${p.id}: flow edge starts at undeclared step "${e.from}" (process-terminal-end)`,
        );
      }
      if (!stepById.has(e.to)) {
        err(
          'C11',
          `process ${p.id}: flow edge ends at undeclared step "${e.to}" (process-terminal-end)`,
        );
      }
      outgoing.set(e.from, [...(outgoing.get(e.from) ?? []), e]);
    }
    for (const s of steps) {
      if ((outgoing.get(s.id) ?? []).length === 0 && s.kind !== 'end_event') {
        err(
          'C11',
          `process ${p.id}: step "${s.id}" (${s.kind}) is a terminal path with no end event — every terminal path must close at an end_event, mandatory on empty gateway branches (process-terminal-end)`,
        );
      }
    }

    // C12 — gateway edge conditions and step I/O name declared registers.
    // The caller-side names of a call's `with` bindings are step I/O too
    // (TODO.roadmap/38): an in-binding READS the caller name, an
    // out-mapping WRITES it. The callee-side parameter names are checked
    // against the callee's signature by C76, not here.
    for (const s of steps) {
      const ioNames = [...s.reads, ...s.writes];
      if (s.wait) {
        ioNames.push(s.wait);
      }
      for (const b of s.callIn) {
        ioNames.push(b.bind);
      }
      for (const b of s.callOut) {
        ioNames.push(b.bind);
      }
      for (const n of ioNames) {
        if (!declared.has(n)) {
          err(
            'C12',
            `process ${p.id}: step "${s.id}" names undeclared register "${n}" (process-flow-names-resolve)`,
          );
        }
      }
      if (s.kind === 'gateway') {
        for (const e of outgoing.get(s.id) ?? []) {
          const re = /\bself\.([A-Za-z_][A-Za-z0-9_]*)/g;
          let m: RegExpExecArray | null;
          while ((m = re.exec(e.condition)) !== null) {
            if (!declared.has(m[1])) {
              err(
                'C12',
                `process ${p.id}: gateway "${s.id}" edge condition references undeclared register "${m[1]}" (process-flow-names-resolve)`,
              );
            }
          }
        }
      }
    }

    // C13 — the executable steps realize the signature: every OUT
    // parameter is written (error), every IN parameter is read (warning).
    // Call bindings count: an in-binding reads the caller name, an
    // out-mapping writes it (TODO.roadmap/38).
    if (p.signature) {
      const written = new Set<string>();
      const read = new Set<string>();
      for (const s of steps) {
        s.writes.forEach(n => written.add(n));
        s.reads.forEach(n => read.add(n));
        if (s.wait) {
          read.add(s.wait);
        }
        s.callOut.forEach(b => written.add(b.bind));
        s.callIn.forEach(b => read.add(b.bind));
      }
      for (const o of p.signature.outputs) {
        if (!written.has(o.name)) {
          err(
            'C13',
            `process ${p.id}: OUT parameter "${o.name}" is never written by any step (process-signature-realized)`,
          );
        }
      }
      for (const inp of p.signature.inputs) {
        if (!read.has(inp.name)) {
          warn(
            'C13',
            `process ${p.id}: IN parameter "${inp.name}" is never read by any step (process-signature-realized)`,
          );
        }
      }
    }

    // C14 — a recurrence (a cycle in the flow graph) must pass through a
    // timer event WITH a declared period: remove guarded timer nodes and
    // require the rest acyclic. A period-less timer_event is NOT a guard
    // (C15) and does not break the cycle here.
    const timerIds = new Set(
      steps.filter(s => s.kind === 'timer_event' && s.period).map(s => s.id),
    );
    const adj = new Map<string, string[]>();
    for (const e of edges) {
      if (timerIds.has(e.from) || timerIds.has(e.to)) {
        continue;
      }
      adj.set(e.from, [...(adj.get(e.from) ?? []), e.to]);
    }
    const cycle = findCycle(adj);
    if (cycle) {
      err(
        'C14',
        `process ${p.id}: recurrence ${cycle.join(' → ')} contains no timer event — an unguarded infinite self-loop (process-timer-recurrence)`,
      );
    }

    // C15 — a timer_event must declare its recurrence `period`: without
    // one it cannot guard a loop (C14) and is almost certainly a
    // modelling mistake (process-timer-period). The period FORMAT is
    // validated by C35 (time-format, TODO.roadmap/06); this rule checks
    // presence only.
    for (const s of steps) {
      if (s.kind === 'timer_event' && !s.period) {
        err(
          'C15',
          `process ${p.id}: timer_event "${s.id}" declares no period — a timer event without a recurrence period cannot guard a loop (process-timer-period)`,
        );
      }
    }
  }

  // ── C17–C20: instantiation and delegation (TODO.roadmap/03) ──
  // The instance plane: scope discipline on stated values (C17), INV-8
  // version pins (C18), subject-chain integrity (C19), and `of` reference
  // resolution (C20).
  const CHAIN_LEVEL_ORDER: Record<string, number> = {
    family: 0,
    group: 1,
    model: 2,
    sample: 3,
  };
  const instrumentIds = new Set((standard.instruments ?? []).map(i => i.id));
  const instanceIds = new Set((standard.instances ?? []).map(i => i.id));
  const dataclassIds = new Set((standard.dataclasses ?? []).map(c => c.id));
  // The BARE-PREFIX link spelling: a class's extends may name a class
  // without its plane segment (Organization for Organization#data —
  // the language's own link spelling; the pre-1.21.0 checker and the
  // platform linker resolve it). C156 resolves both spellings.
  const dataclassBareIds = new Set(
    (standard.dataclasses ?? []).map(c => c.id.split('#')[0]!),
  );
  const attrScopes = new Map(
    (standard.attributeDefinitions ?? []).map(a => [a.id, a.scope]),
  );
  // Classification-dimension scopes, by every spelling a classification
  // map may use: the instrument dimension id, the is_dimension attribute
  // mirror id, and the enum-name aliases (DIM_ALIASES).
  const dimScopes = new Map<string, string>();
  for (const inst of standard.instruments ?? []) {
    for (const d of inst.dimensions ?? []) {
      if (d.scope) {
        dimScopes.set(d.id, d.scope);
      }
    }
  }
  for (const a of standard.attributeDefinitions ?? []) {
    if (a.isDimension && a.scope && !dimScopes.has(a.id)) {
      dimScopes.set(a.id, a.scope);
    }
  }
  for (const [alias, canonical] of Object.entries(DIM_ALIASES)) {
    const s = dimScopes.get(canonical) ?? attrScopes.get(canonical);
    if (s && !dimScopes.has(alias)) {
      dimScopes.set(alias, s);
    }
  }

  for (const inst of standard.instances ?? []) {
    const levelIdx = CHAIN_LEVEL_ORDER[inst.level];

    // C17 — instance-scope: every stated value at its declared scope or
    // lower; sample-scope values only in a sample's test_context.
    // NOTE (sample-level override gap): the language PERMITS a
    // non-sample-scope attribute in a sample's has.attributes (the
    // lower-override law — a sample may restate a wider-scope value), and
    // C17 accepts it. But the current app plane has no sample
    // `parameters` field (only `test_context`), so such a value has no
    // app-side home: recs SHOULD NOT author sample-level attribute
    // overrides until the app plane grows one (tracked by TODO.roadmap
    // task 29). A future strict mode may make this an error.
    if (levelIdx === undefined) {
      err(
        'C17',
        `instance ${inst.id}: level "${inst.level}" is not a chain level (family | group | model | sample) (instance-scope)`,
      );
    }
    for (const key of Object.keys(inst.has?.attributes ?? {})) {
      const scope = attrScopes.get(key);
      if (scope === undefined) {
        err(
          'C17',
          `instance ${inst.id}: attribute "${key}" is not a declared attribute_definition — scope cannot be checked (instance-scope)`,
        );
      } else if (scope === 'sample') {
        err(
          'C17',
          `instance ${inst.id}: sample-scope attribute "${key}" stated in has.attributes — sample-scope values live in has.test_context and are never inherited (instance-scope)`,
        );
      } else if (
        scope &&
        levelIdx !== undefined &&
        CHAIN_LEVEL_ORDER[scope] !== undefined &&
        levelIdx < CHAIN_LEVEL_ORDER[scope]
      ) {
        err(
          'C17',
          `instance ${inst.id}: attribute "${key}" (scope ${scope}) stated at ${inst.level} level — values are stated at their declared scope or lower (instance-scope)`,
        );
      }
    }
    for (const key of Object.keys(inst.has?.testContext ?? {})) {
      if (inst.level !== 'sample') {
        err(
          'C17',
          `instance ${inst.id}: test_context value "${key}" on a ${inst.level}-level instance — test_context exists only at sample level (instance-scope)`,
        );
      }
      const scope = attrScopes.get(key);
      if (scope === undefined) {
        err(
          'C17',
          `instance ${inst.id}: attribute "${key}" is not a declared attribute_definition — scope cannot be checked (instance-scope)`,
        );
      } else if (scope !== 'sample') {
        err(
          'C17',
          `instance ${inst.id}: attribute "${key}" (scope ${scope}) stated in test_context — test_context holds sample-scope attributes only (instance-scope)`,
        );
      }
    }
    for (const key of Object.keys(inst.has?.dimensions ?? {})) {
      if (inst.level === 'sample') {
        err(
          'C17',
          `instance ${inst.id}: classification "${key}" on a sample-level instance — samples carry no classification (instance-scope)`,
        );
      }
      const scope = dimScopes.get(key);
      if (scope === undefined) {
        err(
          'C17',
          `instance ${inst.id}: classification dimension "${key}" is not declared (instance-scope)`,
        );
      } else if (
        levelIdx !== undefined &&
        CHAIN_LEVEL_ORDER[scope] !== undefined &&
        levelIdx < CHAIN_LEVEL_ORDER[scope]
      ) {
        err(
          'C17',
          `instance ${inst.id}: classification dimension "${key}" (scope ${scope}) stated at ${inst.level} level — values are stated at their declared scope or lower (instance-scope)`,
        );
      }
    }

    // C18 — instance-version-pin: every instance is version-pinned to its
    // definitions (INV-8); re-execution requires the pin.
    if (Object.keys(inst.definitionVersions ?? {}).length === 0) {
      err(
        'C18',
        `instance ${inst.id}: no definition_versions — every instance is version-pinned to its definitions (INV-8) (instance-version-pin)`,
      );
    }

    // C19 — chain-acyclic (integrity part 1): upward chain links resolve
    // to declared instances.
    for (const kind of ['model', 'group', 'family'] as const) {
      const target = inst[kind];
      if (target && !instanceIds.has(target)) {
        err(
          'C19',
          `instance ${inst.id}: chain link ${kind} "${target}" is not a declared instance (chain-acyclic)`,
        );
      }
    }

    // C20 — instance-of-resolves: the `of` reference names a declared
    // subject (v3), instrument (v2), or ANOTHER INSTANCE (the power-type
    // discipline — every instance can serve as the definition of further
    // instantiation).
    if (
      !subjectIds.has(inst.of) &&
      !instrumentIds.has(inst.of) &&
      !instanceIds.has(inst.of) &&
      !dataclassIds.has(inst.of)
    ) {
      err(
        'C20',
        `instance ${inst.id}: of "${inst.of}" is not a declared subject, instrument, class, or instance (instance-of-resolves)`,
      );
    }

    // C155 — power-type-chain (coherence leg): an instance whose `of`
    // names another instance carries NO upward subject-chain link — the
    // two are one pattern's two spellings, and mixing them makes the
    // delegation walk ambiguous.
    if (instanceIds.has(inst.of)) {
      const links = (['model', 'group', 'family'] as const).filter(
        k => inst[k],
      );
      if (links.length > 0) {
        err(
          'C155',
          `instance ${inst.id}: of "${inst.of}" names an instance and the instance carries an upward ${links.join('/')} link — the power-type chain and the subject-chain profile do not mix (power-type-chain)`,
        );
      }
    }
  }

  // C155 — power-type-chain (acyclicity leg): the MIXED delegation
  // graph — of-chains to instances AND the prototype hop (an `of` to a
  // class whose extends names an instance) — is acyclic: a cycle over
  // these edges would make the delegation walk non-terminating, and a
  // class instantiating its own prototype (`instance x of C` while
  // `C extends { x }`) is the shapes' own mutual recursion.
  const delegation = delegationSuccessors(standard);
  const ofAdj = new Map<string, string[]>();
  for (const [from, to] of delegation) {
    if (instanceIds.has(to)) {
      ofAdj.set(from, [to]);
    }
  }
  const ofCycle = findCycle(ofAdj);
  if (ofCycle) {
    err(
      'C155',
      `the power-type of-chain is cyclic: ${ofCycle.join(' → ')} (power-type-chain)`,
    );
  }

  // C156 — class-extends-resolves: a class's extends names a declared
  // class or a declared INSTANCE (the definition side of the power-type
  // discipline — a class extending an instance specializes that
  // individual). Successfully merged links clear at resolve time, so a
  // surviving link is exactly an unresolved one.
  for (const c of standard.dataclasses ?? []) {
    if (
      c.extends &&
      !dataclassIds.has(c.extends) &&
      !dataclassBareIds.has(c.extends) &&
      !instanceIds.has(c.extends)
    ) {
      warn(
        'C156',
        `class ${c.id}: extends "${c.extends}" is not a declared class or instance (class-extends-resolves)`,
      );
    }
  }

  // C19 — chain-acyclic (integrity part 2): the resolved link graph is
  // acyclic (a cycle would make delegation resolution non-terminating).
  const instAdj = new Map<string, string[]>();
  for (const inst of standard.instances ?? []) {
    const targets = [inst.model, inst.group, inst.family].filter(
      t => t && instanceIds.has(t),
    );
    if (targets.length > 0) {
      instAdj.set(inst.id, targets);
    }
  }
  const instCycle = findCycle(instAdj);
  if (instCycle) {
    err(
      'C19',
      `instance subject chain cycle: ${instCycle.join(' → ')} (chain-acyclic)`,
    );
  }

  // ── C21–C26: the mapping primitive + coverage calculus ──
  // (TODO.roadmap/04; concept doc §5.2, §5.6, §5.8). Mappings are the ONLY
  // compliance relation between an implementation model and a reference
  // model: both ends resolve (C21), the direction is fixed (C22), coverage
  // is computed not authored (C23), import ≠ mapping (C24), descriptions
  // are demanded at audit strictness (C25), and views are read-only (C26).
  const strictness = options.strictness ?? 'normal';
  const localNs = standard.packageManifest?.id ?? '';
  const compIds = componentIds(standard);

  // In-model map profiles + standalone .prm files in the package root —
  // both serializations of the same primitive, linted uniformly.
  const allProfiles: MapProfile[] = [...(standard.mapProfiles ?? [])];
  if (existsSync(dir)) {
    for (const entry of readdirSync(dir).sort()) {
      if (!entry.endsWith('.prm')) {
        continue;
      }
      const path = join(dir, entry);
      try {
        allProfiles.push(
          ...prmToMapProfiles(loadPrm(readFileSync(path, 'utf8'))),
        );
      } catch (e) {
        err('C21', `${entry}: ${(e as Error).message} (mapping-resolves)`);
      }
    }
  }

  // Dependency-manifest resolution for the supply-chain rules (C24's
  // product_reference exemption, C81, C83): the composition locator when
  // given, else the SIBLING-package scan (the checkManifestResolution
  // stopgap pattern) — manifest-only linting (no --with) must still see
  // package kinds and edition registers. Memoized per package id.
  const resolveDepManifest = (() => {
    const cache = new Map<string, PackageManifest | null>();
    const siblings = new Map<string, PackageManifest>();
    try {
      const parent = dirname(resolve(dir));
      for (const entry of readdirSync(parent).sort()) {
        const full = join(parent, entry);
        try {
          if (!statSync(full).isDirectory()) {
            continue;
          }
          const m = readPackageManifest(full);
          siblings.set(m.id, m);
        } catch {
          // Not a package dir (no/invalid manifest) — not a candidate.
        }
      }
    } catch {
      // No readable parent — no sibling fallback.
    }
    return (id: string): PackageManifest | null => {
      const cached = cache.get(id);
      if (cached !== undefined) {
        return cached;
      }
      let m: PackageManifest | null = null;
      const located = options.resolvePackage?.(id);
      if (located) {
        try {
          m = readPackageManifest(located);
        } catch {
          m = null;
        }
      }
      m ??= siblings.get(id) ?? null;
      cache.set(id, m);
      return m;
    };
  })();

  for (const mp of allProfiles) {
    for (const [source, pairs] of Object.entries(mp.mappings)) {
      // C22 — direction: the source is a LOCAL component. A namespaced
      // source (NS#id) maps a reference element — the wrong way round.
      if (source.includes('#')) {
        err(
          'C22',
          `map_profile ${mp.namespace}: mapping source "${source}" is a namespaced reference element — the mapping direction is implementation → reference (mapping-direction)`,
        );
      } else if (!compIds.has(source)) {
        err(
          'C21',
          `map_profile ${mp.namespace}: mapping source "${source}" is not a declared component (mapping-resolves)`,
        );
      }
      for (const pair of pairs) {
        const ref = parseTargetRef(pair.target, mp.namespace);
        if (ref.namespace !== mp.namespace) {
          err(
            'C21',
            `map_profile ${mp.namespace}: target "${pair.target}" carries namespace "${ref.namespace}" ≠ the profile namespace "${mp.namespace}" (Namespace#ElementID aliasing) (mapping-resolves)`,
          );
        }
        if (localNs && ref.namespace === localNs) {
          err(
            'C22',
            `map_profile ${mp.namespace}: target "${pair.target}" is in the model's own namespace — mapping to one's own components inverts the direction (implementation → reference) (mapping-direction)`,
          );
        }
        if (!compIds.has(ref.qualified)) {
          err(
            'C21',
            `map_profile ${mp.namespace}: target "${ref.qualified}" has no declared alias element — the implementation model declares local copies of the reference elements it maps to (mapping-resolves)`,
          );
        }
        // C25 — a mapping without description is a warning at audit
        // strictness (silent in normal mode).
        if (strictness === 'audit' && !pair.description) {
          warn(
            'C25',
            `map_profile ${mp.namespace}: mapping ${source} -> ${ref.qualified} has no description — how the fulfilment works is demanded at audit strictness (mapping-description)`,
          );
        }
      }
    }
  }

  // C23 — mapping-calculus-consistency: coverage is COMPUTED, not
  // authored. An authored assertion that disagrees with the calculus is
  // an error — both the per-pair `coverage` on a mapping (its target is
  // directly mapped, hence fully covered) and the profile-level
  // `coverage { … }` tripwires over arbitrary reference components. The
  // reference tree comes from options.references when supplied, else
  // from the package's own Namespace#… alias forest.
  //
  // Usability notes when options.references is ABSENT: the alias forest
  // is built from the package's own `Namespace#ElementID` process
  // declarations, which are FRESH declarations — an alias of a gateway
  // parent must itself re-declare `child_composition gateway`, or the
  // alias aggregates with the default `all` and assertions compute
  // against the wrong composition. And closure proposals fire only at
  // FULL aggregation (every child full) — a gateway parent aggregated to
  // minimal/partial proposes nothing, so absence of a proposal is not
  // absence of cover.
  for (const mp of allProfiles) {
    const pairAssertions = Object.entries(mp.mappings).flatMap(
      ([source, pairs]) =>
        pairs
          .filter(p => p.coverage)
          .map(pair => ({
            source,
            pair,
            ref: parseTargetRef(pair.target, mp.namespace),
          })),
    );
    const profileAssertions = Object.entries(mp.coverage ?? {}).map(
      ([ref, level]) => ({ ref: parseTargetRef(ref, mp.namespace), level }),
    );
    if (pairAssertions.length === 0 && profileAssertions.length === 0) {
      continue;
    }
    const reference = options.references?.[mp.namespace];
    const forest = reference
      ? buildProcessTree(reference)
      : buildProcessTree(standard, { idPrefix: mp.namespace + '#' });
    const report = computeCoverage(
      standard,
      forest,
      mappingsFromProfile(mp, localNs),
      mp.namespace,
      { implementationId: localNs, referenceId: mp.namespace },
    );
    const computed = new Map(report.components.map(c => [c.id, c.coverage]));
    for (const a of pairAssertions) {
      const level = computed.get(a.ref.id);
      if (level === undefined) {
        continue; // C21 already flags the unresolvable target
      }
      if (level !== a.pair.coverage) {
        err(
          'C23',
          `map_profile ${mp.namespace}: ${a.source} -> ${a.ref.qualified} asserts coverage "${a.pair.coverage}" but the calculus computes "${level}" — coverage is computed, not authored (mapping-calculus-consistency)`,
        );
      }
    }
    for (const a of profileAssertions) {
      const level = computed.get(a.ref.id);
      if (level === undefined) {
        err(
          'C23',
          `map_profile ${mp.namespace}: coverage assertion for "${a.ref.qualified}" names a component outside the reference tree (mapping-calculus-consistency)`,
        );
        continue;
      }
      if (level !== a.level) {
        err(
          'C23',
          `map_profile ${mp.namespace}: coverage assertion "${a.ref.qualified}: ${a.level}" disagrees with the computed "${level}" — coverage is computed, not authored (mapping-calculus-consistency)`,
        );
      }
    }
  }

  // C24 — import-not-mapping: an import (uses/extends) is structural
  // inclusion; a mapping is a fulfilment claim. Neither may be expressed
  // as the other (concept doc §5.6 b) — one rule, both directions: the
  // imported set and the mapped set must be disjoint.
  //
  // Supply-chain exemption (TODO.roadmap/36, doctrine ch. 15 §15.3): an
  // ABSTRACT IMPORT of a product reference package is reference content
  // cited at a pinned edition, never structural inclusion — the composer
  // does not merge it (ser-des/package.ts). Mode-1 consumption IS a
  // mapping ("the user's model maps its usage to the product's promised
  // aspects"), so a map_profile whose namespace is an imported
  // product_reference package is the intended pattern, not a violation.
  const imported = new Set(
    [
      standard.packageManifest?.extends,
      ...(standard.packageManifest?.uses ?? []),
    ].filter((x): x is string => !!x),
  );
  for (const mp of allProfiles) {
    if (imported.has(mp.namespace)) {
      if (resolveDepManifest(mp.namespace)?.kind === 'product_reference') {
        continue;
      }
      err(
        'C24',
        `map_profile ${mp.namespace}: namespace "${mp.namespace}" is imported (uses/extends) — an import may not be expressed as a mapping, nor a mapping as an import; inclusion ≠ fulfilment (import-not-mapping)`,
      );
    }
  }

  // C26 — view-read-only: a view is a read-only lens. It may only name
  // declared elements, and its `against` reference must be a namespace
  // the model actually maps to — a view never adds, removes, or edits
  // the mappings of the model it reads (the grammar gives view_profile
  // no mapping slots, and applyView returns a frozen projection).
  const mappedNamespaces = new Set(allProfiles.map(p => p.namespace));
  for (const vp of standard.viewProfiles ?? []) {
    for (const el of vp.visibleElements ?? []) {
      if (!compIds.has(el)) {
        err(
          'C26',
          `view_profile ${vp.id}: visible element "${el}" is not a declared component — a view reads the model, it does not invent it (view-read-only)`,
        );
      }
    }
    if (vp.against && !mappedNamespaces.has(vp.against)) {
      err(
        'C26',
        `view_profile ${vp.id}: against "${vp.against}" names no declared map_profile/mapSet namespace — a view reads coverage, it does not create it (view-read-only)`,
      );
    }
  }

  // ── C81–C83: the model supply chain (TODO.roadmap/36; doctrine ch. 15
  // §15.9) ──
  // Three publishers — the standard (reference), the manufacturer
  // (product reference), the user (implementation) — and mapping is the
  // only relation between them. C81: a product reference package's
  // declaration resolves (manufacturer, product designation, and the
  // standards-reference packages it maps to — its map profiles and its
  // maps_to manifest register must agree, and every maps_to target must
  // resolve). C82: an unmapped IS promise is a brochure claim — flagged
  // at authoring (a warning; the mapping is the conformance claim made
  // computable). C83: abstract imports pin a version — no unpinned
  // reference consumption, and the pin resolves against the product
  // package's edition register.
  const productManifest = standard.packageManifest;
  if (productManifest?.kind === 'product_reference') {
    if (!productManifest.manufacturer) {
      err(
        'C81',
        `package "${productManifest.id}": a product reference package declares its manufacturer — the model speaks for them (product-maps-resolves)`,
      );
    }
    if (!productManifest.product) {
      err(
        'C81',
        `package "${productManifest.id}": a product reference package declares its product designation (product-maps-resolves)`,
      );
    }
    const mapsTo = productManifest.mapsTo ?? [];
    if (mapsTo.length === 0) {
      err(
        'C81',
        `package "${productManifest.id}": a product reference package declares the standards-reference packages it maps to (maps_to) — an unmapped product model is a brochure (product-maps-resolves)`,
      );
    }
    for (const target of mapsTo) {
      const dm = resolveDepManifest(target);
      if (!dm) {
        err(
          'C81',
          `package "${productManifest.id}": maps_to "${target}" does not resolve to a known package — the standards reference a product maps to must resolve (product-maps-resolves)`,
        );
      } else if (dm.kind === 'product_reference') {
        err(
          'C81',
          `package "${productManifest.id}": maps_to "${target}" is itself a product reference package — a product maps to the standard, never to another product (product-maps-resolves)`,
        );
      }
      if (!mappedNamespaces.has(target)) {
        err(
          'C81',
          `package "${productManifest.id}": maps_to "${target}" names a standards reference the model never maps to — declare the map_profile/.prm mapSet or drop the entry (product-maps-resolves)`,
        );
      }
    }
    for (const ns of mappedNamespaces) {
      if (!mapsTo.includes(ns)) {
        err(
          'C81',
          `map_profile ${ns}: the model maps to a standards reference it does not declare in its manifest maps_to register (product-maps-resolves)`,
        );
      }
    }

    // C82 — every block-form IS promise is a mapping SOURCE (statement-
    // only shorthand entries are prose, not mappable claims).
    const mappedSources = new Set<string>();
    for (const mp of allProfiles) {
      for (const source of Object.keys(mp.mappings)) {
        mappedSources.add(source);
      }
    }
    for (const s of standard.subjects ?? []) {
      for (const p of s.is?.promises ?? []) {
        if (!p.id) {
          continue;
        }
        if (!mappedSources.has(p.id)) {
          warn(
            'C82',
            `subject ${s.id}: promise "${p.id}" is not mapped to any standard — an unmapped promise is a brochure claim; the mapping is the conformance claim made computable (product-unmapped-promises)`,
          );
        }
      }
    }
  }

  // C83 — abstract-import-pinned: a uses/extends edge to a product
  // reference package carries a version pin (uses { <id>@<edition> }),
  // and the pin resolves against the product package's edition register
  // (the C80 register discipline applied to the import edge).
  if (productManifest) {
    for (const dep of effectiveUses(productManifest)) {
      const dm = resolveDepManifest(dep);
      if (dm?.kind !== 'product_reference') {
        continue;
      }
      const pin = productManifest.usePins?.[dep];
      if (!pin) {
        err(
          'C83',
          `package "${productManifest.id}" imports product reference package "${dep}" without a version pin — abstract imports pin a version (uses { ${dep}@<edition> }); no unpinned reference consumption (abstract-import-pinned)`,
        );
        continue;
      }
      const register = new Set([
        ...(dm.editions ?? []),
        ...(dm.version ? [dm.version] : []),
      ]);
      if (register.size > 0 && !register.has(pin)) {
        err(
          'C83',
          `package "${productManifest.id}" pins "${dep}" at "${pin}", which does not resolve against the product package's edition register { ${[...register].join(' ')} } — the pin names a declared edition (abstract-import-pinned)`,
        );
      }
    }
  }

  // ── C144–C146: the license facets (check-families/license-facets) ──
  runLicenseFacetsFamily({ standard, err });

  // ── C122: scheme-type-resolves (smart TODO.roadmap/40 batch 2; the ──
  // packages-as-SSOT epic) ────────────────────────────────────────────
  // The ISO/IEC 17067 register is composable: a manifest's `scheme_type`
  // token resolves against the composed scheme_type register WHEN one is
  // in scope (per-register gating, the C58 doctrine — a register-less
  // package keeps the register-free fallback, the C89 spelling
  // precedent); and a scheme_type's determination / attestation /
  // surveillance.activities entries resolve against the composed
  // scheme_activity_kind menus when THAT register is in scope. C98's
  // hard-coded no-surveillance set defers to the register's
  // surveillance.required (below, in the C97–C98 block).
  {
    const schemeTypeIds = new Set((standard.schemeTypes ?? []).map(t => t.id));
    const menuIds = new Set(
      (standard.schemeActivityKinds ?? []).map(k => k.id),
    );
    const manifestSchemeType = standard.packageManifest?.schemeType;
    if (
      schemeTypeIds.size > 0 &&
      manifestSchemeType &&
      !schemeTypeIds.has(manifestSchemeType)
    ) {
      err(
        'C122',
        `package "${standard.packageManifest!.id}": scheme_type "${manifestSchemeType}" is not a declared scheme type of the in-scope ISO/IEC 17067 register (scheme-type-resolves)`,
      );
    }
    if (menuIds.size > 0) {
      const resolveMenuEntry = (where: string, facet: string, id: string) => {
        if (!menuIds.has(id)) {
          err(
            'C122',
            `${where}: ${facet} "${id}" is not a declared scheme activity kind (scheme-type-resolves)`,
          );
        }
      };
      for (const t of standard.schemeTypes ?? []) {
        const where = `scheme_type ${t.id}`;
        for (const d of t.determination) {
          resolveMenuEntry(where, 'determination', d);
        }
        for (const a of t.attestation) {
          resolveMenuEntry(where, 'attestation', a);
        }
        for (const s of t.surveillance?.activities ?? []) {
          resolveMenuEntry(where, 'surveillance.activities', s);
        }
      }
    }
  }

  // ── C123: document-module-references-resolve (smart TODO.roadmap/40 ──
  // batch 2; the packages-as-SSOT epic) ───────────────────────────────
  // The document module's edges resolve: the sequence members against
  // the composed processes, the register maintainers against the
  // governance_organ register (per-register gating, the C58 doctrine),
  // and the declared namespace is an absolute requirement-namespace path
  // (the register-free shape leg). The informative annex's applies_to
  // names a known package — checked through the dependency-manifest
  // locator, so the leg is gated on a locator being supplied (the
  // C97-class resolution discipline; without a locator the sibling scan
  // cannot adjudicate non-sibling ids and the leg stays silent).
  {
    const dmOrganIds = new Set(
      (standard.governanceOrgans ?? []).map(o => o.id),
    );
    const dmProcessIds = new Set((standard.processes ?? []).map(p => p.id));
    for (const m of standard.documentModules ?? []) {
      const where = `document_module ${m.id}`;
      if (m.namespace !== '' && !m.namespace.startsWith('/')) {
        err(
          'C123',
          `${where}: namespace "${m.namespace}" is not an absolute requirement-namespace path (e.g. /req/cs/${m.id}) — the declared pin C119 guards must be a path (document-module-references-resolve)`,
        );
      }
      if (dmProcessIds.size > 0) {
        for (const s of m.sequence ?? []) {
          if (!dmProcessIds.has(s)) {
            err(
              'C123',
              `${where}: sequence "${s}" is not a declared process (document-module-references-resolve)`,
            );
          }
        }
      }
      if (dmOrganIds.size > 0) {
        for (const r of m.registers ?? []) {
          if (r.maintainer !== '' && !dmOrganIds.has(r.maintainer)) {
            err(
              'C123',
              `${where} register ${r.id}: maintainer "${r.maintainer}" is not a declared governance organ (document-module-references-resolve)`,
            );
          }
        }
      }
    }
    if (options.resolvePackage) {
      for (const a of standard.informativeAnnexes ?? []) {
        if (a.appliesTo !== '' && !resolveDepManifest(a.appliesTo)) {
          err(
            'C123',
            `informative_annex ${a.id}: applies_to "${a.appliesTo}" does not resolve to a known package — the CASCO layer the annex applies to must resolve (document-module-references-resolve)`,
          );
        }
      }
    }
  }

  // ── C97–C98: the certification program (TODO.v2/01;
  // analysis/twin-certification-design.md Q4) ──
  // A fourth publisher with the product_reference shape: the scheme
  // operator's program is related to recs and product packages by
  // MAPPING and pinned abstract imports only — composed into nothing.
  // C97: the program's maps_to register resolves (the C81-class
  // resolution discipline — the same resolveDepManifest locator/sibling
  // scan): the program maps to the rec requirement vocabulary it
  // certifies against, never to another program, and product twin
  // declarations enter as pinned abstract imports (uses @edition, C83),
  // never as maps_to entries. C98: a program declaring a no-surveillance
  // ISO/IEC 17067 scheme shape (type_1a/1b — sample-only; Table 1) while
  // declaring surveillance machinery (a monitor — the continuous-
  // evaluation primitive — or a surveillance-classified process) is a
  // WARNING: the type_1a/1b shape structurally can't say "continuously".
  if (productManifest?.kind === 'certification_program') {
    const mapsTo = productManifest.mapsTo ?? [];
    if (mapsTo.length === 0) {
      err(
        'C97',
        `package "${productManifest.id}": a certification program declares the Recommendation vocabulary it certifies against (maps_to) — a program that maps to nothing certifies nothing (program-maps-resolves)`,
      );
    }
    for (const target of mapsTo) {
      const dm = resolveDepManifest(target);
      if (!dm) {
        err(
          'C97',
          `package "${productManifest.id}": maps_to "${target}" does not resolve to a known package — the requirement vocabulary a program certifies against must resolve (program-maps-resolves)`,
        );
      } else if (dm.kind === 'certification_program') {
        err(
          'C97',
          `package "${productManifest.id}": maps_to "${target}" is itself a certification program — a program maps to the standards vocabulary, never to another program (program-maps-resolves)`,
        );
      } else if (dm.kind === 'product_reference') {
        err(
          'C97',
          `package "${productManifest.id}": maps_to "${target}" is a product reference package — the product twin declarations a program certifies are pinned abstract imports (uses { ${target}@<edition> }, C83), never maps_to entries (program-maps-resolves)`,
        );
      }
    }

    // C98 — the no-surveillance scheme shapes (ISO/IEC 17067 Table 1:
    // type 1a/1b carry no surveillance) versus the program's declared
    // surveillance machinery. A monitor IS a continuous claim ("without
    // triggers, 'continuous' has no clock" — types/Monitor.ts); an
    // activity_kind { surveillance } process is a surveillance claim.
    // When the scheme-type register is in scope (smart TODO.roadmap/40
    // batch 2 — composed via uses), the register's own
    // surveillance.required adjudicates; the hard-coded type_1a/1b set
    // is the register-free fallback (the C89 spelling precedent).
    const SCHEME_TYPES_WITHOUT_SURVEILLANCE = new Set(['type_1a', 'type_1b']);
    const registerEntry = (standard.schemeTypes ?? []).find(
      t => t.id === productManifest.schemeType,
    );
    const noSurveillance = registerEntry
      ? !registerEntry.surveillance?.required
      : SCHEME_TYPES_WITHOUT_SURVEILLANCE.has(productManifest.schemeType ?? '');
    if (productManifest.schemeType && noSurveillance) {
      const claims: string[] = [];
      if ((standard.monitors ?? []).length > 0) {
        claims.push(
          `${standard.monitors.length} monitor(s): ${standard.monitors.map(m => m.id).join(', ')}`,
        );
      }
      const surveillanceProcesses = (standard.processes ?? []).filter(p =>
        (p.activityKinds ?? []).includes('surveillance'),
      );
      if (surveillanceProcesses.length > 0) {
        claims.push(
          `surveillance-classified process(es): ${surveillanceProcesses.map(p => p.id).join(', ')}`,
        );
      }
      if (claims.length > 0) {
        warn(
          'C98',
          `package "${productManifest.id}": scheme_type "${productManifest.schemeType}" certifies a type sample with no surveillance, but the program declares ${claims.join(' and ')} — the ${productManifest.schemeType} shape structurally can't say "continuously"; a surveillance-constitutive program self-classifies type_5 (ISO/IEC 17067 Table 1) (program-surveillance-required)`,
        );
      }
    }
  }

  // ── C99: the probe-channel provenance facet (smart TODO.v2/01 TCD-2;
  // analysis/twin-certification-design.md Q2) ──
  // A measured reference variable declares the physical-side channel its
  // reading arrives by: reference_instrument (a traceable reference, cited
  // by equipment-register id) | observer_attestation (a verification
  // officer reads the physical display into the evidence form — admitted
  // with the DECLARED traceability limitation, controller decision 3:
  // "twin ≡ display, not twin ≡ mass" is data, never a comment) |
  // sim_ground_truth (the acceptance environment only). The kernel checks
  // shape and vocabulary, register-free; the ref's RESOLUTION against the
  // equipment/personnel/sim registers is the smart-side linker's R45.
  {
    const PROBE_CHANNELS = new Set([
      'reference_instrument',
      'observer_attestation',
      'sim_ground_truth',
    ]);
    for (const t of standard.conformanceTests ?? []) {
      const variableNames = new Set((t.variables ?? []).map(v => v.name));
      for (const v of t.variables ?? []) {
        const p = v.provenance;
        if (!p) {
          continue;
        }
        if (!PROBE_CHANNELS.has(p.channel)) {
          err(
            'C99',
            `conformance test ${t.id}: variable "${v.name}" declares provenance channel "${p.channel}" — the probe channel is one of reference_instrument | observer_attestation | sim_ground_truth (variable-provenance-channel)`,
          );
        }
        if (p.ref === '') {
          err(
            'C99',
            `conformance test ${t.id}: variable "${v.name}" declares channel "${p.channel}" but cites no ref — the channel's register entry (equipment-register id, personnel/participant id, or sim deployment id) is the provenance's substance (variable-provenance-channel)`,
          );
        }
        if (p.observedAt === '') {
          err(
            'C99',
            `conformance test ${t.id}: variable "${v.name}" declares no observed_at binding — a channel reading without its observation timestamp cannot be paired (variable-provenance-channel)`,
          );
        } else if (!variableNames.has(p.observedAt)) {
          err(
            'C99',
            `conformance test ${t.id}: variable "${v.name}" binds observed_at to "${p.observedAt}", which names no declared variable of the test — the observation timestamp lands in a declared variable (variable-provenance-channel)`,
          );
        }
        if (p.channel === 'observer_attestation' && p.limitation === '') {
          err(
            'C99',
            `conformance test ${t.id}: variable "${v.name}" declares the observer_attestation channel without its traceability limitation — attestation-only evidence proves "twin ≡ display", not "twin ≡ mass"; the limitation is DECLARED data, never a comment (variable-provenance-channel)`,
          );
        }
        if (p.channel !== 'observer_attestation' && p.limitation !== '') {
          warn(
            'C99',
            `conformance test ${t.id}: variable "${v.name}" carries a traceability limitation on the ${p.channel} channel — the limitation declaration rides the observer_attestation channel (variable-provenance-channel)`,
          );
        }
        if (v.source !== '' && v.source !== 'measured') {
          warn(
            'C99',
            `conformance test ${t.id}: variable "${v.name}" is source ${v.source} but declares a physical probe channel — the channel provenance belongs to a measured reference reading (variable-provenance-channel)`,
          );
        }
      }
    }
  }

  // ── C182: series-record-fields (the variable↔subform type link) ────
  // A series variable whose series declares `record <form>` types its
  // row members by the record form's fields: a collection derivation's
  // lambda member (`m.<field>`) resolves against them — the derivation
  // over a captured collection is kind-checked, never kind-silent.
  {
    const recordFormFields = new Map<string, Set<string>>();
    for (const f of standard.forms ?? []) {
      recordFormFields.set(f.id, new Set((f.fields ?? []).map(x => x.name)));
    }
    const walkMembers = (
      n: ExprAst,
      bound: Map<string, string>,
      out: { source: string; field: string }[],
    ): void => {
      if (n.type === 'nav') {
        const inner = new Map(bound);
        inner.set(n.var, n.source);
        walkMembers(n.body, inner, out);
        return;
      }
      if (n.type === 'name' && n.path.length > 0) {
        // the lexer keeps dotted names in one path head: m.served is
        // path ['m.served'] — split the head to find the lambda param
        const parts = [...n.path[0]!.split('.'), ...n.path.slice(1)];
        if (parts.length > 1) {
          const src = bound.get(parts[0]!);
          if (src !== undefined) {
            out.push({ source: src, field: parts.slice(1).join('.') });
          }
        }
        return;
      }
      const kids: ExprAst[] =
        n.type === 'call'
          ? n.args
          : n.type === 'binop'
            ? [n.left, n.right]
            : n.type === 'unop'
              ? [n.operand]
              : n.type === 'ifelse'
                ? [n.cond, n.then, n.else]
                : [];
      for (const k of kids) {
        walkMembers(k, bound, out);
      }
    };
    for (const t of standard.conformanceTests ?? []) {
      for (const v of t.variables ?? []) {
        const rec = v.series?.record;
        if (!rec) {
          continue;
        }
        const fields = recordFormFields.get(rec);
        if (!fields) {
          err(
            'C182',
            `conformance test ${t.id}: variable "${v.name}" series record "${rec}" names no declared form — the row members type by the record form's fields (series-record-fields)`,
          );
          continue;
        }
        if (!v.derivation) {
          continue;
        }
        let ast: ExprAst;
        try {
          ast = parseExpression(
            v.derivation.replace(/^ocl\{/, '').replace(/\}$/, ''),
          );
        } catch {
          continue; // parse errors ride the derivation's own rules
        }
        const members: { source: string; field: string }[] = [];
        walkMembers(ast, new Map(), members);
        for (const m of members) {
          if (m.source === v.name && !fields.has(m.field)) {
            err(
              'C182',
              `conformance test ${t.id}: variable "${v.name}" derivation names "m.${m.field}" — the record form ${rec} declares no such field; the row members are its typed fields (series-record-fields)`,
            );
          }
        }
      }
    }
  }

  // ── C86–C88: the model-native DPP (TODO.roadmap/35; doctrine ch. 14
  // §14.6, ch. 15 §15.6/§15.9) ──
  // The passport is the product model's named, access-classed PROJECTION —
  // "it cannot drift from the model because it *is* the model" (§14.6).
  // §15.9's passport rule: "the passport projection contains only aspects
  // that resolve — public classes contain nothing marked restricted".
  // C86: every content entry's class is one of the six declared classes,
  // and a qualified `<class>.<ref>` resolves against the package's
  // declared aspects/promises (sustainability refs pass unjudged — the
  // ESPR delegated-act content models do not exist yet, TODO.roadmap/35
  // "Out"). C87: an entry marked restricted/authority the public class
  // reaches (the same entry, or a covering bare class) is a leak. C88:
  // the UPI scheme declares its pattern and its ESPR level
  // (model | batch | item). Packages without a passport are untouched —
  // the loop is empty.
  {
    const KNOWN_CONTENT = new Set<string>(PASSPORT_CONTENT_CLASSES);
    const KNOWN_LEVELS = new Set<string>(PASSPORT_UPI_LEVELS);
    const entryToken = (e: { contentClass: string; ref: string }): string =>
      e.ref === '' ? e.contentClass : `${e.contentClass}.${e.ref}`;

    // The per-class resolution domains for qualified entries (C86): the
    // package's declared aspects/promises, one vocabulary per class.
    const passportPromiseIds = new Set(
      (standard.subjects ?? []).flatMap(s =>
        (s.is.promises ?? []).map(pr => pr.id).filter(id => id !== ''),
      ),
    );
    const compositionIds = new Set(
      (standard.subjects ?? []).flatMap(s => [
        ...(s.is.structure ?? []),
        ...Object.keys(s.is.designParameters ?? {}),
        ...Object.keys(s.has.characteristics ?? {}),
        ...(s.has.serves ?? []).map(sv => sv.aspect),
      ]),
    );
    const passportArtifactIds = new Set([
      ...(standard.artifactDefinitions ?? []).map(a => a.id),
      ...(standard.subjects ?? []).flatMap(s => s.is.artifacts ?? []),
    ]);
    const passportMonitorIds = new Set(
      (standard.monitors ?? []).map(m => m.id),
    );
    // null = the class has no kernel resolution domain (sustainability —
    // the forward class; its refs pass unjudged).
    const CONTENT_DOMAINS: Record<string, Set<string> | null> = {
      identity: subjectIds,
      composition: compositionIds,
      promises_as_verified: passportPromiseIds,
      live_compliance_status: new Set([
        ...passportMonitorIds,
        ...passportPromiseIds,
      ]),
      artifacts: passportArtifactIds,
      sustainability: null,
    };

    for (const p of standard.passports ?? []) {
      // C86 — passport-content-resolves (§15.9).
      for (const e of p.entries) {
        if (!KNOWN_CONTENT.has(e.contentClass)) {
          err(
            'C86',
            `passport ${p.id}: content entry "${entryToken(e)}" names an unknown content class — one of ${PASSPORT_CONTENT_CLASSES.join(' | ')} (passport-content-resolves)`,
          );
          continue;
        }
        if (e.ref !== '') {
          const domain = CONTENT_DOMAINS[e.contentClass];
          if (domain !== null && !domain.has(e.ref)) {
            err(
              'C86',
              `passport ${p.id}: content entry "${entryToken(e)}" — "${e.ref}" does not resolve against the package's declared aspects/promises (the passport projection contains only aspects that resolve, §15.9) (passport-content-resolves)`,
            );
          }
        }
      }

      // C87 — passport-access-leak (§15.9): an entry marked restricted/
      // authority is reachable from the public class when the public
      // block carries the same entry or a covering bare class. (The
      // reverse narrowing — a bare restricted class with one ref made
      // public — is an authored exception, not a leak.)
      const publicEntries = p.entries.filter(e => e.access === 'public');
      const publicTokens = new Set(publicEntries.map(entryToken));
      const publicBareClasses = new Set(
        publicEntries.filter(e => e.ref === '').map(e => e.contentClass),
      );
      for (const e of p.entries) {
        if (e.access !== 'restricted' && e.access !== 'authority') {
          continue;
        }
        if (
          publicTokens.has(entryToken(e)) ||
          publicBareClasses.has(e.contentClass)
        ) {
          err(
            'C87',
            `passport ${p.id}: entry "${entryToken(e)}" is marked ${e.access} but reachable from the public class — public classes contain nothing marked restricted (§15.9) (passport-access-leak)`,
          );
        }
      }

      // C88 — passport-upi-scheme (§14.6; ESPR): the unique product
      // identifier declares its pattern and its level.
      if (p.upi.pattern === '') {
        err(
          'C88',
          `passport ${p.id}: declares no UPI pattern — a passport is reached through its unique product identifier (upi { pattern … level … }) (passport-upi-scheme)`,
        );
      }
      if (p.upi.level === '') {
        err(
          'C88',
          `passport ${p.id}: the UPI pattern declares no level — the ESPR unique product identifier is model | batch | item level (passport-upi-scheme)`,
        );
      } else if (!KNOWN_LEVELS.has(p.upi.level)) {
        err(
          'C88',
          `passport ${p.id}: UPI level "${p.upi.level}" is not one of ${PASSPORT_UPI_LEVELS.join(' | ')} (passport-upi-scheme)`,
        );
      }
    }
  }

  // ── C90–C91: the architecture invariants (smart gap-close E9,
  // analysis/architecture-gaps-2026-07.md; smart
  // docs/oiml-core/09-invariants.md) ──
  // The `invariant` construct is the first-class replacement for the
  // note-family encoding. C90 invariant-shape: every invariant carries
  // name, statement, and severity (severity is PRESENCE-judged only —
  // the smart side owns the severity vocabulary), and enforcement is a
  // non-empty claim list XOR the literal `aspirational` marker — never
  // empty, never both. C91 invariant-enforcement-grammar: every claim
  // matches kernel:C<n> | linker:<kebab-name> | gate:<kebab-name>, and
  // the aspirational marker never appears inside a claims list. Claim
  // TARGET resolution (does the linker rule exist, does the gate have
  // evidence) is the smart-side linker rule R38's crosswalk — the
  // kernel checks syntax/shape only. Packages without invariants are
  // untouched — the loop is empty.
  {
    const CLAIM_GRAMMAR = [
      /^kernel:C\d+$/,
      /^linker:[a-z0-9-]+$/,
      /^gate:[a-z0-9-]+$/,
    ];
    for (const inv of standard.invariants ?? []) {
      // C90 — invariant-shape.
      if (inv.name === '') {
        err(
          'C90',
          `invariant ${inv.id}: declares no name — an invariant carries a short rule name (invariant-shape)`,
        );
      }
      if (inv.statement === '') {
        err(
          'C90',
          `invariant ${inv.id}: declares no statement — an invariant carries the rule's prose (the default spelling inline; alternates ride text ${inv.id}.statement blocks) (invariant-shape)`,
        );
      }
      if (inv.severity === '') {
        err(
          'C90',
          `invariant ${inv.id}: declares no severity (invariant-shape)`,
        );
      }
      const e = inv.enforcement;
      if (!e.aspirational && e.claims.length === 0) {
        err(
          'C90',
          `invariant ${inv.id}: declares no enforcement — a non-empty claim list (enforcement { kernel:C<n> … }) or the literal marker (enforcement aspirational) (invariant-shape)`,
        );
      }
      if (e.aspirational && e.claims.length > 0) {
        err(
          'C90',
          `invariant ${inv.id}: enforcement mixes the aspirational marker with ${e.claims.length} claim(s) — one or the other, never both (invariant-shape)`,
        );
      }

      // C91 — invariant-enforcement-grammar (syntax only; the smart
      // side's R38 owns target resolution).
      for (const claim of e.claims) {
        if (claim === 'aspirational') {
          err(
            'C91',
            `invariant ${inv.id}: the aspirational marker never appears inside a claims list — spell it bare (enforcement aspirational) (invariant-enforcement-grammar)`,
          );
        } else if (!CLAIM_GRAMMAR.some(re => re.test(claim))) {
          err(
            'C91',
            `invariant ${inv.id}: enforcement claim "${claim}" does not match kernel:C<n> | linker:<kebab-name> | gate:<kebab-name> (invariant-enforcement-grammar)`,
          );
        }
      }
    }
  }

  // ── C92–C93: the required test orderings (smart gap-close E10,
  // analysis/architecture-gaps-2026-07.md; the smart contract
  // data/schemas/test-sequences.yaml) ──
  // The `test_sequence` construct is the first-class replacement for the
  // hand-authored supplemental test-sequences.yaml. C92
  // test-sequence-shape: every sequence carries name, description, and a
  // non-empty steps list; every step's order is a positive integer
  // unique in the sequence; every step carries test XOR phase; role
  // appears only on test steps and only in the baseline | follow_up
  // vocabulary; depends_on is an integer. C93 test-sequence-integrity:
  // every depends_on names the order of an EARLIER step of the same
  // sequence — never itself (self-reference), never a later step
  // (forward reference), never an order no step declares. With
  // single-parent earlier-order edges a cycle is impossible by
  // construction (a cycle needs at least one non-descending edge, which
  // the per-edge checks flag), so the three explicit per-edge checks
  // subsume cycle detection. Test-ref RESOLUTION (does /conf/… name a
  // declared conformance test of the standard) is the smart-side linker
  // rule R39's job — the kernel checks syntax/shape only, exactly like
  // E9's C90/C91 vs R38 split. Packages without test sequences are
  // untouched — the loop is empty.
  {
    for (const seq of standard.testSequences ?? []) {
      // C92 — test-sequence-shape.
      if (seq.name === '') {
        err(
          'C92',
          `test_sequence ${seq.id}: declares no name — a test sequence carries a short name (test-sequence-shape)`,
        );
      }
      if (seq.description === '') {
        err(
          'C92',
          `test_sequence ${seq.id}: declares no description — a test sequence carries the ordering's prose (the default spelling inline; alternates ride text ${seq.id}.description blocks) (test-sequence-shape)`,
        );
      }
      if (seq.steps.length === 0) {
        err(
          'C92',
          `test_sequence ${seq.id}: declares no steps — a test sequence is a non-empty ordered step list (test-sequence-shape)`,
        );
      }
      const orders = new Set<number>();
      for (const step of seq.steps) {
        const at = step.order !== null ? `step ${step.order}` : 'a step';
        if (
          step.order === null ||
          !Number.isInteger(step.order) ||
          step.order < 1
        ) {
          err(
            'C92',
            `test_sequence ${seq.id}: ${at} declares no positive-integer order (got ${step.order === null ? 'none' : step.order}) — the step order is a positive integer (test-sequence-shape)`,
          );
        } else if (orders.has(step.order)) {
          err(
            'C92',
            `test_sequence ${seq.id}: step order ${step.order} is declared twice — the order is unique within the sequence (test-sequence-shape)`,
          );
        } else {
          orders.add(step.order);
        }
        if ((step.test === '') === (step.phase === '')) {
          err(
            'C92',
            `test_sequence ${seq.id}: ${at} carries ${
              step.test === ''
                ? 'neither test nor phase'
                : 'both test and phase'
            } — exactly one per step (a conformance-test reference XOR an environment-program phase) (test-sequence-shape)`,
          );
        }
        if (step.role !== '') {
          if (step.test === '') {
            err(
              'C92',
              `test_sequence ${seq.id}: ${at} declares role "${step.role}" on ${
                step.phase === ''
                  ? 'a step carrying neither test nor phase'
                  : 'a phase step'
              } — the role is meaningful on test steps only (test-sequence-shape)`,
            );
          } else if (
            !(TEST_SEQUENCE_STEP_ROLES as readonly string[]).includes(step.role)
          ) {
            err(
              'C92',
              `test_sequence ${seq.id}: ${at} declares role "${step.role}" — the vocabulary is ${TEST_SEQUENCE_STEP_ROLES.join(' | ')} (test-sequence-shape)`,
            );
          }
        }
        if (step.dependsOn !== null && !Number.isInteger(step.dependsOn)) {
          err(
            'C92',
            `test_sequence ${seq.id}: ${at} declares depends_on ${step.dependsOn} — the dependency is the integer order of an earlier step (test-sequence-shape)`,
          );
        }
      }

      // C93 — test-sequence-integrity (per-edge, explicit: no
      // self-reference, no forward reference, no dangling order).
      for (const step of seq.steps) {
        if (step.dependsOn === null || !Number.isInteger(step.dependsOn)) {
          continue; // absent, or malformed — C92 owns the shape
        }
        const at = step.order !== null ? `step ${step.order}` : 'a step';
        if (step.order !== null && step.dependsOn === step.order) {
          err(
            'C93',
            `test_sequence ${seq.id}: ${at} depends on itself — depends_on names an EARLIER step (test-sequence-integrity)`,
          );
        } else if (!orders.has(step.dependsOn)) {
          err(
            'C93',
            `test_sequence ${seq.id}: ${at} depends_on ${step.dependsOn} names no step of the sequence (test-sequence-integrity)`,
          );
        } else if (step.order !== null && step.dependsOn > step.order) {
          err(
            'C93',
            `test_sequence ${seq.id}: ${at} depends_on ${step.dependsOn} names a LATER step — a forward reference; depends_on names an EARLIER step (test-sequence-integrity)`,
          );
        }
      }
    }
  }

  // ── C147–C148: the executable test programs (smart TODO.twin-demo/03 —
  // the model-drive bindings) ──
  // The conformance test's `preparation { … }` / `stimulus { … }` facets
  // are the machine-executable half of the test declaration: the
  // preparation program (warm-up, preload discipline, zero check) and the
  // ordered measurement program (drive, argument expressions over the
  // subject's declared parameters, hold, the read's freshness bound, the
  // per-point acceptance reference). C147 test-program-shape: every
  // program entry's order is a positive integer unique in the program; a
  // preparation step carries a prose action AND/OR a drive reference; a
  // step's verify block carries read AND tolerance; a stimulus point
  // carries a drive and an acceptance reference. C148
  // test-program-duration: a hold / fresh_within value parses as a
  // duration window (the serve contract's vocabulary — shorthand 30min or
  // ISO 8601 fixed-length PT30M), and a stimulus point declares
  // fresh_within (§14.12's no-stale-semantics doctrine: a measurement
  // point's read carries its freshness bound, like C63's live bindings).
  // Drive/acceptance/tolerance REFERENCE RESOLUTION (the world-vocabulary
  // operation names, the requirement nodes) is the consumer-side
  // conformance leg's job — the kernel checks syntax/shape only (the
  // C92/C93 vs R39 split). Packages without test programs are untouched —
  // the loops are empty.
  {
    for (const ct of standard.conformanceTests ?? []) {
      const prep = ct.preparation;
      if (prep) {
        const orders = new Set<number>();
        for (const step of prep.entries) {
          const at =
            step.order !== null
              ? `preparation step ${step.order}`
              : 'a preparation step';
          if (
            step.order === null ||
            !Number.isInteger(step.order) ||
            step.order < 1
          ) {
            err(
              'C147',
              `conformance_test ${ct.id}: ${at} declares no positive-integer order (got ${step.order === null ? 'none' : step.order}) — the step order is a positive integer (test-program-shape)`,
            );
          } else if (orders.has(step.order)) {
            err(
              'C147',
              `conformance_test ${ct.id}: preparation step order ${step.order} is declared twice — the order is unique within the program (test-program-shape)`,
            );
          } else {
            orders.add(step.order);
          }
          if (step.action === '' && step.drive === '') {
            err(
              'C147',
              `conformance_test ${ct.id}: ${at} declares neither action nor drive — a preparation step carries a prose action AND/OR a drive reference (test-program-shape)`,
            );
          }
          if (
            step.verify &&
            (step.verify.read === '' || step.verify.tolerance === '')
          ) {
            err(
              'C147',
              `conformance_test ${ct.id}: ${at} declares a verify block without ${
                step.verify.read === '' ? 'read' : 'tolerance'
              } — the verification names what to read AND the tolerance reference (test-program-shape)`,
            );
          }
          if (step.hold !== '' && parseFreshnessWindow(step.hold) === null) {
            err(
              'C148',
              `conformance_test ${ct.id}: ${at} hold "${step.hold}" is not a parseable duration (shorthand 500ms/5s/1min/1h/1d or ISO 8601 with fixed-length components, e.g. PT30M) (test-program-duration)`,
            );
          }
        }
      }
      const stim = ct.stimulus;
      if (stim) {
        const orders = new Set<number>();
        for (const point of stim.entries) {
          const at =
            point.order !== null
              ? `stimulus point ${point.order}`
              : 'a stimulus point';
          if (
            point.order === null ||
            !Number.isInteger(point.order) ||
            point.order < 1
          ) {
            err(
              'C147',
              `conformance_test ${ct.id}: ${at} declares no positive-integer order (got ${point.order === null ? 'none' : point.order}) — the point order is a positive integer (test-program-shape)`,
            );
          } else if (orders.has(point.order)) {
            err(
              'C147',
              `conformance_test ${ct.id}: stimulus point order ${point.order} is declared twice — the order is unique within the program (test-program-shape)`,
            );
          } else {
            orders.add(point.order);
          }
          if (point.drive === '') {
            err(
              'C147',
              `conformance_test ${ct.id}: ${at} declares no drive — a stimulus point names the drive operation (test-program-shape)`,
            );
          }
          if (point.acceptance === '') {
            err(
              'C147',
              `conformance_test ${ct.id}: ${at} declares no acceptance — a stimulus point names the MPE/requirement node it is judged against (test-program-shape)`,
            );
          }
          if (point.hold !== '' && parseFreshnessWindow(point.hold) === null) {
            err(
              'C148',
              `conformance_test ${ct.id}: ${at} hold "${point.hold}" is not a parseable duration (shorthand 500ms/5s/1min/1h/1d or ISO 8601 with fixed-length components, e.g. PT30M) (test-program-duration)`,
            );
          }
          if (point.freshWithin === '') {
            err(
              'C148',
              `conformance_test ${ct.id}: ${at} declares no fresh_within — a measurement point's read carries its freshness bound (§14.12: no stale semantics) (test-program-duration)`,
            );
          } else if (parseFreshnessWindow(point.freshWithin) === null) {
            err(
              'C148',
              `conformance_test ${ct.id}: ${at} fresh_within "${point.freshWithin}" is not a parseable freshness window (shorthand 500ms/5s/1min/1h/1d or ISO 8601 with fixed-length components, e.g. PT5S) (test-program-duration)`,
            );
          }
        }
      }
      // The declared procedure's typed-step discipline (TODO.lang-spec/04):
      // the parse refuses the retired spellings (the corpus sweep
      // completed — v0.33.12), so every step here is typed; a duplicate
      // id makes the sequence unresolvable.
      if (ct.procedure.length > 0) {
        const ids = new Set<string>();
        for (const s of ct.procedure) {
          if (!s.id) {
            continue;
          }
          if (ids.has(s.id)) {
            err(
              'C147',
              `conformance_test ${ct.id}: procedure step "${s.id}" is declared twice — the typed ids are unique within the procedure (test-program-shape)`,
            );
          } else {
            ids.add(s.id);
          }
        }
      }
    }
  }

  // ── C94: the per-test evaluation-formula traces (smart gap-close E11,
  // analysis/architecture-gaps-2026-07.md; the smart contract
  // data/schemas/formulas-used.yaml) ──

  // ── C32–C36 + C114/C115 + C118: quantities, time, the IS↔HAS duality,
  // the v3.2 units-typed legs (check-families/quantities) ────────────
  const { kindDecl, kindOfUnit } = runQuantitiesFamily({
    standard,
    dimIds,
    attrIds,
    behaviorIds,
    symbolIds,
    err,
    warn,
  });

  // ── C124–C128: the documentary registers (smart TODO.roadmap/40 batch 4;
  // check-families/documentary-registers) ─────────────────────────────
  runDocumentaryRegistersFamily({ standard, dimIds, symbolIds, err });

  // ── C130: identity-and-aspect-references (smart TODO.roadmap/40 batch 3;
  // check-families/identity-aspects) ──────────────────────────────────
  runIdentityAspectsFamily({ standard, attrIds, dimIds, err });

  // ── C191–C193: the datum coherence (TODO.lang-gaps/04;
  // check-families/datum-coherence) ───────────────────────────────────
  runDatumCoherenceFamily({ standard, err });

  // ── C131–C133: the SSOT registers (smart TODO.roadmap/40 batch 3;
  // check-families/ssot-registers) ────────────────────────────────────
  runSsotRegistersFamily({ standard, attrIds, dimIds, err, warn });

  // ── C134–C142: the evaluation registers (smart TODO.roadmap/40
  // batches 3+5; check-families/evaluation-registers) ────────────────
  runEvaluationRegistersFamily({
    standard,
    attrIds,
    dimIds,
    testIds,
    reqIds,
    err,
    warn,
  });

  // ── C157 registry-dataclass + C143 approval-references:
  // the register-resolution mini-families
  // (check-families/registry-approvals) ───────────────────────────────
  runRegistryApprovalsFamily({ standard, err });

  // ── C74–C76: typed transition boundaries (check-families/transition-boundaries) ──
  runTransitionBoundariesFamily({ standard, kindDecl, kindOfUnit, err, warn });

  // ── C37–C41 + C95 + C109: the machine plane (check-families/state-machines) ──
  runStateMachinesFamily({ standard, err, warn });

  // ── C51–C54 + C71–C73: the coverage audits + the text metric
  // (check-families/coverage-audits) ─────────────────────────────────
  runCoverageAuditsFamily({
    dir,
    standard,
    strictness,
    symbolIds,
    attrIds,
    reqIds,
    dimIds,
    behaviorIds,
    err,
    warn,
    pushIssues: (xs: CheckIssue[]) => issues.push(...xs),
  });

  // ── C104–C108: the dataspace family (check-families/dataspaces) ──
  runDataspacesFamily({ standard, err, warn });

  // ── Finalize: the package allowlist + level severities ──
  // The allowlist (KNOWN/STALE/budget) applies to every level; --strict
  // then promotes the surviving warnings — except KNOWN issues and
  // budget-covered C51/C52 warnings (the budget is their allowance).
  const level: 'normal' | 'audit' = strictness === 'audit' ? 'audit' : 'normal';
  const { allowlist, issues: allowlistParseIssues } = loadAllowlist(dir);
  issues.push(...allowlistParseIssues);
  let finalized = applyAllowlist(
    issues,
    allowlist,
    activeRuleIds(level),
  ).issues;
  // The provider pass (composition): the KNOWN register travels with
  // the package — every provider in the `uses` closure contributes its
  // own allowlist to the diagnostics its elements carry into this
  // check. The consumer never re-authors its providers' dispositions
  // (the INHERITED-entry pattern retires here).
  if (compositionProviders.length > 0) {
    finalized = applyProviderAllowlists(
      finalized,
      compositionProviders,
      activeRuleIds(level),
    );
  }
  if (options.strict) {
    for (const i of finalized) {
      if (i.severity !== 'warning' || i.known) {
        continue;
      }
      if (BUDGETED_RULES.has(i.check) && allowlist.coverageBudget !== null) {
        continue; // the budget governs these — C55 reports the excess
      }
      if (
        TEXT_BUDGETED_RULES.has(i.check) &&
        allowlist.textCoverageBudget !== null
      ) {
        continue; // the text budget governs these — C72 reports the excess
      }
      i.severity = 'error';
    }
  }
  return finalized;
}

// ─────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────
// The workspace locator plane (TODO.lang-spec/15, PROPOSAL-model-
// separation §2a). The workspace declares the named resolution
// endpoints its packages compose through (.primmel/locators.prl, found
// by walking up from the package directory); the import carries its
// resolution in its own name (`<locator>::<id>`). Two rules:
//   C187 workspace-locator-declared — a qualified import names a
//      locator the workspace declares, and the declarations themselves
//      are well-formed (a scheme, the scheme's required facet, a name
//      declared once); the qualifier plane judges the qualified entry,
//      never C27;
//   C188 locator-credential-reference — the credentials are REFERENCES
//      ONLY (`auth env:VAR` or `auth vault:path`); an inline secret in
//      a locator is an error.
// The closure states themselves (closed / interface-closed / unresolved)
// are DATA — closureReport() classifies, the report is the license
// boundary; nothing here errors on a state.
// ─────────────────────────────────────────────────────────────────────
export function checkWorkspaceLocators(
  dir: string,
  manifest?: PackageManifest | null,
): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const err = (check: string, message: string) =>
    issues.push({ check, severity: 'error', message });

  const ws = findWorkspaceLocators(dir);
  if (ws === null) {
    // No workspace vocabulary: a qualified import has no endpoint to
    // name — declared unresolved is a workspace declaration away, never
    // a guess.
    for (const [id, locator] of Object.entries(manifest?.useLocators ?? {})) {
      err(
        'C187',
        `package "${manifest?.id ?? ''}" uses "${locator}::${id}", but no workspace locator file (.primmel/locators.prl) is in scope — the workspace declares no locator endpoint "${locator}" (workspace-locator-declared)`,
      );
    }
    return issues;
  }

  // The file's own discipline: shape (C187's declaration legs), then
  // the credential plane (C188).
  for (const i of ws.issues) {
    err(
      i.code === 'locator-credential' ? 'C188' : 'C187',
      `${i.message} (${ws.file})`,
    );
  }

  // The qualifier plane: every qualified import names a declared
  // endpoint.
  for (const [id, locator] of Object.entries(manifest?.useLocators ?? {})) {
    if (!ws.locators.some(l => l.name === locator)) {
      err(
        'C187',
        `package "${manifest?.id ?? ''}" uses "${locator}::${id}", but the workspace declares no locator endpoint "${locator}" (${ws.file}) (workspace-locator-declared)`,
      );
    }
  }

  // The closure states ride the check as data (the license boundary is
  // evidence, computed once here): a DECLARED endpoint that does not
  // reach its id is the declared unresolved state — visible as data,
  // never a crash, never silently dropped. (A bare import's miss is
  // C27's matter, the manifest-only scan or the composition error; an
  // undeclared qualifier already errored above.)
  try {
    const declared = new Set(ws.locators.map(l => l.name));
    const report = closureReport(dir);
    for (const d of report.dependencies) {
      if (
        d.state === 'unresolved' &&
        d.locator !== undefined &&
        declared.has(d.locator)
      ) {
        issues.push({
          check: 'C187',
          severity: 'warning',
          message: `package "${report.root}": dependency "${d.id}" through locator "${d.locator}" is unresolved — the endpoint is declared, no locator reaches it (the closure report carries the state)`,
        });
      }
    }
  } catch {
    // The report never throws for missing content; an unreadable ROOT
    // manifest is the load's own error, already reported.
  }

  return issues;
}

// Manifest-only resolution stopgap (TODO.roadmap/05).
//
// The shipped package.primmel declarations (uses/requires/provides) are
// enforced metadata ONLY at this level until task 13 moves content from
// textual includes to real composition: composing the real packages
// fails by design today (overlays redeclare layer content), so the
// composition rules C27–C31 cannot run on them. This lint parses the
// manifest of the package at `dir` plus the manifests of its SIBLING
// package directories (a package id resolves when a sibling manifest
// declares the same id) and verifies — WITHOUT composing content:
//   - every uses/extends entry resolves (reported under C27);
//   - the uses graph is acyclic (C29);
//   - every requires entry names a package in the uses closure or one of
//     its provides entries (C31).
// All messages carry a "(manifest-only …)" marker so CI output cannot be
// mistaken for a full composition verdict.
// ─────────────────────────────────────────────────────────────────────
export function checkManifestResolution(dir: string): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const err = (check: string, message: string) =>
    issues.push({ check, severity: 'error', message });
  const MARKER = '(manifest-only sibling resolution — no content composed)';

  let root: PackageManifest;
  try {
    root = readPackageManifest(dir);
  } catch (e) {
    err('C27', `${(e as Error).message} ${MARKER}`);
    return issues;
  }

  // The locator: sibling directories of `dir` carrying a parseable
  // package.primmel, keyed by their declared id (last wins — the sorted
  // scan keeps the choice deterministic).
  const siblings = new Map<string, PackageManifest>();
  const parent = dirname(resolve(dir));
  for (const entry of readdirSync(parent).sort()) {
    const full = join(parent, entry);
    try {
      if (!statSync(full).isDirectory()) {
        continue;
      }
      const m = readPackageManifest(full);
      siblings.set(m.id, m);
    } catch {
      // Not a package dir (no/invalid manifest) — not a resolution candidate.
    }
  }

  // Walk the uses closure over manifests only (cycle-safe), collecting
  // the packages the root transitively imports.
  const closure = new Map<string, PackageManifest>();
  const state = new Map<string, number>(); // 1 = in stack, 2 = done
  const stack: string[] = [];
  const visit = (m: PackageManifest): void => {
    state.set(m.id, 1);
    stack.push(m.id);
    for (const dep of effectiveUses(m)) {
      const c = state.get(dep) ?? 0;
      if (c === 1) {
        err(
          'C29',
          `uses cycle: ${[...stack.slice(stack.indexOf(dep)), dep].join(' → ')} — package composition must be acyclic (uses-cycle) ${MARKER}`,
        );
        continue;
      }
      if (c === 2) {
        continue;
      }
      // A locator-qualified entry (TODO.lang-spec/15) resolves through
      // the workspace's named endpoint — never the ambient sibling
      // scan; the qualifier plane (checkWorkspaceLocators) judged it.
      if (m.useLocators?.[dep] !== undefined) {
        continue;
      }
      const dm = siblings.get(dep);
      if (!dm) {
        err(
          'C27',
          `package "${m.id}" uses "${dep}", which no sibling package directory declares (uses-resolves) ${MARKER}`,
        );
        continue;
      }
      closure.set(dep, dm);
      visit(dm);
    }
    stack.pop();
    state.set(m.id, 2);
  };
  visit(root);

  // Every requires entry (of the root and of every package in its
  // closure) names a composed package id or one of its provides entries
  // — satisfied by another package, never by the requiring one itself.
  // The scoped form (`pkg:token`) matches the sibling that declares the
  // package id AND carries the token in its provides — the same
  // capability-closure semantics the composed check applies (requires
  // never content-merges; the token names the package's own surface).
  for (const m of [root, ...closure.values()]) {
    for (const req of m.requires ?? []) {
      const at = req.indexOf(':');
      const scoped =
        at > 0 ? { pkg: req.slice(0, at), token: req.slice(at + 1) } : null;
      const satisfied = scoped
        ? [...siblings.values()].some(
            other =>
              other.id === scoped.pkg &&
              (other.provides ?? []).includes(scoped.token),
          )
        : [...closure.values()].some(
            other =>
              other.id !== m.id &&
              (other.id === req || (other.provides ?? []).includes(req)),
          );
      if (!satisfied) {
        err(
          'C31',
          `package "${m.id}" requires "${req}", which no used package provides (requires-satisfied) ${MARKER}`,
        );
      }
    }
  }

  return issues;
}

/**
 * A list item's address key in a nested text path (C89): the declared
 * `name` (a form/subform field, a requirement parameter) or the declared
 * numeric position (a test-sequence step's `order`, a requirement
 * subject's `slot`) as its bare token. Keys are declared content, not
 * positional indexes — a reorder never silently re-points an address; a
 * rename breaks it loudly, which is the point (the smart-side hygiene
 * finding that motivated path addressing).
 */
/**
 * C89 — spelling-code-wellformed (TODO.roadmap/25; doctrine ch. 10 §10.7).
 *
 * Every human-readable string is spelling-coded per ISO 24229; BCP 47 is
 * not used. The kernel checks the SYNTAX layer (src/spelling.ts) —
 * register resolution (does this language/script/country/conversion
 * system exist) is the consumer's vendored-snapshot discipline:
 *
 *   - the manifest's default_spelling and declared spellings parse as
 *     spelling codes (language-script[-country][-extension]; the script
 *     is MANDATORY — a bare language code is an error), and the default
 *     belongs to the declared set;
 *   - every `text` block addresses an existing element's prose field.
 *     The address is `<element-id>.<field>` for a top-level field, or
 *     `<element-id>.<path…>.<field>` for prose NESTED inside the element
 *     (smart gap-close E13): the element is the longest dot-boundary
 *     prefix registered in the package (element ids may carry dots), an
 *     intermediate segment names a nested structure, a list item is
 *     keyed by its declared key (name/order/slot — never a positional
 *     index), and the terminal segment is a prose field. A dangling,
 *     scalar, or ambiguous segment is an error. The terminal segment's
 *     snake_case → camelCase fallback is DELIBERATE and terminal-only
 *     (TODO.v2/13 item 3b, pinned — the walk is NOT extended): the
 *     terminal draws from the FIXED prose-field vocabulary authored in
 *     snake_case (the PROSE_FIELDS set — `true_label`, `scope_note`, …)
 *     while the parsed structure holds the property camelCase
 *     (`trueLabel`, …), so the vocabulary lookup translates exactly
 *     there. Intermediate segments are not vocabulary lookups — they
 *     name nested structures by the parsed model's own property names
 *     or key list items by author-declared content (names/orders/slots)
 *     — so a case translation there would bless a second spelling of
 *     machine structure (and an ambiguity where `foo_bar` and `fooBar`
 *     collide); no shipped nested structure name needs it (the corpus
 *     legs);
 *   - every spell entry's code parses; a duplicate code within one
 *     content set is an error (use an extension to distinguish);
 *   - an entry repeating the package's default_spelling is an error —
 *     the default's value belongs inline on the element (`name "…"`);
 *   - every `via` conversion system code parses
 *     (titular:source:target:identifying); a `zz-` user-assigned code
 *     validates with a warning (user-assigned codes are not portable).
 */
// ── C153: artifact-contract-derivation (the typed kernel, clause 10) ─
// An artifact definition whose content is the projection of declared
// claims declares contract_from; the referenced set resolves, and a
// definition that restates inline fields while deriving its contract
// is the restatement the rule exists to prevent.

// ── C152: payload-typed-by-class (the typed kernel R2, clause 10) ────
// A dimension that declares payload_class types every value's
// definition: the class resolves, every payload field is a field of
// that class, and every value carries its definition — a value IS its
// definition, not a symbol pointing at a table. The attribute-side
// bridge resolves too: an attribute_definition's class reference names
// a declared class.

// ── C150/C151: the attestation's references and claim lineage ───────
// C150 attestation-references-resolve: the subject is a declared
// instance, the promise set resolves in `Subject.promise_set_id` form,
// every basis entry carries kind and id, and every claim's declaration
// and verdict references are stated. C151
// attestation-claim-lineage: every promise the certificate prints as
// mandatory must be carried by a claim — a mandatory characteristic is
// carried by lineage, never restated (clause 19).

// ── C149: closed-derivation-references-declared ─────────────────────
// The typed kernel's rule R3: a derivation expression names only
// declared definitions — declared calculations, tables, symbols,
// measurements/variables, data classes, enums, and attributes of the
// model. The checker rejects an expression that references anything
// else and names the missing declaration, so the undefined-reference
// defect class cannot be authored.

/**
 * C103 — declared-predicate (docs/primmel/18 §18.6): every ref predicate
 * resolves against the composed registry. A typo is an error, not a
 * silent new predicate. The rule only fires when the package set DECLARES
 * a registry (the codec is program-agnostic — the predicate vocabulary is
 * data, declared in the metamodel layer's predicates.prl and composed
 * through the layer includes).
 *
 * Only the refs channel is walked: the citation-kind predicates fold
 * into the legacy channels at parse (§18.4), so a predicate still
 * visible in refs is exactly the set the registry must vouch for.
 */
/**
 * C110 — term-alias-shape (MN 114 v3.2, clause 13.10.1;
 * TODO.primmel/11): the term alias family is the everyday-words →
 * defined-term bridge, so its shape is checked. Duplicate entries within
 * one list of one term are errors; an entry that merely echoes the
 * term's label is a warning (it adds no bridge). The same string in two
 * different family fields of one term — the spec's "one entry has one
 * home" error — ships as a WARNING leg during the v3.2 rollout: v2
 * content authored `alt` under the old admitted-forms semantics, where
 * an entry doubling as the term's abbreviation was legal, and the
 * shipped corpus carries exactly that debt (`alt { LC }` +
 * `abbreviations { LC }` on R 60's load-cell and mpe terms); the leg
 * tightens to the spec's error once the consumer wave re-authors the
 * family (TODO.primmel/11d). Each spelling-tagged variant list is its
 * own scope: the same string in two spellings is the variant mechanism
 * working, never a duplicate.
 */
/**
 * C111 — dimension-shape (MN 114 v3.2, clause 10.6; TODO.primmel/11):
 * the applicability dimension namespace is typed and shared, so its
 * declarations are checked. Per dimension (the instruments' inline
 * blocks AND the top-level declarations — one grammar, two placements):
 * value identifiers are unique, every `implies` target resolves inside
 * its own dimension, and the implication graph is acyclic (the
 * applicability engine walks the closure). A top-level dimension carries
 * `values` or `values_of`, never both; a `values_of` naming a register
 * the kernel does not know (the documented register is `capabilities`)
 * warns — the domain stays open, C3's value resolution skips it.
 * Namespace uniqueness: a top-level declaration colliding with an
 * instrument's inline dimension or an is_dimension attribute, or two
 * instruments declaring the same dimension id in the merged package, is
 * an error. The one tolerated overlap is the estate's mirror pattern: an
 * attribute definition declared `is_dimension true` and an instrument's
 * inline dimension carrying the SAME id are one axis declared at two
 * layers (the attribute carries the typed aspect and the enum domain,
 * the inline block the presentation) — R 144's power_supply axis is the
 * shipped precedent.
 */
/**
 * C116/C117 — the verdict chain (MN 114 v3.2, clause 11.3;
 * TODO.primmel/11): a verdict's `inputs` name the free identifiers of
 * its derivation, and an input may name another VERDICT — the
 * acceptance chain is then an explicit graph: requirement →
 * limit.accepts.verdict → the verdict's inputs (symbols and
 * sub-verdicts) → each verdict's acceptance.
 *   C116 verdict-inputs-resolve: every input resolves to a declared
 *      symbol, a test variable or observable, or another verdict.
 *   C117 verdict-chain-acyclic: the verdict→verdict graph never cycles
 *      (a consumption system traverses the chain; a cycle never
 *      terminates).
 */
/**
 * C77–C80 + C85 + C113 — edition lifecycle (TODO.roadmap/28; doctrine ch. 13
 * §13.4/§13.7) and the manifest base URN (TODO.roadmap/27). Editions are
 * packagings: the relations live on the manifest, and the checks run
 * WITHOUT composing content (the checkManifestResolution sibling
 * pattern — supersedes acyclicity is a property of the repo's manifest
 * set).
 *
 *   C77 edition-status: a current/preview edition packages the register's
 *      newest entry. (The status ENUM itself is enforced by the manifest
 *      parser, like `kind` — an unknown token is a parse error.)
 *   C78 edition-validity-window: the window is well-formed ISO 8601 and
 *      `to` is not before `from`.
 *   C79 edition-supersedes-resolves: supersedes/replaces/superseded_by
 *      targets are
 *      well-formed URNs, never the package itself; a target naming an
 *      earlier edition OF THE SAME document resolves against the edition
 *      register (warning when the register omits it); the supersedes
 *      graph over sibling manifests is acyclic.
 *   C80 edition-pin-resolves (INV-8): every instance's
 *      definition_versions pin resolves against the package's edition
 *      register (editions ∪ {version}) — under composition the union
 *      the closure explicitly declares (every provider manifest's
 *      register joins the root's, so a merged package's own instances
 *      pin against their declaring package's register) — an
 *      unresolvable pin breaks the re-execution guarantee (§13.5: after
 *      an edition change the engine must know exactly which reports
 *      re-judge).
 *   C85 baseurn-wellformed: the base URN is a well-formed IRI — it
 *      grounds every downstream IRI (the RDF projection, provenance
 *      comparisons), and the free-string field was the one manifest
 *      IRI surface nothing validated.
 *   C113 edition-lineage-coherent (v3.2, clause 9.3.1): the forward
 *      `superseded_by` edge, where declared, must agree with the
 *      successor's backward edges across the composed closure; a missing
 *      forward edge is never an error.
 */
/**
 * DFS cycle detection on an adjacency map. Returns one cycle as a node
 * path (first node repeated at the end), or null when acyclic. Used by
 * C14 on the flow graph with timer-event nodes removed — any surviving
 * cycle is an unguarded loop.
 */
/**
 * C183 — record-run-inputs (spec §10, spec#57): a record form's
 * `run_inputs { … }` names the applied-input slice the record carries,
 * and the slice is MACHINE-CHECKED end to end — every name must
 * (a) appear in the owning test's `run.inputs` (the applied-input
 * contract: a record cannot carry what the run does not apply) and
 * (b) be a field of the form's data class (the record's shape). The
 * owning test resolves through the form's conformance-process binding
 * (`conformance_process`, or each of `conformance_process_ids`); a
 * slice whose owning test resolves to nothing is an error — the
 * linkage IS the rule's point. A form declaring no slice is untouched
 * (additive; the consuming application renders the applied inputs off
 * the form alone).
 */
/**
 * C184 — field-range-order (kernel#90): a form field's scalar numeric
 * range facets (`min` / `max`, the entry-validation facet for measured
 * fields) are each a numeric literal or a `${…}` template, and a field
 * declaring BOTH bounds numerically declares an ordered range:
 * min ≤ max. Nested fields are judged with the same rule (a subform's
 * shape is the form's shape).
 */
/**
 * C185 — unitsdb-binding-coherent (kernel#87): a register unit's
 * `unitsdb { nist … unitsml … }` pin names entries in the supplied
 * UnitsDB data, and the pinned entry resolves — the decomposition to SI
 * bases terminates. The DB is authoritative for STRUCTURE while the
 * register keeps its authored conversion numbers (maps-to, never
 * imports): without a supplied DB the bindings are inert (the parse
 * owns their shape), and the authored factor/offset is never judged
 * against the DB because the interval-scale offsets (degC's 273.15)
 * live in the register, not in the DB.
 */

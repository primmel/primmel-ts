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

import { readdirSync, statSync } from 'fs';
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

import type Standard from './types/Standard';
import type { AttributeDefinition, Behavior } from './types/Subject';
import Process from './types/process';

import type { Requirement } from './types/Requirement';

import type ConformanceTest from './types/ConformanceTest';
import type Symbol from './types/Symbol';
import type { FormField } from './types/Form';
import {} from './unitsdb';

import {} from './model-diff';

import { activeRuleIds } from './check-rules';

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

import { runExpressionsFamily } from './check-families/expressions';
import { runSubjectAnatomyFamily } from './check-families/subject-anatomy';
import { runClaimPlaneFamily } from './check-families/claim-plane';
import { runRegistersFamily } from './check-families/registers';
import { runTwinMonitorsFamily } from './check-families/twin-monitors';
import { runExecutablePlaneFamily } from './check-families/executable-plane';
import { runSmartBatch2Family } from './check-families/smart-batch2';
import { runSeriesRecordsFamily } from './check-families/series-records';
import { runDppSmartFamily } from './check-families/dpp-smart';
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

  // ── the serve vocabulary + C60–C70: the twin-monitors family
  // (check-families/twin-monitors) ─────────────────────────────────────
  runTwinMonitorsFamily({
    standard,
    roleIds,
    behaviorIds,
    reqIds,
    dimIds,
    subjectIds,
    err,
    warn,
  });

  // ── C10–C26: the executable plane (check-families/executable-plane) ──
  runExecutablePlaneFamily({
    dir,
    standard,
    subjectIds,
    err,
    warn,
    resolvePackage: options.resolvePackage,
    checkOptions: options,
  });

  // ── C144–C146: the license facets (check-families/license-facets) ──
  runLicenseFacetsFamily({ standard, err });

  // ── C122/C123/C97–C99: the smart batch-2 registers
  // (check-families/smart-batch2) ─────────────────────────────────────
  runSmartBatch2Family({
    dir,
    standard,
    err,
    warn,
    resolvePackage: options.resolvePackage,
  });

  // ── C182: the series-records family (check-families/series-records) ──
  runSeriesRecordsFamily({ standard, err });

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

  // ── C86–C94 + C147–C148: the DPP + smart gap-closes
  // (check-families/dpp-smart) ────────────────────────────────────────
  runDppSmartFamily({
    standard,
    subjectIds,
    err,
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
  const strictness = options.strictness ?? 'normal';
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

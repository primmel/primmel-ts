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
//      characteristic (of the owning subject) or behavior
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
//      owning process
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
  effectiveUses,
  loadPackageWithIssues,
  readPackageManifest,
  type ResolvePackage,
} from './ser-des/package';
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
import type { ProcessParameter, ProcessStep } from './types/process';
import type { Requirement } from './types/Requirement';
import type ConformanceTest from './types/ConformanceTest';
import type { TestPrecondition } from './types/ConformanceTest';
import type Symbol from './types/Symbol';
import type { FormField } from './types/Form';
import { isDate, isDateTime, isDuration, isValidTimeValue, parseFreshnessWindow, timeInstantMs } from './time';
import { isWellFormedMapType } from './type-expr';
import { normalizeSourceRef } from './model-diff';
import {
  BUILTIN_CONNECTOR_PROFILES,
  ENDPOINT_ACCESS_SCOPES,
  ENDPOINT_OPERATION_KINDS,
} from './types/Twin';
import {
  MONITOR_ESCALATION_ACTIONS,
  MONITOR_OUTCOMES,
  MONITOR_REFSET_KINDS,
  MONITOR_STREAMS,
  type Monitor,
} from './types/Monitor';
import { extractStateGates } from './operational-state';
import { activeRuleIds } from './check-rules';
import {
  applyAllowlist,
  BUDGETED_RULES,
  loadAllowlist,
  TEXT_BUDGETED_RULES,
} from './check-allowlist';
import {
  computeTextCoverage,
  loadTextCoverageData,
  uncoveredSentenceMessage,
} from './text-coverage';

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
}

const BIND_SCOPES: Record<string, string> = {
  'family.parameters': 'family',
  'group.parameters': 'group',
  'model.parameters': 'model',
  'sample.test_context': 'sample',
};

/** Identity paths (not AttributeDefinitions — fields on the entity classes). */
const IDENTITY_PREFIXES = [
  'model.identity.',
  'model.model_designation',
  'model.hardware_revision',
  'family.family_designation',
  'manufacturer.',
  'sample.serial_number',
  'sample.sample_number',
  'sample.status',
  'sample.condition',
  'application.',
  'test_report.',
  'test_request.',
];

/** Enum-name aliases: a classification path may use the enum name while the
 *  attribute/dimension id differs (app resolves both spellings). */
const DIM_ALIASES: Record<string, string> = {
  humidity_class: 'humidity_symbol',
};

/** A bare numeric literal (same shape as ser-des/config/quantity.ts NUMERIC). */
const NUMERIC_TOKEN = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;

function isIdentityPath(path: string): boolean {
  return IDENTITY_PREFIXES.some(p => path.startsWith(p));
}

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

  // ── C27–C31: `uses` composition (TODO.roadmap/05) ──────────────────
  // Composition errors are HARD load errors (the merge cannot proceed),
  // so the loader throws CompositionError; the linter reports them as
  // rule-identified issues instead. Composition WARNINGS (unconsumed
  // provides, extends deprecation) come back in the load's issue list.
  const COMPOSITION_RULE_CHECKS: Record<string, string> = {
    'uses-resolves': 'C27',
    'uses-no-redefine': 'C28',
    'uses-cycle': 'C29',
    'requires-satisfied': 'C31',
  };
  let standard: Standard;
  try {
    const loaded = loadPackageWithIssues(dir, {
      resolvePackage: options.resolvePackage,
    });
    standard = loaded.standard;
    for (const i of loaded.issues) {
      if (i.code === 'provides-unconsumed') {
        warn('C30', i.message);
      } else if (i.code === 'extends-deprecated') {
        warn('C27', i.message);
      }
    }
  } catch (e) {
    if (e instanceof CompositionError) {
      err(COMPOSITION_RULE_CHECKS[e.rule] ?? 'C27', e.message);
      return issues;
    }
    throw e;
  }

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

  // ── C77–C80: edition lifecycle (TODO.roadmap/28, doctrine §13.4/§13.7) ──
  // Versioning relations live on the package manifest, never in subject
  // models: status/register coherence (C77), validity windows (C78),
  // supersedes/replaces resolution + acyclicity across sibling manifests
  // (C79), and the INV-8 pin — every instance's definition_versions
  // resolves against the package's edition register (C80).
  issues.push(...checkEditionLifecycle(dir, standard));

  const reqIds = new Set(
    (standard.requirements ?? []).map((r: Requirement) => r.id),
  );
  const testIds = new Set(
    (standard.conformanceTests ?? []).map((t: ConformanceTest) => t.id),
  );
  const attrIds = new Set(
    (standard.attributeDefinitions ?? []).map((a: AttributeDefinition) => a.id),
  );
  const behaviorIds = new Set(
    (standard.behaviors ?? []).map((b: Behavior) => b.id),
  );
  const subjectIds = new Set(
    (standard.subjects ?? []).map((s: Subject) => s.id),
  );
  // Observables live in the symbols registry, not the attribute layer —
  // binds_to / limit.uses may reference them (e.g. sample.test_context
  // quantities that are measured test outputs).
  const symbolIds = new Set((standard.symbols ?? []).map((s: Symbol) => s.id));
  const dimIds = new Map<string, Set<string>>();
  const dimCardinality = new Map<string, string>();
  for (const inst of standard.instruments ?? []) {
    for (const d of inst.dimensions ?? []) {
      dimIds.set(d.id, new Set(d.values.map(v => v.id)));
      if (d.cardinality) {
        dimCardinality.set(d.id, d.cardinality);
      }
    }
  }

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

  // C2 — reference targets resolve
  for (const t of standard.conformanceTests ?? []) {
    for (const target of t.targets ?? []) {
      if (!reqIds.has(target)) {
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
      } else if (!dimIds.get(dim)!.has(String(value))) {
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
        for (const v of a.values ?? []) {
          if (!dimIds.get(a.dimension)!.has(v)) {
            err(
              'C3',
              `requirement ${r.id}: applicability ${a.dimension}="${v}" not in the dimension's values`,
            );
          }
        }
        // Universal/exact matching is the set-dimension semantics — on a
        // single-cardinality dimension the selection holds at most one
        // value, so `match all` and `match exact` both reduce to plain
        // membership (equivalent to the default any). Flag the redundant
        // mode so the data author either sets the dimension's cardinality
        // or drops the mode.
        if (
          (a.match === 'all' || a.match === 'exact') &&
          dimCardinality.get(a.dimension) !== 'set'
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
  for (const t of standard.conformanceTests ?? []) {
    for (const target of t.targets ?? []) {
      covered.add(target);
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

  // C6 — subject anatomy: every aspect declared under exactly one family
  // (anatomy-family). The parser records wrong-family and undeclared
  // aspect keys on Subject.misplacedAspects; value-level markers catch
  // the two classic content confusions (a test-dependent value among
  // design parameters; a condition tier among attributes). NOTE: those
  // two value-level checks (the test-dependent marker in
  // design_parameters; condition-tier keys in has.attributes) are
  // HEURISTICS beyond the spec's literal wording — the spec mandates
  // aspect→family placement only.
  const ASPECT_FAMILY: Record<string, string> = {
    metadata: 'is',
    provenance: 'is',
    structure: 'is',
    design_parameters: 'is',
    designed_conditions: 'is',
    promises: 'is',
    artifacts: 'is',
    endpoint: 'is',
    attributes: 'has',
    dimensions: 'has',
    state: 'has',
    characteristics: 'has',
    environmental_context: 'has',
    artifact_instances: 'has',
    serve: 'has',
    behavior: 'does',
  };
  const CONDITION_TIERS = new Set(['reference', 'rated', 'limiting']);
  for (const s of standard.subjects ?? []) {
    for (const m of s.misplacedAspects ?? []) {
      const home = ASPECT_FAMILY[m.aspect];
      if (home && home !== m.family) {
        err(
          'C6',
          `subject ${s.id}: aspect "${m.aspect}" declared under family "${m.family}" — it belongs to "${home}" (anatomy-family)`,
        );
      } else if (!home) {
        err(
          'C6',
          `subject ${s.id}: undeclared aspect "${m.aspect}" in family "${m.family}" (anatomy-family)`,
        );
      }
    }
    for (const [k, v] of Object.entries(s.is.designParameters ?? {})) {
      if (/test[-_]dependent/.test(v)) {
        err(
          'C6',
          `subject ${s.id}: design parameter "${k}" is test-dependent — exhibited values belong to has.attributes (anatomy-family)`,
        );
      }
    }
    for (const k of Object.keys(s.has.attributes ?? {})) {
      if (CONDITION_TIERS.has(k)) {
        err(
          'C6',
          `subject ${s.id}: attribute "${k}" is a condition tier — designed tiers belong to is.designed_conditions (anatomy-family)`,
        );
      }
    }
    // C7 — every characteristic names its derivation from behavior I/O
    // (anatomy-characteristic-derivation).
    for (const [k, c] of Object.entries(s.has.characteristics ?? {})) {
      if (!c.derivation) {
        err(
          'C7',
          `subject ${s.id}: characteristic "${k}" names no derivation from behavior I/O (anatomy-characteristic-derivation)`,
        );
      }
    }
    // C8 — every does behavior resolves to a declared behavior
    // (anatomy-behavior-resolves).
    for (const b of s.does.behaviors ?? []) {
      if (!behaviorIds.has(b)) {
        err(
          'C8',
          `subject ${s.id}: behavior "${b}" is not a declared behavior (anatomy-behavior-resolves)`,
        );
      }
    }
    // C9 — a subject's extends target resolves to a declared subject id
    // (subject-extends-resolves). Successfully merged chains clear
    // `extends` at resolve time, so a surviving link is exactly an
    // unresolved one (missing parent, or a broken cycle).
    if (s.extends && !subjectIds.has(s.extends)) {
      warn(
        'C9',
        `subject ${s.id}: extends "${s.extends}" is not a declared subject (subject-extends-resolves)`,
      );
    }
  }

  // ── C42–C44: promises (TODO.roadmap/08) ──
  // A promise is a manufacturer claim on a characteristic or a behavior —
  // possibly envelope-shaped, possibly conditional — that evaluation
  // verifies and the certificate prints as promises-as-verified (doctrine
  // ch. 02 §2.3, ch. 15 §15.2). It is NOT a declared attribute value: a
  // claim stated as one bare parameter value stays an `origin: declared`
  // attribute (C44 enforces the distinctness).
  //
  // Verification linkage (C43): a promise may declare `verified_by`
  // requirement/test ids (their resolution is C2, above). When it does
  // not, the linter DERIVES candidates — requirements/tests binding the
  // same target: a requirement binds a characteristic target when its
  // limit.uses or a binds_to leaf names the characteristic or its symbol,
  // and binds a behavior target via a `…behaviors.<id>` binds_to path; a
  // test binds a target when it targets a binding requirement, names the
  // target in an acceptance criterion/variable/observable, or (behaviors)
  // is listed in the behavior's own verified_by. No verification declared
  // or derived is a warning at authoring.
  const requirementBindsPromiseTarget = (
    r: Requirement,
    names: Set<string>,
  ): boolean => {
    for (const u of r.limit?.uses ?? []) {
      const leaf = u.split('.').pop() ?? u;
      if (names.has(u) || names.has(leaf)) {
        return true;
      }
    }
    for (const p of r.bindsTo ?? []) {
      const leaf = String(p).split('.').pop() ?? '';
      if (names.has(leaf)) {
        return true;
      }
    }
    return false;
  };
  const testBindsPromiseTarget = (
    t: ConformanceTest,
    names: Set<string>,
    boundReqs: Set<string>,
  ): boolean => {
    for (const target of t.targets ?? []) {
      if (boundReqs.has(target)) {
        return true;
      }
    }
    for (const ac of t.acceptanceCriteria ?? []) {
      if (names.has(ac.item)) {
        return true;
      }
    }
    for (const v of t.variables ?? []) {
      if (names.has(v.name)) {
        return true;
      }
    }
    for (const o of t.observables ?? []) {
      if (names.has(o.name)) {
        return true;
      }
    }
    return false;
  };
  for (const s of standard.subjects ?? []) {
    // Characteristics of THIS subject (extends chains already merged):
    // name → symbol, both spellings legal in promise targets/derivations.
    const characteristicSymbols = new Map<string, string>();
    for (const [k, c] of Object.entries(s.has.characteristics ?? {})) {
      characteristicSymbols.set(k, c.symbol ?? '');
    }
    // Bare-value targets (C44): declared attribute values — attribute
    // definitions, the subject's design parameters, its has.attributes.
    const bareValueTargets = new Set<string>([
      ...attrIds,
      ...Object.keys(s.is.designParameters ?? {}),
      ...Object.keys(s.has.attributes ?? {}),
    ]);
    for (const p of s.is.promises ?? []) {
      const label =
        p.id ||
        (p.statement.length > 40
          ? p.statement.slice(0, 37) + '…'
          : p.statement);
      // C2 — declared verified_by ids must resolve to a requirement or a
      // conformance test (same discipline as behavior verified_by).
      for (const v of p.verifiedBy ?? []) {
        if (!reqIds.has(v) && !testIds.has(v)) {
          err(
            'C2',
            `subject ${s.id}: promise "${label}" verified_by "${v}" is not a declared requirement or conformance test`,
          );
        }
      }
      if (!p.target) {
        // Statement-only shorthand: no target to derive verification
        // against — unless verified_by is declared, the promise is
        // unverifiable (C43, warning at authoring).
        if ((p.verifiedBy ?? []).length === 0) {
          warn(
            'C43',
            `subject ${s.id}: promise "${label}" has no target and no verified_by — it is unverifiable; give it a characteristic/behavior target or declare the verifying requirement/test (promise-verifiable)`,
          );
        }
        continue;
      }
      const isCharacteristic = characteristicSymbols.has(p.target);
      const isBehavior = behaviorIds.has(p.target);
      if (!isCharacteristic && !isBehavior) {
        if (bareValueTargets.has(p.target)) {
          // C44 (narrowed) — the crime is RESTATING a bare value as a
          // claim, not TARGETING an attribute: fire only when the promise
          // merely restates the declared attribute value — a bare
          // quantity level with no conditions and no verification
          // linkage. A genuine claim ABOUT an attribute (conditioned,
          // envelope/range, symbolic level, or verified) is legal; a
          // characteristic/behavior name wins the collision (above).
          const restatesBareValue =
            p.level?.kind === 'quantity' &&
            p.conditions === '' &&
            (p.verifiedBy ?? []).length === 0;
          if (restatesBareValue) {
            err(
              'C44',
              `subject ${s.id}: promise "${label}" only restates the declared attribute value "${p.target}" — a promise claims a characteristic or behavior (optionally conditioned); bare values stay origin: declared attributes (promise-not-bare-value)`,
            );
          }
        } else {
          // C42 — the target resolves to nothing the subject can claim.
          err(
            'C42',
            `subject ${s.id}: promise "${label}" target "${p.target}" is not a declared characteristic or behavior (promise-target-resolves)`,
          );
        }
        continue;
      }
      if ((p.verifiedBy ?? []).length > 0) {
        continue; // verification declared — C43 silent
      }
      // C43 — derive the verifying requirements/tests from the target.
      const names = new Set<string>([p.target]);
      if (isCharacteristic) {
        const sym = characteristicSymbols.get(p.target);
        if (sym) {
          names.add(sym);
        }
      }
      const boundReqs = new Set<string>();
      for (const r of standard.requirements ?? []) {
        if (requirementBindsPromiseTarget(r, names)) {
          boundReqs.add(r.id);
        }
      }
      const boundTests = new Set<string>();
      for (const t of standard.conformanceTests ?? []) {
        if (testBindsPromiseTarget(t, names, boundReqs)) {
          boundTests.add(t.id);
        }
      }
      if (isBehavior) {
        const b = (standard.behaviors ?? []).find(x => x.id === p.target);
        for (const tid of b?.verifiedBy ?? []) {
          boundTests.add(tid);
        }
      }
      if (boundReqs.size === 0 && boundTests.size === 0) {
        warn(
          'C43',
          `subject ${s.id}: promise "${label}" declares no verified_by and no requirement/test binds its target "${p.target}" — declare the verifying requirement or test (promise-verifiable)`,
        );
      }
    }
  }

  // ── C45–C47: artifacts (TODO.roadmap/09 — gap audit G2) ──
  // An artifact is a required OUTPUT OF THE SUBJECT (the instrument) — not
  // a record of the test. artifact_definition (IS: content contract +
  // produced-when) is referenced from the subject's is.artifacts slot;
  // artifact_instance (HAS/evidence: one produced output checked against
  // the contract) from has.artifact_instances.
  const artifactDefs = new Map(
    (standard.artifactDefinitions ?? []).map(d => [d.id, d]),
  );
  const artifactInstIds = new Set(
    (standard.artifactInstances ?? []).map(a => a.id),
  );

  // C45 — artifact-def-contract: the content contract is well-formed.
  for (const d of standard.artifactDefinitions ?? []) {
    const c = d.contentContract;
    if (c.fields.length === 0) {
      err(
        'C45',
        `artifact definition ${d.id}: content contract declares no fields — a definition must contract SOME content (artifact-def-contract)`,
      );
    }
    const seenFields = new Set<string>();
    for (const f of c.fields) {
      if (seenFields.has(f.name)) {
        err(
          'C45',
          `artifact definition ${d.id}: duplicate contract field "${f.name}" (artifact-def-contract)`,
        );
      }
      seenFields.add(f.name);
      if (!f.type) {
        err(
          'C45',
          `artifact definition ${d.id}: contract field "${f.name}" has no type — fields are named AND typed (artifact-def-contract)`,
        );
      }
    }
    for (const m of c.media) {
      if (!seenFields.has(m.field)) {
        err(
          'C45',
          `artifact definition ${d.id}: media entry refines "${m.field}", which is not a declared contract field (artifact-def-contract)`,
        );
      }
    }
    const pw = d.producedWhen;
    const KNOWN_PRODUCED_WHEN = new Set([
      'per_measurement',
      'per_interval',
      'on_event',
    ]);
    if (!KNOWN_PRODUCED_WHEN.has(pw.kind)) {
      err(
        'C45',
        `artifact definition ${d.id}: produced_when "${pw.kind}" is not one of per_measurement | per_interval | on_event (artifact-def-contract)`,
      );
    } else if (pw.kind === 'per_interval' && !isDuration(pw.interval ?? '')) {
      err(
        'C45',
        `artifact definition ${d.id}: produced_when per_interval "${pw.interval ?? ''}" is not an ISO-8601 duration (artifact-def-contract)`,
      );
    } else if (pw.kind === 'on_event' && !pw.event) {
      err(
        'C45',
        `artifact definition ${d.id}: produced_when on_event names no event (artifact-def-contract)`,
      );
    }
  }

  // C46 — artifact-instance-resolves: subject slots resolve; an instance's
  // `of` resolves; its content satisfies the contract; produced-when is
  // satisfiable by the linking run/report.
  for (const t of standard.conformanceTests ?? []) {
    for (const a of t.producesArtifacts ?? []) {
      if (!artifactDefs.has(a)) {
        err(
          'C46',
          `conformance test ${t.id}: produces_artifacts "${a}" is not a declared artifact_definition (artifact-instance-resolves)`,
        );
      }
    }
  }
  for (const s of standard.subjects ?? []) {
    for (const a of s.is.artifacts ?? []) {
      if (!artifactDefs.has(a)) {
        err(
          'C46',
          `subject ${s.id}: is.artifacts entry "${a}" is not a declared artifact_definition (artifact-instance-resolves)`,
        );
      }
    }
    for (const a of s.has.artifactInstances ?? []) {
      if (!artifactInstIds.has(a)) {
        err(
          'C46',
          `subject ${s.id}: has.artifact_instances entry "${a}" is not a declared artifact_instance (artifact-instance-resolves)`,
        );
      }
    }
  }
  for (const a of standard.artifactInstances ?? []) {
    const def = artifactDefs.get(a.of);
    if (!def) {
      err(
        'C46',
        `artifact instance ${a.id}: of "${a.of}" is not a declared artifact_definition (artifact-instance-resolves)`,
      );
      continue; // no contract to check the content against
    }
    if (!a.by) {
      err(
        'C46',
        `artifact instance ${a.id}: no producer (by) — an artifact instance is unattributable without its producing subject (artifact-instance-resolves)`,
      );
    }
    const contractFields = new Map(
      def.contentContract.fields.map(f => [f.name, f]),
    );
    for (const key of Object.keys(a.content)) {
      if (!contractFields.has(key)) {
        err(
          'C46',
          `artifact instance ${a.id}: content field "${key}" is not in the contract of ${def.id} (artifact-instance-resolves)`,
        );
      }
    }
    for (const [name, f] of contractFields) {
      if (!f.optional && !(name in a.content)) {
        err(
          'C46',
          `artifact instance ${a.id}: required contract field "${name}" of ${def.id} is not populated (artifact-instance-resolves)`,
        );
      }
    }
    // produced-when leg: per_measurement means the instance exists BY a
    // measurement — an instance linking no run/report cannot demonstrate
    // the produced-when rule is satisfied.
    if (def.producedWhen.kind === 'per_measurement' && a.links.length === 0) {
      err(
        'C46',
        `artifact instance ${a.id}: ${def.id} is produced per_measurement but the instance links no run/report — link the producing measurement run or report (artifact-instance-resolves)`,
      );
    }
  }

  // C47 — artifact-evidence-separation (the MECE firewall): an artifact is
  // an output OF the instrument; an EvidenceRecord is a record OF the test.
  // No artifact contract field name may double as a test-run record slot
  // (conformance-test variable/observable, form field) — a collision means
  // the instrument's output is being duplicated into an evidence-record
  // shape (or test-run evidence is being passed off as the artifact).
  const evidenceSlots = new Map<string, string>(); // name → where declared
  for (const t of standard.conformanceTests ?? []) {
    for (const v of t.variables ?? []) {
      if (v.name && !evidenceSlots.has(v.name)) {
        evidenceSlots.set(v.name, `a variable of conformance test ${t.id}`);
      }
    }
    for (const o of t.observables ?? []) {
      if (o.name && !evidenceSlots.has(o.name)) {
        evidenceSlots.set(o.name, `an observable of conformance test ${t.id}`);
      }
    }
  }
  const collectFormFieldNames = (
    fields: ReadonlyArray<FormField>,
    formId: string,
  ): void => {
    for (const f of fields) {
      if (f.name && !evidenceSlots.has(f.name)) {
        evidenceSlots.set(f.name, `a field of form ${formId}`);
      }
      collectFormFieldNames(f.fields ?? [], formId);
    }
  };
  for (const form of standard.forms ?? []) {
    collectFormFieldNames(form.fields ?? [], form.id);
  }
  for (const d of standard.artifactDefinitions ?? []) {
    for (const f of d.contentContract.fields) {
      const where = evidenceSlots.get(f.name);
      if (where) {
        err(
          'C47',
          `artifact definition ${d.id}: contract field "${f.name}" is also ${where} — an artifact is an output OF the instrument, not a record OF the test; keep artifact content out of evidence-record shapes (and vice versa) (artifact-evidence-separation)`,
        );
      }
    }
  }

  // ── C48–C50: characteristics (TODO.roadmap/10) ──────────────────────
  // Characteristics are the quantitative interface of the subject
  // (doctrine ch. 02 §2.7): DEFINED in the primary model (the subject's
  // has.characteristics), referenced everywhere else — promises claim
  // them, requirements constrain them, tests compute them, verdicts
  // judge them.

  // C48 — characteristic-one-home: once a standard declares subject
  // characteristics (the primary-model register), a `verdict` construct
  // carrying its own `derive` defines a verdict-quantity derivation
  // OUTSIDE the primary model — the one-home violation the OIML SMART
  // linker's verdict-no-shadow / verdict-restatement rules guard,
  // re-pointed at the new home. Packages without subject characteristics
  // (the v2 instrument trees, whose verdict registry is the
  // specification-side transport of model/characteristics.yaml) stay
  // silent: the rule fires only where a primary-model characteristic
  // register exists.
  const anySubjectCharacteristics = (standard.subjects ?? []).some(
    s => Object.keys(s.has.characteristics ?? {}).length > 0,
  );
  if (anySubjectCharacteristics) {
    for (const v of standard.verdicts ?? []) {
      if (v.derive) {
        err(
          'C48',
          `verdict ${v.id}: carries a derivation outside the primary model — a verdict quantity derives ONCE in the subject's has.characteristics and is referenced everywhere else (characteristic-one-home)`,
        );
      }
    }
  }

  // C49 — characteristic-behavior-link: a characteristic's behavior ref
  // resolves to a declared behavior (closing the
  // behavior→I/O→characteristic chain).
  for (const s of standard.subjects ?? []) {
    for (const [k, c] of Object.entries(s.has.characteristics ?? {})) {
      if (c.behavior && !behaviorIds.has(c.behavior)) {
        err(
          'C49',
          `subject ${s.id}: characteristic "${k}" behavior "${c.behavior}" is not a declared behavior (characteristic-behavior-link)`,
        );
      }
    }
  }

  // C50 — characteristic-derivation-inputs: the identifiers an ocl{…}
  // derivation reads resolve to the subject's quantitative vocabulary —
  // self.<p> reads against the subject's parameters (design parameters,
  // has.attributes, attribute definitions); bare names against the
  // behavior-I/O vocabulary (the standard's symbols — the observables
  // measured of the behavior — plus attribute definitions and the
  // subject's parameters). Prose derivations are not machine-checkable
  // and are skipped.
  const OCL_KEYWORDS = new Set([
    'self',
    'and',
    'or',
    'xor',
    'not',
    'implies',
    'true',
    'false',
    'null',
    'if',
    'then',
    'else',
    'endif',
    'let',
    'in',
    'invalid',
  ]);
  const derivationReads = (
    derivation: string,
  ): { selfReads: string[]; bareReads: string[] } => {
    const body = derivation
      .trim()
      .replace(/^ocl\{/, '')
      .replace(/\}$/, '');
    const selfReads: string[] = [];
    const bareReads: string[] = [];
    for (const m of body.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) {
      const id = m[0];
      if (OCL_KEYWORDS.has(id)) {
        continue;
      }
      const idx = m.index ?? 0;
      const rest = body.slice(idx + id.length);
      if (rest.trimStart().startsWith('(')) {
        continue;
      } // function call
      const before = body.slice(0, idx);
      if (before.endsWith('self.')) {
        selfReads.push(id);
      } else if (before.endsWith('.')) {
        continue; // navigation segment into a resolved root
      } else {
        bareReads.push(id);
      }
    }
    return { selfReads, bareReads };
  };
  for (const s of standard.subjects ?? []) {
    const subjectParams = new Set<string>([
      ...Object.keys(s.is.designParameters ?? {}),
      ...Object.keys(s.has.attributes ?? {}),
      ...attrIds,
    ]);
    const ioVocabulary = new Set<string>([
      ...symbolIds,
      ...attrIds,
      ...Object.keys(s.is.designParameters ?? {}),
      ...Object.keys(s.has.attributes ?? {}),
    ]);
    for (const [k, c] of Object.entries(s.has.characteristics ?? {})) {
      if (!/^ocl\{[\s\S]*\}$/.test(c.derivation.trim())) {
        continue;
      }
      const { selfReads, bareReads } = derivationReads(c.derivation);
      for (const id of selfReads) {
        if (!subjectParams.has(id)) {
          err(
            'C50',
            `subject ${s.id}: characteristic "${k}" derivation reads self.${id}, which is not a declared subject parameter (design parameter, has.attribute, or attribute definition) — in \`${c.derivation}\` (characteristic-derivation-inputs)`,
          );
        }
      }
      for (const id of bareReads) {
        if (!ioVocabulary.has(id)) {
          err(
            'C50',
            `subject ${s.id}: characteristic "${k}" derivation reads "${id}", which is not a declared symbol, attribute, or subject parameter (behavior I/O) — in \`${c.derivation}\` (characteristic-derivation-inputs)`,
          );
        }
      }
    }
  }

  // ── C58: activity-kind-resolves (TODO.roadmap/39) ─────────────────
  // A process's `activity_kind { … }` classifies it against the ISO/IEC
  // 17000 functional-approach activity taxonomy (selection; determination
  // — testing/inspection/audit/validation/verification/peer assessment;
  // review; decision; attestation — declaration/certification/
  // accreditation; surveillance …). Classification, not inheritance —
  // multi-kind is deliberate (ISO/IEC 17065 §7.4 "evaluation" = selection
  // + determination). Every tagged kind must resolve against a declared
  // activity_archetype register WHEN ONE IS IN SCOPE (composed via uses);
  // the rule stays silent in a register-less package — classification is
  // opt-in and a register-less tree cannot adjudicate. The register's own
  // `parent` references must likewise resolve to declared archetypes.
  // Mirror of the OIML SMART linker's R23 activity-kind-resolves.
  const activityArchetypeIds = new Set(
    (standard.activityArchetypes ?? []).map(a => a.id),
  );
  if (activityArchetypeIds.size > 0) {
    // The register's own parent references resolve within the register.
    for (const a of standard.activityArchetypes ?? []) {
      if (a.parent !== '' && !activityArchetypeIds.has(a.parent)) {
        err(
          'C58',
          `activity_archetype ${a.id}: parent "${a.parent}" is not a declared activity archetype (activity-kind-resolves)`,
        );
      }
    }
    for (const p of standard.processes ?? []) {
      for (const kind of p.activityKinds ?? []) {
        if (!activityArchetypeIds.has(kind)) {
          err(
            'C58',
            `process ${p.id}: activity_kind "${kind}" is not a declared activity archetype (activity-kind-resolves)`,
          );
        }
      }
    }
  }

  // ── C59: segregation-members-resolve (TODO.roadmap/39b) ────────────
  // A process's `segregation { constraint … }` declares the ISO/IEC 17065
  // role-segregation constraints as first-class structure (7.5.1 reviewer
  // ∉ evaluation, 7.6.2 decider ∉ evaluation, 7.13.5 complaint resolution
  // ∉ case activities, 7.13.6/4.2.10 consultancy bars). Well-formedness:
  // (a) every pair member resolves to a declared process id or the
  // reserved `case_personnel` token (the personnel involved in the
  // certification activities of the case a complaint relates to); (b) the
  // two members are distinct; (c) the owning process is a member of its
  // own pair; (d) the kind is declared. Pair members are process ids,
  // never roles — a scheme may bind one role to evaluation, review AND
  // decision, so the norms quantify over process involvement. Per-
  // assignment runtime enforcement is the platform's business (task 44).
  // Mirror of the OIML SMART linker's R24 abstract-process-segregation.
  {
    const SEGREGATION_CASE_PERSONNEL = 'case_personnel';
    const segregationProcessIds = new Set(
      (standard.processes ?? []).map(p => p.id),
    );
    for (const p of standard.processes ?? []) {
      for (const s of p.segregation ?? []) {
        if (
          s.kind !== 'case_personnel_disjoint' &&
          s.kind !== 'consultancy_bar'
        ) {
          err(
            'C59',
            `process ${p.id}: segregation constraint "${s.id}" declares kind "${s.kind || '(none)'}" — valid kinds: case_personnel_disjoint, consultancy_bar (segregation-members-resolve)`,
          );
          continue;
        }
        if (s.kind === 'case_personnel_disjoint') {
          if (s.pair.length !== 2) {
            err(
              'C59',
              `process ${p.id}: segregation constraint "${s.id}" is case_personnel_disjoint but declares ${s.pair.length} pair members — exactly two are required (segregation-members-resolve)`,
            );
            continue;
          }
          const [a, b] = s.pair;
          if (a === b) {
            err(
              'C59',
              `process ${p.id}: segregation constraint "${s.id}" declares "${a}" disjoint from itself — the two personnel sets must be distinct (segregation-members-resolve)`,
            );
          }
          for (const member of [a, b]) {
            if (
              member !== SEGREGATION_CASE_PERSONNEL &&
              !segregationProcessIds.has(member)
            ) {
              err(
                'C59',
                `process ${p.id}: segregation constraint "${s.id}" names pair member "${member}", which is not a declared process (nor the reserved "${SEGREGATION_CASE_PERSONNEL}" token) (segregation-members-resolve)`,
              );
            }
          }
          if (a !== p.id && b !== p.id) {
            err(
              'C59',
              `process ${p.id}: segregation constraint "${s.id}" is declared on process "${p.id}" but neither pair member is "${p.id}" — the constrained process owns its segregation constraints (segregation-members-resolve)`,
            );
          }
        }
      }
    }
  }

  // ── C84: constraint-shape (TODO.roadmap/51 — BUG.R60-SSOT gap 7) ─────
  // The subject-intrinsic constraint's DECLARATION shape — the kernel
  // mirror of the OIML SMART constraints.yaml schema
  // (data/schemas/constraints.yaml; the resolution legs stay smart-side
  // as linker rule R32 constraint-references): the stereotype is always
  // «inv» (the subject's declaration-level invariant; requirements are
  // the «req» counterpart), the check is ONE OCL boolean expression, the
  // violation_meaning is REQUIRED (the judgment records what a violation
  // means, never a bare id), and on_violation is invalid (void
  // measurement) or indeterminate (the declaration cannot be judged) —
  // never a fail. A declared source names both doc and clause (clause-URN
  // provenance). Duplicate constraint ids are the parse-time duplicate-id
  // rule, not a C84 leg.
  {
    const OCL_CHECK = /^ocl\{[\s\S]*\}$/;
    for (const c of standard.constraints ?? []) {
      if (c.stereotype !== 'inv') {
        err(
          'C84',
          `constraint ${c.id}: stereotype "${c.stereotype || '(none)'}" — a constraint is always «inv», the subject's declaration-level invariant (constraint-shape)`,
        );
      }
      if (!OCL_CHECK.test(c.check)) {
        err(
          'C84',
          `constraint ${c.id}: check is not one OCL boolean expression ocl{…} over the subject's declared anatomy (constraint-shape)`,
        );
      }
      if (!c.violationMeaning || c.violationMeaning.trim() === '') {
        err(
          'C84',
          `constraint ${c.id}: violation_meaning is required — the invalidated judgment records what the violation means, never a bare id (constraint-shape)`,
        );
      }
      if (c.onViolation !== 'invalid' && c.onViolation !== 'indeterminate') {
        err(
          'C84',
          `constraint ${c.id}: on_violation "${c.onViolation || '(none)'}" — valid: invalid (void measurement), indeterminate (the declaration cannot be judged); never a fail (constraint-shape)`,
        );
      }
      if (c.source && (!c.source.doc || !c.source.clause)) {
        err(
          'C84',
          `constraint ${c.id}: source names ${!c.source.doc ? 'no doc' : 'no clause'} — clause-URN provenance carries both doc and clause (constraint-shape)`,
        );
      }
    }
  }

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
    const roleIds = new Set((standard.roles ?? []).map(r => r.id));
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
    // subject (v3) or instrument (v2) definition.
    if (!subjectIds.has(inst.of) && !instrumentIds.has(inst.of)) {
      err(
        'C20',
        `instance ${inst.id}: of "${inst.of}" is not a declared subject or instrument (instance-of-resolves)`,
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

  // ── C32–C36: quantities, time, and the IS↔HAS duality ──
  // (TODO.roadmap/06; doctrine ch. 6). Coherence is judged on quantity
  // KINDS — resolved through the package's quantity_registers — never on
  // unit strings.
  const kindDecl = new Map<string, string>(); // kind id → register id
  for (const reg of standard.quantityRegisters ?? []) {
    for (const k of reg.kinds) {
      if (!kindDecl.has(k.id)) {
        kindDecl.set(k.id, reg.id);
      }
    }
  }
  const unitToKind = new Map<string, string>(); // unit id|symbol → kind id
  const unitHome = new Map<string, string>(); // unit id|symbol → register id
  const registersExist = (standard.quantityRegisters ?? []).length > 0;
  for (const reg of standard.quantityRegisters ?? []) {
    for (const u of reg.units) {
      // C33 — the unit's kind must resolve across the package's registers.
      if (!kindDecl.has(u.kind)) {
        err(
          'C33',
          `quantity_register ${reg.id}: unit "${u.id}" declares kind "${u.kind}", which no quantity_register declares (quantity-coherence)`,
        );
      }
      // C33 — no cross-register redefinition: a rec EXTENDS the register
      // with domain units; it never redefines an existing entry.
      for (const key of new Set([u.id, u.symbol].filter(s => s))) {
        const prior = unitHome.get(key);
        if (prior !== undefined) {
          err(
            'C33',
            `quantity_register ${reg.id}: unit "${u.id}" ("${key}") redefines a unit already declared by register "${prior}" — a package extends the register, it never redefines entries (quantity-coherence)`,
          );
        } else {
          unitHome.set(key, reg.id);
          unitToKind.set(key, u.kind);
        }
      }
    }
  }
  const kindOfUnit = (unit: string | undefined): string | undefined =>
    unit === undefined ? undefined : unitToKind.get(unit.trim());

  // C32 — INV-1: no bare numbers. A value stated for a declared physical
  // quantity (the attribute definition carries a unit, declares a
  // quantity_kind, or is typed QuantityValue) must itself carry a unit.
  // An empty-string unit token counts as bare, not as unit'd.
  const attrDefs = standard.attributeDefinitions ?? [];
  const isPhysicalAttr = (def: AttributeDefinition): boolean =>
    def.unit !== '' ||
    def.quantityKind !== '' ||
    def.valueType === 'QuantityValue';
  const physicalFacet = (def: AttributeDefinition): string =>
    def.unit !== ''
      ? `unit "${def.unit}"`
      : def.valueType === 'QuantityValue'
        ? 'value_type QuantityValue'
        : `quantity_kind ${def.quantityKind}`;
  for (const inst of standard.instances ?? []) {
    const planes: Array<'attributes' | 'testContext'> = [
      'attributes',
      'testContext',
    ];
    for (const plane of planes) {
      for (const [key, v] of Object.entries(inst.has?.[plane] ?? {})) {
        const def = attrDefs.find(a => a.id === key);
        if (!def) {
          continue; // C17 reports the undeclared attribute
        }
        if (isPhysicalAttr(def) && (v.unit ?? '') === '') {
          err(
            'C32',
            `instance ${inst.id}: attribute "${key}" is a declared physical quantity (` +
              physicalFacet(def) +
              `) but the stated value is a bare number — INV-1: no bare numbers (inv1-no-bare-quantity)`,
          );
        }
        // C33 (warning leg) — a stated unit no register declares is
        // unmapped (doctrine §6.8: unmapped units are warnings). An empty
        // unit token is bare (C32 above), not unmapped.
        if (
          v.unit !== undefined &&
          v.unit !== '' &&
          registersExist &&
          kindOfUnit(v.unit) === undefined
        ) {
          warn(
            'C33',
            `instance ${inst.id}: attribute "${key}" carries unit "${v.unit}", which no quantity_register declares (quantity-coherence)`,
          );
        }
        // C33 — stated kind vs the definition's declared kind: an explicit
        // `kind` on the value, or the stated unit's kind, must agree with
        // the attribute definition's quantity_kind / declared unit's kind.
        const statedKind = v.quantityKind ?? kindOfUnit(v.unit);
        if (def.quantityKind && statedKind && statedKind !== def.quantityKind) {
          err(
            'C33',
            `instance ${inst.id}: attribute "${key}" (kind ${def.quantityKind}) stated with ` +
              (v.quantityKind
                ? `kind "${v.quantityKind}"`
                : `unit "${v.unit}" (kind ${statedKind})`) +
              ` — quantity kinds differ (quantity-coherence)`,
          );
        } else if (!def.quantityKind && def.unit && v.unit) {
          const defKind = kindOfUnit(def.unit);
          const vKind = kindOfUnit(v.unit);
          if (defKind && vKind && defKind !== vKind) {
            err(
              'C33',
              `instance ${inst.id}: attribute "${key}" declared with unit "${def.unit}" (kind ${defKind}) stated with unit "${v.unit}" (kind ${vKind}) — quantity kinds differ (quantity-coherence)`,
            );
          }
        }
        // C35 — time-typed attributes carry ISO 8601 time values.
        if (
          ['date', 'datetime', 'duration', 'period'].includes(def.valueType) &&
          !isValidTimeValue(
            def.valueType as 'date' | 'datetime' | 'duration' | 'period',
            String(v.value),
          )
        ) {
          err(
            'C35',
            `instance ${inst.id}: attribute "${key}" (value_type ${def.valueType}) value "${String(v.value)}" is not a valid ISO 8601 ${def.valueType} (time-format)`,
          );
        }
      }
    }
  }

  // C32/C33 — condition-set entries. C32: a NUMERIC entry value (with or
  // without tolerance) stated without a unit is a bare physical quantity —
  // INV-1 (free-text values like "local ambient" stay legal). C33: the
  // entry's unit must measure the entry's declared quantity kind.
  for (const cs of standard.conditionSets ?? []) {
    for (const e of cs.entries ?? []) {
      if (!e.unit) {
        if (NUMERIC_TOKEN.test(e.value)) {
          err(
            'C32',
            `condition_set ${cs.id}: entry "${e.quantityKind}" is a bare physical value — a numeric condition value carries a unit — INV-1: no bare numbers (inv1-no-bare-quantity)`,
          );
        }
        continue;
      }
      const eKind = kindOfUnit(e.unit);
      if (eKind === undefined) {
        if (registersExist) {
          warn(
            'C33',
            `condition_set ${cs.id}: entry "${e.quantityKind}" carries unit "${e.unit}", which no quantity_register declares (quantity-coherence)`,
          );
        }
      } else if (kindDecl.has(e.quantityKind) && eKind !== e.quantityKind) {
        err(
          'C33',
          `condition_set ${cs.id}: entry "${e.quantityKind}" carries unit "${e.unit}" (kind ${eKind}) — the unit does not measure the entry's quantity kind (quantity-coherence)`,
        );
      }
    }
  }

  // C33 — symbols and verdict quantities: a declared quantity_kind must
  // agree with the declared unit's kind.
  const unitables: Array<{
    kind: string;
    id: string;
    unit: string;
    qk: string;
  }> = [
    ...(standard.symbols ?? []).map(s => ({
      kind: 'symbol',
      id: s.id,
      unit: s.unit,
      qk: s.quantityKind,
    })),
    ...(standard.verdicts ?? []).map(v => ({
      kind: 'verdict',
      id: v.id,
      unit: v.unit,
      qk: v.quantityKind,
    })),
  ];
  for (const u of unitables) {
    if (!u.unit || !u.qk) {
      continue;
    }
    const uKind = kindOfUnit(u.unit);
    if (uKind && kindDecl.has(u.qk) && uKind !== u.qk) {
      err(
        'C33',
        `${u.kind} ${u.id}: declared quantity_kind "${u.qk}" but unit "${u.unit}" measures kind ${uKind} — quantity kinds differ (quantity-coherence)`,
      );
    }
  }

  // C34 — duality-coherence: one value structure, two roles.
  for (const d of standard.duals ?? []) {
    if (d.attribute && !attrIds.has(d.attribute)) {
      err(
        'C34',
        `dual ${d.id}: attribute "${d.attribute}" is not a declared attribute_definition (duality-coherence)`,
      );
    }
    if (!d.designed && !d.exhibited) {
      err(
        'C34',
        `dual ${d.id}: neither designed nor exhibited stated — a dual pair carries at least one role (duality-coherence)`,
      );
      continue;
    }
    // Tolerance marks the designed side, uncertainty the measured side —
    // the two never merge (doctrine §6.3).
    if (d.designed?.uncertainty !== undefined) {
      warn(
        'C34',
        `dual ${d.id}: the designed role carries an uncertainty — uncertainty belongs to the measured (exhibited) side (duality-coherence)`,
      );
    }
    if (d.exhibited?.tolerance !== undefined) {
      warn(
        'C34',
        `dual ${d.id}: the exhibited role carries a tolerance — tolerance belongs to the specified (designed) side (duality-coherence)`,
      );
    }
    // INV-1: a role stated for a declared physical quantity carries a unit
    // (or an explicit quantity kind) — never a bare number. An empty-string
    // unit token counts as bare, not as unit'd.
    const dualAttr = d.attribute
      ? attrDefs.find(a => a.id === d.attribute)
      : undefined;
    if (dualAttr && isPhysicalAttr(dualAttr)) {
      for (const [role, v] of [
        ['designed', d.designed],
        ['exhibited', d.exhibited],
      ] as const) {
        if (v && (v.unit ?? '') === '' && (v.quantityKind ?? '') === '') {
          err(
            'C34',
            `dual ${d.id}: role "${role}" of attribute "${d.attribute}" is a bare physical value — INV-1 (duality-coherence)`,
          );
        }
      }
    }
    if (d.designed && d.exhibited) {
      const roleKind = (v: {
        unit?: string;
        quantityKind?: string;
      }): string | undefined => v.quantityKind ?? kindOfUnit(v.unit);
      const dk = roleKind(d.designed);
      const ek = roleKind(d.exhibited);
      for (const [role, v] of [
        ['designed', d.designed],
        ['exhibited', d.exhibited],
      ] as const) {
        if (
          v.unit !== undefined &&
          v.unit !== '' &&
          registersExist &&
          kindOfUnit(v.unit) === undefined
        ) {
          warn(
            'C34',
            `dual ${d.id}: the ${role} role carries unit "${v.unit}", which no quantity_register declares (duality-coherence)`,
          );
        }
      }
      if (dk && ek && dk !== ek) {
        err(
          'C34',
          `dual ${d.id}: designed (kind ${dk}) vs exhibited (kind ${ek}) — the two roles of one quantity must share a quantity kind (duality-coherence)`,
        );
      }
    }
  }

  // C35 — timer-event recurrence periods are ISO 8601 durations (closes
  // task 02's deferred format check; C15 checks presence only).
  for (const p of standard.processes ?? []) {
    for (const s of p.does?.steps ?? []) {
      if (s.kind === 'timer_event' && s.period && !isDuration(s.period)) {
        err(
          'C35',
          `process ${p.id}: timer_event "${s.id}" period "${s.period}" is not an ISO 8601 duration (time-format)`,
        );
      }
    }
  }

  // C36 — map<K, V> field/value types are well-formed (K = string or an
  // enum id; V a valid type expression).
  for (const c of standard.dataclasses ?? []) {
    for (const a of c.attributes ?? []) {
      if (/^map\s*</.test(a.type) && !isWellFormedMapType(a.type)) {
        err(
          'C36',
          `class ${c.id}: attribute "${a.id}" type "${a.type}" is not a well-formed map<K, V> type — K is string or an enum id, V a type expression (map-type)`,
        );
      }
    }
  }
  for (const a of standard.attributeDefinitions ?? []) {
    if (/^map\s*</.test(a.valueType) && !isWellFormedMapType(a.valueType)) {
      err(
        'C36',
        `attribute_definition ${a.id}: value_type "${a.valueType}" is not a well-formed map<K, V> type — K is string or an enum id, V a type expression (map-type)`,
      );
    }
  }

  // ── C74–C76: typed transition boundaries (TODO.roadmap/38) ──
  // Composition is sound only when the upstream output signature covers
  // the downstream input signature — the algebra's
  // ∘: t₁: A→B, t₂: B→C ⊢ t₂∘t₁: A→C. The boundary types are the task-02
  // quantity-kind/type tokens on signature parameters and registers,
  // resolved to KINDS through the package's quantity registers (a kind id
  // directly, or a unit id/symbol via its declared kind — the C33
  // machinery); unresolved tokens compare as plain type names. An untyped
  // ('') name is unconstrained and composes with anything (gradual
  // typing — untyped legacy content stays silent). With no kind
  // hierarchy, kind equality IS the covariant rule: the written/output
  // kind must equal the read/input kind.
  type ResolvedType = { kind: string } | { token: string } | null;
  const resolveParamType = (type: string): ResolvedType => {
    const t = type.trim();
    if (t === '') {
      return null;
    }
    if (kindDecl.has(t)) {
      return { kind: t };
    }
    const k = kindOfUnit(t);
    if (k !== undefined) {
      return { kind: k };
    }
    return { token: t };
  };
  const typesCompatible = (a: ResolvedType, b: ResolvedType): boolean => {
    if (a === null || b === null) {
      return true;
    }
    if ('kind' in a && 'kind' in b) {
      return a.kind === b.kind;
    }
    if ('token' in a && 'token' in b) {
      return a.token === b.token;
    }
    return false;
  };

  const processById = new Map((standard.processes ?? []).map(q => [q.id, q]));
  for (const p of standard.processes ?? []) {
    // The declared type sites of one name: signature in/out + registers.
    // A step's read/write names carry no type of their own — the boundary
    // type of a handoff is whatever the declarations say, so a name with
    // TWO conflicting declarations is the kind-incompatible boundary.
    const sites = new Map<string, Array<{ pos: string; type: string }>>();
    const noteSites =
      (pos: string) =>
      (prm: ProcessParameter): void => {
        sites.set(prm.name, [
          ...(sites.get(prm.name) ?? []),
          { pos, type: prm.type },
        ]);
      };
    (p.signature?.inputs ?? []).forEach(noteSites('signature in'));
    (p.signature?.outputs ?? []).forEach(noteSites('signature out'));
    (p.registers ?? []).forEach(noteSites('registers'));
    // The first declared site answers the caller-side type of a name
    // (C74 owns the conflict when sites disagree).
    const declaredTypeOf = (name: string): string | undefined =>
      sites.get(name)?.[0]?.type;

    // C74 — one name, ONE type (process-io-type-coherence). Runs on the
    // abstract form too: the signature/registers coherence is a
    // declaration-level fact, independent of the `does` body.
    for (const [name, decls] of sites) {
      let conflict: { a: string; b: string } | null = null;
      for (let x = 0; x < decls.length && !conflict; x++) {
        for (let y = x + 1; y < decls.length && !conflict; y++) {
          if (
            !typesCompatible(
              resolveParamType(decls[x].type),
              resolveParamType(decls[y].type),
            )
          ) {
            conflict = {
              a: `${decls[x].pos} "${decls[x].type}"`,
              b: `${decls[y].pos} "${decls[y].type}"`,
            };
          }
        }
      }
      if (conflict) {
        err(
          'C74',
          `process ${p.id}: "${name}" declares incompatible types — ${conflict.a} vs ${conflict.b} — one name, one type at a transition boundary (process-io-type-coherence)`,
        );
      }
    }

    const flow = p.does;
    if (!flow) {
      continue;
    }
    const steps = flow.steps ?? [];
    const edges = flow.edges ?? [];
    const stepById = new Map(steps.map(s => [s.id, s]));
    // Effective step I/O: the declared reads/writes plus the wait target
    // (a read) and the caller-side names of a call's `with` bindings.
    const readsOf = (s: ProcessStep): Set<string> =>
      new Set([
        ...s.reads,
        ...(s.wait ? [s.wait] : []),
        ...s.callIn.map(b => b.bind),
      ]);
    const writesOf = (s: ProcessStep): Set<string> =>
      new Set([...s.writes, ...s.callOut.map(b => b.bind)]);
    // The C12 declared-name vocabulary (registers + signature + instance
    // keys + the process's own state).
    const declaredNames = new Set<string>(['state', ...sites.keys()]);
    for (const v of Object.values(p.instances?.values ?? {})) {
      for (const k of Object.keys(v)) {
        declaredNames.add(k);
      }
    }
    // Names the process is PROVIDED with at entry: the IN parameters, the
    // per-classification instance values, and the operational state —
    // ambient HAS, available at every step without a writer in the flow.
    const provided = new Set<string>(['state']);
    for (const prm of p.signature?.inputs ?? []) {
      provided.add(prm.name);
    }
    for (const v of Object.values(p.instances?.values ?? {})) {
      for (const k of Object.keys(v)) {
        provided.add(k);
      }
    }
    // Edge conditions read self.<name> AFTER the source step completes.
    const condReads = new Map<string, Set<string>>();
    for (const e of edges) {
      const re = /\bself\.([A-Za-z_][A-Za-z0-9_]*)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(e.condition)) !== null) {
        condReads.set(e.from, (condReads.get(e.from) ?? new Set()).add(m[1]));
      }
    }

    // C75 — the step-chain dataflow covers every read: a must-analysis
    // (definitely-written on EVERY incoming path) over the flow graph,
    // computed as a shrink-to-fixpoint from the top (all written names).
    // Known limitation: the intersection runs over ALL predecessors
    // uniformly, so a parallel_gateway fork's conjunctive branches are
    // treated as alternative paths — a value written on one parallel
    // branch and read after the join (guaranteed bound under the concept
    // doc §4.2 "unordered conjunction" semantics) is reported uncovered.
    // The direction is safe (over-reports, never misses a real gap).
    // Follow-up: distinguish same-fork conjunctive predecessors (union)
    // from choice predecessors (intersection).
    const allWritten = new Set<string>();
    for (const s of steps) {
      writesOf(s).forEach(n => allWritten.add(n));
    }
    const preds = new Map<string, string[]>();
    for (const e of edges) {
      if (stepById.has(e.from) && stepById.has(e.to)) {
        preds.set(e.to, [...(preds.get(e.to) ?? []), e.from]);
      }
    }
    const availIn = new Map<string, Set<string>>();
    for (const s of steps) {
      availIn.set(s.id, new Set(allWritten));
    }
    let changed = true;
    while (changed) {
      changed = false;
      for (const s of steps) {
        const ps = preds.get(s.id) ?? [];
        let next = new Set<string>();
        if (ps.length > 0) {
          next = new Set(allWritten);
          for (const pid of ps) {
            const pOut = new Set([
              ...(availIn.get(pid) ?? []),
              ...writesOf(stepById.get(pid)!),
            ]);
            next = new Set([...next].filter(n => pOut.has(n)));
          }
        }
        const cur = availIn.get(s.id)!;
        if (next.size !== cur.size || [...next].some(n => !cur.has(n))) {
          availIn.set(s.id, next);
          changed = true;
        }
      }
    }
    const availOut = (s: ProcessStep): Set<string> =>
      new Set([...(availIn.get(s.id) ?? []), ...writesOf(s)]);

    // C75 (error leg) — a read with no writer on every incoming path and
    // no provided home reads a never-bound value. Undeclared names are
    // C12's finding, not repeated here.
    for (const s of steps) {
      for (const n of readsOf(s)) {
        if (!declaredNames.has(n) || provided.has(n)) {
          continue;
        }
        if (!(availIn.get(s.id) ?? new Set<string>()).has(n)) {
          err(
            'C75',
            `process ${p.id}: step "${s.id}" reads "${n}", which is neither an IN parameter/instance value nor written on every incoming flow path (process-flow-io-cover)`,
          );
        }
      }
      for (const n of condReads.get(s.id) ?? new Set<string>()) {
        if (!declaredNames.has(n) || provided.has(n)) {
          continue;
        }
        if (!availOut(s).has(n)) {
          err(
            'C75',
            `process ${p.id}: the edge condition at "${s.id}" reads "${n}", which is neither an IN parameter/instance value nor written on every incoming flow path (process-flow-io-cover)`,
          );
        }
      }
    }
    // C75 (warning leg) — a write with no reader is a dead output: no
    // step reads it, no edge condition references it, and no OUT
    // parameter names it. A capture-step write lands in evidence through
    // the capture form (the form is its reader), so it is never dead.
    const allRead = new Set<string>();
    for (const s of steps) {
      readsOf(s).forEach(n => allRead.add(n));
    }
    for (const names of condReads.values()) {
      names.forEach(n => allRead.add(n));
    }
    const outNames = new Set((p.signature?.outputs ?? []).map(o => o.name));
    for (const s of steps) {
      if (s.capture) {
        continue;
      }
      for (const n of writesOf(s)) {
        if (!declaredNames.has(n)) {
          continue;
        }
        if (!allRead.has(n) && !outNames.has(n)) {
          warn(
            'C75',
            `process ${p.id}: step "${s.id}" writes "${n}", which no step reads and no OUT parameter names — a dead output (process-flow-io-cover)`,
          );
        }
      }
    }

    // C76 — a `calls` step binds the callee's declared signature
    // completely and kind-compatibly (subprocess-signature-bound). The
    // callee lookup runs against the COMPOSED process set, so a call
    // across a `uses` boundary is checked the same way (post-merge).
    for (const s of steps) {
      if (!s.calls) {
        continue;
      }
      const callee = processById.get(s.calls);
      if (!callee) {
        err(
          'C76',
          `process ${p.id}: step "${s.id}" calls "${s.calls}", which is not a declared process (subprocess-signature-bound)`,
        );
        continue;
      }
      const sig = callee.signature;
      if (!sig) {
        if (s.callIn.length > 0 || s.callOut.length > 0) {
          err(
            'C76',
            `process ${p.id}: step "${s.id}" carries a with {…} binding, but "${s.calls}" declares no signature — there is nothing to bind (subprocess-signature-bound)`,
          );
        }
        continue;
      }
      const checkBindings = (
        direction: 'IN' | 'OUT',
        params: ProcessParameter[],
        bindings: { param: string; bind: string }[],
      ): void => {
        for (const prm of params) {
          const bs = bindings.filter(b => b.param === prm.name);
          if (bs.length === 0) {
            err(
              'C76',
              `process ${p.id}: step "${s.id}" calls "${callee.id}": ${direction} parameter "${prm.name}" is not ${direction === 'IN' ? 'bound from a caller register' : 'mapped back to a caller register'} — the signature binds completely (subprocess-signature-bound)`,
            );
          } else if (bs.length > 1) {
            err(
              'C76',
              `process ${p.id}: step "${s.id}" calls "${callee.id}": ${direction} parameter "${prm.name}" is bound ${bs.length} times — exactly once (subprocess-signature-bound)`,
            );
          }
        }
        for (const b of bindings) {
          const prm = params.find(q => q.name === b.param);
          if (!prm) {
            err(
              'C76',
              `process ${p.id}: step "${s.id}" calls "${callee.id}": "${b.param}" is not a declared ${direction} parameter of the callee (subprocess-signature-bound)`,
            );
            continue;
          }
          const callerType = declaredTypeOf(b.bind);
          if (callerType === undefined) {
            continue; // undeclared caller-side name — C12's finding
          }
          // IN: the caller register feeds the callee's input; OUT: the
          // callee's output lands in the caller register. Kind equality
          // both ways (no kind hierarchy — see the section header).
          if (
            !typesCompatible(
              resolveParamType(callerType),
              resolveParamType(prm.type),
            )
          ) {
            err(
              'C76',
              `process ${p.id}: step "${s.id}" calls "${callee.id}": caller "${b.bind}" (${callerType || 'untyped'}) and ${direction} parameter "${b.param}" (${prm.type || 'untyped'}) are not kind-compatible (subprocess-signature-bound)`,
            );
          }
        }
      };
      checkBindings('IN', sig.inputs, s.callIn);
      checkBindings('OUT', sig.outputs, s.callOut);
    }
  }

  // ── C37–C40: operational state machines (TODO.roadmap/07) ──
  // The subject's HAS state is a state_machine typed `kind operational`,
  // bound via has.state (C40), driven by step `fires` (C37), and gated on
  // by `self.state = #…` preconditions (C39). The operational and
  // lifecycle families are strictly disjoint (C38).
  const machineById = new Map(
    (standard.stateMachines ?? []).map(sm => [sm.entityName, sm]),
  );
  const operationalIds = new Set(
    (standard.stateMachines ?? [])
      .filter(sm => sm.kind === 'operational')
      .map(sm => sm.entityName),
  );
  const lifecycleIds = new Set(
    (standard.stateMachines ?? [])
      .filter(sm => sm.kind !== 'operational')
      .map(sm => sm.entityName),
  );

  // C38 — state-family-separation: the two families never reference each
  // other. A cascade targets an entity by name; naming the OTHER family's
  // machine is a cross-family reference, in either direction.
  for (const sm of standard.stateMachines ?? []) {
    const operational = sm.kind === 'operational';
    for (const t of sm.transitions ?? []) {
      for (const c of t.cascades ?? []) {
        if (!operational && operationalIds.has(c.targetEntity)) {
          err(
            'C38',
            `state_machine ${sm.entityName} (lifecycle): transition ${t.from} -> ${t.to} cascades into operational machine "${c.targetEntity}" — the lifecycle family never targets the operational family (state-family-separation)`,
          );
        }
        if (operational && lifecycleIds.has(c.targetEntity)) {
          err(
            'C38',
            `state_machine ${sm.entityName} (operational): transition ${t.from} -> ${t.to} cascades into lifecycle machine "${c.targetEntity}" — the operational family never targets a workflow entity's state (state-family-separation)`,
          );
        }
      }
    }
  }

  // C37 — state-fires-resolve: a step's `fires` names a transition action
  // of the process's bound machine (process `state <machineRef>`).
  // C39 — state-machine-states-referenced: a `self.state = #…` gate in a
  // precondition names a declared state of the bound machine. Both rules
  // need the binding, so a missing/dangling binding is reported once per
  // rule that actually uses it.
  for (const p of standard.processes ?? []) {
    const firedSteps = (p.does?.steps ?? []).filter(s => s.fires);
    const gates: Array<{ preconditionId: string; state: string }> = [];
    for (const pc of p.preconditions ?? []) {
      for (const g of extractStateGates(pc.check)) {
        gates.push({ preconditionId: pc.id, state: g.state });
      }
    }
    const bound = p.state ? machineById.get(p.state) : undefined;
    if (firedSteps.length > 0) {
      if (!p.state) {
        for (const s of firedSteps) {
          err(
            'C37',
            `process ${p.id}: step "${s.id}" fires "${s.fires}" but the process binds no state machine — declare state <machineRef> (state-fires-resolve)`,
          );
        }
      } else if (!bound) {
        err(
          'C37',
          `process ${p.id}: state machine "${p.state}" is not declared — step fires cannot resolve (state-fires-resolve)`,
        );
      } else {
        const actions = new Set(
          bound.transitions.map(t => t.actionName).filter(a => a),
        );
        for (const s of firedSteps) {
          if (!actions.has(s.fires)) {
            err(
              'C37',
              `process ${p.id}: step "${s.id}" fires "${s.fires}", which state machine "${p.state}" does not declare as a transition action (state-fires-resolve)`,
            );
          }
        }
      }
    }
    if (gates.length > 0) {
      if (!p.state) {
        err(
          'C39',
          `process ${p.id}: precondition "${gates[0].preconditionId}" gates on self.state but the process binds no state machine — declare state <machineRef> (state-machine-states-referenced)`,
        );
      } else if (!bound) {
        err(
          'C39',
          `process ${p.id}: state machine "${p.state}" is not declared — state gates cannot resolve (state-machine-states-referenced)`,
        );
      } else {
        const states = new Set(bound.states.map(s => s.name));
        for (const g of gates) {
          if (!states.has(g.state)) {
            err(
              'C39',
              `process ${p.id}: precondition "${g.preconditionId}" gates on #${g.state}, which is not a declared state of machine "${p.state}" (state-machine-states-referenced)`,
            );
          }
        }
      }
    }
  }

  // C40 — anatomy-state-resolves: a subject's has.state names a declared
  // state machine. A DECLARED but lifecycle machine is a cross-family
  // reference and reports under C38 instead (family separation).
  for (const s of standard.subjects ?? []) {
    if (!s.has?.state) {
      continue;
    }
    const machine = machineById.get(s.has.state);
    if (!machine) {
      err(
        'C40',
        `subject ${s.id}: has.state "${s.has.state}" is not a declared state machine — a subject's HAS state binds a declared operational machine (anatomy-state-resolves)`,
      );
    } else if (machine.kind !== 'operational') {
      err(
        'C38',
        `subject ${s.id}: has.state "${s.has.state}" is a lifecycle state machine — a subject's HAS state is its OPERATIONAL machine; workflow lifecycle state lives on entities (state-family-separation)`,
      );
    }
  }

  // C41 — precondition-on-violation-known: on_violation parses as a free
  // string (ser-des/config/process.ts, conformanceTest.ts), and the only
  // known outcome is `invalid` — a violated run-validity precondition
  // VOIDS the run; it never fails the instrument (doctrine ch. 04 §4.5).
  // Any other value warns. A STATE GATE declared `on_violation fail` is
  // always a warning naming the doctrine: the warm-up pattern voids the
  // run, and recording `fail` would state a conformity verdict the
  // instrument never earned.
  const checkOnViolation = (
    ownerKind: string,
    ownerId: string,
    pc: TestPrecondition,
  ): void => {
    if (pc.onViolation === 'invalid') {
      return;
    }
    if (pc.onViolation === 'fail' && extractStateGates(pc.check).length > 0) {
      warn(
        'C41',
        `${ownerKind} ${ownerId}: precondition "${pc.id}" declares on_violation fail — a violated run-validity precondition VOIDS the run (invalid); it never fails the instrument (doctrine ch. 04 §4.5) (precondition-on-violation-known)`,
      );
    } else {
      warn(
        'C41',
        `${ownerKind} ${ownerId}: precondition "${pc.id}" declares on_violation "${pc.onViolation}" — the only known outcome is "invalid" (precondition-on-violation-known)`,
      );
    }
  };
  for (const p of standard.processes ?? []) {
    for (const pc of p.preconditions ?? []) {
      checkOnViolation('process', p.id, pc);
    }
  }
  for (const t of standard.conformanceTests ?? []) {
    for (const pc of t.preconditions ?? []) {
      checkOnViolation('conformance_test', t.id, pc);
    }
  }

  // ── C51–C54: the coverage audits (TODO.roadmap/17, concept doc ──
  // §11.5). The aspect↔requirement↔test↔form↔verdict closure: C5 holds
  // the requirement→test link; C51/C52 hold the test→form→verdict links
  // at audit strictness; C53/C54 anchor the requirement's inputs
  // (uses bound, lookup tables) at the normal level.

  // C53 — coverage-uses-bound: every requirement limit.uses input is
  // bound. Unprefixed entries resolve against the package's quantitative
  // vocabulary (attributes, symbols, requirements, classification
  // dimensions, behaviors — bare ids or full paths, compared on the
  // leaf); `observable:`/`formula:` prefixes resolve against the symbol
  // and calculation registries. `load` is the declared per-load-point
  // free variable of the MPE lookups (deep-audit-r60 F6 — indeterminate
  // at verdict time by design). table:/profile: prefixes are C54's.
  // (Moves C2's former warning leg here and hardens it to an error: a
  // use input that binds nothing computes nothing.)
  const calcNames = new Set<string>();
  for (const c of standard.calculations ?? []) {
    if (c.id) {
      calcNames.add(c.id);
    }
    if (c.name) {
      calcNames.add(c.name);
    }
  }
  for (const r of standard.requirements ?? []) {
    for (const u of r.limit?.uses ?? []) {
      if (/^(table|profile):/.test(u)) {
        continue; // C54's lookup-table leg
      }
      if (u.startsWith('observable:')) {
        const id = u.slice('observable:'.length);
        if (!symbolIds.has(id)) {
          err(
            'C53',
            `requirement ${r.id}: limit.uses "${u}" — observable "${id}" is not a declared symbol (coverage-uses-bound)`,
          );
        }
        continue;
      }
      if (u.startsWith('formula:')) {
        const id = u.slice('formula:'.length);
        if (!calcNames.has(id)) {
          err(
            'C53',
            `requirement ${r.id}: limit.uses "${u}" — formula "${id}" is not a declared calculation (coverage-uses-bound)`,
          );
        }
        continue;
      }
      // `uses` may carry bare ids or full paths — compare the last segment.
      const leaf = u.split('.').pop() ?? u;
      if (
        !attrIds.has(leaf) &&
        !attrIds.has(u) &&
        !symbolIds.has(leaf) &&
        !symbolIds.has(u) &&
        !reqIds.has(u) &&
        !dimIds.has(leaf) &&
        !behaviorIds.has(leaf) &&
        u !== 'load'
      ) {
        err(
          'C53',
          `requirement ${r.id}: limit.uses "${u}" binds nothing — it is not a declared attribute, symbol, requirement, dimension, or behavior (coverage-uses-bound)`,
        );
      }
    }
  }

  // C54 — coverage-lookup-table-exists: lookup tables exist. The
  // table:/profile: uses prefixes and the calculations' lookup profiles
  // (lookupMPE/lookupProfile targets) resolve to declared tables and
  // their profile definitions — a dangling lookup breaks evaluation at
  // runtime. A profile reference resolves as a declared table id, as
  // `<table>.<name>` with <name> in the table's profileDefs, or as a
  // bare <name> in the `profiles` table's profileDefs.
  const tablesById = new Map((standard.tables ?? []).map(t => [t.id, t]));
  const profileRefResolves = (ref: string): boolean => {
    if (tablesById.has(ref)) {
      return true;
    }
    const dot = ref.indexOf('.');
    if (dot > 0) {
      const tbl = tablesById.get(ref.slice(0, dot));
      const name = ref.slice(dot + 1);
      if (tbl && (tbl.profileDefs ?? []).some(p => p.name === name)) {
        return true;
      }
    }
    const profiles = tablesById.get('profiles');
    return (
      profiles !== undefined &&
      (profiles.profileDefs ?? []).some(p => p.name === ref)
    );
  };
  for (const r of standard.requirements ?? []) {
    for (const u of r.limit?.uses ?? []) {
      if (u.startsWith('table:')) {
        const id = u.slice('table:'.length);
        if (!tablesById.has(id)) {
          err(
            'C54',
            `requirement ${r.id}: limit.uses "${u}" — table "${id}" is not declared (coverage-lookup-table-exists)`,
          );
        }
      } else if (u.startsWith('profile:')) {
        const ref = u.slice('profile:'.length);
        if (!profileRefResolves(ref)) {
          err(
            'C54',
            `requirement ${r.id}: limit.uses "${u}" — profile "${ref}" is not a declared table or profile definition (coverage-lookup-table-exists)`,
          );
        }
      }
    }
  }
  for (const c of standard.calculations ?? []) {
    if (c.profile && !profileRefResolves(c.profile)) {
      err(
        'C54',
        `calculation ${c.name || c.id}: lookup profile "${c.profile}" is not a declared table or profile definition (coverage-lookup-table-exists)`,
      );
    }
  }

  // C51 — coverage-test-evidence (AUDIT): a conformance test whose runs
  // leave no declared evidence — no form declares it via
  // conformance_process, it names no result_forms / report_rows, and no
  // form covers a requirement it targets. inherits_from chains inherit
  // the parent's evidence links (R 60's class-driven instances).
  if (strictness === 'audit') {
    const testById = new Map(
      (standard.conformanceTests ?? []).map(t => [t.id, t]),
    );
    const formDeclaredTests = new Set<string>();
    for (const f of standard.forms ?? []) {
      for (const pid of f.conformanceProcessIds ??
        (f.conformanceProcessId ? [f.conformanceProcessId] : [])) {
        formDeclaredTests.add(pid);
      }
    }
    const formRequirementSets = (standard.forms ?? []).map(
      f => new Set(f.requirements ?? []),
    );
    const hasEvidence = (t: ConformanceTest, seen: Set<string>): boolean => {
      if (seen.has(t.id)) {
        return false;
      }
      seen.add(t.id);
      if (formDeclaredTests.has(t.id)) {
        return true;
      }
      if ((t.resultForms ?? []).length > 0 || (t.reportRows ?? []).length > 0) {
        return true;
      }
      if (
        formRequirementSets.some(reqs =>
          (t.targets ?? []).some(target => reqs.has(target)),
        )
      ) {
        return true;
      }
      const parent = t.inheritsFrom ? testById.get(t.inheritsFrom) : undefined;
      return parent !== undefined && hasEvidence(parent, seen);
    };
    for (const t of standard.conformanceTests ?? []) {
      if (!hasEvidence(t, new Set())) {
        warn(
          'C51',
          `conformance test ${t.id}: no form records its evidence — the run happens and nothing permanent records it (coverage-test-evidence)`,
        );
      }
    }

    // C52 — coverage-form-judgment (AUDIT): a test-evidence form (one
    // binding a conformance process) carrying no judgment — no
    // pass_fail, no field evaluation/verdict, no requirements binding.
    // Documentary forms (report sections, headers) are not the closure's
    // "form" slot and stay silent.
    const formHasJudgment = (f: (typeof standard.forms)[number]): boolean => {
      if (f.passFail) {
        return true;
      }
      const walk = (fields: ReadonlyArray<FormField>): boolean =>
        fields.some(x => x.evaluation || x.verdict || walk(x.fields ?? []));
      return walk(f.fields ?? []);
    };
    for (const f of standard.forms ?? []) {
      const bindsTest =
        !!f.conformanceProcessId || (f.conformanceProcessIds ?? []).length > 0;
      if (!bindsTest) {
        continue;
      }
      if (!formHasJudgment(f) && (f.requirements ?? []).length === 0) {
        warn(
          'C52',
          `form ${f.id}: binds a conformance process but computes no judgment — evidence gathered and never weighed (coverage-form-judgment)`,
        );
      }
    }
  }

  // ── C71–C73: the normative-text coverage metric (TODO.roadmap/26, ──
  // concept doc §11.6) — layer 5 of the validation stack. The sentence
  // decomposition ships inside the package (sources-prd/*.sentences.json
  // + coverage.json); without them the metric is silent. C73 (config
  // hygiene — malformed payloads, stale allowances/adjudications) runs
  // at every level; C71 (uncovered normative sentences) is audit-level
  // and budgeted by the package's text_coverage_budget (C72, applied
  // with the allowlist below). Duplicate pairs are REPORTED by
  // `primmel check --coverage`, never auto-failed here.
  const textCoverageData = loadTextCoverageData(dir);
  issues.push(...textCoverageData.issues);
  if (textCoverageData.manifests.length > 0) {
    const textCoverage = computeTextCoverage(
      standard,
      textCoverageData.manifests,
      textCoverageData.config,
    );
    issues.push(...textCoverage.configIssues);
    if (strictness === 'audit') {
      for (const d of textCoverage.documents) {
        for (const s of d.uncoveredCounted) {
          warn('C71', uncoveredSentenceMessage(d.urn, s));
        }
      }
    }
  }

  // ── Finalize: the package allowlist + level severities ──
  // The allowlist (KNOWN/STALE/budget) applies to every level; --strict
  // then promotes the surviving warnings — except KNOWN issues and
  // budget-covered C51/C52 warnings (the budget is their allowance).
  const level: 'normal' | 'audit' = strictness === 'audit' ? 'audit' : 'normal';
  const { allowlist, issues: allowlistParseIssues } = loadAllowlist(dir);
  issues.push(...allowlistParseIssues);
  const finalized = applyAllowlist(
    issues,
    allowlist,
    activeRuleIds(level),
  ).issues;
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
  for (const m of [root, ...closure.values()]) {
    for (const req of m.requires ?? []) {
      const satisfied = [...closure.values()].some(
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
 * C77–C80 + C85 — edition lifecycle (TODO.roadmap/28; doctrine ch. 13
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
 *   C79 edition-supersedes-resolves: supersedes/replaces targets are
 *      well-formed URNs, never the package itself; a target naming an
 *      earlier edition OF THE SAME document resolves against the edition
 *      register (warning when the register omits it); the supersedes
 *      graph over sibling manifests is acyclic.
 *   C80 edition-pin-resolves (INV-8): every instance's
 *      definition_versions pin resolves against the package's edition
 *      register (editions ∪ {version}) — an unresolvable pin breaks the
 *      re-execution guarantee (§13.5: after an edition change the engine
 *      must know exactly which reports re-judge).
 *   C85 baseurn-wellformed: the base URN is a well-formed IRI — it
 *      grounds every downstream IRI (the RDF projection, provenance
 *      comparisons), and the free-string field was the one manifest
 *      IRI surface nothing validated.
 */
export function checkEditionLifecycle(
  dir: string,
  standard: Standard,
): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const err = (check: string, message: string) =>
    issues.push({ check, severity: 'error', message });
  const warn = (check: string, message: string) =>
    issues.push({ check, severity: 'warning', message });
  const m = standard.packageManifest;
  if (!m) {
    return issues;
  }
  const register = new Set<string>([
    ...(m.editions ?? []),
    ...(m.version ? [m.version] : []),
  ]);

  // C77 — a current/preview edition is the register's newest entry.
  if (m.status === 'current' || m.status === 'preview') {
    const newest = (m.editions ?? [])[0];
    if (newest !== undefined && m.version !== newest) {
      err(
        'C77',
        `package "${m.id}": status ${m.status} but version "${m.version}" is not the edition register's newest entry (${newest}) (edition-status)`,
      );
    }
  }

  // C78 — the validity window is well-formed time (§13.7).
  if (m.validity) {
    const { from, to } = m.validity;
    if (!from || !(isDate(from) || isDateTime(from))) {
      err(
        'C78',
        `package "${m.id}": validity window from "${from}" is not an ISO 8601 date/datetime (edition-validity-window)`,
      );
    }
    if (to !== undefined) {
      if (!(isDate(to) || isDateTime(to))) {
        err(
          'C78',
          `package "${m.id}": validity window to "${to}" is not an ISO 8601 date/datetime (edition-validity-window)`,
        );
      } else if (from) {
        // Compare as INSTANTS, never lexicographically: a mixed
        // date/datetime pair (from 2021-01-01T00:00:00Z, to 2021-01-01)
        // is the same moment — string order false-positives on it.
        const fromMs = timeInstantMs(from);
        const toMs = timeInstantMs(to);
        if (fromMs !== null && toMs !== null && toMs < fromMs) {
          err(
            'C78',
            `package "${m.id}": validity window to ${to} is before from ${from} (edition-validity-window)`,
          );
        }
      }
    }
  }

  // C85 — the base URN is a well-formed IRI (TODO.roadmap/27, task-27c
  // review Important 1): a scheme, then no whitespace or IRI delimiters.
  // baseUrn grounds every downstream IRI (the RDF projection's document
  // node and instance IRIs, edition-normalized provenance comparisons);
  // the field is a free string, and a malformed value (`urn:bad urn`)
  // passed check while exports emitted spec-malformed IRIREFs silently.
  // The same shape the RDF export guards on (export/rdf.ts IRI_SHAPED) —
  // duplicated as one line rather than shared across the kernel/export
  // boundary.
  if (
    m.baseUrn &&
    !/^[A-Za-z][A-Za-z0-9+.-]*:[^\s<>"{}|^`\\]*$/.test(m.baseUrn)
  ) {
    err(
      'C85',
      `package "${m.id}": baseUrn "${m.baseUrn}" is not a well-formed IRI (a scheme followed by no whitespace or IRI delimiters) (baseurn-wellformed)`,
    );
  }

  // C79 — supersedes/replaces: well-formed URNs, never self, resolving
  // against the register (same-document targets) and acyclic across the
  // repo's manifests (§13.7).
  const relations: [string, string][] = [
    ...(m.supersedes ?? []).map(t => ['supersedes', t] as [string, string]),
    ...(m.replaces ?? []).map(t => ['replaces', t] as [string, string]),
  ];
  const ownBasis = normalizeSourceRef(m.baseUrn ?? '', '').basis;
  for (const [rel, target] of relations) {
    if (!target.startsWith('urn:')) {
      err(
        'C79',
        `package "${m.id}": ${rel} "${target}" is not a URN — versioning relations name published package versions (edition-supersedes-resolves)`,
      );
      continue;
    }
    if (target === m.baseUrn) {
      err(
        'C79',
        `package "${m.id}": ${rel} ${target} — a package cannot ${rel} itself (edition-supersedes-resolves)`,
      );
      continue;
    }
    const tNorm = normalizeSourceRef(target, '');
    if (tNorm.basis === ownBasis && tNorm.edition) {
      if (!register.has(tNorm.edition)) {
        warn(
          'C79',
          `package "${m.id}": ${rel} ${target}, but the edition register { ${[...register].join(' ')} } does not list ${tNorm.edition} (edition-supersedes-resolves)`,
        );
      }
    }
  }
  if (relations.length > 0) {
    // The supersedes graph over the repo's manifests (sibling dirs keyed
    // by baseUrn) must be acyclic — no superseding oneself through a
    // chain. Edges to URNs no sibling declares are external and cannot
    // close a cycle here.
    const nodes = new Map<string, [string, string][]>(); // baseUrn → relations
    const parent = dirname(resolve(dir));
    for (const entry of readdirSync(parent).sort()) {
      const full = join(parent, entry);
      try {
        if (!statSync(full).isDirectory()) {
          continue;
        }
        const sib = readPackageManifest(full);
        const key = sib.baseUrn || sib.id;
        nodes.set(key, [
          ...(sib.supersedes ?? []).map(t => ['supersedes', t] as [string, string]),
          ...(sib.replaces ?? []).map(t => ['replaces', t] as [string, string]),
        ]);
      } catch {
        // Not a package dir — not a graph node.
      }
    }
    const adj = new Map<string, string[]>();
    for (const [baseUrn, rels] of nodes) {
      adj.set(
        baseUrn,
        rels
          .map(([, t]) => t)
          // Self-edges are reported by the dedicated self-supersession
          // check above — the cycle detector covers chains of length ≥ 2.
          .filter(t => nodes.has(t) && t !== baseUrn),
      );
    }
    const cycle = findCycle(adj);
    if (cycle) {
      err(
        'C79',
        `supersedes cycle: ${cycle.join(' → ')} — the supersedes graph must be acyclic; a package cannot supersede itself through a chain (edition-supersedes-resolves)`,
      );
    }
  }

  // C80 — INV-8: definition version pins resolve against the edition
  // register. Silent on a register-less package (nothing to resolve
  // against); C18 still requires the pins themselves.
  if (register.size > 0) {
    for (const inst of standard.instances ?? []) {
      for (const [definition, version] of Object.entries(
        inst.definitionVersions ?? {},
      )) {
        if (!register.has(version)) {
          err(
            'C80',
            `instance ${inst.id}: definition_versions pin ${definition} : "${version}" does not resolve against the edition register { ${[...register].join(' ')} } — every executed definition is version-pinned to a declared edition (INV-8) (edition-pin-resolves)`,
          );
        }
      }
    }
  }

  return issues;
}

/**
 * DFS cycle detection on an adjacency map. Returns one cycle as a node
 * path (first node repeated at the end), or null when acyclic. Used by
 * C14 on the flow graph with timer-event nodes removed — any surviving
 * cycle is an unguarded loop.
 */
function findCycle(adj: Map<string, string[]>): string[] | null {
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  const stack: string[] = [];
  let cycle: string[] | null = null;
  const visit = (n: string): void => {
    if (cycle) {
      return;
    }
    color.set(n, GRAY);
    stack.push(n);
    for (const m of adj.get(n) ?? []) {
      if (cycle) {
        return;
      }
      const c = color.get(m) ?? 0;
      if (c === GRAY) {
        cycle = [...stack.slice(stack.indexOf(m)), m];
        return;
      }
      if (c !== BLACK) {
        visit(m);
      }
    }
    stack.pop();
    color.set(n, BLACK);
  };
  for (const n of adj.keys()) {
    if (cycle) {
      break;
    }
    if (!color.has(n)) {
      visit(n);
    }
  }
  return cycle;
}

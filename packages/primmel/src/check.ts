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
import type { Requirement } from './types/Requirement';
import type ConformanceTest from './types/ConformanceTest';
import type { TestPrecondition } from './types/ConformanceTest';
import type Symbol from './types/Symbol';
import type { FormField } from './types/Form';
import { isDuration, isValidTimeValue } from './time';
import { isWellFormedMapType } from './type-expr';
import { extractStateGates } from './operational-state';
import { activeRuleIds } from './check-rules';
import {
  applyAllowlist,
  BUDGETED_RULES,
  loadAllowlist,
} from './check-allowlist';

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
    attributes: 'has',
    dimensions: 'has',
    state: 'has',
    characteristics: 'has',
    environmental_context: 'has',
    artifact_instances: 'has',
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
    for (const s of steps) {
      const ioNames = [...s.reads, ...s.writes];
      if (s.wait) {
        ioNames.push(s.wait);
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
    if (p.signature) {
      const written = new Set<string>();
      const read = new Set<string>();
      for (const s of steps) {
        s.writes.forEach(n => written.add(n));
        s.reads.forEach(n => read.add(n));
        if (s.wait) {
          read.add(s.wait);
        }
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
  const imported = new Set(
    [
      standard.packageManifest?.extends,
      ...(standard.packageManifest?.uses ?? []),
    ].filter((x): x is string => !!x),
  );
  for (const mp of allProfiles) {
    if (imported.has(mp.namespace)) {
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

// ─────────────────────────────────────────────────────────────────────
// The twin-monitors family (the serve aspect vocabulary, C60-C64 the
// twin interface, C65-C70 the monitors; TODO.roadmap/32+34, doctrine
// ch. 14 §14.4/§14.5/§14.12): the shared serve vocabulary (the aspect
// slots both the twin and the monitors read), the twin interface's
// declaration legs, and the monitor families (the state machines, the
// measurement programs, the freshness windows). The region moves
// verbatim from check.ts; the compiler and the suite pin the move.
// ─────────────────────────────────────────────────────────────────────

import { parseFreshnessWindow } from '../time';
import type Standard from '../types/Standard';
import { COMPOSITION_STATE_RULES } from '../types/Composition';
import {
  MONITOR_ESCALATION_ACTIONS,
  MONITOR_OUTCOMES,
  MONITOR_REFSET_KINDS,
  MONITOR_STREAMS,
} from '../types/Monitor';
import type { Monitor } from '../types/Monitor';
import type { Subject } from '../types/Subject';
import {
  BUILTIN_CONNECTOR_PROFILES,
  ENDPOINT_ACCESS_SCOPES,
  ENDPOINT_OPERATION_KINDS,
} from '../types/Twin';

function attrId(standard: Standard, id: string) {
  return (standard.attributeDefinitions ?? []).find(a => a.id === id);
}

export interface TwinMonitorsContext {
  standard: Standard;
  roleIds: Set<string>;
  behaviorIds: Set<string>;
  reqIds: Set<string>;
  dimIds: Map<string, Set<string> | null>;
  subjectIds: Set<string>;
  err: (check: string, message: string) => void;
  warn: (check: string, message: string) => void;
}

export function runTwinMonitorsFamily({
  standard,
  roleIds,
  behaviorIds,
  reqIds,
  dimIds,
  subjectIds,
  err,
  warn,
}: TwinMonitorsContext): void {
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
}

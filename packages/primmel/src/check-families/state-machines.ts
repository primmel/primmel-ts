// ─────────────────────────────────────────────────────────────────────
// The state-machines family (C37–C41, C95, C109; TODO.roadmap/07,
// smart gap-close E12): the machine plane. The subject's HAS state is
// a state_machine typed `kind operational`, bound via has.state (C40),
// driven by step `fires` (C37), and gated on by `self.state = #…`
// preconditions (C39); the operational and lifecycle families are
// strictly disjoint (C38); initial is required (C109); on_violation's
// only known outcome is `invalid` (C41); and a declared cascade that
// writes status on a machinated target routes through the target's own
// machine via a declared, unguarded, status-matching transition (C95's
// eight legs, analysis/cascade-machine-routing-design.md §4–§5).
//
// THE FAMILY-MODULE PATTERN (the check.ts decomposition, one family
// at a time): the family takes the context record it actually uses —
// `standard` and the two emit closures — and nothing else. The bodies
// move verbatim from check.ts; the compiler and the suite pin the
// move (entryConditionsOf moved with its only consumers).
// ─────────────────────────────────────────────────────────────────────

import { extractStateGates } from '../operational-state';
import Process, { ProcessGateEntryCondition } from '../types/process';
import type { DataClass } from '../types/data';
import type Standard from '../types/Standard';

/**
 * The process's entry-condition gate entries (TODO.lang-spec/07) — the
 * may-only-run-when declarations the state-gate (C39) and outcome (C41)
 * legs judge. The anonymous entries (the folded guard prose) ride along;
 * their prose checks never extract a state gate and their outcome is the
 * `invalid` default, so both legs stay silent on them.
 */
function entryConditionsOf(p: Process): ProcessGateEntryCondition[] {
  return (p.gates ?? []).filter(
    (g): g is ProcessGateEntryCondition => g.kind === 'entry_condition',
  );
}

export interface StateMachinesContext {
  standard: Standard;
  err: (check: string, message: string) => void;
  warn: (check: string, message: string) => void;
}

export function runStateMachinesFamily({
  standard,
  err,
  warn,
}: StateMachinesContext): void {
  // ── C37–C40: operational state machines (TODO.roadmap/07) ──
  // The subject's HAS state is a state_machine typed `kind operational`,
  // bound via has.state (C40), driven by step `fires` (C37), and gated on
  // by `self.state = #…` preconditions (C39). The operational and
  // lifecycle families are strictly disjoint (C38).
  const machineById = new Map(
    (standard.stateMachines ?? []).map(sm => [sm.entityName, sm]),
  );

  // C109 — state-machine-initial-present: the spec marks `initial`
  // required (state-machines §2: "Initial state. Required."), for both
  // families. The parser stays total (a missing line loads as ''), the
  // serializer omits the line rather than emitting the dangling keyword
  // (the editor wave-03 finding: `initial ` reparsed as
  // `initial states`), so the refusal lives here — the language's own
  // validation layer.
  for (const sm of standard.stateMachines ?? []) {
    if (!sm.initialState) {
      err(
        'C109',
        `state_machine ${sm.entityName}: declares no initial state — initial is required (state-machine-initial-present)`,
      );
    }
  }
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

  // ── C95: cascade-transition-resolve (smart gap-close E12,
  // analysis/cascade-machine-routing-design.md §4–§5) ──
  // A declared cascade that writes `status` on a machinated target must
  // ROUTE the write through a declared transition of the target's own
  // machine — the `via <transition-action>` facet — instead of
  // raw-writing past the machine (the INV-honesty leak E12 closes). The
  // machines and the entity classes are visible to the kernel in one
  // composed package (both live in oiml-smart-core — the design's §5
  // layer argument), so target resolution is intra-package. The eight
  // legs (§5, verbatim):
  //   1. via-present: a status-writing step (a mechanical `set`
  //      containing `status`, or a semantic `submit`/`lock`) on a target
  //      entity that has a declared machine declares `via` — self-steps
  //      (target == the owning machine's entity) excepted;
  //   2. via-resolves: `via` names a transition of the TARGET machine;
  //   3. via-matches-status: that transition's `to` equals the written
  //      status (`submit` ⇒ SUBMITTED, `lock` ⇒ LOCKED);
  //   4. via-unguarded: the named transition declares no `guard`;
  //   5. via-forbidden-elsewhere: no `via` on self / payload-only /
  //      create / notify / record steps or on targets with no declared
  //      machine;
  //   6. self-consistency: a self-step writing `status` writes the
  //      owning transition's `to`;
  //   7. status-is-a-state: every written status is a declared state of
  //      the target machine;
  //   8. fields-resolve: `where` field paths and `set`/`with` field
  //      names resolve against the target entity's declared fields.
  // ROLLOUT (closed 2026-07-27): leg 1 WARNS → ERRS. During the rollout
  // window the shipped corpus carried the via-less cross-entity steps
  // the design enumerated (§3.2), so leg 1 warned (the C33 de-escalation
  // precedent). The smart declaration leg (gap E12) landed the 13 via
  // facets + the test_report_recalled edge and deleted the redundant
  // step, so leg 1 is now the catalogued error and the corpus pin
  // asserts zero C95 issues of any severity. Legs 2–8 were errors from
  // day one (leg 8 by the design's explicit decision — every field the
  // shipped steps write is declared, so a miss is a genuine typo).
  {
    // The semantic side-effect actions' documented status meaning (the
    // walker's vocabulary, state-walk.ts: submit ⇒ SUBMITTED, lock ⇒
    // LOCKED); notify/record are record-creates, never status writes.
    const SEMANTIC_STATUS: Record<string, string> = {
      submit: 'SUBMITTED',
      lock: 'LOCKED',
    };
    // Entity references (machine entityName, cascade targets) spell the
    // bare entity name; class ids may carry a namespace suffix
    // (`TestAssignment#data`). Index both spellings.
    const dataclassByEntity = new Map<string, DataClass>();
    for (const c of standard.dataclasses ?? []) {
      if (!dataclassByEntity.has(c.id)) {
        dataclassByEntity.set(c.id, c);
      }
      const bare = c.id.includes('#') ? c.id.slice(0, c.id.indexOf('#')) : c.id;
      if (!dataclassByEntity.has(bare)) {
        dataclassByEntity.set(bare, c);
      }
    }
    // The left-hand field path of every comparison clause of a where
    // conjunction (`a = … AND b != …`). Interpolations (${…}) sit on the
    // right-hand side by construction; a clause this extractor cannot
    // read stays silent here — the walker's fail-closed clause parsing
    // owns the runtime judgment.
    const whereFields = (where: string): string[] => {
      const fields: string[] = [];
      for (const clause of where.split(/\s+[Aa][Nn][Dd]\s+/)) {
        const m = /^([A-Za-z_][A-Za-z0-9_.]*)\s*(?:=|!=|<=|>=|<|>)/.exec(
          clause.trim(),
        );
        if (m) {
          fields.push(m[1]);
        }
      }
      return fields;
    };
    for (const sm of standard.stateMachines ?? []) {
      for (const t of sm.transitions ?? []) {
        const transitionLabel = `${t.from} -> ${t.to}${t.actionName ? ` action ${t.actionName}` : ''}`;
        t.cascades.forEach((c, k) => {
          const stepLabel = `state_machine ${sm.entityName}: transition ${transitionLabel}: cascade ${k} (${c.targetEntity})`;
          const self = c.targetEntity === sm.entityName;
          const targetMachine = machineById.get(c.targetEntity);
          const targetClass = dataclassByEntity.get(c.targetEntity);
          const isCreate = c.create !== null;
          const semanticStatus =
            c.action !== null ? SEMANTIC_STATUS[c.action] : undefined;
          const setStatus = c.set.find(s => s.field === 'status');
          const writesStatus =
            !isCreate &&
            (semanticStatus !== undefined || setStatus !== undefined);
          const writtenStatus = semanticStatus ?? setStatus?.value ?? '';

          // Leg 1 — via-present (error severity — the rollout window
          // closed when the smart declaration leg landed: the corpus is
          // via-complete).
          if (writesStatus && targetMachine && !self && c.via === '') {
            err(
              'C95',
              `${stepLabel} writes status '${writtenStatus}' on machinated entity '${c.targetEntity}' but declares no via — a status-writing cascade routes through a declared transition of the target's machine (cascade-transition-resolve)`,
            );
          }

          // Leg 5 — via-forbidden-elsewhere; legs 2–4 — the routing
          // contract, judged only where a via is legal (one issue per
          // defect: a forbidden via reports under leg 5 only).
          if (c.via !== '') {
            if (
              self ||
              isCreate ||
              !writesStatus ||
              !targetMachine ||
              c.action === 'notify' ||
              c.action === 'record'
            ) {
              const forbidden = self
                ? "a self-step (the target is the owning machine's own entity)"
                : isCreate
                  ? 'a create step (a fresh record has no current-state hop to route)'
                  : c.action === 'notify' || c.action === 'record'
                    ? `an action ${c.action} step (a record-create, never a status hop)`
                    : !writesStatus
                      ? 'a step that writes no status (payload-only)'
                      : `a step on entity '${c.targetEntity}', which declares no state machine`;
              err(
                'C95',
                `${stepLabel} declares via '${c.via}' on ${forbidden} — via routes a status write through the target's machine and is forbidden everywhere else (cascade-transition-resolve)`,
              );
            } else {
              // Leg 2 — via-resolves. An action name is not unique
              // across a machine (the design's §4.1 evidence), so the
              // via names a CANDIDATE SET; legs 3–4 qualify it.
              const candidates = targetMachine.transitions.filter(
                tr => tr.actionName === c.via,
              );
              if (candidates.length === 0) {
                err(
                  'C95',
                  `${stepLabel} via '${c.via}' resolves to no transition of machine '${c.targetEntity}' (cascade-transition-resolve)`,
                );
              } else {
                // Leg 3 — via-matches-status: the route must land on
                // the written status.
                const landing = candidates.filter(
                  tr => tr.to === writtenStatus,
                );
                if (landing.length === 0) {
                  err(
                    'C95',
                    `${stepLabel} via '${c.via}' names no transition of machine '${c.targetEntity}' whose to is '${writtenStatus}' — the route must land on the written status (cascade-transition-resolve)`,
                  );
                } else if (landing.some(tr => tr.guard !== '')) {
                  // Leg 4 — via-unguarded: a cascade has no caller to
                  // supply computed guard values.
                  err(
                    'C95',
                    `${stepLabel} via '${c.via}' names a guarded transition of machine '${c.targetEntity}' — a cascade has no caller to supply guard values; the route must be unguarded (cascade-transition-resolve)`,
                  );
                }
              }
            }
          }

          // Leg 6 — self-consistency: the self-step's status write
          // restates the owning transition's `to` (the walker already
          // wrote it; the set block exists to carry the payload).
          if (self && writesStatus && writtenStatus !== t.to) {
            err(
              'C95',
              `${stepLabel} writes status '${writtenStatus}' on its own entity, but the owning transition's to is '${t.to}' — a self-step's status write restates the owning transition (cascade-transition-resolve)`,
            );
          }

          // Leg 7 — status-is-a-state (the typo net: "SUMBITTED" never
          // reaches runtime).
          if (writesStatus && targetMachine && writtenStatus !== '') {
            const stateNames = new Set(targetMachine.states.map(s => s.name));
            if (!stateNames.has(writtenStatus)) {
              err(
                'C95',
                `${stepLabel} writes status '${writtenStatus}', which machine '${c.targetEntity}' does not declare as a state (cascade-transition-resolve)`,
              );
            }
          }

          // Leg 8 — fields-resolve (the design's explicit error leg):
          // where paths and set/with field names against the target
          // entity's declared fields. A dotted path resolves its head
          // (the reference field); the deeper segments ride the
          // referenced entity and are the runtime's judgment.
          if (targetClass) {
            const fieldIds = new Set(targetClass.attributes.map(a => a.id));
            for (const path of whereFields(c.where)) {
              const head = path.includes('.')
                ? path.slice(0, path.indexOf('.'))
                : path;
              if (!fieldIds.has(head)) {
                err(
                  'C95',
                  `${stepLabel} where path '${path}' resolves to no declared field of entity '${c.targetEntity}' (cascade-transition-resolve)`,
                );
              }
            }
            for (const s of c.set) {
              if (!fieldIds.has(s.field)) {
                err(
                  'C95',
                  `${stepLabel} set field '${s.field}' resolves to no declared field of entity '${c.targetEntity}' (cascade-transition-resolve)`,
                );
              }
            }
            for (const key of Object.keys(c.with)) {
              if (!fieldIds.has(key)) {
                err(
                  'C95',
                  `${stepLabel} with parameter '${key}' resolves to no declared field of entity '${c.targetEntity}' (cascade-transition-resolve)`,
                );
              }
            }
          }
        });
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
    const stateGates: Array<{ entryId: string; state: string }> = [];
    for (const ec of entryConditionsOf(p)) {
      for (const g of extractStateGates(ec.check)) {
        stateGates.push({ entryId: ec.id, state: g.state });
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
    if (stateGates.length > 0) {
      if (!p.state) {
        err(
          'C39',
          `process ${p.id}: entry_condition "${stateGates[0].entryId}" gates on self.state but the process binds no state machine — declare state <machineRef> (state-machine-states-referenced)`,
        );
      } else if (!bound) {
        err(
          'C39',
          `process ${p.id}: state machine "${p.state}" is not declared — state gates cannot resolve (state-machine-states-referenced)`,
        );
      } else {
        const states = new Set(bound.states.map(s => s.name));
        for (const g of stateGates) {
          if (!states.has(g.state)) {
            err(
              'C39',
              `process ${p.id}: entry_condition "${g.entryId}" gates on #${g.state}, which is not a declared state of machine "${p.state}" (state-machine-states-referenced)`,
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
    entryName: string,
    check: string,
    onViolation: string,
  ): void => {
    if (onViolation === 'invalid') {
      return;
    }
    if (onViolation === 'fail' && extractStateGates(check).length > 0) {
      warn(
        'C41',
        `${ownerKind} ${ownerId}: ${entryName} declares on_violation fail — a violated run-validity precondition VOIDS the run (invalid); it never fails the instrument (doctrine ch. 04 §4.5) (precondition-on-violation-known)`,
      );
    } else {
      warn(
        'C41',
        `${ownerKind} ${ownerId}: ${entryName} declares on_violation "${onViolation}" — the only known outcome is "invalid" (precondition-on-violation-known)`,
      );
    }
  };
  for (const p of standard.processes ?? []) {
    for (const ec of entryConditionsOf(p)) {
      checkOnViolation(
        'process',
        p.id,
        `entry_condition "${ec.id}"`,
        ec.check,
        ec.onViolation,
      );
    }
  }
  for (const t of standard.conformanceTests ?? []) {
    for (const pc of t.preconditions ?? []) {
      checkOnViolation(
        'conformance_test',
        t.id,
        `precondition "${pc.id}"`,
        pc.check,
        pc.onViolation,
      );
    }
  }
}

/**
 * The `monitor` construct (Primmel v3, TODO.roadmap/34 — doctrine
 * ch. 14 §14.5, grammar sketch §14.11): continuous compliance. A monitor
 * is a continuous process — the tertiary tier run as a service against
 * live twins:
 *
 *   monitor fleet_watch {
 *     over { LoadCellModel }
 *     triggers { every 1h on signal artifact_arrived on change state }
 *     evaluate { requirements applicable_to(this.classification) promises all }
 *     emit { evidence -> workspace verdicts -> verdict_log }
 *     escalate { on fail { flag_certificate open_service_case } on invalid { open_service_case } }
 *   }
 *
 * The loop (§14.5), every step existing for a reason:
 *   1. TRIGGER — something says check now: a timer (every <window>), a
 *      signal (an artifact arrived), a change (a watched aspect moved).
 *      Without triggers, "continuous" has no clock.
 *   2. FETCH — the engine queries the endpoint (or receives the push);
 *      values arrive with timestamps (the gateway, TODO.roadmap/33).
 *   3. FRESHNESS — a stale value degrades the verdict to `indeterminate`,
 *      never `fail` (a network outage is not a metrological event), never
 *      a silent pass (silence is not evidence). Runtime semantics, owned
 *      by the smart app's verdict service (TODO.roadmap/32).
 *   4. EVALUATE — the requirement's OCL limit and the promise's
 *      conditions run over the fresh values — the SAME statements the lab
 *      used (INV-9); no second dialect for "online mode". The refs are
 *      applicability-expanded per twin at runtime.
 *   5. VERDICT — pass · fail · indeterminate · invalid, per requirement
 *      × twin. Invalid still means the setup was wrong; fail means the
 *      product was wrong.
 *   6. EVIDENCE — values seen, rule results, verdicts, timestamps,
 *      appended to the workspace. Facts only; permanent; every record
 *      carries definition version pins (INV-8, §14.12).
 *   7. ACT — pass: history accrues (that IS the deliverable). Fail/
 *      invalid: escalation — notify roles, flag the certificate, open a
 *      case. §14.12: a monitor without an escalation path for `fail` is
 *      a warning (linter C68).
 *
 * Surface-syntax notes (deviations from the §14.11 sketch — the chapter
 * is the spec for SEMANTICS, not for delimiters; the same convention the
 * twin constructs established): the sketch's `monitor <id> over <subject>`
 * head moves `over` INSIDE the block (the kernel's construct shape is
 * `keyword id { … }`), and the escalate action lists are `{ … }` blocks —
 * PRL id lists are brace-delimited everywhere.
 *
 * Linter rules (check.ts, family twins): C65 monitor-subject-resolves,
 * C66 monitor-trigger-wellformed, C67 monitor-evaluate-resolves,
 * C68 monitor-fail-escalation (the §14.12 warning),
 * C69 monitor-escalation-resolves, C70 monitor-emit-sinks.
 */

/** Trigger kinds (§14.5 step 1): a timer | a signal | a watched change. */
export const MONITOR_TRIGGER_KINDS = ['timer', 'signal', 'change'] as const;
export type MonitorTriggerKind = (typeof MONITOR_TRIGGER_KINDS)[number];

/**
 * One trigger of the monitor's clock. Exactly one field is populated per
 * kind (the linter's C66 enforces the shape):
 *   timer  — `every <window>`: a freshness-window duration (5s, 1h, PT1H);
 *   signal — `on signal <name>`: an external signal (an artifact arrived);
 *   change — `on change <aspect>`: a watched aspect moved (the serve
 *            aspect vocabulary of types/Twin.ts).
 */
export interface MonitorTrigger {
  kind: string;
  /** kind=timer: the recurrence window (e.g. `1h`, `PT1H`). */
  every: string;
  /** kind=signal: the signal name (e.g. artifact_arrived). */
  signal: string;
  /** kind=change: the watched aspect path (serve aspect vocabulary). */
  aspect: string;
}

/** Evaluate-selector kinds: everything | applicability-expanded | explicit. */
export const MONITOR_REFSET_KINDS = ['all', 'applicable_to', 'refs'] as const;
export type MonitorRefSetKind = (typeof MONITOR_REFSET_KINDS)[number];

/**
 * One evaluate selector (§14.5 step 4): which requirements / promises the
 * cycle judges. `all` and `applicable_to(<expr>)` expand per twin at
 * runtime (applicability-expanded — the brief); `refs` names explicit
 * requirement / promise ids (the linter's C67 resolves them).
 */
export interface MonitorRefSet {
  /** 'all' | 'applicable_to' | 'refs' (C67 flags others). */
  kind: string;
  /** kind=applicable_to: the applicability expression (e.g.
   *  this.classification). */
  expression: string;
  /** kind=refs: the explicit ids. */
  refs: string[];
}

/** The evaluate block: requirement + promise refs (§14.11). */
export interface MonitorEvaluate {
  requirements: MonitorRefSet;
  promises: MonitorRefSet;
}

/** The emitted streams (§14.5 step 6): the fact stream + the verdict log. */
export const MONITOR_STREAMS = ['evidence', 'verdicts'] as const;
export type MonitorStream = (typeof MONITOR_STREAMS)[number];

/** One emit entry: `<stream> -> <sink>` (evidence -> workspace). */
export interface MonitorEmitSink {
  /** 'evidence' | 'verdicts' (C70 flags others). */
  stream: string;
  /** The sink id (deployment-named, e.g. workspace, verdict_log). */
  target: string;
}

/** Escalation outcomes — the verdict outcomes an escalation rule binds. */
export const MONITOR_OUTCOMES = [
  'pass',
  'fail',
  'indeterminate',
  'invalid',
] as const;
export type MonitorOutcome = (typeof MONITOR_OUTCOMES)[number];

/** Escalation actions (§14.5 step 7): notify / flag certificate / open case. */
export const MONITOR_ESCALATION_ACTIONS = [
  'notify',
  'flag_certificate',
  'open_service_case',
] as const;
export type MonitorEscalationActionKind =
  (typeof MONITOR_ESCALATION_ACTIONS)[number];

/**
 * One escalation action. `notify` carries the notified role id (C69
 * resolves it against the package's roles); flag_certificate /
 * open_service_case carry none.
 */
export interface MonitorEscalationAction {
  /** 'notify' | 'flag_certificate' | 'open_service_case' (C69 flags others). */
  action: string;
  /** action=notify: the role notified (resolves against declared roles). */
  role: string;
}

/** One escalation rule: `on <outcome> { <action> [<role>] … }`. */
export interface MonitorEscalationRule {
  /** The bound verdict outcome (C69: one of MONITOR_OUTCOMES). */
  outcome: string;
  actions: MonitorEscalationAction[];
}

/**
 * monitor <id> — a continuous compliance process over a subject set
 * (§14.5/§14.11). Top-level construct: a monitor watches subjects from
 * the outside (the engine operator speaks for the standard, §14.8) — it
 * is not anatomy of the watched subject.
 */
export interface Monitor {
  id: string;
  /** The monitored subject set — subject ids (C65 resolves them). */
  over: string[];
  triggers: MonitorTrigger[];
  evaluate: MonitorEvaluate;
  emit: MonitorEmitSink[];
  escalate: MonitorEscalationRule[];
  referenceIds: string[];
}

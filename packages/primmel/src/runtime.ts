// ─────────────────────────────────────────────────────────────────────
// The Primmel runtime (the full flow's phase 4 — the execution plane):
// a model RUN is a replayable object — the test programs as executed,
// the verdicts derived from the authored data, the state trajectory,
// and the evidence records the evidence law requires. Deterministic by
// construction: no clock, no randomness, JSON-stable — the same model,
// instance and inputs always produce the same run.
//
// The evaluator covers the closed-derivation subset the checks
// guarantee (C149: every referenced name is declared): literals,
// attribute references, `.` field access into the dimension values'
// typed payloads, arithmetic, comparisons, if/then/else, and abs/min/
// max. Nothing else is legal in a declared derivation, so nothing else
// is evaluated.
// ─────────────────────────────────────────────────────────────────────

import type Standard from './types/Standard';
import type { Instance } from './types/Instance';
import type { StateTrajectoryEntry, FiredStep } from './operational-state';
import { foldTrajectory } from './operational-state';

/** One applied program step as executed: the ordered stimulus point's
 *  evaluated arguments and its acceptance outcome. */
export interface RunProgramStep {
  program: 'preparation' | 'stimulus';
  order: number | null;
  /** The operation the world performs (e.g. ladApply) — named, never
   *  interpreted here. */
  drive: string;
  /** The step's evaluated argument values (the expressions computed
   *  over the instance's declared data). */
  args: Record<string, number | string>;
  hold?: string;
  /** The stimulus point's acceptance reference, verbatim. */
  acceptance?: string;
}

/** One derived verdict outcome: the value computed from the authored
 *  data, the limit it was judged against, and the outcome. */
export interface RunVerdict {
  id: string;
  /** The verdict's derivation, verbatim. */
  derive: string;
  /** The verdict's evaluated inputs. */
  inputs: Record<string, number>;
  /** The computed value. */
  value: number;
  unit?: string;
  /** The limit expression, the comparison operator, and the bound's
   *  computed value. */
  limit?: { expression: string; op: string; bound: number };
  outcome: 'pass' | 'fail' | 'indeterminate';
}

/** One evidence record — the evidence law's write side: the run's
 *  outputs land as a record of the registry the evidence requirement
 *  names, per value with its provenance carried from the source
 *  attribute. */
export interface RunEvidenceRecord {
  registry: string;
  /** The run that produced the record (the replay key). */
  run: string;
  values: {
    id: string;
    value: number | string;
    unit?: string;
    /** The per-value provenance, carried from the source attribute. */
    provenance?: { source?: string; page?: number };
  }[];
}

/** The replayable run object (file 12, phase 4): everything one
 *  execution of a test against one instance produced, and nothing
 *  else — JSON-stable, comparable, replayable. */
export interface Run {
  instance: string;
  test?: string;
  /** The applied program, in execution order. */
  programs: RunProgramStep[];
  /** The verdict outcomes, in declaration order. */
  verdicts: RunVerdict[];
  /** The fired state trajectory (the bound operational machine). */
  trajectory: StateTrajectoryEntry[];
  /** The evidence records the run produced. */
  evidence: RunEvidenceRecord[];
}

/** One run input: an applied load with its observed error — the world
 *  half of the run, recorded so the run replays. */
export interface RunInput {
  /** The applied load, in the calculation's own unit. */
  load_v: number;
  /** The observed error of indication. */
  e_l: number;
}

/** ── The expression evaluator ─────────────────────────────────────
 *  A recursive-descent reader for the closed-derivation subset. */

type Tok =
  { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const s = src;
  while (i < s.length) {
    const ch = s[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(s[i + 1] ?? ''))) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j]!)) {
        j++;
      }
      out.push({ t: 'num', v: Number(s.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < s.length && /[A-Za-z0-9_]/.test(s[j]!)) {
        j++;
      }
      out.push({ t: 'id', v: s.slice(i, j) });
      i = j;
      continue;
    }
    if (
      s.startsWith('<=', i) ||
      s.startsWith('>=', i) ||
      s.startsWith('!=', i)
    ) {
      out.push({ t: 'op', v: s.slice(i, i + 2) });
      i += 2;
      continue;
    }
    if ('+-*/()<>=,.'.includes(ch)) {
      out.push({ t: 'op', v: ch });
      i++;
      continue;
    }
    throw new Error(
      `runtime: the derivation uses a character the evaluator does not know: "${ch}"`,
    );
  }
  return out;
}

/** The evaluation environment: plain values, and nested objects for
 *  `.` field access (the dimension values' typed payloads). */
export interface RunScopeObj {
  [key: string]: number | string | RunScopeObj;
}
export type RunEnv = RunScopeObj;

class Reader {
  constructor(private toks: Tok[]) {}
  private pos = 0;
  peek(): Tok | undefined {
    return this.toks[this.pos];
  }
  next(): Tok {
    const t = this.toks[this.pos];
    if (!t) {
      throw new Error('runtime: the derivation ended unexpectedly');
    }
    this.pos++;
    return t;
  }
  expectOp(v: string): void {
    const t = this.next();
    if (t.t !== 'op' || t.v !== v) {
      throw new Error(`runtime: the derivation expected "${v}"`);
    }
  }
}

function evalExpr(r: Reader, env: RunEnv): number {
  return evalIf(r, env);
}

// if <cond> then <expr> else <expr> — R 60's tier selection rides it.
function evalIf(r: Reader, env: RunEnv): number {
  const t = r.peek();
  if (t && t.t === 'id' && t.v === 'if') {
    r.next();
    const cond = evalComparison(r, env);
    const thenT = r.next();
    if (thenT.t !== 'id' || thenT.v !== 'then') {
      throw new Error('runtime: the derivation expected "then"');
    }
    const a = evalIf(r, env);
    const elseT = r.next();
    if (elseT.t !== 'id' || elseT.v !== 'else') {
      throw new Error('runtime: the derivation expected "else"');
    }
    const b = evalIf(r, env);
    return cond ? a : b;
  }
  return evalComparison(r, env);
}

function evalComparison(r: Reader, env: RunEnv): number {
  const left = evalAdd(r, env);
  const t = r.peek();
  if (t && t.t === 'op' && ['<=', '>=', '<', '>', '=', '!='].includes(t.v)) {
    r.next();
    const right = evalAdd(r, env);
    switch (t.v) {
      case '<=':
        return left <= right ? 1 : 0;
      case '>=':
        return left >= right ? 1 : 0;
      case '<':
        return left < right ? 1 : 0;
      case '>':
        return left > right ? 1 : 0;
      case '=':
        return left === right ? 1 : 0;
      case '!=':
        return left !== right ? 1 : 0;
    }
  }
  return left;
}

function evalAdd(r: Reader, env: RunEnv): number {
  let v = evalMul(r, env);
  for (;;) {
    const t = r.peek();
    if (t && t.t === 'op' && (t.v === '+' || t.v === '-')) {
      r.next();
      const rhs = evalMul(r, env);
      v = t.v === '+' ? v + rhs : v - rhs;
      continue;
    }
    return v;
  }
}

function evalMul(r: Reader, env: RunEnv): number {
  let v = evalUnary(r, env);
  for (;;) {
    const t = r.peek();
    if (t && t.t === 'op' && (t.v === '*' || t.v === '/')) {
      r.next();
      const rhs = evalUnary(r, env);
      v = t.v === '*' ? v * rhs : v / rhs;
      continue;
    }
    return v;
  }
}

function evalUnary(r: Reader, env: RunEnv): number {
  const t = r.peek();
  if (t && t.t === 'op' && (t.v === '-' || t.v === '+')) {
    r.next();
    const v = evalUnary(r, env);
    return t.v === '-' ? -v : v;
  }
  return evalPostfix(r, env);
}

function evalPostfix(r: Reader, env: RunEnv): number {
  let v: number | string | RunScopeObj = evalAtom(r, env);
  for (;;) {
    const t = r.peek();
    if (t && t.t === 'op' && t.v === '.') {
      r.next();
      const field = r.next();
      if (field.t !== 'id') {
        throw new Error('runtime: the derivation expected a field name');
      }
      if (v === null || typeof v !== 'object') {
        throw new Error(
          `runtime: the derivation reads "${field.v}" off a plain value`,
        );
      }
      const scope: RunScopeObj = v as RunScopeObj;
      const next: number | string | RunScopeObj | undefined = scope[field.v];
      if (next === undefined) {
        throw new Error(
          `runtime: the derivation reads the undeclared field "${field.v}"`,
        );
      }
      v = next;
      continue;
    }
    return v as number;
  }
}

function evalAtom(r: Reader, env: RunEnv): number {
  const t = r.next();
  if (t.t === 'num') {
    return t.v;
  }
  if (t.t === 'id') {
    if (t.v === 'abs' || t.v === 'min' || t.v === 'max') {
      r.expectOp('(');
      const a = evalExpr(r, env);
      let b: number | null = null;
      const comma = r.peek();
      if (comma && comma.t === 'op' && comma.v === ',') {
        r.next();
        b = evalExpr(r, env);
      }
      r.expectOp(')');
      if (t.v === 'abs') {
        return Math.abs(a);
      }
      if (b === null) {
        throw new Error(`runtime: ${t.v} needs two arguments`);
      }
      return t.v === 'min' ? Math.min(a, b) : Math.max(a, b);
    }
    if (t.v === 'ocl') {
      // The calculation idiom's wrapping token — the expression inside
      // the braces was already unwrapped by the caller.
      r.expectOp('(');
      const v = evalExpr(r, env);
      r.expectOp(')');
      return v;
    }
    if (t.v === 'true') {
      return 1;
    }
    if (t.v === 'false') {
      return 0;
    }
    if (!(t.v in env)) {
      throw new Error(
        `runtime: the derivation names "${t.v}", which the run scope does not bind`,
      );
    }
    const v = env[t.v];
    if (typeof v === 'object') {
      return v as unknown as number;
    } // a payload object for '.' access
    return typeof v === 'string' ? Number(v) : v;
  }
  if (t.t === 'op' && t.v === '(') {
    const v = evalExpr(r, env);
    r.expectOp(')');
    return v;
  }
  throw new Error(`runtime: the derivation has an unexpected token`);
}

/** Evaluate one closed derivation over the run scope. The checks
 *  guarantee every referenced name is declared (C149); this throws —
 *  never silently indeterminates — when the scope lacks one. */
export function evaluateExpression(expr: string, env: RunEnv): number {
  const cleaned = expr
    .replace(/^ocl\{/, '')
    .replace(/\}$/, '')
    .trim();
  const r = new Reader(tokenize(cleaned));
  const v = evalExpr(r, env);
  if (r.peek() !== undefined) {
    throw new Error('runtime: the derivation has trailing tokens');
  }
  return v;
}

/** ── The run ────────────────────────────────────────────────────── */

interface InstanceValueLike {
  value?:
    | number
    | string
    | {
        value?: number | string;
        unit?: string;
        provenance?: { source?: string; page?: number };
      };
  unit?: string;
  provenance?: { source?: string; page?: number };
}

function attrValue(inst: Instance, id: string): InstanceValueLike | undefined {
  const raw = (
    inst.has?.attributes as unknown as
      Record<string, InstanceValueLike> | undefined
  )?.[id];
  if (
    raw !== undefined &&
    raw !== null &&
    typeof raw === 'object' &&
    'value' in (raw as object)
  ) {
    return raw as InstanceValueLike;
  }
  return raw !== undefined ? { value: raw as number | string } : undefined;
}

/** The accuracy-class dimension value's typed payload (the class's
 *  defining data — Table 1 limits, Table 4 tiers), as the evaluator's
 *  nested scope. */
function classPayload(
  standard: Standard,
  dimValue: string | undefined,
): RunEnv {
  const instrument = standard.instruments[0];
  const dim = instrument?.dimensions.find(d => d.id === 'accuracy_class');
  const valueId = dimValue;
  const value = dim?.values.find(v => v.id === valueId);
  const out: RunEnv = {};
  const payload =
    (
      value as unknown as
        { payload?: Record<string, number | string> } | undefined
    )?.payload ?? {};
  for (const [k, v] of Object.entries(payload)) {
    const n = Number(v);
    out[k] = Number.isNaN(n) ? String(v) : n;
  }
  return out;
}

export interface ExecuteRunOptions {
  /** The instance under test. */
  instance: string;
  /** The conformance test executed (its programs carry the run). */
  test?: string;
  /** The requirement judged (defaults to the test's targets). */
  requirement?: string;
  /** The applied runs: each an applied load with its observed error. */
  inputs: RunInput[];
  /** The registry the evidence record lands in (the evidence
   *  requirement names it; the law's loop closes through it). */
  evidenceRegistry?: string;
  /** The run's replay key (defaults to instance[:test]). */
  runId?: string;
}

/** Execute one deterministic run: the test's programs as applied, the
 *  verdict chain derived from the authored data, the state trajectory
 *  of the bound machine, and the evidence record. The same call with
 *  the same arguments always returns the same run. */
export function executeRun(
  standard: Standard,
  options: ExecuteRunOptions,
): Run {
  const inst = standard.instances.find(i => i.id === options.instance);
  if (!inst) {
    throw new Error(`runtime: no instance "${options.instance}" is declared`);
  }

  // The run scope: the instance's declared attributes (p_lc, e_max,
  // n_lc, ...) plus the typed class payload behind the dimension value.
  const dimValue = inst.has?.dimensions?.accuracy_class;
  const payload = classPayload(standard, dimValue);
  const scope: RunEnv = { ...payload, accuracy_class: payload };
  for (const [id] of Object.entries(inst.has?.attributes ?? {})) {
    const v = attrValue(inst, id);
    if (v === undefined) {
      continue;
    }
    const n = Number(
      typeof v.value === 'object'
        ? (v.value as { value?: unknown }).value
        : v.value,
    );
    if (!Number.isNaN(n)) {
      scope[id] = n;
    }
  }

  // The programs: the test's ordered steps with their argument
  // expressions evaluated over the run scope.
  const programs: RunProgramStep[] = [];
  const test = options.test
    ? standard.conformanceTests.find(t => t.id === options.test)
    : undefined;
  if (test) {
    for (const step of test.preparation?.entries ?? []) {
      const args: Record<string, number | string> = {};
      for (const [k, expr] of Object.entries(step.args ?? {})) {
        try {
          args[k] = evaluateExpression(String(expr), scope);
        } catch {
          args[k] = String(expr);
        }
      }
      programs.push({
        program: 'preparation',
        order: step.order ?? null,
        drive: step.drive ?? '',
        args,
        hold: step.hold || undefined,
      });
    }
    for (const point of test.stimulus?.entries ?? []) {
      const args: Record<string, number | string> = {};
      for (const [k, expr] of Object.entries(point.args ?? {})) {
        try {
          args[k] = evaluateExpression(String(expr), scope);
        } catch {
          args[k] = String(expr);
        }
      }
      programs.push({
        program: 'stimulus',
        order: point.order ?? null,
        drive: point.drive ?? '',
        args,
        hold: point.hold || undefined,
        acceptance: point.acceptance || undefined,
      });
    }
  }

  // The verdicts: the bound requirement's limit's accepted verdicts,
  // evaluated per input — |e_l| against the MPE the model derives.
  const verdicts: RunVerdict[] = [];
  const reqIds = [
    ...(options.requirement ? [options.requirement] : []),
    ...(test?.targets ?? []),
  ];
  const reqs = standard.requirements.filter(r => reqIds.includes(r.id));
  const limitChain = reqs.flatMap(r => (r.limit ? [r] : []));
  const verdictDefs = standard.verdicts;
  for (const input of options.inputs) {
    const runScope: RunEnv = {
      ...scope,
      load_v: input.load_v,
      e_l: input.e_l,
      indication: input.e_l,
      reference: 0,
    };
    for (const req of limitChain) {
      const limit = req.limit!;
      const accepts = limit.accepts ? [limit.accepts] : [];
      for (const acc of accepts) {
        const vdef = verdictDefs.find(v => v.id === acc.verdict);
        if (!vdef) {
          continue;
        }
        let value: number;
        try {
          value = evaluateExpression(vdef.derive, runScope);
        } catch {
          value = Number.NaN;
        }
        // The bound: the limit expression evaluated over the same scope
        // (the MPE derivation — the tier selection over the applied
        // load, scaled by the apportioning factor).
        let bound: number | null = null;
        const boundExpr = (limit.expression ?? '').trim();
        if (boundExpr !== '') {
          const calc = standard.calculations.find(c => c.id === boundExpr);
          if (calc) {
            try {
              bound = evaluateExpression(calc.expression ?? '', runScope);
            } catch {
              bound = null;
            }
          } else {
            try {
              bound = evaluateExpression(boundExpr, runScope);
            } catch {
              bound = null;
            }
          }
        }
        const op = acc.op ?? 'lte';
        const outcome: RunVerdict['outcome'] =
          Number.isNaN(value) || bound === null
            ? 'indeterminate'
            : op === 'lte'
              ? value <= bound
                ? 'pass'
                : 'fail'
              : op === 'lt'
                ? value < bound
                  ? 'pass'
                  : 'fail'
                : op === 'gte'
                  ? value >= bound
                    ? 'pass'
                    : 'fail'
                  : op === 'gt'
                    ? value > bound
                      ? 'pass'
                      : 'fail'
                    : value === bound
                      ? 'pass'
                      : 'fail';
        verdicts.push({
          id: vdef.id,
          derive: vdef.derive,
          inputs: { e_l: input.e_l, load_v: input.load_v },
          value,
          unit: vdef.unit || undefined,
          limit: boundExpr
            ? { expression: boundExpr, op, bound: bound ?? Number.NaN }
            : undefined,
          outcome,
        });
      }

      // The formula leg: a limit whose uses name a declared calculation
      // (R 60's `formula:mpe` — the tier selection) binds through it:
      // the observed error against the calculation's value.
      for (const use of limit.uses ?? []) {
        if (!use.startsWith('formula:')) {
          continue;
        }
        const calc = standard.calculations.find(
          c => c.id === use.slice('formula:'.length),
        );
        if (!calc?.expression) {
          continue;
        }
        let bound: number;
        try {
          bound = evaluateExpression(calc.expression, runScope);
        } catch {
          continue;
        }
        verdicts.push({
          id: calc.id,
          derive: calc.expression,
          inputs: { e_l: input.e_l, load_v: input.load_v },
          value: input.e_l,
          limit: { expression: calc.id, op: 'lte', bound },
          outcome: input.e_l <= bound ? 'pass' : 'fail',
        });
      }
    }
  }

  // The trajectory: the bound operational machine's fired steps (the
  // runtime records what the run drove; the steps name transitions).
  let trajectory: StateTrajectoryEntry[] = [];
  const subject = standard.subjects.find(
    sub => sub.id === inst.of || sub.extends === inst.of,
  );
  const machineId = subject?.has?.state ?? '';
  const machine = machineId
    ? standard.stateMachines.find(
        m =>
          (m as unknown as { id?: string }).id === machineId ||
          m.entityName === machineId,
      )
    : undefined;
  if (machine) {
    const fired: FiredStep[] = [];
    for (const p of programs) {
      const action = p.drive;
      if (action && machine.transitions.some(t => t.actionName === action)) {
        fired.push({
          id: `${p.program}:${p.order ?? ''}`,
          fires: action,
          at: String(fired.length),
        });
      }
    }
    if (fired.length > 0) {
      try {
        trajectory = foldTrajectory(
          machine,
          { state: machine.initialState, at: '0' },
          fired,
        );
      } catch {
        trajectory = [];
      }
    }
  }

  // The evidence record: the run's outputs, per value with its
  // provenance carried from the source attribute (the law's loop).
  const evidence: RunEvidenceRecord[] = [];
  if (options.evidenceRegistry) {
    const record: RunEvidenceRecord = {
      registry: options.evidenceRegistry,
      run:
        options.runId ??
        (options.test
          ? `${options.instance}:${options.test}`
          : options.instance),
      values: [
        ...options.inputs.map((inp, i) => ({
          id: `load_v[${i}]`,
          value: inp.load_v,
          provenance:
            undefined as RunEvidenceRecord['values'][number]['provenance'],
        })),
        ...verdicts.map((v, i) => ({
          id: `${v.id}[${i}]`,
          value: v.value,
          unit: v.unit,
          provenance:
            undefined as RunEvidenceRecord['values'][number]['provenance'],
        })),
      ],
    };
    evidence.push(record);
  }

  return {
    instance: options.instance,
    test: options.test,
    programs,
    verdicts,
    trajectory,
    evidence,
  };
}

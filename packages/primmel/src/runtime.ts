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
  peekAt(offset: number): Tok | undefined {
    return this.toks[this.pos + offset];
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

/** True when the reader's next tokens are `( id )` and that id binds a
 *  list — the discriminator between scalar min/max(a, b) and the
 *  aggregators min(list)/max(list). Pure peek: no state to restore. */
function listShaped(r: Reader, env: RunEnv): boolean {
  const open = r.peek();
  const id = r.peekAt(1);
  const close = r.peekAt(2);
  return (
    open?.t === 'op' &&
    open.v === '(' &&
    id?.t === 'id' &&
    close?.t === 'op' &&
    close.v === ')' &&
    Array.isArray(env[id.v])
  );
}

function evalAtom(r: Reader, env: RunEnv): number {
  const t = r.next();
  if (t.t === 'num') {
    return t.v;
  }
  if (t.t === 'id') {
    // The list aggregators (the MMEL v2 measurement language's postfix
    // `.sum/.max/.min/.count/.average`, retained as call-form over the
    // run scope's list payloads): sum/max/min/count/average(list).
    // The min/max LIST form is discriminated by listShaped — scalar
    // min/max(a, b) keeps its branch below.
    if (
      t.v === 'sum' ||
      t.v === 'count' ||
      t.v === 'average' ||
      ((t.v === 'min' || t.v === 'max') && listShaped(r, env))
    ) {
      r.expectOp('(');
      const name = r.next();
      r.expectOp(')');
      const list = env[name.v];
      if (!Array.isArray(list)) {
        throw new Error(
          `runtime: ${t.v}(...) aggregates a list — "${name.v}" is ${Array.isArray(list) ? 'a list' : typeof list}`,
        );
      }
      const nums = list.map(Number);
      if (t.v === 'count') {
        return nums.length;
      }
      if (nums.length === 0) {
        throw new Error(`runtime: ${t.v}(...) over the empty list "${name.v}"`);
      }
      if (t.v === 'sum') {
        return nums.reduce((a, b) => a + b, 0);
      }
      if (t.v === 'average') {
        return nums.reduce((a, b) => a + b, 0) / nums.length;
      }
      return t.v === 'min' ? Math.min(...nums) : Math.max(...nums);
    }
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
/** One model table (the subset the lookup reads): id + the data grid
 *  (row 0 is the header — the legacy's slice(1) convention). */
export interface LookupTable {
  id: string;
  data: string[][];
}

/**
 * The MMEL v2 TABLE-variable lookup, retained with the legacy's exact
 * signature and semantics (Checker.js `lookupTable`): the definition
 * string is `tableId,targetCol,(matchCol,varName)…` — filter the
 * table's rows (below the header) where every match column equals the
 * named variable's value, and return the first surviving row's target
 * cell (numeric when it parses). Throws — never silently nulls — when
 * the table is missing or no row matches.
 */
export function lookupTable(
  tables: LookupTable[],
  definition: string,
  values: RunEnv,
): number | string {
  const parts = definition.split(',');
  if (parts.length < 3) {
    throw new Error(
      `runtime: the table lookup definition needs tableId,targetCol,matchCol,var — got "${definition}"`,
    );
  }
  const table = tables.find(t => t.id === parts[0]!.trim());
  const targetCol = Number(parts[1]!.trim());
  if (!table || Number.isNaN(targetCol)) {
    throw new Error(
      `runtime: the table lookup names "${parts[0]!.trim()}", which no declared table carries`,
    );
  }
  const rows = table.data.slice(1);
  let matched = rows;
  for (let i = 2; i + 1 < parts.length; i += 2) {
    const col = Number(parts[i]!.trim());
    const want = String(values[parts[i + 1]!.trim()] ?? '');
    matched = matched.filter(r => String(r[col] ?? '') === want);
  }
  if (matched.length === 0) {
    throw new Error(
      `runtime: the table lookup over "${parts[0]!.trim()}" matches no row`,
    );
  }
  const cell = matched[0]![targetCol] ?? '';
  const num = Number(cell);
  return cell !== '' && !Number.isNaN(num) ? num : cell;
}

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

/** One certificate claim as projected: the declared value with its
 *  provenance, and the validation outcome the run recorded. */
export interface CertificateClaim {
  id: string;
  declared?: { value: number | string; unit?: string; source?: string };
  validatedBy?: string;
  /** The run verdict this claim rides ('' when the claim carries no
   *  validation reference). */
  outcome: 'pass' | 'fail' | 'indeterminate' | 'unexecuted';
  value?: number;
}

/** The projected certificate (file 12, phase 4): the attestation's
 *  claims with their declared values (read from the authored lineage —
 *  never re-entered) and the validation outcomes the run recorded.
 *  Deterministic; JSON-stable. */
export interface CertificateProjection {
  attestation: string;
  subject?: string;
  statement?: string;
  claims: CertificateClaim[];
}

/** Project the certificate from an executed run: the attestation's
 *  claims, each judged by the run verdict its validated_by names. */
export function projectCertificate(
  standard: Standard,
  run: Run,
  attestationId: string,
): CertificateProjection {
  const att = standard.attestations?.find(a => a.id === attestationId);
  if (!att) {
    throw new Error(`runtime: no attestation "${attestationId}" is declared`);
  }

  // The declared values: the lineage instance each claim names — the
  // claim's declared path's leading id is the declaration instance.
  const claims: CertificateClaim[] = [];
  for (const claim of att.claims ?? []) {
    const id = claim.promise;
    // The declared path names the declaration stage (e.g. the
    // application declaration's id); the lineage INSTANCE carries the
    // suffix -declared on it — resolve either spelling.
    const declaredId = claim.declared?.split('.')[0] ?? '';
    const source =
      standard.instances.find(i => i.id === declaredId) ??
      standard.instances.find(i => i.id === `${declaredId}-declared`) ??
      standard.instances.find(i => i.id === att.subject);
    // The declared value rides the attributes — or, for a
    // classification claim, the dimensions map.
    const raw = source
      ? ((
          source.has?.attributes as unknown as
            | Record<
                string,
                {
                  value?: unknown;
                  unit?: string;
                  provenance?: { source?: string };
                }
              >
            | undefined
        )?.[id] ??
        (
          source.has?.dimensions as unknown as
            Record<string, string | number> | undefined
        )?.[id])
      : undefined;
    const value =
      typeof raw === 'object' && raw !== null
        ? (raw as { value?: unknown }).value
        : raw;
    const declared =
      value === undefined
        ? undefined
        : {
            value: (typeof value === 'object' && value !== null
              ? (value as { value?: number | string }).value
              : value) as number | string,
            unit: (raw as { unit?: string } | undefined)?.unit,
            source: (raw as { provenance?: { source?: string } } | undefined)
              ?.provenance?.source,
          };
    const verdictId = claim.validatedBy ?? '';
    const matched = run.verdicts.filter(
      v => v.id === verdictId || verdictId === '',
    );
    const outcome: CertificateClaim['outcome'] =
      verdictId === ''
        ? 'unexecuted'
        : matched.length === 0
          ? 'unexecuted'
          : matched.every(v => v.outcome === 'pass')
            ? 'pass'
            : matched.some(v => v.outcome === 'fail')
              ? 'fail'
              : 'indeterminate';
    claims.push({
      id,
      declared,
      validatedBy: verdictId || undefined,
      outcome,
      value:
        matched.length > 0 ? matched[matched.length - 1]!.value : undefined,
    });
  }
  return {
    attestation: att.id,
    subject: att.subject,
    statement: att.statement,
    claims,
  };
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
  /** Verdict constructs to execute over each input (the attestation
   *  claims' validated_by set) — each derive evaluates as the
   *  judgment, with every declared calculation's value bound into
   *  the scope under its id. */
  verdicts?: string[];
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

    // The named verdicts: the attestation claims' validated_by set.
    // Every declared calculation's value binds into the scope under
    // its id (mpe-verdict's derive reads `mpe`), then the derive
    // evaluates as the judgment — truthy passes, falsy fails.
    for (const vid of options.verdicts ?? []) {
      const vdef = standard.verdicts.find(v => v.id === vid);
      if (!vdef) {
        continue;
      }
      const judgeScope: RunEnv = { ...runScope };
      for (const calc of standard.calculations) {
        if (!calc.expression || calc.id in judgeScope) {
          continue;
        }
        try {
          judgeScope[calc.id] = evaluateExpression(calc.expression, runScope);
        } catch {
          // an unrestorable binding stays absent — the derive's own
          // evaluation reports it
        }
      }
      let outcome: RunVerdict['outcome'] = 'indeterminate';
      try {
        outcome = evaluateExpression(vdef.derive, judgeScope) ? 'pass' : 'fail';
      } catch {
        outcome = 'indeterminate';
      }
      verdicts.push({
        id: vdef.id,
        derive: vdef.derive,
        inputs: { e_l: input.e_l, load_v: input.load_v },
        value: input.e_l,
        unit: vdef.unit || undefined,
        outcome,
      });
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

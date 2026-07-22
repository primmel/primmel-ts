// ─────────────────────────────────────────────────────────────────────
// `process` construct — v2 MMEL process + v3 process-model extensions
// (TODO.roadmap/02).
//
// The v2 shape is untouched: name/actor/modality, registry I/O
// (reference_data_registry / output), validate_provision /
// validate_measurement, canvas page, nested child processes.
//
// The v3 additions make the process a recursive subject with two
// definition forms (concept doc §4):
//
//   process creep_test {
//     name "Creep test method (R 60-2, 2.7.3)"
//     # IS — signature, invariants, preconditions, executor
//     signature {
//       in  { applied_load : mass duration : time }
//       out { indication_series : mass_series }
//     }
//     invariants { "ocl{self.applied_load <= self.e_max}" }
//     preconditions {
//       precondition warmed-up {
//         check "ocl{self.state = #ready and self.warmed_up}"
//         description "An unwarmed run is invalid, never a fail."
//         on_violation invalid
//       }
//     }
//     executor lab
//     # HAS — registers, state
//     registers { conditions_log : text indication_series : mass_series }
//     state OperationalStates
//     # per-classification instances (R 60: n_runs A/B=5, C/D=3)
//     instances {
//       by accuracy_class
//       values { A { n_runs: 5 } B { n_runs: 5 } C { n_runs: 3 } D { n_runs: 3 } }
//     }
//     # DOES — the executable body (absent = abstract form, always valid)
//     does {
//       start_event s
//       action stabilize  { executor actor role lab_technician capture stab_form write { conditions_log } }
//       action apply_load { executor actor role lab_technician read { applied_load } }
//       action hold       { executor machine wait duration }
//       action record     { executor machine read { applied_load } write { indication_series } }
//       end_event e
//       flow {
//         s -> stabilize -> apply_load -> hold -> record -> e
//       }
//     }
//   }
//
// A step may declare `fires <transition>` (TODO.roadmap/07): when the step
// completes, the process's bound state machine (`state <machineRef>`) takes
// the named transition — e.g. `action warm_up { executor machine fires warm }`
// drives an operational machine off → ready.
//
// Step kinds: action, approval, gateway, parallel_gateway, start_event,
// end_event, timer_event (period for recurrence), signal_event. Flow
// edges chain (`a -> b -> c`); an optional `{ when "ocl{...}" }` body
// conditions the LAST hop of a chain (first match in document order wins
// at a gateway; the unconditioned edge is the default).
//
// `child_composition gateway` (default `all`) declares how the process's
// CHILDREN combine for the coverage calculus (TODO.roadmap/04): `all` =
// every child required; `gateway` = the children are exclusive branches
// and at least one suffices for minimal cover.
// ─────────────────────────────────────────────────────────────────────

import Process, {
  ProcessFlow,
  ProcessFlowEdge,
  ProcessParameter,
  ProcessSignature,
  ProcessStep,
  ProcessStepKind,
  ResolvableProcess,
} from '../../types/process';
import type {
  TestInstances,
  TestPrecondition,
} from '../../types/ConformanceTest';
import { resolveFromContext } from '../resolve';
import tokenize, {
  escapeString,
  stripWrapping,
  unwrapBlock,
  tokenizePackage,
} from '../tokenize';
import { forEachEntry, unwrapped } from '../parse-block';
import { dumpBareSafe, readValueToken, stripColon } from './field-parser';
import { Parser, Resolver } from '../types';
import type { ParseContext } from '../types';
import type { Registry } from '../../types/data';
import type Provision from '../../types/Provision';
import type Role from '../../types/Role';
import type { Subprocess } from '../../types/flow';

/** Numeric-looking values parse as numbers, everything else stays a string. */
function numOrString(s: string): string | number {
  if (s.trim() !== '' && !isNaN(Number(s))) {
    return Number(s);
  }
  return s;
}

// ── v3 block sub-parsers ─────────────────────────────────────────────

/** Read `name [: type]` entries (signature params, registers). */
function parseParamList(block: string): ProcessParameter[] {
  const out: ProcessParameter[] = [];
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const name = stripColon(t[i++]);
    if (!name) {
      break;
    }
    let type = '';
    if (i < t.length && t[i] === ':') {
      i++;
    }
    if (i < t.length) {
      type = stripWrapping(t[i++]);
    }
    out.push({ name, type });
  }
  return out;
}

/** Read OCL entries — quoted strings or bare `ocl{…}` (reassembled). */
function parseOclList(block: string): string[] {
  const out: string[] = [];
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const read = readValueToken(t, i);
    const text = stripWrapping(read.text);
    i = read.next;
    if (text) {
      out.push(text);
    }
  }
  return out;
}

/**
 * Forward-compatible skip of an unknown keyword entry. `i` is the index
 * AFTER the unknown keyword; consumes the optional value and, when a
 * `{ … }` block follows, the balanced block — so `kw value`,
 * `kw { block }`, and `kw value { block }` all stay aligned with the
 * token walk (the tokenizer keeps a `{…}` group as ONE balanced token).
 */
function skipUnknownEntry(t: string[], i: number): number {
  if (i >= t.length) {
    return i;
  }
  if (t[i].startsWith('{')) {
    return i + 1; // `kw { block }`
  }
  i++; // the value
  if (i < t.length && t[i].startsWith('{')) {
    i++; // `kw value { block }`
  }
  return i;
}

/**
 * Preconditions — same shape as conformance-test preconditions (an OCL
 * Boolean check, a description, and the violation outcome). The outcome
 * is always `invalid` (a violated entry guard voids the run, never fails
 * it); the keyword is carried for parallelism with cc.yaml.
 */
function parseProcessPreconditions(block: string): TestPrecondition[] {
  const out: TestPrecondition[] = [];
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (cmd !== 'precondition') {
      i = skipUnknownEntry(t, i);
      continue;
    }
    const pid = stripWrapping(t[i++]);
    const p: TestPrecondition = {
      id: pid,
      check: '',
      description: '',
      onViolation: 'invalid',
    };
    if (i < t.length && t[i].startsWith('{')) {
      const pt = tokenize(unwrapBlock(t[i++]));
      let j = 0;
      while (j < pt.length) {
        const pc = pt[j++];
        if (j >= pt.length) {
          break;
        }
        if (pc === 'check') {
          const read = readValueToken(pt, j);
          p.check = stripWrapping(read.text);
          j = read.next;
        } else if (pc === 'description') {
          p.description = stripWrapping(pt[j++]);
        } else if (pc === 'on_violation') {
          p.onViolation = stripWrapping(pt[j++]);
        } else {
          unwrapBlock(pt[j++]);
        }
      }
    }
    out.push(p);
  }
  return out;
}

/** Per-classification instances: `by <dimension> values { V { k: n } … }`. */
function parseProcessInstances(block: string): TestInstances {
  const out: TestInstances = { by: '', values: {} };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'by') {
      out.by = stripWrapping(t[i++]);
    } else if (cmd === 'values') {
      const vt = tokenize(unwrapBlock(t[i++]));
      let j = 0;
      while (j < vt.length) {
        const key = stripColon(vt[j++]);
        if (j >= vt.length) {
          break;
        }
        if (vt[j] === ':') {
          j++;
        }
        if (j < vt.length && vt[j].startsWith('{')) {
          const pt = tokenize(unwrapBlock(vt[j++]));
          const params: Record<string, string | number> = {};
          let k = 0;
          while (k < pt.length) {
            const pkey = stripColon(pt[k++]);
            if (k >= pt.length) {
              break;
            }
            if (pt[k] === ':') {
              k++;
            }
            if (k < pt.length) {
              params[pkey] = numOrString(stripWrapping(pt[k++]));
            }
          }
          out.values[key] = params;
        }
      }
    } else {
      unwrapBlock(t[i++]);
    }
  }
  return out;
}

const STEP_KINDS = new Set<ProcessStepKind>([
  'action',
  'approval',
  'gateway',
  'parallel_gateway',
  'start_event',
  'end_event',
  'timer_event',
  'signal_event',
]);

/** Read one step body (the `{ … }` after `<kind> <id>`). */
function parseStepBody(
  id: string,
  kind: ProcessStepKind,
  block: string,
): ProcessStep {
  const step: ProcessStep = {
    id,
    kind,
    executor: '',
    role: '',
    capture: '',
    reads: [],
    writes: [],
    wait: '',
    period: '',
    signal: '',
    fires: '',
    description: '',
  };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'executor') {
      const ex = stripWrapping(t[i++]);
      if (ex !== 'machine' && ex !== 'actor') {
        throw new Error(
          `Parsing error: process step. ID ${id}: Unknown executor ${ex} (valid: machine, actor)`,
        );
      }
      step.executor = ex;
    } else if (cmd === 'role') {
      step.role = stripWrapping(t[i++]);
    } else if (cmd === 'capture') {
      step.capture = stripWrapping(t[i++]);
    } else if (cmd === 'read') {
      step.reads.push(
        ...tokenize(stripWrapping(t[i++]))
          .map(stripColon)
          .map(stripWrapping)
          .filter(s => s.length > 0),
      );
    } else if (cmd === 'write') {
      step.writes.push(
        ...tokenize(stripWrapping(t[i++]))
          .map(stripColon)
          .map(stripWrapping)
          .filter(s => s.length > 0),
      );
    } else if (cmd === 'wait') {
      step.wait = stripWrapping(t[i++]);
    } else if (cmd === 'period') {
      step.period = stripWrapping(t[i++]);
    } else if (cmd === 'signal') {
      step.signal = stripWrapping(t[i++]);
    } else if (cmd === 'fires') {
      step.fires = stripWrapping(t[i++]);
    } else if (cmd === 'description') {
      step.description = stripWrapping(t[i++]);
    } else {
      i = skipUnknownEntry(t, i);
    }
  }
  return step;
}

/**
 * Read the flow block: chained edges `a -> b -> c`, each hop optionally
 * followed by `{ when "ocl{…}" }` (the condition binds to the LAST hop
 * of the chain). `condition` is accepted as an alias of `when` for
 * symmetry with canvas edges.
 *
 * A FUSED arrow (`s->a->e`, `s→a→e` — no whitespace around the arrow)
 * tokenizes as ONE token and would otherwise yield zero edges, surfacing
 * later as misleading C11 errors. Reject it at parse time with a clear
 * message instead of silently dropping the chain or attempting to split
 * it. Block (`{…}`) and quoted tokens are exempt — an OCL `->` inside a
 * `when` condition is not a flow arrow.
 */
function parseFlowEdges(block: string): ProcessFlowEdge[] {
  const edges: ProcessFlowEdge[] = [];
  const t = tokenize(block);
  for (const tok of t) {
    if (
      !tok.startsWith('{') &&
      !tok.startsWith('"') &&
      tok !== '->' &&
      tok !== '→' &&
      (tok.includes('->') || tok.includes('→'))
    ) {
      throw new Error(
        `Parsing error: process flow edge "${tok}" contains a fused arrow — separate steps and "->" with whitespace`,
      );
    }
  }
  let i = 0;
  while (i < t.length) {
    let current = stripWrapping(t[i++]);
    if (!current) {
      break;
    }
    while (i < t.length && (t[i] === '->' || t[i] === '→')) {
      i++;
      if (i >= t.length) {
        break;
      }
      const to = stripWrapping(t[i++]);
      let condition = '';
      if (i < t.length && t[i].startsWith('{')) {
        const bt = tokenize(unwrapBlock(t[i++]));
        let j = 0;
        while (j < bt.length) {
          const cmd = bt[j++];
          if (j >= bt.length) {
            break;
          }
          if (cmd === 'when' || cmd === 'condition') {
            const read = readValueToken(bt, j);
            condition = stripWrapping(read.text);
            j = read.next;
          } else {
            unwrapBlock(bt[j++]);
          }
        }
      }
      edges.push({ from: current, to, condition });
      current = to;
    }
  }
  return edges;
}

/** Read the `does { … }` executable body: step declarations + one flow block. */
function parseDoes(block: string): ProcessFlow {
  const flow: ProcessFlow = { steps: [], edges: [] };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'flow') {
      flow.edges.push(...parseFlowEdges(unwrapBlock(t[i++])));
    } else if (STEP_KINDS.has(cmd as ProcessStepKind)) {
      const stepId = stripWrapping(t[i++]);
      let body = '';
      if (i < t.length && t[i].startsWith('{')) {
        body = unwrapBlock(t[i++]);
      }
      flow.steps.push(parseStepBody(stepId, cmd as ProcessStepKind, body));
    } else {
      // Forward-compatible: skip `kw value` and `kw id { body }` shapes.
      const v = t[i++];
      if (
        v !== undefined &&
        !v.startsWith('{') &&
        i < t.length &&
        t[i].startsWith('{')
      ) {
        i++;
      }
    }
  }
  return flow;
}

// ── process parser ───────────────────────────────────────────────────

export const parseProcess: Parser = function (id, data) {
  const result: ResolvableProcess = {
    id: id,
    name: '',
    modality: '',
    actor: null,
    output: [],
    input: [],
    provision: [],
    page: null,
    measure: [],
    parent: '',
    children: [],
    // v3 process model — defaults keep a plain v2 process exactly as before
    signature: null,
    invariants: [],
    preconditions: [],
    executor: '',
    registers: [],
    state: '',
    instances: null,
    childComposition: 'all',
    does: null,
    provisionRefs: [],
    _relations: {
      actor: '',
      output: [],
      input: [],
      provision: [],
      page: '',
    },
  };

  const childModifiers: ((ctx: ParseContext) => ParseContext)[] = [];

  if (data.trim() !== '') {
    const tokens = tokenizePackage(data);
    const filtered: string[] = [];
    let i = 0;
    while (i < tokens.length) {
      if (
        tokens[i] === 'process' &&
        i + 2 < tokens.length &&
        tokens[i + 2].startsWith('{')
      ) {
        const childId = tokens[i + 1];
        const childBlock = tokens[i + 2];
        const childModifier = parseProcess(childId, childBlock);
        childModifiers.push((ctx: ParseContext) => {
          ctx = childModifier(ctx);
          const childProc = ctx.processes[childId];
          if (childProc) {
            childProc.parent = id;
          }
          return ctx;
        });
        result.children.push(childId);
        i += 3;
      } else {
        filtered.push(tokens[i]);
        i++;
      }
    }
    data = '{ ' + filtered.join(' ') + ' }';
  }

  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'modality') {
        result.modality = value();
      } else if (keyword === 'name') {
        result.name = unwrapped(value);
      } else if (keyword === 'actor') {
        result._relations.actor = value();
      } else if (keyword === 'parent') {
        result.parent = value();
      } else if (keyword === 'canvas' || keyword === 'subprocess') {
        result._relations.page = value();
      } else if (keyword === 'validate_provision') {
        result._relations.provision = tokenizePackage(value());
      } else if (keyword === 'validate_measurement') {
        result.measure = tokenizePackage(value()).map(x => unwrapBlock(x));
      } else if (keyword === 'output') {
        result._relations.output = tokenizePackage(value());
      } else if (keyword === 'reference_data_registry') {
        result._relations.input = tokenizePackage(value());
      } else if (keyword === 'signature') {
        // signature { in { … } out { … } }
        const sig: ProcessSignature = { inputs: [], outputs: [] };
        const st = tokenize(unwrapBlock(value()));
        let j = 0;
        while (j < st.length) {
          const sc = st[j++];
          if (j >= st.length) {
            break;
          }
          if (sc === 'in') {
            sig.inputs.push(...parseParamList(unwrapBlock(st[j++])));
          } else if (sc === 'out') {
            sig.outputs.push(...parseParamList(unwrapBlock(st[j++])));
          } else {
            unwrapBlock(st[j++]);
          }
        }
        result.signature = sig;
      } else if (keyword === 'invariants') {
        result.invariants = parseOclList(unwrapBlock(value()));
      } else if (keyword === 'preconditions') {
        result.preconditions = parseProcessPreconditions(unwrapBlock(value()));
      } else if (keyword === 'executor') {
        result.executor = stripWrapping(value());
      } else if (keyword === 'registers') {
        result.registers = parseParamList(unwrapBlock(value()));
      } else if (keyword === 'state') {
        result.state = stripWrapping(value());
      } else if (keyword === 'instances') {
        result.instances = parseProcessInstances(unwrapBlock(value()));
      } else if (keyword === 'child_composition') {
        const comp = stripWrapping(value());
        if (comp !== 'all' && comp !== 'gateway') {
          throw new Error(
            `Parsing error: process. ID ${id}: Unknown child_composition "${comp}" (valid: all, gateway)`,
          );
        }
        result.childComposition = comp;
      } else if (keyword === 'does') {
        // The presence of the body marks the process EXECUTABLE — even an
        // empty `does { }` (the linter then reports the missing start event).
        result.does = parseDoes(unwrapBlock(value()));
      } else {
        return false;
      }
      return true;
    },
    { construct: 'process', id },
  );

  return ctx => {
    ctx.processes[id] = result;
    for (const mod of childModifiers) {
      ctx = mod(ctx);
    }
    return ctx;
  };
};

export const resolveProcess: Resolver<Process, ResolvableProcess> = function (
  ctx,
  unresolved,
) {
  const { _relations, ...rest } = unresolved;
  const p: Process = {
    ...rest,
    output: [],
    input: [],
    provision: [],
    // The raw validate_provision ids survive resolution even when they
    // name no declared `provision` construct (e.g. `/req/cs/*`
    // requirements) — the linter and the dumper read this list.
    provisionRefs: [..._relations.provision],
    actor: null,
    page: null,
  };
  for (const id of _relations.output) {
    const r = resolveFromContext<Registry>(ctx, 'regs', id);
    if (r !== undefined) {
      p.output.push(r);
    }
  }
  for (const id of _relations.input) {
    const r = resolveFromContext<Registry>(ctx, 'regs', id);
    if (r !== undefined) {
      p.input.push(r);
    }
  }
  for (const id of _relations.provision) {
    const r = resolveFromContext<Provision>(ctx, 'provisions', id);
    if (r !== undefined) {
      p.provision.push(r);
    }
  }
  if (_relations.actor !== '') {
    p.actor = resolveFromContext<Role>(ctx, 'roles', _relations.actor) ?? null;
  }
  if (_relations.page !== '') {
    const page = resolveFromContext<Subprocess>(ctx, 'pages', _relations.page);
    p.page = page ?? null;
  }
  return p;
};

function indentBlock(block: string): string {
  return block
    .split('\n')
    .map(line => (line ? '  ' + line : line))
    .join('\n');
}

export function dumpProcessTree(
  process: Process,
  lookup: Map<string, Process>,
  nested = false,
): string {
  let out = dumpProcess(process, { nested });
  if (process.children.length > 0) {
    const childBlocks: string[] = [];
    for (const childId of process.children) {
      const child = lookup.get(childId);
      if (child) {
        childBlocks.push(indentBlock(dumpProcessTree(child, lookup, true)));
      }
    }
    if (childBlocks.length > 0) {
      out = out.replace(/\n}\n$/, '\n' + childBlocks.join('\n') + '}\n');
    }
  }
  return out;
}

// ── v3 block dumpers ─────────────────────────────────────────────────

function dumpParamList(params: ProcessParameter[]): string {
  return params.map(p => p.name + (p.type ? ' : ' + p.type : '')).join(' ');
}

function dumpSignature(sig: ProcessSignature): string {
  let out = '  signature {\n';
  if (sig.inputs.length > 0) {
    out += '    in { ' + dumpParamList(sig.inputs) + ' }\n';
  }
  if (sig.outputs.length > 0) {
    out += '    out { ' + dumpParamList(sig.outputs) + ' }\n';
  }
  out += '  }\n';
  return out;
}

function dumpStep(step: ProcessStep): string {
  const inner: string[] = [];
  if (step.executor) {
    inner.push('executor ' + step.executor);
  }
  if (step.role) {
    inner.push('role ' + dumpBareSafe(step.role));
  }
  if (step.capture) {
    inner.push('capture ' + dumpBareSafe(step.capture));
  }
  if (step.reads.length > 0) {
    inner.push('read { ' + step.reads.map(dumpBareSafe).join(' ') + ' }');
  }
  if (step.writes.length > 0) {
    inner.push('write { ' + step.writes.map(dumpBareSafe).join(' ') + ' }');
  }
  if (step.wait) {
    inner.push('wait ' + dumpBareSafe(step.wait));
  }
  if (step.period) {
    inner.push('period ' + dumpBareSafe(step.period));
  }
  if (step.signal) {
    inner.push('signal ' + dumpBareSafe(step.signal));
  }
  if (step.fires) {
    inner.push('fires ' + dumpBareSafe(step.fires));
  }
  if (step.description) {
    inner.push('description "' + escapeString(step.description) + '"');
  }
  if (inner.length === 0) {
    return '    ' + step.kind + ' ' + step.id + '\n';
  }
  return '    ' + step.kind + ' ' + step.id + ' { ' + inner.join(' ') + ' }\n';
}

function dumpDoes(flow: ProcessFlow): string {
  let out = '  does {\n';
  for (const s of flow.steps) {
    out += dumpStep(s);
  }
  if (flow.edges.length > 0) {
    out += '    flow {\n';
    for (const e of flow.edges) {
      out += '      ' + e.from + ' -> ' + e.to;
      if (e.condition) {
        out += ' { when "' + escapeString(e.condition) + '" }';
      }
      out += '\n';
    }
    out += '    }\n';
  }
  out += '  }\n';
  return out;
}

// Wider than Dumper<Process> by one OPTIONAL context arg (still
// assignable to Dumper<Process>): `nested` marks emission inside the
// parent's block, where the nesting itself expresses the parent link.
export const dumpProcess: (
  process: Process,
  ctx?: { nested?: boolean },
) => string = function (process, ctx) {
  let out: string = 'process ' + process.id + ' {\n';
  out += '  name "' + escapeString(process.name) + '"\n';
  if (process.actor !== null) {
    out += '  actor ' + process.actor.id + '\n';
  }
  if (process.modality !== '') {
    out += '  modality ' + process.modality + '\n';
  }
  if (process.input.length > 0) {
    out += '  reference_data_registry {\n';
    for (const dr of process.input) {
      out += '    ' + dr.id + '\n';
    }
    out += '  }\n';
  }
  if (process.provisionRefs.length > 0) {
    out += '  validate_provision {\n';
    for (const id of process.provisionRefs) {
      out += '    ' + id + '\n';
    }
    out += '  }\n';
  }
  if (process.measure.length > 0) {
    out += '  validate_measurement {\n';
    for (const v of process.measure) {
      out += '    "' + v + '"\n';
    }
    out += '  }\n';
  }
  if (process.output.length > 0) {
    out += '  output {\n';
    for (const c of process.output) {
      out += '    ' + c.id + '\n';
    }
    out += '  }\n';
  }
  if (process.page !== null) {
    out += '  canvas ' + process.page.id + '\n';
  }
  // ── v3 blocks (emitted only when declared) ──
  if (process.signature !== null && process.signature !== undefined) {
    out += dumpSignature(process.signature);
  }
  if (process.invariants && process.invariants.length > 0) {
    out += '  invariants {\n';
    for (const inv of process.invariants) {
      out += '    "' + escapeString(inv) + '"\n';
    }
    out += '  }\n';
  }
  if (process.preconditions && process.preconditions.length > 0) {
    out += '  preconditions {\n';
    for (const p of process.preconditions) {
      let line = '    precondition ' + p.id + ' { ';
      if (p.check) {
        line += 'check "' + escapeString(p.check) + '" ';
      }
      if (p.description) {
        line += 'description "' + escapeString(p.description) + '" ';
      }
      line += 'on_violation ' + p.onViolation + ' ';
      out += line + '}\n';
    }
    out += '  }\n';
  }
  if (process.executor) {
    out += '  executor ' + dumpBareSafe(process.executor) + '\n';
  }
  if (process.registers && process.registers.length > 0) {
    out += '  registers { ' + dumpParamList(process.registers) + ' }\n';
  }
  if (process.state) {
    out += '  state ' + dumpBareSafe(process.state) + '\n';
  }
  if (process.instances) {
    let line = '  instances { by ' + process.instances.by + ' values { ';
    for (const [key, params] of Object.entries(process.instances.values)) {
      line += key + ' { ';
      for (const [pk, pv] of Object.entries(params)) {
        line += pk + ': ' + dumpBareSafe(String(pv)) + ' ';
      }
      line += '} ';
    }
    out += line + '} }\n';
  }
  if (process.childComposition === 'gateway') {
    out += '  child_composition gateway\n';
  }
  if (process.does) {
    out += dumpDoes(process.does);
  }
  // A `parent` link is emitted explicitly whenever nesting does not
  // already express it: leaf processes keep the historical flat form,
  // and a non-leaf process dumped at TOP LEVEL (a flat `parent X`
  // declaration that itself has children) must emit it too — dropping it
  // would silently re-root the subtree across a dump/load cycle, which
  // the coverage calculus aggregates over. A non-leaf process dumped
  // NESTED inside its parent needs no line (the nesting expresses it).
  if (process.parent && (process.children.length === 0 || !ctx?.nested)) {
    out += '  parent ' + process.parent + '\n';
  }
  out += '}\n';
  return out;
};

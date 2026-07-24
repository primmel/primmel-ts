// ─────────────────────────────────────────────────────────────────────
// `monitor` construct (Primmel v3, TODO.roadmap/34 — doctrine ch. 14
// §14.5, grammar sketch §14.11): continuous compliance — triggers,
// evaluation, verdict streams, escalation, as a top-level construct:
//
//   monitor fleet_watch {
//     over { LoadCellModel }
//     triggers { every 1h on signal artifact_arrived on change state }
//     evaluate { requirements applicable_to(this.classification) promises all }
//     emit { evidence -> workspace verdicts -> verdict_log }
//     escalate { on fail { flag_certificate open_service_case } on invalid { open_service_case } }
//   }
//
// Surface-syntax notes (deviations from the §14.11 sketch — the chapter
// is the spec for SEMANTICS, not for delimiters; the convention the twin
// constructs established, ser-des/config/twin.ts header):
//   - the sketch's `monitor <id> over <subject>` head moves `over`
//     INSIDE the block — the kernel's construct shape is
//     `keyword id { … }` (one payload block per construct);
//   - the escalate action lists are `{ … }` blocks and the `;` entry
//     separators of the sketch are optional noise; the sketch's colon
//     form (`on fail: flag_certificate`) parses identically — PRL id
//     lists are brace-delimited everywhere;
//   - an evaluate selector is `all`, `applicable_to(<expr>)` (the expr
//     token may span whitespace — parens are balanced on read), or a
//     `{ … }` block of explicit ids.
//
// Round-trip: the dump emits the canonical single-line sub-block form;
// both the sketch spelling and the canonical form re-parse to the same
// model — the fixpoint is proven in test/monitor.test.ts.
// ─────────────────────────────────────────────────────────────────────

import { stripWrapping, tokenizePackage, unwrapBlock } from '../tokenize';
import { forEachEntry } from '../parse-block';
import { dumpBareSafe, stripColon } from './field-parser';
import type { ConstructDefinition } from './index';
import type {
  Monitor,
  MonitorEmitSink,
  MonitorEscalationAction,
  MonitorEscalationRule,
  MonitorEvaluate,
  MonitorRefSet,
  MonitorTrigger,
} from '../../types/Monitor';

/** Strip the sketch's optional `;` separators from a sub-block stream. */
function subBlockTokens(block: string): string[] {
  return tokenizePackage(block)
    .map(s => s.replace(/^;+|;+$/g, ''))
    .filter(s => s.length > 0);
}

/** Read an id stream: `{ a b }` block form, or a single bare id. */
function readIdStream(value: string): string[] {
  if (value.startsWith('{')) {
    return subBlockTokens(unwrapBlock(value))
      .flatMap(s => s.split(','))
      .map(s => stripWrapping(s.trim()))
      .filter(s => s.length > 0);
  }
  const single = stripWrapping(value);
  return single === '' ? [] : [single];
}

/**
 * Read an evaluate selector token, accumulating an `applicable_to(…)`
 * expression the whitespace tokenizer splits (parens are balanced on
 * read — the same trick readValueToken uses for ocl{…}).
 */
function readSelector(
  t: string[],
  i: number,
): { selector: MonitorRefSet; next: number } {
  const first = t[i] ?? '';
  if (first.startsWith('{')) {
    return {
      selector: { kind: 'refs', expression: '', refs: readIdStream(first) },
      next: i + 1,
    };
  }
  if (first.startsWith('applicable_to(')) {
    const delta = (s: string) =>
      (s.match(/\(/g) || []).length - (s.match(/\)/g) || []).length;
    let text = first;
    let depth = delta(first);
    let j = i + 1;
    while (depth > 0 && j < t.length) {
      text += ' ' + t[j];
      depth += delta(t[j]);
      j++;
    }
    const inner = text.slice(
      'applicable_to('.length,
      text.endsWith(')') ? -1 : undefined,
    );
    return {
      selector: { kind: 'applicable_to', expression: inner.trim(), refs: [] },
      next: j,
    };
  }
  // Bare selector keyword (`all`, or anything else — the linter's C67
  // judges unknown kinds; the parser stays total).
  return {
    selector: { kind: stripWrapping(first), expression: '', refs: [] },
    next: i + 1,
  };
}

/** Parse the `triggers { … }` block (already unwrapped). */
function parseTriggers(block: string): MonitorTrigger[] {
  const triggers: MonitorTrigger[] = [];
  const t = subBlockTokens(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (cmd === 'every') {
      triggers.push({
        kind: 'timer',
        every: stripWrapping(t[i++] ?? ''),
        signal: '',
        aspect: '',
      });
    } else if (cmd === 'on') {
      const mode = t[i++] ?? '';
      const name = stripWrapping(t[i++] ?? '');
      if (mode === 'signal') {
        triggers.push({ kind: 'signal', every: '', signal: name, aspect: '' });
      } else if (mode === 'change') {
        triggers.push({ kind: 'change', every: '', signal: '', aspect: name });
      } else {
        // `on <something-else>` — record as an unknown trigger shape; the
        // linter (C66) judges. The token after `on` was consumed as the
        // mode; nothing further to skip (a block form would arrive as one
        // token and land in `mode` uninterpreted).
        triggers.push({ kind: mode, every: '', signal: '', aspect: name });
      }
    }
    // Unknown tokens are skipped (forward compatibility).
  }
  return triggers;
}

/** Parse the `evaluate { … }` block (already unwrapped). */
function parseEvaluate(block: string): MonitorEvaluate {
  const evaluate: MonitorEvaluate = {
    requirements: { kind: '', expression: '', refs: [] },
    promises: { kind: '', expression: '', refs: [] },
  };
  const t = subBlockTokens(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (cmd === 'requirements' || cmd === 'promises') {
      const read = readSelector(t, i);
      evaluate[cmd] = read.selector;
      i = read.next;
    }
  }
  return evaluate;
}

/** Parse the `emit { … }` block (already unwrapped): `<stream> -> <sink>` pairs. */
function parseEmit(block: string): MonitorEmitSink[] {
  const sinks: MonitorEmitSink[] = [];
  const t = subBlockTokens(block);
  let i = 0;
  while (i < t.length) {
    const stream = t[i++];
    if (t[i] === '->') {
      i++;
      sinks.push({ stream, target: stripWrapping(t[i++] ?? '') });
    } else {
      // A stream without its arrow/sink — record with an empty target;
      // the linter (C70) judges.
      sinks.push({ stream, target: '' });
    }
  }
  return sinks;
}

/** Parse one `on <outcome> { actions… }` action block (already unwrapped). */
function parseEscalationActions(block: string): MonitorEscalationAction[] {
  const actions: MonitorEscalationAction[] = [];
  const t = subBlockTokens(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (cmd === 'notify') {
      actions.push({ action: 'notify', role: stripWrapping(t[i++] ?? '') });
    } else {
      actions.push({ action: cmd, role: '' });
    }
  }
  return actions;
}

/** Parse the `escalate { … }` block (already unwrapped). Tolerates both
 *  the canonical `on <outcome> { actions… }` and the sketch's colon form
 *  `on <outcome>: <action>…` (bare actions read up to the next `on`). */
function parseEscalate(block: string): MonitorEscalationRule[] {
  const rules: MonitorEscalationRule[] = [];
  const t = tokenizePackage(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (cmd !== 'on') {
      continue; // forward compatibility: skip unknown tokens
    }
    const outcome = stripColon(stripWrapping(t[i++] ?? ''));
    if (i < t.length && t[i].startsWith('{')) {
      rules.push({
        outcome,
        actions: parseEscalationActions(unwrapBlock(t[i++])),
      });
      continue;
    }
    // Colon form: bare action tokens up to the next `on` (notify takes a role).
    const actions: MonitorEscalationAction[] = [];
    while (i < t.length && t[i] !== 'on') {
      const action = stripColon(t[i++].replace(/^;+|;+$/g, ''));
      if (action === '') {
        continue;
      }
      if (action === 'notify') {
        actions.push({ action: 'notify', role: stripWrapping(t[i++] ?? '') });
      } else {
        actions.push({ action, role: '' });
      }
    }
    rules.push({ outcome, actions });
  }
  return rules;
}

const parseMonitor: ConstructDefinition['parse'] = function (id, data) {
  const monitor: Monitor = {
    id,
    over: [],
    triggers: [],
    evaluate: {
      requirements: { kind: '', expression: '', refs: [] },
      promises: { kind: '', expression: '', refs: [] },
    },
    emit: [],
    escalate: [],
    referenceIds: [],
  };

  forEachEntry(
    data,
    (command, value) => {
      if (command === 'over') {
        monitor.over = readIdStream(value());
      } else if (command === 'triggers') {
        monitor.triggers = parseTriggers(unwrapBlock(value()));
      } else if (command === 'evaluate') {
        monitor.evaluate = parseEvaluate(unwrapBlock(value()));
      } else if (command === 'emit') {
        monitor.emit = parseEmit(unwrapBlock(value()));
      } else if (command === 'escalate') {
        monitor.escalate = parseEscalate(unwrapBlock(value()));
      } else if (command === 'reference') {
        monitor.referenceIds = readIdStream(value());
      } else {
        return false;
      }
      return true;
    },
    { construct: 'monitor', id },
  );

  return ctx => {
    ctx.monitors[id] = monitor;
    return ctx;
  };
};

// ── dump (canonical form) ────────────────────────────────────────────

function dumpTrigger(trigger: MonitorTrigger): string {
  if (trigger.kind === 'timer') {
    return 'every ' + dumpBareSafe(trigger.every);
  }
  if (trigger.kind === 'signal') {
    return 'on signal ' + dumpBareSafe(trigger.signal);
  }
  if (trigger.kind === 'change') {
    return 'on change ' + dumpBareSafe(trigger.aspect);
  }
  return 'on ' + dumpBareSafe(trigger.kind);
}

function dumpSelector(selector: MonitorRefSet): string {
  if (selector.kind === 'applicable_to') {
    return 'applicable_to(' + selector.expression + ')';
  }
  if (selector.kind === 'refs') {
    return '{ ' + selector.refs.map(dumpBareSafe).join(' ') + ' }';
  }
  return dumpBareSafe(selector.kind);
}

function dumpEscalationRule(rule: MonitorEscalationRule): string {
  const actions = rule.actions
    .map(a =>
      a.action === 'notify'
        ? 'notify ' + dumpBareSafe(a.role)
        : dumpBareSafe(a.action),
    )
    .join(' ');
  return 'on ' + dumpBareSafe(rule.outcome) + ' { ' + actions + ' }';
}

const dumpMonitor = function (m: Monitor): string {
  let out = 'monitor ' + m.id + ' {\n';
  if (m.over.length > 0) {
    out += '  over { ' + m.over.map(dumpBareSafe).join(' ') + ' }\n';
  }
  if (m.triggers.length > 0) {
    out += '  triggers { ' + m.triggers.map(dumpTrigger).join(' ') + ' }\n';
  }
  const reqs = m.evaluate.requirements;
  const promises = m.evaluate.promises;
  if (reqs.kind || promises.kind) {
    out += '  evaluate {';
    if (reqs.kind) {
      out += ' requirements ' + dumpSelector(reqs);
    }
    if (promises.kind) {
      out += ' promises ' + dumpSelector(promises);
    }
    out += ' }\n';
  }
  if (m.emit.length > 0) {
    out +=
      '  emit { ' +
      m.emit.map(s => s.stream + ' -> ' + dumpBareSafe(s.target)).join(' ') +
      ' }\n';
  }
  if (m.escalate.length > 0) {
    out +=
      '  escalate { ' + m.escalate.map(dumpEscalationRule).join(' ') + ' }\n';
  }
  if (m.referenceIds.length > 0) {
    out +=
      '  reference { ' + m.referenceIds.map(dumpBareSafe).join(' ') + ' }\n';
  }
  out += '}\n';
  return out;
};

export const monitorConstruct = {
  keyword: 'monitor',
  field: 'monitors',
  takesID: true,
  parse: parseMonitor,
  dump: dumpMonitor,
} as const;

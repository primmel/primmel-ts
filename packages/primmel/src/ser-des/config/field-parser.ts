// ─────────────────────────────────────────────────────────────────────
// Shared FormField parser + dumper.
//
// Both form.ts (for `form` construct) and subform.ts (for `subform`
// construct) need to parse the same `field <name> { ... }` block shape.
// Previously each file had its own copy of the same 60-line function
// (the audit called this out as a DRY violation).
//
// Extracted here so both can import without circular-dependency issues
// (this file imports only from tokenize + types, never from form/subform).
//
// v2 parser repair (W1a):
// - Scalar values use stripWrapping (unwrapBlock mangles bare tokens:
//   `true` → `ru`, `computed` → `ompute`, `42` → ``).
// - Typed field heads (`field x : number { … }`) are parsed, not lost.
// - calculation_bindings / evaluation / items / nested fields /
//   min_items / max_items are POPULATED (previously parsed-then-skipped).
// - Nested `subform_ref` inside a field block is captured.
// - dumpFormField emits the full field fidelity (lossless round-trip).
// ─────────────────────────────────────────────────────────────────────

import type {
  FormField,
  ApplicabilityEntry,
  CalculationBinding,
  EvaluationRule,
  SubformRef,
} from '../../types/Form';
import tokenize from '../tokenize';
import {
  escapeString,
  unwrapBlock,
  stripWrapping,
  tokenizePackage,
} from '../tokenize';
import { parseSeriesDecl, dumpSeriesDecl } from './series';

/**
 * Read a value token, accumulating inline `ocl{…}` expressions that the
 * whitespace tokenizer splits (braces are only block delimiters at token
 * start, so `ocl{(a - b) / c}` arrives as several tokens).
 */
function readValueToken(
  t: string[],
  i: number,
): { text: string; next: number } {
  const tok = t[i] ?? '';
  if (!tok.startsWith('ocl{')) {
    return { text: tok, next: i + 1 };
  }
  const delta = (s: string) =>
    (s.match(/\{/g) || []).length - (s.match(/\}/g) || []).length;
  let text = tok;
  let depth = delta(tok);
  let j = i + 1;
  while (depth > 0 && j < t.length) {
    const nt = t[j++];
    depth += delta(nt);
    text += ' ' + nt;
  }
  return { text, next: j };
}

/** Emit a bare value safely: quote it when it contains spaces/braces/quotes. */
function dumpBareSafe(v: string): string {
  return /[\s{}"]/.test(v) ? '"' + escapeString(v) + '"' : v;
}

/** Strip one trailing colon: `status:` → `status` (tokenizer keeps colons attached). */
export function stripColon(x: string): string {
  return x.endsWith(':') ? x.slice(0, -1) : x;
}

/**
 * Read a balanced `[...]` or `{...}` value that may span whitespace.
 * The tokenizer is brace-aware only for `{...}`; `[A, C]` lists split
 * across tokens. `t[i]` is the token to start from; returns the joined
 * text and the next unconsumed index.
 */
export function readBalanced(
  t: string[],
  i: number,
): { text: string; next: number } {
  const first = t[i] ?? '';
  if (!first.startsWith('[')) {
    return { text: first, next: i + 1 };
  }
  let text = first;
  let j = i + 1;
  while (!text.includes(']') && j < t.length) {
    text += ' ' + t[j++];
  }
  return { text, next: j };
}

/**
 * Read a field head: `name [: type] { ...block... }`.
 * `t[i]` must be the token AFTER the `field` keyword. Returns null when
 * the shape is not a field head (caller may treat it as something else,
 * e.g. a bare `subform_ref`).
 */
export function readFieldHead(
  t: string[],
  i: number,
): { name: string; type: string; block: string; next: number } | null {
  const name = t[i++];
  if (name === undefined) {
    return null;
  }
  let type = '';
  if (t[i] === ':') {
    i++;
    type = t[i++] ?? '';
    // Optional cardinality after the type, e.g. `: string [0..*]`
    if (t[i] && t[i].startsWith('[') && t[i].endsWith(']')) {
      i++;
    }
  }
  const blockToken = t[i++];
  if (blockToken === undefined || !blockToken.startsWith('{')) {
    return null;
  }
  return { name, type, block: unwrapBlock(blockToken), next: i };
}

/**
 * Parse a `field <name> [: <type>] { ... }` block into a FormField.
 *
 * Caller passes the field name (the token consumed before the brace),
 * the raw block content (inside the braces), and optionally the declared
 * type from the field head. Returns a fully populated FormField with all
 * known sub-keywords processed and unknown ones skipped (forward-compatible).
 */
export function parseFormField(
  name: string,
  block: string,
  type?: string,
): FormField {
  const field: FormField = {
    name,
    type: type || 'string',
    label: '',
    definition: '',
    unit: '',
    required: false,
    measurementMethod: '',
    calculationId: null,
    calculationBindings: [],
    derivation: '',
    evaluation: null,
    values: [],
    defaultValue: '',
    hasDefault: false,
    referenceIds: [],
    fields: [],
    itemsType: '',
    subformRef: null,
  };

  if (!block || !block.trim()) {
    return field;
  }

  // `block` is already-unwrapped CONTENT — use plain tokenize. (tokenizePackage
  // would unwrap AGAIN and eat real characters: `d_max}` → `d_ma`.)
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'label') {
      field.label = stripWrapping(t[i++]);
    } else if (cmd === 'definition') {
      field.definition = stripWrapping(t[i++]);
    } else if (cmd === 'type') {
      // Type may also be declared inside the block.
      field.type = stripWrapping(t[i++]);
    } else if (cmd === 'unit') {
      field.unit = stripWrapping(t[i++]);
    } else if (cmd === 'bind') {
      // Binding path into the subject chain (G5):
      // model.parameters.e_max · sample.test_context.d_min · model.classification.accuracy_class
      field.bind = stripWrapping(t[i++]);
    } else if (cmd === 'required') {
      field.required = stripWrapping(t[i++]) === 'true';
    } else if (cmd === 'measurement_method') {
      field.measurementMethod = stripWrapping(t[i++]);
    } else if (cmd === 'calculation') {
      // Bare ID, quoted string, or inline `ocl{…}` expression (which the
      // whitespace tokenizer SPLITS — accumulate until brace-balanced, or the
      // value truncates at the first space and becomes a dump-time hazard).
      const read = readValueToken(t, i);
      field.calculationId = stripWrapping(read.text);
      i = read.next;
    } else if (cmd === 'calculation_bindings') {
      field.calculationBindings = parseCalculationBindings(unwrapBlock(t[i++]));
    } else if (cmd === 'derivation') {
      field.derivation = stripWrapping(t[i++]);
    } else if (cmd === 'evaluation') {
      field.evaluation = parseEvaluation(unwrapBlock(t[i++]));
    } else if (cmd === 'values') {
      // values [A, B] — lists split across whitespace; accumulate first.
      const read = readBalanced(t, i);
      const inner = read.text
        .trim()
        .replace(/^[[{]/, '')
        .replace(/[\]}]$/, '');
      field.values = inner
        .split(/[,\s]+/)
        .filter(s => s.length > 0)
        .map(stripWrapping);
      i = read.next;
    } else if (cmd === 'default') {
      field.defaultValue = stripWrapping(t[i++]);
      field.hasDefault = true;
    } else if (cmd === 'min_items') {
      field.minItems = parseInt(stripWrapping(t[i++]), 10);
    } else if (cmd === 'max_items') {
      field.maxItems = parseInt(stripWrapping(t[i++]), 10);
    } else if (cmd === 'items') {
      // items { <type> [fields { … }] } — element type + optional nested fields.
      const iblock = unwrapBlock(t[i++]);
      const it = tokenize(iblock);
      const typeParts: string[] = [];
      let k = 0;
      while (k < it.length && it[k] !== 'fields') {
        typeParts.push(it[k++]);
      }
      field.itemsType = typeParts.join(' ');
      if (it[k] === 'fields') {
        k++;
        if (k < it.length) {
          field.fields = parseNestedFields(unwrapBlock(it[k]));
        }
      }
    } else if (cmd === 'series') {
      // series { axis <id> { … } … cell { symbol … unit "…" } } — typed
      // series shape for datalist (array) evidence.
      field.series = parseSeriesDecl(unwrapBlock(t[i++]));
    } else if (cmd === 'fields') {
      field.fields = parseNestedFields(unwrapBlock(t[i++]));
    } else if (cmd === 'subform_ref') {
      // Nested: field … { subform_ref SubformID { parameters { … } applicability { … } } }
      const subformId = stripWrapping(t[i++]);
      const refBlock = i < t.length ? unwrapBlock(t[i++]) : '';
      field.subformRef = parseSubformRef(subformId, refBlock);
      if (!field.type || field.type === 'string') {
        field.type = 'array';
      }
    } else if (cmd === 'reference') {
      field.referenceIds = tokenizePackage(t[i++]).map(stripWrapping);
    } else {
      // Forward-compatible: skip unknown keyword value
      unwrapBlock(t[i++]);
    }
  }
  return field;
}

/** `calculation_bindings { inputName: pathExpr … }` */
function parseCalculationBindings(block: string): CalculationBinding[] {
  const out: CalculationBinding[] = [];
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const key = stripColon(t[i++]);
    if (i >= t.length) {
      break;
    }
    if (t[i] === ':') {
      i++;
    }
    if (i < t.length) {
      out.push({ inputName: key, pathExpr: stripWrapping(t[i++]) });
    }
  }
  return out;
}

/** `evaluation { rule "…" condition "…" reference { … } }` */
function parseEvaluation(block: string): EvaluationRule {
  const rule: EvaluationRule = { rule: '', condition: '', referenceId: null };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'rule') {
      rule.rule = stripWrapping(t[i++]);
    } else if (cmd === 'condition') {
      rule.condition = stripWrapping(t[i++]);
    } else if (cmd === 'reference') {
      const ids = tokenizePackage(t[i++]).map(stripWrapping);
      rule.referenceId = ids[0] ?? null;
    } else {
      unwrapBlock(t[i++]);
    }
  }
  return rule;
}

/** `fields { field a { … } field b : number { … } … }` (recursive) */
function parseNestedFields(block: string): FormField[] {
  const out: FormField[] = [];
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (cmd !== 'field') {
      if (i < t.length) {
        unwrapBlock(t[i - 1]);
      }
      continue;
    }
    const head = readFieldHead(t, i);
    if (!head) {
      break;
    }
    out.push(parseFormField(head.name, head.block, head.type || undefined));
    i = head.next;
  }
  return out;
}

/** Parse `applicability { dim: [A, B] dim2: { A: 5, B: 3 } }` entries. */
export function parseApplicability(block: string): ApplicabilityEntry[] {
  const entries: ApplicabilityEntry[] = [];
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const dimension = stripColon(t[i++]);
    if (i >= t.length) {
      break;
    }
    if (t[i] === ':') {
      i++;
    }
    if (i < t.length) {
      const read = readBalanced(t, i);
      i = read.next;
      // text is `[A, B]`, `{ A: 5, B: 5 }`, or a bare value
      const trimmed = read.text.trim();
      let entry: ApplicabilityEntry;
      if (trimmed.startsWith('[')) {
        const inner = trimmed.slice(1, trimmed.lastIndexOf(']'));
        const values = inner.split(/[,\s]+/).filter(s => s.length > 0);
        entry = { dimension, values, mapping: null, match: null };
      } else if (trimmed.startsWith('{')) {
        // Mapping form
        const inner = trimmed.slice(1, -1);
        const mapping: Record<string, string | number> = {};
        for (const pair of inner
          .split(/[,\n]+/)
          .map(s => s.trim())
          .filter(s => s)) {
          const m = pair.match(/^(\w+)\s*:\s*(.+)$/);
          if (m) {
            mapping[m[1]] = m[2].trim();
          }
        }
        entry = { dimension, values: [], mapping, match: null };
      } else {
        // Single value
        entry = {
          dimension,
          values: [stripWrapping(trimmed)],
          mapping: null,
          match: null,
        };
      }
      // Declared-condition match mode (rc.yaml $defs/applicability):
      // `match any|all` follows the values — universal matching for
      // set-cardinality dimensions (default 'any', existential).
      if (!entry.mapping && t[i] === 'match') {
        i++;
        const mode = stripWrapping(t[i++] ?? '');
        if (mode !== 'any' && mode !== 'all') {
          throw new Error(
            `Parsing error: applicability: Unknown match ${mode} (valid: any, all)`,
          );
        }
        entry.match = mode;
      }
      entries.push(entry);
    }
  }
  return entries;
}

/** Parse `SubformID { parameters { … } applicability { … } }` */
export function parseSubformRef(subformId: string, block: string): SubformRef {
  const ref: SubformRef = {
    subformId: stripWrapping(subformId),
    parameters: {},
    applicability: [],
  };
  if (block && block.trim()) {
    const t = tokenize(block);
    let i = 0;
    while (i < t.length) {
      const cmd = t[i++];
      if (i < t.length) {
        if (cmd === 'parameters') {
          const pblock = unwrapBlock(t[i++]);
          const pt = tokenize(pblock);
          let j = 0;
          while (j < pt.length) {
            const key = stripColon(pt[j++]);
            if (j < pt.length) {
              if (pt[j] === ':') {
                j++;
              }
              if (j < pt.length) {
                ref.parameters[key] = stripWrapping(pt[j++]);
              }
            }
          }
        } else if (cmd === 'applicability') {
          ref.applicability = parseApplicability(unwrapBlock(t[i++]));
        } else {
          unwrapBlock(t[i++]);
        }
      }
    }
  }
  return ref;
}

/** Dump one field with full fidelity (recursive for nested fields). */
export function dumpFormField(field: FormField, indent: string): string {
  let out = '';
  if (field.subformRef) {
    const sr = field.subformRef;
    out += indent + 'subform_ref ' + sr.subformId + ' { ';
    const pkeys = Object.keys(sr.parameters);
    if (pkeys.length > 0) {
      out += 'parameters { ';
      for (const k of pkeys) {
        out += k + ': ' + sr.parameters[k] + ' ';
      }
      out += '} ';
    }
    if (sr.applicability.length > 0) {
      out +=
        'applicability { ' + dumpApplicabilityEntries(sr.applicability) + '} ';
    }
    out += '}\n';
    return out;
  }

  const inner: string[] = [];
  if (field.label) {
    inner.push('label "' + escapeString(field.label) + '"');
  }
  if (field.definition) {
    inner.push('definition "' + escapeString(field.definition) + '"');
  }
  if (field.unit) {
    inner.push('unit "' + escapeString(field.unit) + '"');
  }
  if (field.required) {
    inner.push('required true');
  }
  if (field.measurementMethod) {
    inner.push('measurement_method ' + field.measurementMethod);
  }
  if (field.calculationId) {
    inner.push('calculation ' + dumpBareSafe(field.calculationId));
  }
  if (field.calculationBindings.length > 0) {
    inner.push(
      'calculation_bindings { ' +
        field.calculationBindings
          .map(b => b.inputName + ': ' + b.pathExpr)
          .join(' ') +
        '}',
    );
  }
  if (field.derivation) {
    inner.push('derivation "' + escapeString(field.derivation) + '"');
  }
  if (field.evaluation) {
    let ev = 'evaluation { rule "' + escapeString(field.evaluation.rule) + '"';
    if (field.evaluation.condition) {
      ev += ' condition "' + escapeString(field.evaluation.condition) + '"';
    }
    if (field.evaluation.referenceId) {
      ev += ' reference { ' + field.evaluation.referenceId + ' }';
    }
    inner.push(ev + ' }');
  }
  if (field.values.length > 0) {
    inner.push('values { ' + field.values.join(' ') + ' }');
  }
  if (field.hasDefault) {
    inner.push('default ' + field.defaultValue);
  }
  if (field.itemsType) {
    inner.push('items { ' + field.itemsType + ' }');
  }
  if (field.minItems !== undefined && field.minItems !== null) {
    inner.push('min_items ' + field.minItems);
  }
  if (field.maxItems !== undefined && field.maxItems !== null) {
    inner.push('max_items ' + field.maxItems);
  }
  if (field.series) {
    inner.push(dumpSeriesDecl(field.series));
  }
  if (field.fields.length > 0) {
    inner.push(
      'fields {\n' +
        field.fields.map(f => dumpFormField(f, indent + '    ')).join('') +
        indent +
        '  }',
    );
  }
  if (field.referenceIds.length > 0) {
    inner.push('reference { ' + field.referenceIds.join(' ') + ' }');
  }

  const typeSpec =
    field.type && field.type !== 'string' ? ' : ' + field.type : '';
  if (inner.length === 0) {
    return indent + 'field ' + field.name + typeSpec + ' { }\n';
  }
  if (inner.every(s => !s.includes('\n'))) {
    return (
      indent +
      'field ' +
      field.name +
      typeSpec +
      ' { ' +
      inner.join(' ') +
      ' }\n'
    );
  }
  return (
    indent +
    'field ' +
    field.name +
    typeSpec +
    ' {\n' +
    inner.map(s => indent + '  ' + s + '\n').join('') +
    indent +
    '}\n'
  );
}

/** Dump applicability entries inside an `applicability { … }` block. */
export function dumpApplicabilityEntries(
  entries: ApplicabilityEntry[],
): string {
  let out = '';
  for (const a of entries) {
    if (a.mapping) {
      out += a.dimension + ': { ';
      for (const [k, v] of Object.entries(a.mapping)) {
        out += k + ': ' + v + ' ';
      }
      out += '} ';
    } else {
      out += a.dimension + ': [' + a.values.join(', ') + '] ';
      if (a.match) {
        out += 'match ' + a.match + ' ';
      }
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────
// Instantiation (Primmel v3, TODO.roadmap/03): the `instance` construct.
//
//   instance smp-hbk-hlci-001 {
//     of LoadCellSample
//     level sample
//     model mod-hbk-hlci-2-2t-c3          // upward chain link(s)
//     definition_versions { LoadCellSample : "2021" attributes : "1.0.0" }
//     has {
//       attributes { e_max : 2.2 t }      // own exhibited values (parameters)
//       dimensions { accuracy_class : C } // classification (not on samples)
//       test_context { d_min : 0 kg }     // sample-scope values, never inherited
//     }
//   }
//
// The `of <SubjectRef>` head of the doctrine's grammar sketch
// (`instance X of Y { … }`) lives INSIDE the block: the parser's takesID
// contract consumes exactly (id, block-payload), so a three-token head is
// not expressible — `of` is a body keyword here, with the same meaning.
//
// Value entries are `key : value [unit]` pairs; the value token may be a
// quoted string (kept a string even when numeric — "2.1" ≠ 2.1), an
// unquoted numeric literal (parsed to a number), or any other bare token.
// A value may also take the QuantityValue BLOCK form (TODO.roadmap/06):
//   key : { value 2.2 unit t kind mass uncertainty 0.001 tolerance 0.5 }
// carrying the full INV-1 contract (unit, kind, uncertainty, tolerance).
// Sample-scope (test-dependent) values live in has.testContext only; the
// scope discipline of every entry is a LINTER concern (C17), the parse
// stays lenient. Delegation resolution of these values is NOT here — see
// src/instance-resolution.ts (INV-10).
// ─────────────────────────────────────────────────────────────────────

import tokenize from '../tokenize';
import { unwrapBlock, stripWrapping, tokenizePackage } from '../tokenize';
import { stripColon, dumpBareSafe } from './field-parser';
import {
  coerceValueToken,
  dumpQuantityValue,
  readQuantityBlock,
} from './quantity';
import type { ConstructDefinition } from './index';
import type { Instance, InstanceValue } from '../../types/Instance';

/** A token that heads a `key : value` entry: unquoted, trailing colon. */
function isKeyHead(tok: string): boolean {
  return !tok.startsWith('"') && tok.endsWith(':') && tok.length > 1;
}

/**
 * Read `<key> : <value> [unit]` entries. Entry boundaries: the next key is
 * either a bare `key` token followed by a `:` token, or an attached-colon
 * `key:` token. The value is one token (quoted strings stay one token), the
 * optional unit a second; anything more is a parse error — multi-word
 * values must be quoted so the unit position stays unambiguous. A single
 * brace-block token is the QuantityValue block form (value/unit/kind/
 * uncertainty/tolerance).
 *
 * Exported for the artifact_instance content map (task 09) — the same
 * `key : value [unit]` entry shape.
 */
export function readValueMap(block: string): Record<string, InstanceValue> {
  const out: Record<string, InstanceValue> = {};
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const key = stripColon(t[i++]);
    if (!key) {
      break;
    }
    if (t[i] === ':') {
      i++;
    }
    const parts: string[] = [];
    while (i < t.length && t[i + 1] !== ':' && !isKeyHead(t[i])) {
      parts.push(t[i++]);
    }
    if (parts.length === 0) {
      out[key] = { value: '' };
      continue;
    }
    if (parts.length > 2) {
      throw new Error(
        `Parsing error: instance value entry "${key}" has ${parts.length} tokens ` +
          `(shape: key : value [unit]) — quote multi-word values`,
      );
    }
    // QuantityValue block form: `key : { value … unit … kind … }`.
    if (parts.length === 1 && parts[0].startsWith('{')) {
      out[key] = readQuantityBlock(unwrapBlock(parts[0]));
      continue;
    }
    const [rawValue, rawUnit] = parts;
    const value = coerceValueToken(rawValue);
    out[key] =
      rawUnit === undefined
        ? { value }
        : { value, unit: stripWrapping(rawUnit) };
  }
  return out;
}

/** Read `<key> : <value>` single-token string entries (dimensions, versions). */
function readStringMap(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const key = stripColon(t[i++]);
    if (!key) {
      break;
    }
    if (t[i] === ':') {
      i++;
    }
    if (i < t.length) {
      out[key] = stripWrapping(t[i++]);
    }
  }
  return out;
}

function readReference(block: string): string[] {
  return tokenize(stripWrapping(block))
    .map(stripWrapping)
    .filter(s => s.length > 0);
}

function parseInstanceHas(block: string, result: Instance): void {
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'attributes') {
      result.has.attributes = readValueMap(unwrapBlock(t[i++]));
    } else if (cmd === 'dimensions') {
      result.has.dimensions = readStringMap(unwrapBlock(t[i++]));
    } else if (cmd === 'test_context') {
      result.has.testContext = readValueMap(unwrapBlock(t[i++]));
    } else {
      unwrapBlock(t[i++]);
    }
  }
}

const parseInstance: ConstructDefinition['parse'] = function (id, data) {
  const result: Instance = {
    id,
    of: '',
    level: '',
    model: '',
    group: '',
    family: '',
    definitionVersions: {},
    has: { attributes: {}, dimensions: {}, testContext: {} },
    referenceIds: [],
  };

  const t = tokenizePackage(data);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'of') {
      result.of = stripWrapping(t[i++]);
    } else if (cmd === 'level') {
      result.level = stripWrapping(t[i++]);
    } else if (cmd === 'model') {
      result.model = stripWrapping(t[i++]);
    } else if (cmd === 'group') {
      result.group = stripWrapping(t[i++]);
    } else if (cmd === 'family') {
      result.family = stripWrapping(t[i++]);
    } else if (cmd === 'definition_versions') {
      result.definitionVersions = readStringMap(unwrapBlock(t[i++]));
    } else if (cmd === 'has') {
      parseInstanceHas(unwrapBlock(t[i++]), result);
    } else if (cmd === 'reference') {
      result.referenceIds = readReference(t[i++]);
    } else {
      unwrapBlock(t[i++]);
    }
  }

  return ctx => {
    ctx.instances[id] = result;
    return ctx;
  };
};

// ── dump ─────────────────────────────────────────────────────────────

// Value emission is shared with the dual construct (ser-des/config/
// quantity.ts): numbers bare; strings quoted when unsafe, when they would
// re-parse as a number (quoted-numeric round-trip), or when they end in a
// colon — a bare trailing-colon token re-parses as a KEY head (isKeyHead),
// splitting the entry in two. Values carrying kind/uncertainty/tolerance
// emit the QuantityValue block form.

function dumpInstanceValueMap(
  keyword: string,
  map: Record<string, InstanceValue>,
): string {
  const keys = Object.keys(map);
  if (keys.length === 0) {
    return '';
  }
  return (
    '    ' +
    keyword +
    ' { ' +
    keys.map(k => k + ' : ' + dumpQuantityValue(map[k])).join(' ') +
    ' }\n'
  );
}

function dumpInstanceStringMap(
  keyword: string,
  map: Record<string, string>,
): string {
  const keys = Object.keys(map);
  if (keys.length === 0) {
    return '';
  }
  return (
    '    ' +
    keyword +
    ' { ' +
    keys.map(k => k + ' : ' + dumpBareSafe(map[k])).join(' ') +
    ' }\n'
  );
}

const dumpInstance = function (inst: Instance): string {
  let out = 'instance ' + inst.id + ' {\n';
  if (inst.of) {
    out += '  of ' + inst.of + '\n';
  }
  if (inst.level) {
    out += '  level ' + inst.level + '\n';
  }
  if (inst.model) {
    out += '  model ' + inst.model + '\n';
  }
  if (inst.group) {
    out += '  group ' + inst.group + '\n';
  }
  if (inst.family) {
    out += '  family ' + inst.family + '\n';
  }
  const versions = Object.keys(inst.definitionVersions);
  if (versions.length > 0) {
    out +=
      '  definition_versions { ' +
      versions
        .map(k => k + ' : ' + dumpBareSafe(inst.definitionVersions[k]))
        .join(' ') +
      ' }\n';
  }
  const hasBody =
    dumpInstanceValueMap('attributes', inst.has.attributes) +
    dumpInstanceStringMap('dimensions', inst.has.dimensions) +
    dumpInstanceValueMap('test_context', inst.has.testContext);
  if (hasBody) {
    out += '  has {\n' + hasBody + '  }\n';
  }
  if (inst.referenceIds.length > 0) {
    out += '  reference { ' + inst.referenceIds.join(' ') + ' }\n';
  }
  out += '}\n';
  return out;
};

export const instanceConstruct = {
  keyword: 'instance',
  field: 'instances',
  takesID: true,
  parse: parseInstance,
  dump: dumpInstance,
} as const;

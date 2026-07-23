import type { Dumper, Parser } from '../types';
import tokenize, {
  escapeString,
  unescapeString,
  unwrapBlock,
  stripWrapping,
  tokenizePackage,
} from '../tokenize';
import { stripColon, readBalanced, dumpBareSafe } from './field-parser';
import {
  parseSourceDiscrepancy,
  dumpSourceDiscrepancy,
} from './sourceDiscrepancy';
import type Table from '../../types/Table';
import type { TableColumnDef, TableProfileDef } from '../../types/Table';
import type { SourceRef } from '../../types/Subject';

/** Numeric-looking values parse as numbers, everything else stays a string. */
function numOrString(s: string): string | number {
  if (s.trim() !== '' && !isNaN(Number(s))) {
    return Number(s);
  }
  return s;
}

function readSource(block: string): SourceRef {
  const src: SourceRef = { doc: '', clause: '' };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'doc') {
      src.doc = stripWrapping(t[i++]);
    } else if (cmd === 'clause') {
      src.clause = stripWrapping(t[i++]);
    } else {
      unwrapBlock(t[i++]);
    }
  }
  return src;
}

/** columns { accuracy_class: string load_min: number "v" … } — typed form. */
function parseColumnDefs(block: string): TableColumnDef[] {
  const out: TableColumnDef[] = [];
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const name = stripColon(t[i++]);
    if (!name) {
      break;
    }
    if (i < t.length && t[i] === ':') {
      i++;
    }
    const type = i < t.length ? stripWrapping(t[i++]) : '';
    let unit = '';
    if (i < t.length && t[i].startsWith('"')) {
      unit = stripWrapping(t[i++]);
    }
    out.push({ name, type, unit });
  }
  return out;
}

/** Scalar map inside a binding: { min: 0 max: 50000 factor: 0.5 }. */
function parseBindingObject(block: string): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const key = stripColon(t[i++]);
    if (!key) {
      break;
    }
    if (i < t.length && t[i] === ':') {
      i++;
    }
    if (i < t.length) {
      out[key] = numOrString(stripWrapping(t[i++]));
    }
  }
  return out;
}

/**
 * binding { A: 5 B: { min: 50000 } C: [{ min: 0 } { min: 5 }] } — values
 * are bare scalars (number when numeric), { k: v } objects, or arrays
 * of objects (the `[...]` is not tokenizer-balanced — readBalanced).
 */
function parseBinding(block: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const key = stripColon(t[i++]);
    if (!key) {
      break;
    }
    if (i < t.length && t[i] === ':') {
      i++;
    }
    if (i >= t.length) {
      break;
    }
    if (t[i].startsWith('[')) {
      const read = readBalanced(t, i);
      i = read.next;
      const inner = read.text.trim().slice(1, read.text.lastIndexOf(']'));
      const items: Record<string, string | number>[] = [];
      for (const tok of tokenize(inner)) {
        if (tok.startsWith('{')) {
          items.push(parseBindingObject(unwrapBlock(tok)));
        }
      }
      out[key] = items;
    } else if (t[i].startsWith('{')) {
      out[key] = parseBindingObject(unwrapBlock(t[i++]));
    } else {
      out[key] = numOrString(stripWrapping(t[i++]));
    }
  }
  return out;
}

function parseProfileDef(name: string, block: string): TableProfileDef {
  const def: TableProfileDef = {
    name,
    description: '',
    dimension: '',
    unit: '',
    type: '',
    sourceDiscrepancy: null,
    binding: {},
  };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'description') {
      def.description = stripWrapping(t[i++]);
    } else if (cmd === 'dimension') {
      def.dimension = stripWrapping(t[i++]);
    } else if (cmd === 'unit') {
      def.unit = stripWrapping(t[i++]);
    } else if (cmd === 'type') {
      def.type = stripWrapping(t[i++]);
    } else if (cmd === 'source_discrepancy') {
      def.sourceDiscrepancy = parseSourceDiscrepancy(unwrapBlock(t[i++]));
    } else if (cmd === 'binding') {
      def.binding = parseBinding(unwrapBlock(t[i++]));
    } else {
      unwrapBlock(t[i++]);
    }
  }
  return def;
}

/** profiles { <dimension> { <value> { <payload tokens> } } } — raw payload preserved as text map. */
function parseProfiles(block: string): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const dim = stripColon(t[i++]);
    if (!dim) {
      break;
    }
    if (i < t.length && t[i] === ':') {
      i++;
    }
    if (i < t.length && t[i].startsWith('{')) {
      const vblock = unwrapBlock(t[i++]);
      const vt = tokenize(vblock);
      const values: Record<string, unknown> = {};
      let j = 0;
      while (j < vt.length) {
        const val = stripColon(vt[j++]);
        if (!val) {
          break;
        }
        if (j < vt.length && vt[j] === ':') {
          j++;
        }
        if (j < vt.length && vt[j].startsWith('{')) {
          // payload as raw trimmed content (structure preserved textually)
          values[val] = unwrapBlock(vt[j++]).trim();
        } else if (j < vt.length) {
          values[val] = stripWrapping(vt[j++]);
        }
      }
      out[dim] = values;
    }
  }
  return out;
}

/** overrides { field_automatic { condition statistical_analysis by evaluator } } */
function parseOverrides(
  block: string,
): Record<string, { condition: string; by: string }> {
  const out: Record<string, { condition: string; by: string }> = {};
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const key = stripColon(t[i++]);
    if (!key) {
      break;
    }
    if (i < t.length && t[i] === ':') {
      i++;
    }
    if (i < t.length && t[i].startsWith('{')) {
      const ot = tokenize(unwrapBlock(t[i++]));
      const entry = { condition: '', by: '' };
      let j = 0;
      while (j < ot.length) {
        const oc = ot[j++];
        if (j >= ot.length) {
          break;
        }
        if (oc === 'condition') {
          entry.condition = stripWrapping(ot[j++]);
        } else if (oc === 'by') {
          entry.by = stripWrapping(ot[j++]);
        } else {
          unwrapBlock(ot[j++]);
        }
      }
      out[key] = entry;
    }
  }
  return out;
}

export const parseTable: Parser = function (id, data) {
  const result: Table = {
    id,
    title: '',
    description: '',
    columns: '',
    columnDefs: null,
    display: '',
    data: [],
    domain: null,
    overrides: null,
    sourceRef: null,
    sourceDiscrepancy: null,
  };

  if (data !== '') {
    const t: Array<string> = tokenizePackage(data);
    let i = 0;
    while (i < t.length) {
      const command: string = t[i++];
      if (i < t.length) {
        if (command === 'title') {
          result.title = unwrapBlock(t[i++]);
        } else if (command === 'description') {
          result.description = stripWrapping(t[i++]);
        } else if (command === 'columns') {
          const tok = t[i++];
          if (tok.startsWith('{')) {
            // Typed form: columns { accuracy_class: string load_min: number "v" }
            result.columnDefs = parseColumnDefs(unwrapBlock(tok));
          } else {
            result.columns = unwrapBlock(tok);
          }
        } else if (command === 'display') {
          result.display = unwrapBlock(t[i++]);
        } else if (command === 'source') {
          // Structured provenance: source { doc "urn:..." clause "4" }
          // Repeated source blocks collect into sourceRefs (TODO.roadmap/24).
          const src = readSource(unwrapBlock(t[i++]));
          if (!result.sourceRef) {
            result.sourceRef = src;
          }
          (result.sourceRefs ??= []).push(src);
        } else if (command === 'source_discrepancy') {
          result.sourceDiscrepancy = parseSourceDiscrepancy(
            unwrapBlock(t[i++]),
          );
        } else if (command === 'overrides') {
          result.overrides = parseOverrides(unwrapBlock(t[i++]));
        } else if (command === 'profiles') {
          // profiles { accuracy_class { A { ... } } } (legacy) and/or
          // profiles { profile <name> { ... } } (structured, v2)
          const pt = tokenize(unwrapBlock(t[i++]));
          const legacyParts: string[] = [];
          let j = 0;
          while (j < pt.length) {
            if (pt[j] === 'profile') {
              j++;
              const name = stripWrapping(pt[j++]);
              const pblock = j < pt.length ? unwrapBlock(pt[j++]) : '';
              result.profileDefs = result.profileDefs ?? [];
              result.profileDefs.push(parseProfileDef(name, pblock));
            } else {
              legacyParts.push(pt[j++]);
            }
          }
          if (legacyParts.length > 0) {
            result.profiles = parseProfiles(legacyParts.join(' '));
          }
        } else if (command === 'domain') {
          // Domain block is captured as raw package string
          result.domain = unwrapBlock(t[i++]) as unknown as Record<
            string,
            unknown
          >;
        } else if (command === 'data') {
          // Data block contains CSV-like rows
          const dataBlock = unwrapBlock(t[i++]);
          result.data = parseTableData(dataBlock);
        } else {
          i++; // forward-compatible: skip unknown keyword value
        }
      } else {
        throw new Error(
          `Parsing error: table. ID ${id}: Expecting value for ${command}`,
        );
      }
    }
  }

  return ctx => {
    ctx.tables[id] = result;
    return ctx;
  };
};

function parseTableData(block: string): string[][] {
  // Simple line-by-line, whitespace-separated. Quoted cells honour
  // backslash escapes (\" and \\) and are unescaped on consumption —
  // the same contract as stripWrapping elsewhere, so load→dump→load
  // cycles don't accumulate backslashes.
  const rows = block
    .split(/\n+/)
    .map(r => r.trim())
    .filter(r => r.length > 0);
  return rows.map(row => {
    const cells: string[] = [];
    const re = /"((?:[^"\\]|\\.)*)"|(\S+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(row)) !== null) {
      cells.push(m[1] !== undefined ? unescapeString(m[1]) : (m[2] ?? ''));
    }
    return cells;
  });
}

function dumpBindingScalar(v: unknown): string {
  if (typeof v === 'number') {
    return String(v);
  }
  return dumpBareSafe(String(v));
}

function dumpBindingValue(v: unknown): string {
  if (Array.isArray(v)) {
    return (
      '[' +
      v
        .map(item =>
          typeof item === 'object' && item !== null
            ? '{ ' +
              Object.entries(item as Record<string, unknown>)
                .map(([k, val]) => k + ': ' + dumpBindingScalar(val))
                .join(' ') +
              ' }'
            : dumpBindingScalar(item),
        )
        .join(' ') +
      ']'
    );
  }
  if (typeof v === 'object' && v !== null) {
    return (
      '{ ' +
      Object.entries(v as Record<string, unknown>)
        .map(([k, val]) => k + ': ' + dumpBindingScalar(val))
        .join(' ') +
      ' }'
    );
  }
  return dumpBindingScalar(v);
}

export const dumpTable: Dumper<Table> = function (t) {
  let out = 'table ' + t.id + ' {\n';
  out += '  title "' + t.title + '"\n';
  if (t.description) {
    out += '  description "' + escapeString(t.description) + '"\n';
  }
  if (t.columnDefs && t.columnDefs.length > 0) {
    out += '  columns {\n';
    for (const c of t.columnDefs) {
      let line = '    ' + c.name + ': ' + c.type;
      if (c.unit) {
        line += ' "' + escapeString(c.unit) + '"';
      }
      out += line + '\n';
    }
    out += '  }\n';
  } else {
    out += '  columns "' + t.columns + '"\n';
  }
  if (t.display) {
    out += '  display "' + t.display + '"\n';
  }
  for (const src of t.sourceRefs ??
    (t.sourceRef && (t.sourceRef.doc || t.sourceRef.clause)
      ? [t.sourceRef]
      : [])) {
    out +=
      '  source { doc "' +
      escapeString(src.doc) +
      '" clause "' +
      escapeString(src.clause) +
      '" }\n';
  }
  if (t.sourceDiscrepancy) {
    out += dumpSourceDiscrepancy(t.sourceDiscrepancy, '  ') + '\n';
  }
  if (t.overrides && Object.keys(t.overrides).length > 0) {
    out += '  overrides { ';
    for (const [key, o] of Object.entries(t.overrides)) {
      out += key + ' { condition ' + o.condition + ' by ' + o.by + ' } ';
    }
    out += '}\n';
  }
  if (t.domain) {
    out += '  domain { }\n';
  }
  if (t.data.length > 0) {
    out += '  data {\n';
    for (const row of t.data) {
      const cells = row.map(c => `"${escapeString(c)}"`).join(' ');
      out += '    ' + cells + '\n';
    }
    out += '  }\n';
  }
  if (
    (t.profiles && Object.keys(t.profiles).length > 0) ||
    (t.profileDefs && t.profileDefs.length > 0)
  ) {
    out += '  profiles {\n';
    for (const [dim, values] of Object.entries(t.profiles ?? {})) {
      out += '    ' + dim + ' { ';
      for (const [val, payload] of Object.entries(values)) {
        out += val + ': { ' + String(payload) + ' } ';
      }
      out += '}\n';
    }
    for (const p of t.profileDefs ?? []) {
      let line = '    profile ' + p.name + ' { ';
      if (p.description) {
        line += 'description "' + escapeString(p.description) + '" ';
      }
      if (p.dimension) {
        line += 'dimension ' + p.dimension + ' ';
      }
      if (p.unit) {
        line += 'unit "' + escapeString(p.unit) + '" ';
      }
      if (p.type) {
        line += 'type ' + p.type + ' ';
      }
      if (p.sourceDiscrepancy) {
        line += dumpSourceDiscrepancy(p.sourceDiscrepancy, '') + ' ';
      }
      line += 'binding { ';
      for (const [val, payload] of Object.entries(p.binding)) {
        line += val + ': ' + dumpBindingValue(payload) + ' ';
      }
      line += '} ';
      out += line + '}\n';
    }
    out += '  }\n';
  }
  out += '}\n';
  return out;
};

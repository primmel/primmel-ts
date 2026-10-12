// ─────────────────────────────────────────────────────────────────────
// The LML-aligned constructs' parsers and dumpers (TODO.lang-gaps 03
// 04 09 11 13). Facet interpretation is deliberately thin: the
// constructs carry their declared data; the checker (C158–C167) does
// the discipline.
// ─────────────────────────────────────────────────────────────────────

import type { Dumper, Parser } from '../types';
import {
  escapeString,
  stripWrapping,
  tokenizePackage,
  unwrapBlock,
} from '../tokenize';
import { forEachEntry } from '../parse-block';
import type { ParseContext } from '../types';
import type {
  Check,
  Datum,
  DatumRender,
  NamespaceDecl,
  StringFormat,
  WireMapEntry,
  WireMapping,
} from '../../types/LmlAligned';

const MATH_NOTATIONS = ['asciimath', 'latex', 'unicodemath', 'mathml', 'omml'];
const MAPPING_FORMATS = ['xml', 'yaml', 'json', 'toml', 'csv'];

/** The materialized mapping id is `<format>:<Class>` — the two-token
 *  LML declaration, folded by the shape front end. */
function splitMappingId(id: string): {
  format: WireMapping['format'];
  target: string;
} {
  const at = id.indexOf(':');
  const format = (at === -1 ? 'xml' : id.slice(0, at)) as WireMapping['format'];
  return { format, target: at === -1 ? id : id.slice(at + 1) };
}

export const parseWireMapping: Parser = function (id, data) {
  const { format, target } = splitMappingId(id);
  const out: WireMapping = {
    id,
    format,
    target,
    element: '',
    namespaceRef: '',
    content: '',
    mixed: false,
    renderNil: null,
    entries: [],
    source: null,
  };
  forEachEntry(
    data,
    (command, value, peek) => {
      if (command === 'element') {
        out.element = stripWrapping(value());
      } else if (command === 'namespace') {
        out.namespaceRef = stripWrapping(value());
      } else if (command === 'mixed_content') {
        value();
        out.mixed = true;
      } else if (command === 'render_nil') {
        out.renderNil = stripWrapping(value()) === 'true';
      } else if (command === 'map_content') {
        out.content = stripWrapping(value());
      } else if (
        command === 'map_element' ||
        command === 'map_attribute' ||
        command === 'map'
      ) {
        const wire = stripWrapping(value());
        const name = peek() !== undefined ? stripWrapping(value()) : '';
        const kind: WireMapEntry['kind'] =
          command === 'map_element'
            ? 'element'
            : command === 'map_attribute'
              ? 'attribute'
              : 'map';
        out.entries.push({ kind, wire, name, modifier: '' });
      } else if (command === 'map_key' || command === 'map_value') {
        // map_key to_instance <name> / map_value to_instance|as_attribute <name>
        const modifier = stripWrapping(value());
        const name = peek() !== undefined ? stripWrapping(value()) : '';
        out.entries.push({ kind: 'map', wire: command, name, modifier });
      } else {
        return false;
      }
      return true;
    },
    { construct: 'mapping', id },
  );
  return (ctx: ParseContext) => {
    ctx.wireMappings[id] = out;
    return ctx;
  };
};

export const dumpWireMapping: Dumper<WireMapping> = function (w) {
  const lines: string[] = [`mapping ${w.format} ${w.target} {`];
  if (w.element) {
    lines.push(`  element "${escapeString(w.element)}"`);
  }
  if (w.namespaceRef) {
    lines.push(`  namespace ${w.namespaceRef}`);
  }
  for (const e of w.entries) {
    if (e.kind === 'map' && e.modifier) {
      lines.push(`  ${e.wire} ${e.modifier} ${e.name}`);
    } else {
      const kw =
        e.kind === 'element'
          ? 'map_element'
          : e.kind === 'attribute'
            ? 'map_attribute'
            : 'map';
      lines.push(`  ${kw} "${escapeString(e.wire)}" ${e.name}`);
    }
  }
  if (w.content) {
    lines.push(`  map_content ${w.content}`);
  }
  if (w.mixed) {
    lines.push(`  mixed_content`);
  }
  if (w.renderNil !== null) {
    lines.push(`  render_nil ${w.renderNil}`);
  }
  lines.push('}');
  return lines.join('\n');
};

export const parseStringFormat: Parser = function (rawId, data) {
  // The registered format name carries the colon sigil (`:pubid_iso` —
  // LML's registered-format shape). A bare id is a parse error: the
  // sigil is what distinguishes a format registration from any other
  // declaration the token front end might rescue.
  if (!rawId.startsWith(':')) {
    throw new Error(
      `Parsing error: string_format. ID ${rawId}: the registered format name carries the colon sigil (string_format :${rawId})`,
    );
  }
  const id = rawId.slice(1);
  const out: StringFormat = { id, artifact: '', root: '', source: null };
  forEachEntry(
    data,
    (command, value) => {
      if (command === 'artifact') {
        out.artifact = stripWrapping(value());
      } else if (command === 'root') {
        out.root = stripWrapping(value());
      } else {
        return false;
      }
      return true;
    },
    { construct: 'string_format', id },
  );
  return (ctx: ParseContext) => {
    ctx.stringFormats[id] = out;
    return ctx;
  };
};

export const dumpStringFormat: Dumper<StringFormat> = function (f) {
  return [
    `string_format :${f.id} {`,
    `  artifact "${escapeString(f.artifact)}"`,
    `  root "${escapeString(f.root)}"`,
    '}',
  ].join('\n');
};

export const parseNamespace: Parser = function (id, data) {
  const out: NamespaceDecl = {
    id,
    uri: '',
    prefix: '',
    isDefault: false,
    source: null,
  };
  forEachEntry(
    data,
    (command, value) => {
      if (command === 'uri') {
        out.uri = stripWrapping(value());
      } else if (command === 'prefix') {
        out.prefix = stripWrapping(value());
      } else if (command === 'default') {
        value();
        out.isDefault = true;
      } else {
        return false;
      }
      return true;
    },
    { construct: 'namespace', id },
  );
  return (ctx: ParseContext) => {
    ctx.namespaces[id] = out;
    return ctx;
  };
};

export const dumpNamespace: Dumper<NamespaceDecl> = function (d) {
  const lines = [`namespace ${d.id} {`, `  uri "${escapeString(d.uri)}"`];
  if (d.prefix) {
    lines.push(`  prefix "${escapeString(d.prefix)}"`);
  }
  if (d.isDefault) {
    lines.push(`  default`);
  }
  lines.push('}');
  return lines.join('\n');
};

export const parseDatum: Parser = function (id, raw) {
  // The datum's type capture rides the payload head (`: <type> { ... }`
  // — the parg captures it between the ident and the block).
  const data = raw.replace(/^\s*:\s*\S+\s*/, '');
  const out: Datum = {
    id,
    type: '',
    unit: '',
    quantityKind: '',
    origin: 'declared',
    scope: '',
    renders: [],
    label: '',
    description: '',
    source: null,
  };
  forEachEntry(
    data,
    (command, value, peek) => {
      if (command === 'render') {
        const notation = stripWrapping(value()) as DatumRender['notation'];
        const text = peek() !== undefined ? stripWrapping(value()) : '';
        if (MATH_NOTATIONS.includes(notation)) {
          out.renders.push({ notation, text });
        }
      } else if (command === 'label') {
        out.label = stripWrapping(value());
      } else if (command === 'description') {
        const v = value();
        out.description = v.startsWith('{') ? unwrapBlock(v) : stripWrapping(v);
      } else if (command === 'unit') {
        out.unit = stripWrapping(value());
      } else if (command === 'quantity_kind') {
        out.quantityKind = stripWrapping(value());
      } else if (command === 'origin') {
        const o = stripWrapping(value());
        if (['declared', 'design-fixed', 'observed', 'computed'].includes(o)) {
          out.origin = o as Datum['origin'];
        }
      } else if (command === 'scope') {
        out.scope = stripWrapping(value());
      } else {
        return false;
      }
      return true;
    },
    { construct: 'datum', id },
  );
  return (ctx: ParseContext) => {
    ctx.datums[id] = out;
    return ctx;
  };
};

export const dumpDatum: Dumper<Datum> = function (x) {
  const lines = [`datum ${x.id}${x.type ? ` : ${x.type}` : ''} {`];
  if (x.quantityKind) {
    lines.push(`  quantity_kind ${x.quantityKind}`);
  }
  if (x.unit) {
    lines.push(`  unit ${x.unit}`);
  }
  if (x.origin !== 'declared') {
    lines.push(`  origin ${x.origin}`);
  }
  if (x.scope) {
    lines.push(`  scope ${x.scope}`);
  }
  for (const r of x.renders) {
    lines.push(`  render ${r.notation} "${escapeString(r.text)}"`);
  }
  if (x.label) {
    lines.push(`  label "${escapeString(x.label)}"`);
  }
  if (x.description) {
    lines.push(`  description { ${x.description} }`);
  }
  lines.push('}');
  return lines.join('\n');
};

export const parseCheck: Parser = function (id, data) {
  const out: Check = {
    id,
    inputs: [],
    expression: '',
    operator: '',
    threshold: '',
    source: null,
  };
  forEachEntry(
    data,
    (command, value, peek) => {
      if (command === 'inputs') {
        const block = value();
        const inner = block.startsWith('{')
          ? tokenizePackage(unwrapBlock(block))
          : [];
        out.inputs = inner.map(x => stripWrapping(x));
      } else if (command === 'expression') {
        out.expression = stripWrapping(value());
      } else if (command === 'operator') {
        out.operator = stripWrapping(value());
      } else if (command === 'threshold') {
        const v = value();
        out.threshold = v.startsWith('{') ? unwrapBlock(v) : stripWrapping(v);
      } else {
        return false;
      }
      void peek;
      return true;
    },
    { construct: 'check', id },
  );
  return (ctx: ParseContext) => {
    ctx.checks[id] = out;
    return ctx;
  };
};

export const dumpCheck: Dumper<Check> = function (x) {
  const lines = [`check ${x.id} {`];
  if (x.inputs.length) {
    lines.push(`  inputs { ${x.inputs.join(' ')} }`);
  }
  if (x.expression) {
    lines.push(`  expression "${escapeString(x.expression)}"`);
  }
  if (x.operator) {
    lines.push(`  operator ${x.operator}`);
  }
  if (x.threshold) {
    lines.push(`  threshold ${x.threshold}`);
  }
  lines.push('}');
  return lines.join('\n');
};

export { MAPPING_FORMATS, MATH_NOTATIONS };

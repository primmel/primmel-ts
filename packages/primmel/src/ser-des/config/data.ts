import {
  DataAttribute,
  DataClass,
  Enum,
  EnumValue,
  Reference,
  Registry,
  ResolvableDataClass,
  ResolvableRegistry,
  ResolveableDataAttribute,
  Variable,
} from '../../types/data';
import { resolveFromContext } from '../resolve';
import { escapeString, tokenizePackage, stripWrapping } from '../tokenize';
import { forEachEntry, forEachAttribute, unwrapped } from '../parse-block';
import type { Ref } from './ref';
import { Dumper, Parser, Resolver } from '../types';

export const parseEnum: Parser = (id: string, data: string) => {
  const result: Enum = {
    id: id,
    values: [],
  };
  // Enum bodies are (value-id, block) pairs, not (keyword, value).
  // forEachEntry's contract still applies: the visitor always claims.
  forEachEntry(
    data,
    (_vid, value) => {
      result.values.push(parseEnumValue(_vid, value()));
      return true;
    },
    { construct: 'enum', id },
  );

  return ctx => {
    ctx.enums[id] = result;
    return ctx;
  };
};

const parseEnumValue = (id: string, data: string) => {
  const ev: EnumValue = {
    id: id,
    value: '',
  };
  forEachEntry(
    data,
    (command, value) => {
      if (command === 'definition') {
        ev.value = unwrapped(value);
      } else {
        return false;
      }
      return true;
    },
    { construct: 'enum value', id },
  );
  return ev;
};

export const parseRegistry: Parser = function (id, data) {
  const result: ResolvableRegistry = {
    id: id,
    title: '',
    data: null,
    _relations: {
      data: '',
    },
  };

  forEachEntry(
    data,
    (command, value) => {
      if (command === 'title') {
        result.title = unwrapped(value);
      } else if (command === 'data_class') {
        result._relations.data = value();
      } else {
        return false;
      }
      return true;
    },
    { construct: 'registry', id },
  );

  return ctx => {
    ctx.regs[id] = result;
    return ctx;
  };
};

export const parseDataClass: Parser = function (id, data) {
  const result: ResolvableDataClass = {
    id: id,
    attributes: [],
  };

  forEachAttribute(
    data,
    (basic, details) => {
      // Class-level ref (Extension 2 — primmel-ts#52). The unified ref
      // construct `ref <predicate> "<target>" [{ note "…" }]` is accepted
      // at class scope. The first whitespace-separated token is `ref`.
      if (basic.startsWith('ref ')) {
        // basic is `ref <predicate> "<target>"` — split carefully to
        // preserve the quoted target intact. tokenizePackage would
        // unwrap the outer chars (treating input as a block body), so
        // we hand-split instead.
        const m = basic.match(/^ref\s+(\S+)\s+"([^"]*)"$/);
        if (m) {
          const ref: Ref = { predicate: m[1]!, target: m[2]! };
          if (details) {
            const noteMatch =
              /note\s+"([^"]*)"/.exec(details) ?? /note\s+(\S+)/.exec(details);
            if (noteMatch) {
              ref.note = noteMatch[1];
            }
          }
          result.ref ??= [];
          result.ref.push(ref);
          return;
        }
        // Fall through: malformed ref — treat as unknown attribute.
      }
      // Reserved class-level entries (v2 G2 storage semantics):
      //   store { <name> } · indexes { a b c } · helper { true } · extends { <Class> }
      const head = basic.trim();
      if (head === 'store') {
        result.store = details.trim();
        return;
      }
      if (head === 'description') {
        // stripWrapping unescapes \" — the tokenizer keeps escapes raw.
        result.description = stripWrapping(details.trim());
        return;
      }
      if (head === 'indexes') {
        result.indexes = details.split(/\s+/).filter(x => x.length > 0);
        return;
      }
      if (head === 'helper') {
        result.helper = details.trim() === 'true';
        return;
      }
      if (head === 'extends') {
        result.extends = details.trim();
        return;
      }
      result.attributes.push(parseDataAttribute(head, details));
    },
    { construct: 'class', id },
  );

  return ctx => {
    ctx.dataclasses[id] = result;
    return ctx;
  };
};

const parseDataAttribute = (
  basic: string,
  details: string,
): ResolveableDataAttribute => {
  const result: ResolveableDataAttribute = {
    id: '',
    type: '',
    modality: '',
    cardinality: '',
    definition: '',
    ref: [],
    satisfy: [],
    _relations: {
      ref: [],
    },
  };
  // Cardinality is the TRAILING bracket group, and only when its content
  // starts with a digit or `*` (`[0..*]`, `[1..1]`) — a `[]` inside the type
  // itself (e.g. `string[]`) is NOT a cardinality marker.
  const cardMatch = basic.match(/^(.*?)\s*\[([\d*][^\]]*)\]\s*$/);
  if (cardMatch) {
    result.cardinality = cardMatch[2].trim();
    basic = cardMatch[1];
  }
  const colonIndex = basic.indexOf(':');
  if (colonIndex !== -1) {
    result.type = basic
      .substr(colonIndex + 1, basic.length - colonIndex - 1)
      .trim();
    basic = basic.substr(0, colonIndex);
  }
  result.id = basic.trim();
  forEachEntry(
    details,
    (keyword, value) => {
      if (keyword === 'modality') {
        result.modality = value();
      } else if (keyword === 'definition') {
        result.definition = unwrapped(value);
      } else if (keyword === 'reference') {
        result._relations.ref = tokenizePackage(value());
      } else if (keyword === 'satisfy') {
        result.satisfy = tokenizePackage(value());
      } else if (keyword === 'on_delete') {
        result.onDelete = value();
      } else if (keyword === 'deprecated') {
        result.deprecated = value() === 'true';
      } else if (keyword === 'enum_values') {
        result.enumValues = tokenizePackage(value());
      } else if (keyword === 'required') {
        result.required = value() === 'true';
      } else if (keyword === 'unit') {
        result.unit = unwrapped(value);
      } else if (keyword === 'default') {
        result.defaultValue = unwrapped(value);
      } else {
        return false;
      }
      return true;
    },
    { construct: 'data attribute', id: result.id },
  );
  return result;
};

export const resolveDataClass: Resolver<DataClass, ResolvableDataClass> =
  function (ctx, unresolved) {
    const attributes: DataAttribute[] = unresolved.attributes.map(attr => {
      const resolved: DataAttribute = { ...attr, ref: [] };
      for (const id of attr._relations.ref) {
        const r = resolveFromContext<Reference>(ctx, 'references', id);
        if (r !== undefined) {
          resolved.ref.push(r);
        }
      }
      return resolved;
    });
    return {
      id: unresolved.id,
      attributes,
      ...(unresolved.store !== undefined ? { store: unresolved.store } : {}),
      ...(unresolved.indexes !== undefined
        ? { indexes: unresolved.indexes }
        : {}),
      ...(unresolved.helper !== undefined ? { helper: unresolved.helper } : {}),
      ...(unresolved.extends !== undefined
        ? { extends: unresolved.extends }
        : {}),
      ...(unresolved.description !== undefined
        ? { description: unresolved.description }
        : {}),
      ...(unresolved.ref !== undefined ? { ref: unresolved.ref } : {}),
    };
  };

export const resolveRegistry: Resolver<Registry, ResolvableRegistry> =
  function (ctx, unresolved) {
    const { _relations, ...rest } = unresolved;
    const p: Registry = { ...rest, data: null };
    if (_relations.data !== '') {
      const dc = resolveFromContext<DataClass>(
        ctx,
        'dataclasses',
        _relations.data,
      );
      if (dc !== undefined) {
        p.data = dc;
      }
    }
    return p;
  };

export const dumpDataClass: Dumper<DataClass> = function (dataclass) {
  let out: string = 'class ' + dataclass.id + ' {\n';
  if (dataclass.store) {
    out += '  store { ' + dataclass.store + ' }\n';
  }
  if (dataclass.description) {
    // Attribute-shaped body: class-level entries carry brace blocks.
    out += '  description { "' + escapeString(dataclass.description) + '" }\n';
  }
  if (dataclass.indexes && dataclass.indexes.length > 0) {
    out += '  indexes { ' + dataclass.indexes.join(' ') + ' }\n';
  }
  if (dataclass.helper !== undefined) {
    out += '  helper { ' + dataclass.helper + ' }\n';
  }
  if (dataclass.extends) {
    out += '  extends { ' + dataclass.extends + ' }\n';
  }
  if (dataclass.ref && dataclass.ref.length > 0) {
    for (const r of dataclass.ref) {
      out += '  ref ' + r.predicate + ' "' + escapeString(r.target) + '"';
      if (r.note) {
        out += ' { note "' + escapeString(r.note) + '" }';
      }
      out += '\n';
    }
  }
  for (const a of dataclass.attributes) {
    out += toDataAttributeModel(a);
  }
  out += '}\n';
  return out;
};

const toDataAttributeModel = (attribute: DataAttribute) => {
  let out: string = '  ' + attribute.id;
  if (attribute.type !== '') {
    out += ': ' + attribute.type;
  }
  if (attribute.cardinality !== '') {
    out += '[' + attribute.cardinality + ']';
  }
  out += ' {\n';
  out += '    definition "' + escapeString(attribute.definition) + '"\n';
  if (attribute.modality !== '') {
    out += '    modality ' + attribute.modality + '\n';
  }
  if (attribute.onDelete) {
    out += '    on_delete ' + attribute.onDelete + '\n';
  }
  if (attribute.deprecated) {
    out += '    deprecated true\n';
  }
  if (attribute.enumValues && attribute.enumValues.length > 0) {
    out += '    enum_values { ' + attribute.enumValues.join(' ') + ' }\n';
  }
  if (attribute.required !== undefined) {
    out += '    required ' + (attribute.required ? 'true' : 'false') + '\n';
  }
  if (attribute.unit) {
    out += '    unit "' + escapeString(attribute.unit) + '"\n';
  }
  if (attribute.defaultValue !== undefined) {
    out += '    default "' + escapeString(attribute.defaultValue) + '"\n';
  }
  if (attribute.satisfy.length > 0) {
    out += '    satisfy {\n';
    for (const s of attribute.satisfy) {
      out += '      ' + s + '\n';
    }
    out += '    }\n';
  }
  if (attribute.ref.length > 0) {
    out += '    reference {\n';
    for (const r of attribute.ref) {
      out += '      ' + r.id + '\n';
    }
    out += '    }\n';
  }
  out += '  }\n';
  return out;
};

const dumpEnumValue = (ev: EnumValue) => {
  let out: string = '  ' + ev.id + ' {\n';
  out += '    definition "' + escapeString(ev.value) + '"\n';
  out += '  }\n';
  return out;
};

export const dumpEnum: Dumper<Enum> = function (en) {
  let out: string = 'enum ' + en.id + ' {\n';
  for (const v of en.values) {
    out += dumpEnumValue(v);
  }
  out += '}\n';
  return out;
};

export const dumpRegistry: Dumper<Registry> = function (reg) {
  let out: string = 'data_registry ' + reg.id + ' {\n';
  out += '  title "' + escapeString(reg.title) + '"\n';
  if (reg.data !== null) {
    out += '  data_class ' + reg.data.id + '\n';
  }
  out += '}\n';
  return out;
};

export const parseVariable: Parser = function (id, data) {
  const result: Variable = {
    id: id,
    type: '',
    definition: '',
    description: '',
  };
  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'type') {
        result.type = value();
      } else if (keyword === 'definition') {
        result.definition = unwrapped(value);
      } else if (keyword === 'description') {
        result.description = unwrapped(value);
      } else {
        return false;
      }
      return true;
    },
    { construct: 'variable', id },
  );
  return ctx => {
    ctx.variables[id] = result;
    return ctx;
  };
};

export const dumpVariable: Dumper<Variable> = function (v) {
  let out: string = 'variable ' + v.id + ' {\n';
  if (v.type !== '') {
    out += '  type ' + v.type + '\n';
  }
  if (v.definition !== '') {
    out += '  definition "' + escapeString(v.definition) + '"\n';
  }
  if (v.description !== '') {
    out += '  description "' + escapeString(v.description) + '"\n';
  }
  out += '}\n';
  return out;
};

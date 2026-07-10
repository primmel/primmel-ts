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
import { escapeString, tokenizePackage } from '../tokenize';
import { forEachEntry, forEachAttribute, unwrapped } from '../parse-block';
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
      result.attributes.push(parseDataAttribute(basic.trim(), details));
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
  let index = basic.indexOf('[');
  if (index !== -1) {
    result.cardinality = basic
      .substr(index + 1, basic.length - index - 2)
      .trim();
    basic = basic.substr(0, index);
  }
  index = basic.indexOf(':');
  if (index !== -1) {
    result.type = basic.substr(index + 1, basic.length - index - 1).trim();
    basic = basic.substr(0, index);
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
    return { id: unresolved.id, attributes };
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

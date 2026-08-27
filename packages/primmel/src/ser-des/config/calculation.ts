import type { Dumper, Parser, Resolver } from '../types';
import {
  escapeString,
  unwrapBlock,
  stripWrapping,
  tokenizePackage,
} from '../tokenize';
import tokenize from '../tokenize';
import { parseRef, foldRefIntoLegacy, dumpSourceRefAsRef } from './ref';
import { dumpCorrespondences, parseCorresponds } from './correspondence';
import { dumpBareSafe } from './field-parser';
import type Calculation from '../../types/Calculation';
import type {
  CalculationInput,
  CalculationLookup,
  CalculationOutput,
  ResolvableCalculation,
} from '../../types/Calculation';
import type Reference from '../../types/Reference';
import { resolveFromContext } from '../resolve';

export const parseCalculation: Parser = function (id, data) {
  const result: ResolvableCalculation = {
    id,
    name: '',
    description: '',
    inputs: [],
    output: { type: 'number', unit: '1' },
    expression: '',
    params: [],
    lookup: null,
    profile: '',
    ref: [],
    _relations: {
      ref: [],
    },
    // Initialized so the ref fold (docs/primmel/18 §18.4) mirrors the
    // first derives-from block here — the fold only mirrors slots the
    // object already carries.
    sourceRef: null,
  };

  if (data !== '') {
    const t: Array<string> = tokenizePackage(data);
    let i = 0;
    while (i < t.length) {
      const command: string = t[i++];
      if (i < t.length) {
        if (command === 'name') {
          result.name = unwrapBlock(t[i++]);
        } else if (command === 'identifier') {
          result.identifier = stripWrapping(t[i++]);
        } else if (command === 'type') {
          result.ruleType = stripWrapping(t[i++]);
        } else if (command === 'category') {
          result.category = stripWrapping(t[i++]);
        } else if (command === 'label') {
          result.label = stripWrapping(t[i++]);
        } else if (command === 'description') {
          result.description = unwrapBlock(t[i++]);
        } else if (command === 'expression') {
          result.expression = unwrapBlock(t[i++]);
        } else if (command === 'reference') {
          result._relations.ref = tokenizePackage(t[i++]);
        } else if (command === 'ref') {
          const rr = parseRef(t, i, stripWrapping, unwrapBlock);
          if (!foldRefIntoLegacy(result as never, rr.ref)) {
            (result.refs ??= []).push(rr.ref);
          }
          i = rr.next;
        } else if (command === 'corresponds') {
          // The per-node correspondence annotation (MN 114 clause 19.4).
          const cc = parseCorresponds(t, i, stripWrapping);
          (result.correspondences ??= []).push(cc.corr);
          i = cc.next;
        } else if (command === 'source') {
          // Structured provenance: source { doc "urn:..." clause "2.1.2.4" }
          // Repeated source blocks collect into sourceRefs (TODO.roadmap/24).
          // The optional third field `fragment` is the sentence sub-address
          // (TODO.roadmap/26) — the dumper emits it, so the parser must keep
          // it (codec symmetry, TODO.refactor/16).
          const inner = tokenize(unwrapBlock(t[i++]));
          const src: { doc: string; clause: string; fragment?: string } = {
            doc: '',
            clause: '',
          };
          for (let k = 0; k + 1 < inner.length; k += 2) {
            if (inner[k] === 'doc') {
              src.doc = stripWrapping(inner[k + 1]);
            } else if (inner[k] === 'clause') {
              src.clause = stripWrapping(inner[k + 1]);
            } else if (inner[k] === 'fragment') {
              src.fragment = stripWrapping(inner[k + 1]);
            }
          }
          if (!result.sourceRef) {
            result.sourceRef = src;
          }
          (result.sourceRefs ??= []).push(src);
        } else if (command === 'inputs') {
          result.inputs = parseInputs(unwrapBlock(t[i++]));
        } else if (command === 'output') {
          // output : <type> { ... } — the head spans up to three tokens
          // (':', type, block); collect them before parsing.
          let head = '';
          if (t[i] === ':') {
            head += t[i++];
          }
          if (i < t.length && !t[i].startsWith('{')) {
            head += ' ' + t[i++];
          }
          if (i < t.length && t[i].startsWith('{')) {
            head += ' ' + t[i++];
          }
          result.output = parseOutput(head);
        } else if (command === 'params') {
          result.params = tokenize(stripWrapping(t[i++]))
            .map(stripWrapping)
            .filter(s => s.length > 0);
        } else if (command === 'lookup') {
          result.lookup = parseLookup(unwrapBlock(t[i++]));
        } else if (command === 'profile') {
          result.profile = stripWrapping(t[i++]);
        } else {
          i++; // forward-compatible: skip unknown keyword value
        }
      } else {
        throw new Error(
          `Parsing error: calculation. ID ${id}: Expecting value for ${command}`,
        );
      }
    }
  }

  return ctx => {
    ctx.calculations[id] = result;
    return ctx;
  };
};

function parseInputs(block: string): CalculationInput[] {
  const inputs: CalculationInput[] = [];
  // inputs block contains entries like: `name : type { unit "..." description "..." default <v> }`
  // We tokenize the block and walk through it
  const t = tokenizePackage(block);
  let i = 0;
  while (i < t.length) {
    const name = t[i++];
    if (i >= t.length) {
      break;
    }
    // Expect ':' then type
    if (t[i] === ':') {
      i++;
    }
    const type = i < t.length ? t[i++] : 'number';
    // Optional brace block with properties
    let unit = '1';
    let description = '';
    let defaultValue = '';
    let hasDefault = false;
    let enumValues: string[] | undefined;
    if (i < t.length && t[i].startsWith('{')) {
      const propBlock = unwrapBlock(t[i++]);
      const pt = tokenizePackage(propBlock);
      let j = 0;
      while (j < pt.length) {
        const cmd = pt[j++];
        if (j < pt.length) {
          if (cmd === 'unit') {
            unit = unwrapBlock(pt[j++]);
          } else if (cmd === 'description') {
            description = unwrapBlock(pt[j++]);
          } else if (cmd === 'default') {
            defaultValue = unwrapBlock(pt[j++]);
            hasDefault = true;
          } else if (cmd === 'enum_values') {
            enumValues = tokenizePackage(unwrapBlock(pt[j++]));
          } else {
            j++; // skip unknown
          }
        }
      }
    }
    inputs.push({
      name,
      type,
      unit,
      description,
      defaultValue,
      hasDefault,
      enumValues,
    });
  }
  return inputs;
}

function parseOutput(block: string): CalculationOutput {
  // output head: `: type { unit "..." name "..." description "..." }` —
  // plain tokenize (the head is NOT brace-wrapped; tokenizePackage's
  // unwrapBlock would mangle the first ':' and last '}').
  const t = tokenize(block);
  let i = 0;
  let type = 'number';
  let unit = '1';
  let name = '';
  let description = '';
  if (t[i] === ':') {
    i++;
  }
  if (i < t.length) {
    type = t[i++];
  }
  if (i < t.length && t[i].startsWith('{')) {
    const propBlock = unwrapBlock(t[i++]);
    const pt = tokenizePackage(propBlock);
    let j = 0;
    while (j < pt.length) {
      const cmd = pt[j++];
      if (j < pt.length) {
        if (cmd === 'unit') {
          unit = unwrapBlock(pt[j++]);
        } else if (cmd === 'name') {
          name = stripWrapping(pt[j++]);
        } else if (cmd === 'description') {
          description = stripWrapping(pt[j++]);
        } else {
          j++;
        }
      }
    }
  }
  // Optional keys are set only when present — a calculation without an
  // output block keeps the { type, unit } init shape, and a reparse of
  // its dump must produce the identical shape (round-trip deepEqual).
  const out: CalculationOutput = { type, unit };
  if (name) {
    out.name = name;
  }
  if (description) {
    out.description = description;
  }
  return out;
}

function parseLookup(block: string): CalculationLookup {
  const lookup: CalculationLookup = { key: '', variable: '', multiplier: '' };
  const t = tokenizePackage(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'key') {
      lookup.key = stripWrapping(t[i++]);
    } else if (cmd === 'variable') {
      lookup.variable = stripWrapping(t[i++]);
    } else if (cmd === 'multiplier') {
      lookup.multiplier = stripWrapping(t[i++]);
    } else if (cmd === 'default_tier') {
      // default_tier { factor 1.5 mode absolute } — declared missing-key
      // fallback (G12 residual (b), TODO.roadmap/19). Set only when present
      // so a reparse deep-equals the dump of a declaration without one.
      const dt = tokenize(unwrapBlock(t[i++]));
      const tier: { factor: number; mode?: 'absolute' | 'relative' } = {
        factor: 0,
      };
      for (let j = 0; j < dt.length; j++) {
        if (dt[j] === 'factor' && j + 1 < dt.length) {
          tier.factor = Number(stripWrapping(dt[++j]));
        } else if (dt[j] === 'mode' && j + 1 < dt.length) {
          tier.mode = stripWrapping(dt[++j]) as 'absolute' | 'relative';
        }
      }
      lookup.defaultTier = tier;
    } else {
      unwrapBlock(t[i++]);
    }
  }
  return lookup;
}

export const resolveCalculation: Resolver<Calculation, ResolvableCalculation> =
  function (ctx, unresolved) {
    const ref: Reference[] = [];
    for (const id of unresolved._relations.ref) {
      const r = resolveFromContext<Reference>(ctx, 'references', id);
      if (r !== undefined) {
        ref.push(r);
      }
    }
    return { ...unresolved, ref };
  };

export const dumpCalculation: Dumper<Calculation> = function (c) {
  let out = 'calculation ' + c.id + ' {\n';
  out += '  name "' + escapeString(c.name) + '"\n';
  if (c.identifier) {
    out += '  identifier "' + escapeString(c.identifier) + '"\n';
  }
  if (c.ruleType) {
    out += '  type ' + c.ruleType + '\n';
  }
  if (c.category) {
    out += '  category ' + c.category + '\n';
  }
  if (c.label) {
    out += '  label "' + escapeString(c.label) + '"\n';
  }
  if (c.description) {
    out += '  description "' + escapeString(c.description) + '"\n';
  }
  if (c.inputs.length > 0) {
    out += '  inputs {\n';
    for (const inp of c.inputs) {
      let line = '    ' + inp.name + ' : ' + inp.type + ' { ';
      line += 'unit "' + escapeString(inp.unit) + '"';
      if (inp.description) {
        line += ' description "' + escapeString(inp.description) + '"';
      }
      if (inp.hasDefault) {
        line += ' default ' + inp.defaultValue;
      }
      if (inp.enumValues && inp.enumValues.length > 0) {
        line += ' enum_values { ' + inp.enumValues.join(' ') + ' }';
      }
      line += ' }\n';
      out += line;
    }
    out += '  }\n';
  }
  let outputLine =
    '  output : ' +
    c.output.type +
    ' { unit "' +
    escapeString(c.output.unit) +
    '"';
  if (c.output.name) {
    outputLine += ' name "' + escapeString(c.output.name) + '"';
  }
  if (c.output.description) {
    outputLine += ' description "' + escapeString(c.output.description) + '"';
  }
  out += outputLine + ' }\n';
  if (c.expression) {
    out += '  expression "' + escapeString(c.expression) + '"\n';
  }
  if (c.params && c.params.length > 0) {
    out += '  params { ' + c.params.join(' ') + ' }\n';
  }
  if (c.lookup) {
    out += '  lookup { ';
    if (c.lookup.key) {
      out += 'key ' + c.lookup.key + ' ';
    }
    if (c.lookup.variable) {
      out += 'variable ' + c.lookup.variable + ' ';
    }
    if (c.lookup.multiplier) {
      out += 'multiplier ' + c.lookup.multiplier + ' ';
    }
    if (c.lookup.defaultTier) {
      out += 'default_tier { factor ' + c.lookup.defaultTier.factor;
      if (c.lookup.defaultTier.mode) {
        out += ' mode ' + c.lookup.defaultTier.mode;
      }
      out += ' } ';
    }
    out += '}\n';
  }
  if (c.profile) {
    out += '  profile ' + c.profile + '\n';
  }
  for (const src of c.sourceRefs ??
    (c.sourceRef && (c.sourceRef.doc || c.sourceRef.clause)
      ? [c.sourceRef]
      : [])) {
    out += dumpSourceRefAsRef(src, '  ', escapeString);
  }
  for (const r of c.refs ?? []) {
    out +=
      '  ref ' +
      r.predicate +
      ' "' +
      escapeString(r.target) +
      '"' +
      (r.note ? ' { note "' + escapeString(r.note) + '" }' : '') +
      '\n';
  }
  out += dumpCorrespondences(
    c.correspondences,
    '  ',
    escapeString,
    dumpBareSafe,
  );
  if (c.ref.length > 0) {
    out += '  reference {\n';
    for (const r of c.ref) {
      out += '    ' + r.id + '\n';
    }
    out += '  }\n';
  }
  out += '}\n';
  return out;
};

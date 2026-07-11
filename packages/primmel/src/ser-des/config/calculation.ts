import type { Dumper, Parser, Resolver } from '../types';
import { escapeString, unwrapBlock, tokenizePackage } from '../tokenize';
import type Calculation from '../../types/Calculation';
import type {
  CalculationInput,
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
    ref: [],
    _relations: {
      ref: [],
    },
  };

  if (data !== '') {
    const t: Array<string> = tokenizePackage(data);
    let i = 0;
    while (i < t.length) {
      const command: string = t[i++];
      if (i < t.length) {
        if (command === 'name') {
          result.name = unwrapBlock(t[i++]);
        } else if (command === 'description') {
          result.description = unwrapBlock(t[i++]);
        } else if (command === 'expression') {
          result.expression = unwrapBlock(t[i++]);
        } else if (command === 'reference') {
          result._relations.ref = tokenizePackage(t[i++]);
        } else if (command === 'inputs') {
          result.inputs = parseInputs(unwrapBlock(t[i++]));
        } else if (command === 'output') {
          result.output = parseOutput(unwrapBlock(t[i++]));
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
          } else {
            j++; // skip unknown
          }
        }
      }
    }
    inputs.push({ name, type, unit, description, defaultValue, hasDefault });
  }
  return inputs;
}

function parseOutput(block: string): CalculationOutput {
  // output block: `: type { unit "..." }`
  const t = tokenizePackage(block);
  let i = 0;
  let type = 'number';
  let unit = '1';
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
        } else {
          j++;
        }
      }
    }
  }
  return { type, unit };
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
      line += ' }\n';
      out += line;
    }
    out += '  }\n';
  }
  out +=
    '  output : ' +
    c.output.type +
    ' { unit "' +
    escapeString(c.output.unit) +
    '" }\n';
  out += '  expression "' + escapeString(c.expression) + '"\n';
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

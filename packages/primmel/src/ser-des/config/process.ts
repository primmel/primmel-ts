import Process, { ResolvableProcess } from '../../types/process';
import { resolveFromContext } from '../resolve';
import { escapeString, unwrapBlock, tokenizePackage } from '../tokenize';
import { forEachEntry, unwrapped } from '../parse-block';
import { Dumper, Parser, Resolver } from '../types';
import type { ParseContext } from '../types';
import type { Registry } from '../../types/data';
import type Provision from '../../types/Provision';
import type Role from '../../types/Role';
import type { Subprocess } from '../../types/flow';

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
): string {
  let out = dumpProcess(process);
  if (process.children.length > 0) {
    const childBlocks: string[] = [];
    for (const childId of process.children) {
      const child = lookup.get(childId);
      if (child) {
        childBlocks.push(indentBlock(dumpProcessTree(child, lookup)));
      }
    }
    if (childBlocks.length > 0) {
      out = out.replace(/\n}\n$/, '\n' + childBlocks.join('\n') + '}\n');
    }
  }
  return out;
}

export const dumpProcess: Dumper<Process> = function (process) {
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
  if (process.provision.length > 0) {
    out += '  validate_provision {\n';
    for (const r of process.provision) {
      out += '    ' + r.id + '\n';
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
  if (process.parent && process.children.length === 0) {
    out += '  parent ' + process.parent + '\n';
  }
  out += '}\n';
  return out;
};

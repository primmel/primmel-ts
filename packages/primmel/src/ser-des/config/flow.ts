import {
  Edge,
  ResolvableEdge,
  ResolvableSubprocess,
  ResolvableSubprocessComponent,
  Subprocess,
  SubprocessComponent,
} from '../../types/flow';
import type Node from '../../types/Node';
import type { ParseContext } from '../types';
import { resolveFromContext } from '../resolve';
import { escapeString, unwrapBlock, tokenizePackage } from '../tokenize';
import { Dumper, Parser, Resolver } from '../types';
// `Parser` is still used by parseSubprocess below; the sub-parsers
// (parseElements/parseData/parseEdges) use SubprocessSubParser instead.

// Parsers

export const parseSubprocess: Parser = function (id, data) {
  let result: ResolvableSubprocess = {
    id: id,
    childs: [],
    edges: [],
    data: [],
    _relations: {
      childs: [],
      edges: [],
      data: [],
    },
    _components: {},
  };
  if (data !== '') {
    const t: string[] = tokenizePackage(data);
    let i = 0;
    while (i < t.length) {
      const keyword: string = t[i++];
      if (i < t.length) {
        if (keyword === 'elements') {
          result = parseElements(unwrapBlock(t[i++]))(result);
        } else if (keyword === 'process_flow') {
          result = parseEdges(unwrapBlock(t[i++]))(result);
        } else if (keyword === 'data') {
          result = parseData(unwrapBlock(t[i++]))(result);
        } else {
          i++; // forward-compatible: skip unknown keyword value
        }
      } else {
        throw new Error(
          `Parsing error: subprocess. ID ${id}: Expecting value for ${keyword}`,
        );
      }
    }
  }
  return ctx => {
    ctx.pages[id] = result;
    return ctx;
  };
};

// Sub-parsers operate on a ResolvableSubprocess accumulator (not the
// top-level ParseContext). They take the inner block content and return
// a function that folds the accumulator. Declared explicitly — the
// `Parser<C>` type parameter is for the top-level ParseContext, not for
// this intermediate shape.
type SubprocessSubParser = (
  data: string,
) => (acc: ResolvableSubprocess) => ResolvableSubprocess;

const parseElements: SubprocessSubParser = function (data: string) {
  const t: string[] = tokenizePackage(data);
  const elements: Record<string, ResolvableSubprocessComponent> = {};
  let i = 0;
  while (i < t.length) {
    const name: string = t[i++];
    if (i < t.length) {
      const id = name.trim();
      elements[id] = readSubprocessComponent(id, t[i++]);
    } else {
      throw new Error(
        `Parsing error: elements in subprocess. Expecting value for ${name}`,
      );
    }
  }
  return ctx => ({
    ...ctx,
    _components: { ...ctx._components, ...elements },
    _relations: { ...ctx._relations, childs: Object.values(elements) },
  });
};

const parseData: SubprocessSubParser = function (data: string) {
  const t: string[] = tokenizePackage(data);
  const elements: Record<string, ResolvableSubprocessComponent> = {};
  let i = 0;
  while (i < t.length) {
    const name: string = t[i++];
    if (i < t.length) {
      const id = name.trim();
      elements[id] = readSubprocessComponent(id, t[i++]);
    } else {
      throw new Error(
        `Parsing error: data in subprocess. Expecting value for ${name}`,
      );
    }
  }
  return ctx => ({
    ...ctx,
    _components: { ...ctx._components, ...elements },
    _relations: { ...ctx._relations, data: Object.values(elements) },
  });
};

const parseEdges: SubprocessSubParser = function (data: string) {
  const t: string[] = tokenizePackage(data);
  const edges: Record<string, ResolvableEdge> = {};
  let i = 0;
  while (i < t.length) {
    const id: string = t[i++].trim();
    if (i < t.length) {
      edges[id] = readEdge(id.trim(), t[i++]);
    } else {
      throw new Error(
        `Parsing error: edges in subprocess. Expecting value for ${id}`,
      );
    }
  }
  return ctx => ({
    ...ctx,
    _relations: { ...ctx._relations, edges: Object.values(edges) },
  });
};

function readSubprocessComponent(
  elm: string,
  data: string,
): ResolvableSubprocessComponent {
  const com: ResolvableSubprocessComponent = {
    name: elm,
    element: null,
    x: 0,
    y: 0,
    _relations: {
      element: elm,
    },
  };

  const t: string[] = tokenizePackage(data);
  let i = 0;
  while (i < t.length) {
    const keyword: string = t[i++];
    if (i < t.length) {
      if (keyword === 'x') {
        com.x = parseFloat(t[i++]);
      } else if (keyword === 'y') {
        com.y = parseFloat(t[i++]);
      } else {
        // forward-compatible: skip unknown keyword value
        i++;
      }
    } else {
      throw new Error(
        `Parsing error: subprocess component. Element ${elm}: Expecting value for ${keyword}`,
      );
    }
  }
  return com;
}

function readEdge(id: string, data: string): ResolvableEdge {
  const edge: ResolvableEdge = {
    id: id,
    from: null,
    to: null,
    description: '',
    condition: '',
    _relations: {
      from: '',
      to: '',
    },
  };

  const t: string[] = tokenizePackage(data);
  let i = 0;
  while (i < t.length) {
    const command: string = t[i++];
    if (i < t.length) {
      if (command === 'from') {
        edge._relations.from = t[i++];
      } else if (command === 'description') {
        edge.description = unwrapBlock(t[i++]);
      } else if (command === 'condition') {
        edge.condition = unwrapBlock(t[i++]);
      } else if (command === 'to') {
        edge._relations.to = t[i++];
      } else {
        // forward-compatible: skip unknown keyword value (e.g., label, color)
        i++;
      }
    } else {
      throw new Error(
        `Parsing error: process_flow. ID ${id}: Expecting value for ${command}`,
      );
    }
  }
  return edge;
}

// Dumpers

/**
 * Resolve a parsed subprocess into its final shape.
 *
 * The parser stores components (elements + data) and edges inside
 * `_relations` rather than on the top-level fields, and keeps a flat
 * `_components` map keyed by element ID for edge lookups. This resolver
 * walks each component / edge and swaps the string ID references for
 * real objects:
 *
 *  - component._relations.element → a Node (process/approval/event/gateway)
 *  - edge._relations.from / .to → a resolved SubprocessComponent
 *
 * Lenient: missing references leave the field null rather than throwing.
 */
export const resolveSubprocess: Resolver<Subprocess, ResolvableSubprocess> =
  function (ctx, unresolved) {
    const relations = unresolved._relations ?? {
      childs: [],
      edges: [],
      data: [],
    };
    const components = unresolved._components ?? {};
    const componentsById = new Map<string, ResolvableSubprocessComponent>();
    for (const c of Object.values(components)) {
      if (c._relations?.element) {
        componentsById.set(c._relations.element, c);
      }
    }

    const resolveComponent = (
      c: ResolvableSubprocessComponent,
    ): SubprocessComponent => ({
      name: c.name,
      x: c.x,
      y: c.y,
      element: lookupNode(ctx, c._relations.element),
    });

    const resolveEdge = (e: ResolvableEdge): Edge => {
      const fromComp = e._relations.from
        ? componentsById.get(e._relations.from)
        : undefined;
      const toComp = e._relations.to
        ? componentsById.get(e._relations.to)
        : undefined;
      return {
        id: e.id,
        description: e.description,
        condition: e.condition,
        from: fromComp ? resolveComponent(fromComp) : null,
        to: toComp ? resolveComponent(toComp) : null,
      };
    };

    return {
      id: unresolved.id,
      childs: relations.childs.map(resolveComponent),
      edges: relations.edges.map(resolveEdge),
      data: relations.data.map(resolveComponent),
    };
  };

/**
 * Look up a Node by ID across every construct that can appear as a
 * subprocess element. Returns null when the ID is unknown (lenient).
 */
function lookupNode(ctx: ParseContext, id: string): Node | null {
  const found =
    resolveFromContext<Node>(ctx, 'processes', id) ??
    resolveFromContext<Node>(ctx, 'approvals', id) ??
    resolveFromContext<Node>(ctx, 'events', id) ??
    resolveFromContext<Node>(ctx, 'gateways', id) ??
    null;
  return found;
}

export const dumpSubprocess: Dumper<Subprocess> = function (sub) {
  let out: string = 'canvas ' + sub.id + ' {\n';
  out += '  elements {\n';
  sub.childs.forEach(x => {
    out += dumpSubprocessComponent(x);
  });
  out += '  }\n';
  out += '  process_flow {\n';
  sub.edges.forEach(e => {
    out += dumpEdge(e);
  });
  out += '  }\n';
  out += '  data {\n';
  sub.data.forEach(d => {
    out += dumpSubprocessComponent(d);
  });
  out += '  }\n';
  out += '}\n';
  return out;
};

function dumpSubprocessComponent(com: SubprocessComponent): string {
  // Components are always emitted, even when element is null — data
  // components in particular often have no Node reference. Use the
  // preserved source name as the key.
  const key = com.element?.id ?? com.name;
  let out: string = '    ' + key + ' {\n';
  out += '      x ' + com.x + '\n';
  out += '      y ' + com.y + '\n';
  out += '    }\n';
  return out;
}

function dumpEdge(edge: Edge): string {
  let out: string = '    ' + edge.id + ' {\n';
  if (edge.from !== null && edge.from.element !== null) {
    out += '      from ' + edge.from.element.id + '\n';
  }
  if (edge.to !== null && edge.to.element !== null) {
    out += '      to ' + edge.to.element.id + '\n';
  }
  if (edge.description !== '') {
    out += '      description "' + escapeString(edge.description) + '"\n';
  }
  if (edge.condition !== '') {
    out += '      condition "' + escapeString(edge.condition) + '"\n';
  }
  out += '    }\n';
  return out;
}

import Standard from '../types/Standard';
import { ParseContext, ResolverConfiguration } from './types';
import Metadata from '../types/Metadata';

const EMPTY_META: Metadata = {
  schema: '',
  author: '',
  title: '',
  edition: '',
  namespace: '',
  shortname: '',
};

/**
 * Look up an item by ID in a ParseContext table.
 *
 * Returns the item (with `_relations` stripped if it had any) or `undefined`
 * if the ID is not present. Lenient by design — callers decide whether an
 * undefined miss is an error.
 */
export function resolveFromContext<T>(
  ctx: ParseContext,
  field: keyof ParseContext,
  id: string
): T | undefined {
  const table = ctx[field] as unknown as Record<string, T>;
  if (table === null || table === undefined) {
    return undefined;
  }
  const item = table[id];
  if (item === undefined) {
    return undefined;
  }

  const anyItem = item as unknown as { _relations?: unknown };
  if (anyItem._relations) {
    const stripped = { ...item };
    delete (stripped as unknown as { _relations?: unknown })._relations;
    table[id] = stripped;
    return stripped;
  }
  return item;
}

/**
 * Resolve a ParseContext into a typed Standard.
 *
 * For each registered resolver (RESOLVER_CONFIG), iterate every parsed item
 * of that construct, run the resolver, and append the result to the matching
 * Standard field. Fields without a resolver are passed through directly.
 *
 * Lenient: missing references inside a resolver are dropped (not thrown).
 * The partially-resolved item is still returned.
 */
export default function resolve(
  ctx: ParseContext,
  resolvers: ResolverConfiguration
): Standard {
  const standard: Standard = {
    meta: ctx.metadata ?? EMPTY_META,
    roles: Object.values(ctx.roles),
    provisions: [],
    pages: [],
    processes: [],
    dataclasses: [],
    regs: [],
    events: Object.values(ctx.events),
    gateways: Object.values(ctx.gateways),
    refs: Object.values(ctx.references),
    approvals: [],
    enums: Object.values(ctx.enums),
    vars: Object.values(ctx.variables),
    notes: [],
    tables: Object.values(ctx.tables),
    figures: Object.values(ctx.figures),
    links: Object.values(ctx.links),
    mapProfiles: Object.values(ctx.mapProfiles),
    viewProfiles: Object.values(ctx.viewProfiles),
    forms: Object.values(ctx.forms),
    subforms: Object.values(ctx.subforms),
    symbols: [],
    calculations: [],
    stateMachines: Object.values(ctx.stateMachines),
    root: null,
  };

  // Resolve order matters: pages reference processes/approvals/events/gateways,
  // so those must be cached in their resolved form before pages run.
  resolveField(ctx, resolvers, 'dataClasses', standard.dataclasses);
  resolveField(ctx, resolvers, 'registers', standard.regs);
  resolveField(ctx, resolvers, 'provisions', standard.provisions);
  resolveField(ctx, resolvers, 'processes', standard.processes);
  resolveField(ctx, resolvers, 'approvals', standard.approvals);
  resolveField(ctx, resolvers, 'notes', standard.notes);
  resolveField(ctx, resolvers, 'symbols', standard.symbols);
  resolveField(ctx, resolvers, 'calculations', standard.calculations);
  resolveField(ctx, resolvers, 'pages', standard.pages);

  // Root is a single page reference — look it up after pages are resolved.
  if (ctx.root) {
    const root = ctx.pages[ctx.root];
    standard.root = root ?? null;
  }

  return standard;
}

function resolveField(
  ctx: ParseContext,
  resolvers: ResolverConfiguration,
  field: keyof ParseContext,
  out: unknown[]
) {
  const cfg = resolvers[field];
  if (!cfg) {
    return;
  }
  const table = ctx[field] as Record<string, unknown>;
  for (const [id, item] of Object.entries(table)) {
    const resolved = cfg.resolve(ctx, item as never) as {
      _relations?: unknown;
    };
    if (resolved === undefined) {
      continue;
    }
    delete resolved._relations;
    table[id] = resolved;
    out.push(resolved);
  }
}

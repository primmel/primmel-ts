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
  id: string,
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
 * Fields without a resolver are passed through directly (their entries are
 * already in final form). Fields WITH a resolver are iterated, resolved,
 * and the result replaces the parsed form on both `ctx` (cached for any
 * later lookup) and `standard`.
 *
 * Adding a new construct with cross-references is now purely a registry
 * change in RESOLVER_CONFIG — no edit needed here.
 *
 * Lenient: missing references inside a resolver are dropped (not thrown).
 * The partially-resolved item is still returned.
 *
 * Resolve order is RESOLVER_CONFIG insertion order; pages must come last
 * because subprocess components reference processes/approvals/events/
 * gateways, and those need to be cached in resolved form first.
 */
export default function resolve(
  ctx: ParseContext,
  resolvers: ResolverConfiguration,
): Standard {
  const standard = {
    meta: ctx.metadata ?? EMPTY_META,
    root: null,
  } as Standard;

  // Pass-through fields (no resolver — entries are already in final form).
  // Listed explicitly so the Standard shape drives this, not the resolver
  // registry. Singletons `meta` and `root` are handled above.
  standard.roles = Object.values(ctx.roles);
  standard.events = Object.values(ctx.events);
  standard.gateways = Object.values(ctx.gateways);
  standard.refs = Object.values(ctx.references);
  standard.enums = Object.values(ctx.enums);
  standard.vars = Object.values(ctx.variables);
  standard.tables = Object.values(ctx.tables);
  standard.figures = Object.values(ctx.figures);
  standard.links = Object.values(ctx.links);
  standard.mapProfiles = Object.values(ctx.mapProfiles);
  standard.viewProfiles = Object.values(ctx.viewProfiles);
  standard.terms = Object.values(ctx.terms);
  standard.forms = Object.values(ctx.forms);
  standard.subforms = Object.values(ctx.subforms);
  standard.stateMachines = Object.values(ctx.stateMachines);

  // Resolved fields — driven entirely by RESOLVER_CONFIG. Order matters:
  // processes/approvals/etc. must run before pages (subprocess components
  // reference them via lookupNode).
  for (const field of Object.keys(resolvers) as Array<keyof ParseContext>) {
    const cfg = resolvers[field];
    if (!cfg) {
      continue;
    }
    const table = ctx[field] as Record<string, unknown>;
    const out: unknown[] = [];
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
    (standard as unknown as Record<string, unknown[]>)[field as string] = out;
  }

  if (ctx.root) {
    standard.root = ctx.pages[ctx.root] ?? null;
  }

  return standard;
}

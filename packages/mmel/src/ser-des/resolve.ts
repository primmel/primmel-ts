import Standard from '../types/Standard';
import { ParseContext, ResolverConfiguration } from './types';
import { Resolvable } from '../types/Resolvable';

export function resolveFromContext(
  ctx: ParseContext,
  field: keyof ParseContext,
  id: string
) {
  const item = ctx[field][id];
  if (item !== undefined) {
    if (item._relations) {
      throw new Error(
        `Error in resolving ${field}::${id}: related item unresolved`
      );
    }
    return item;
  } else {
    throw new Error(`Error in resolving ${field}::${id}: not found`);
  }
}

export default function resolve(
  ctx: ParseContext,
  resolvers: ResolverConfiguration
): Standard {
  function resolveRelations<T>(
    partName: keyof typeof resolvers,
    id: string,
    item: Resolvable<T, any>
  ): T {
    const resolvedItem = resolvers[partName].resolve(ctx, item);
    // Mark item as resolved
    delete resolvedItem._relations;
    // Update context with resolved item
    ctx[partName][id] = resolvedItem;
    return resolvedItem;
  }

  const standard: Standard = {
    meta: ctx.metadata,
    roles: Object.values(ctx.roles),
    provisions: [],
    pages: Object.values(ctx.pages).map(p => (p as any).content ?? p),
    processes: [],
    dataclasses: Object.values(ctx.dataClasses),
    regs: Object.values(ctx.registers),
    events: Object.values(ctx.events),
    gateways: Object.values(ctx.gateways),
    refs: Object.values(ctx.references),
    approvals: [],
    enums: Object.values(ctx.enums),
    vars: Object.values(ctx.variables),
    // MMEL 0.1 constructs missing from earlier parser versions
    notes: [],
    tables: Object.values(ctx.tables),
    figures: Object.values(ctx.figures),
    links: Object.values(ctx.links),
    mapProfiles: Object.values(ctx.mapProfiles),
    viewProfiles: Object.values(ctx.viewProfiles),
    root: null,
  };

  for (const [id, item] of Object.entries(ctx.provisions)) {
    standard.provisions.push(resolveRelations('provisions', id, item));
  }

  for (const [id, item] of Object.entries(ctx.notes)) {
    if (resolvers.notes) {
      standard.notes.push(resolveRelations('notes', id, item));
    } else {
      // Inline default resolver: resolve reference list
      const resolved = { ...item, ref: [] };
      for (const refId of item._relations.ref) {
        resolved.ref.push(resolveFromContext(ctx, 'references', refId));
      }
      delete resolved._relations;
      ctx.notes[id] = resolved;
      standard.notes.push(resolved);
    }
  }

  // Resolve subprocess root reference
  if (ctx.root) {
    const rootPage = ctx.pages[ctx.root];
    standard.root = rootPage ? ((rootPage as any).content ?? rootPage) : null;
  }

  // Resolve processes (already resolvable)
  for (const [id, item] of Object.entries(ctx.processes)) {
    if (resolvers.processes) {
      standard.processes.push(resolveRelations('processes', id, item));
    } else {
      standard.processes.push((item as any).content ?? item);
    }
  }

  // Resolve approvals
  for (const [id, item] of Object.entries(ctx.approvals)) {
    if (resolvers.approvals) {
      standard.approvals.push(resolveRelations('approvals', id, item));
    } else {
      standard.approvals.push((item as any).content ?? item);
    }
  }

  return standard;
}

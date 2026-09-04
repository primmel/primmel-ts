// ─────────────────────────────────────────────────────────────────────
// Impact-graph export (primmel/spec#18 ask 7 — MN 114 v3.2, clause
// 17.8): the adjacency form of the model's edge-bearing facets.
//
// The impact graph answers the consumer's change-impact question ("if
// this tolerance changes, which tests, verdicts, and certificates are
// affected?") as a read over an index instead of a walk over the
// authored trees. Like the interchange projections it is a toolchain
// artifact — generated, never authored, never re-imported.
//
// The contract (clause 17.8, `impact-graph/1`):
//
//   * adjacency keyed by the package-authored element id (the id an
//     author wrote, not a generated surrogate), so a consumer joins the
//     graph to the authored trees without a mapping step;
//   * a FORWARD index (element → the edges it declares) and a REVERSE
//     index (element → the edges that target it), the two views of the
//     same edge set;
//   * every edge carrying its kind and its source facet, and the clause
//     provenance (source { doc clause } / ref derives-from) of the
//     edge-bearing element where the element declares one.
//
// The edge registry (the clause-17.8 table) is the normative content:
// every facet that contributes edges, the kind each contributes, and
// the collection the target id resolves into.
// ─────────────────────────────────────────────────────────────────────

import { loadPackage } from '../ser-des/package';
import type Standard from '../types/Standard';
import type { SourceRef } from '../types/Subject';

export const IMPACT_GRAPH_VERSION = 'impact-graph/1';

/** One declared edge. `via` disambiguates edges of one facet that carry
 *  a sub-key (the dimension value an implies edge leaves from). */
export interface ImpactEdge {
  kind: string;
  facet: string;
  target: string;
  via?: string;
  /** Clause provenance of the edge-bearing element, where declared. */
  source?: { doc: string; clause: string };
  /** The derives-from ref target, when that is the provenance form. */
  derivesFrom?: string;
}

/** A reverse-index edge: the same edge plus the element declaring it. */
export interface ImpactReverseEdge extends ImpactEdge {
  element: string;
}

export interface ImpactGraph {
  version: typeof IMPACT_GRAPH_VERSION;
  package: { id: string; version: string; baseUrn: string };
  forward: Record<string, ImpactEdge[]>;
  reverse: Record<string, ImpactReverseEdge[]>;
}

export interface ImpactExportStats {
  edges: number;
  elements: number;
  targets: number;
  byKind: Record<string, number>;
}

export interface ImpactExport {
  graph: ImpactGraph;
  json: string;
  stats: ImpactExportStats;
}

type EdgeCarrier = {
  sourceRefs?: SourceRef[] | { doc: string; clause: string }[];
  sourceRef?: SourceRef | { doc: string; clause: string } | null;
  source?: SourceRef | { doc: string; clause: string } | string | null;
  refs?: { predicate: string; target: string }[];
};

/** The edge's provenance pair: the element's first declared source block
 *  (doc + clause), or its derives-from ref target when that is the form. */
function provenanceOf(el: EdgeCarrier): {
  source?: { doc: string; clause: string };
  derivesFrom?: string;
} {
  const first =
    el.sourceRefs?.[0] ??
    (el.sourceRef && typeof el.sourceRef === 'object' ? el.sourceRef : null) ??
    (el.source && typeof el.source === 'object' ? el.source : null);
  if (first && (first.doc || first.clause)) {
    return { source: { doc: first.doc ?? '', clause: first.clause ?? '' } };
  }
  const ref = (el.refs ?? []).find(r => r.predicate === 'derives-from');
  return ref ? { derivesFrom: ref.target } : {};
}

export function impactGraph(standard: Standard): ImpactGraph {
  const forward = new Map<string, ImpactEdge[]>();
  const add = (
    element: string,
    carrier: EdgeCarrier,
    kind: string,
    facet: string,
    target: string | undefined,
    via?: string,
  ): void => {
    if (target === undefined || target === '') {
      return;
    }
    const edge: ImpactEdge = { kind, facet, target, ...provenanceOf(carrier) };
    if (via !== undefined) {
      edge.via = via;
    }
    const list = forward.get(element);
    if (list) {
      list.push(edge);
    } else {
      forward.set(element, [edge]);
    }
  };

  const verdictIds = new Set((standard.verdicts ?? []).map(v => v.id));

  // requirement: binds_to / dependencies / limit.accepts.verdict /
  // applicability / channel
  for (const r of standard.requirements ?? []) {
    for (const p of r.bindsTo ?? []) {
      add(r.id, r, 'binding', 'binds_to', p);
    }
    for (const d of r.dependencies ?? []) {
      add(r.id, r, 'prerequisite', 'dependencies', d);
    }
    if (r.limit?.accepts?.verdict) {
      add(
        r.id,
        r,
        'acceptance',
        'limit.accepts.verdict',
        r.limit.accepts.verdict,
      );
    }
    for (const a of r.applicability ?? []) {
      add(r.id, r, 'classification', 'applicability', a.dimension);
    }
    if (r.channel) {
      add(r.id, r, 'evidence channel', 'channel', r.channel);
    }
  }

  // conformance_test: targets / inherits_from / dependencies /
  // instances.by / result_forms / produces_artifacts
  for (const t of standard.conformanceTests ?? []) {
    for (const target of t.targets ?? []) {
      add(t.id, t, 'coverage', 'targets', target);
    }
    add(
      t.id,
      t,
      'specialization',
      'inherits_from',
      t.inheritsFrom || undefined,
    );
    for (const d of t.dependencies ?? []) {
      add(t.id, t, 'prerequisite', 'dependencies', d);
    }
    if (t.instances?.by) {
      add(t.id, t, 'instantiation', 'instances.by', t.instances.by);
    }
    for (const f of t.resultForms ?? []) {
      add(t.id, t, 'evidence view', 'result_forms', f);
    }
    for (const a of t.producesArtifacts ?? []) {
      add(t.id, t, 'issuance', 'produces_artifacts', a);
    }
  }

  // verdict: inputs (symbols → derivation; verdicts → acceptance chain) /
  // behavior
  for (const v of standard.verdicts ?? []) {
    for (const inp of v.inputs ?? []) {
      add(
        v.id,
        v,
        verdictIds.has(inp) ? 'acceptance chain' : 'derivation',
        'inputs',
        inp,
      );
    }
    add(v.id, v, 'state transition', 'behavior', v.behavior || undefined);
  }

  // calculation: inputs / lookup / profile / params
  for (const c of standard.calculations ?? []) {
    for (const inp of c.inputs ?? []) {
      add(c.id, c, 'derivation', 'inputs', inp.name);
    }
    if (c.lookup?.key) {
      add(c.id, c, 'data source', 'lookup', c.lookup.key);
    }
    add(c.id, c, 'data source', 'profile', c.profile || undefined);
    for (const p of c.params ?? []) {
      add(c.id, c, 'parameterization', 'params', p);
    }
  }

  // form: requirements / calculation_context / field bind+verdict+targets
  for (const f of standard.forms ?? []) {
    for (const r of f.requirements ?? []) {
      add(f.id, f, 'evidence scope', 'requirements', r);
    }
    for (const table of f.calculationContext?.tables ?? []) {
      add(f.id, f, 'derivation context', 'calculation_context', table);
    }
    const fields = (list: typeof f.fields): void => {
      for (const fld of list ?? []) {
        add(f.id, f, 'binding', 'field.bind', fld.bind, fld.name);
        add(
          f.id,
          f,
          'binding',
          'field.verdict',
          fld.verdict || undefined,
          fld.name,
        );
        for (const t of fld.targets ?? []) {
          add(f.id, f, 'binding', 'field.targets', t, fld.name);
        }
        fields(fld.fields);
      }
    };
    fields(f.fields);
  }

  // formulas_used (the form family's derivation row — a top-level
  // construct keyed by the test reference)
  for (const fu of standard.formulasUsed ?? []) {
    for (const formula of fu.formulas ?? []) {
      add(fu.id, fu, 'derivation', 'formulas_used', formula);
    }
  }

  // dimension: value implies (both placements — the instrument-inline
  // blocks and the top-level declarations)
  const dims = [
    ...(standard.dimensions ?? []),
    ...(standard.instruments ?? []).flatMap(i => i.dimensions ?? []),
  ];
  for (const d of dims) {
    for (const v of d.values ?? []) {
      for (const target of v.implies ?? []) {
        add(
          d.id,
          d,
          'subsumption',
          'values.implies',
          `${d.id}.${target}`,
          v.id,
        );
      }
    }
  }

  // instance: of / model / family (group rides the same chain row).
  // Instances carry no clause provenance (the empty carrier).
  for (const i of standard.instances ?? []) {
    add(i.id, {}, 'instantiation', 'of', i.of);
    add(i.id, {}, 'instantiation', 'model', i.model || undefined);
    add(i.id, {}, 'instantiation', 'group', i.group || undefined);
    add(i.id, {}, 'instantiation', 'family', i.family || undefined);
  }

  // manifest: uses / maps_to / supersedes / replaces / superseded_by
  const m = standard.packageManifest;
  if (m) {
    for (const u of m.uses ?? []) {
      add(m.id, {}, 'composition', 'uses', u);
    }
    for (const mt of m.mapsTo ?? []) {
      add(m.id, {}, 'composition', 'maps_to', mt);
    }
    for (const s of m.supersedes ?? []) {
      add(m.id, {}, 'edition lineage', 'supersedes', s);
    }
    for (const s of m.replaces ?? []) {
      add(m.id, {}, 'edition lineage', 'replaces', s);
    }
    for (const s of m.supersededBy ?? []) {
      add(m.id, {}, 'edition lineage', 'superseded_by', s);
    }
  }

  // The reverse index: the same edge set, keyed by target.
  const reverse: Record<string, ImpactReverseEdge[]> = {};
  const forwardObj: Record<string, ImpactEdge[]> = {};
  for (const [element, edges] of [...forward.entries()].sort()) {
    forwardObj[element] = edges;
    for (const e of edges) {
      (reverse[e.target] ??= []).push({ ...e, element });
    }
  }

  return {
    version: IMPACT_GRAPH_VERSION,
    package: {
      id: m?.id ?? '',
      version: m?.version ?? '',
      baseUrn: m?.baseUrn ?? '',
    },
    forward: forwardObj,
    reverse,
  };
}

export function exportPackageImpact(dir: string): ImpactExport {
  const standard = loadPackage(dir);
  const graph = impactGraph(standard);
  const byKind: Record<string, number> = {};
  let edges = 0;
  for (const list of Object.values(graph.forward)) {
    for (const e of list) {
      edges++;
      byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
    }
  }
  return {
    graph,
    json: JSON.stringify(graph, null, 2) + '\n',
    stats: {
      edges,
      elements: Object.keys(graph.forward).length,
      targets: Object.keys(graph.reverse).length,
      byKind,
    },
  };
}

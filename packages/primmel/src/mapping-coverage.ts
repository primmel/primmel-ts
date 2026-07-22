// ─────────────────────────────────────────────────────────────────────
// The coverage calculus engine (TODO.roadmap/04; concept doc §5.3, §5.6;
// Mapping Guide slides 5–19, 46).
//
// Coverage answers, per reference-model component: how much of it is
// fulfilled by mapped implementations? Four levels — full / minimal /
// partial / no cover — computed by three propagation rules:
//
//   1. INHERITANCE (downward): a directly-mapped component is fully
//      covered, and the mapping covers its whole subprocess tree
//      recursively (slide 12).
//   2. AGGREGATION (upward): all children full ⇒ parent full; gateway
//      children with the minimum met (at least one branch full/minimal)
//      ⇒ parent minimal; something covered but not the minimum ⇒
//      partial; nothing ⇒ none (slides 7–9).
//   3. TRANSITIVITY (process level): A ⇒ B and B ⇒ C ⊢ A ⇒ C — computed
//      as DISCOVERY proposals (flagged, never asserted; slides 16–18).
//      At MODEL level transitivity does NOT hold: two mappings chain
//      only through a shared component (slide 15) — discoverTransitive
//      therefore requires the exact same Namespace#ElementID on both
//      hops, and repoMap reports declared links only, no closure.
//
// A fourth rule, CLOSURE — all children covered ⇒ parent covered without
// a direct mapping — is the standard discovery heuristic: the parent's
// coverage LEVEL is aggregated (asserted), but a direct mapping pair to
// the parent is only ever PROPOSED, flagged for confirmation (slide 46).
//
// TREE SOURCE: the process tree is built from the declared parent /
// children links of processes (nested `process` declarations — the v3
// nesting, also legal in v2), NOT from canvas layout: the canvas is a
// visual projection, while the children links are the requirement
// decomposition the calculus aggregates over. A parent whose children
// are exclusive branches declares `child_composition gateway` (default
// `all`) — the gateway semantics of rule 2.
// ─────────────────────────────────────────────────────────────────────

import type Standard from './types/Standard';
import type MapProfile from './types/MapProfile';
import type { CoverageLevel } from './types/MapProfile';
import type ViewProfile from './types/ViewProfile';
import type { PrmFile } from './ser-des/prm';
import { prmToMapProfiles } from './ser-des/prm';

export type { CoverageLevel } from './types/MapProfile';

// ── mapping records ──────────────────────────────────────────────────

/** A normalized mapping pair, lifted out of its serialization. */
export interface MappingRecord {
  /** Source component id — local to the source (implementation) model. */
  source: string;
  /** Source model id (package manifest id or the supplied modelId). */
  sourceModel: string;
  /** Target component, ALWAYS in qualified `Namespace#ElementID` form. */
  target: string;
  /** Target (reference) namespace — the map_profile/mapSet key. */
  targetModel: string;
  description: string;
  justification: string;
  /** Authored coverage assertion ('' = none) — input to C23. */
  assertedCoverage: CoverageLevel | '';
}

/** A `Namespace#ElementID` reference, split and normalized. */
export interface TargetRef {
  namespace: string;
  id: string;
  qualified: string;
}

/**
 * Split a mapping target into namespace + element id. A bare id is
 * scoped by the profile/mapSet namespace it was authored under (the v2
 * spelling); a `Namespace#ElementID` carries its namespace explicitly.
 */
export function parseTargetRef(raw: string, defaultNs: string): TargetRef {
  const hash = raw.indexOf('#');
  if (hash >= 0) {
    const namespace = raw.slice(0, hash);
    const id = raw.slice(hash + 1);
    return { namespace, id, qualified: namespace + '#' + id };
  }
  return { namespace: defaultNs, id: raw, qualified: defaultNs + '#' + raw };
}

/** Lift one map profile's pairs into normalized mapping records. */
export function mappingsFromProfile(
  profile: MapProfile,
  sourceModel: string,
): MappingRecord[] {
  const out: MappingRecord[] = [];
  for (const [source, pairs] of Object.entries(profile.mappings)) {
    for (const pair of pairs) {
      out.push({
        source,
        sourceModel,
        target: parseTargetRef(pair.target, profile.namespace).qualified,
        targetModel: profile.namespace,
        description: pair.description,
        justification: pair.justification,
        assertedCoverage: pair.coverage,
      });
    }
  }
  return out;
}

/**
 * Collect every mapping record a model declares — its in-model map
 * profiles plus any standalone .prm files passed alongside.
 */
export function collectMappings(
  standard: Standard,
  options: { modelId?: string; prm?: PrmFile | PrmFile[] } = {},
): MappingRecord[] {
  const modelId =
    options.modelId ??
    standard.packageManifest?.id ??
    standard.meta?.namespace ??
    '';
  const profiles: MapProfile[] = [...(standard.mapProfiles ?? [])];
  const prms = options.prm
    ? Array.isArray(options.prm)
      ? options.prm
      : [options.prm]
    : [];
  for (const prm of prms) {
    profiles.push(...prmToMapProfiles(prm));
  }
  return profiles.flatMap(p => mappingsFromProfile(p, modelId));
}

// ── the process tree ─────────────────────────────────────────────────

/** One node of a reference model's process tree. */
export interface ProcessTreeNode {
  id: string;
  /** 'all' = every child required; 'gateway' = at least one branch. */
  composition: 'all' | 'gateway';
  children: ProcessTreeNode[];
}

/**
 * Build the process forest of a model from the declared parent/children
 * links (nested process declarations). Roots are processes with no
 * parent inside the (possibly prefix-filtered) set; dangling child links
 * are skipped. `idPrefix` selects an alias forest — e.g. the local
 * `StdS#…` copies an implementation model declares for its mapping
 * targets (the Namespace#ElementID aliasing pattern); the prefix is
 * STRIPPED from the node ids so an alias `StdS#Process5` stands in for
 * the reference element `Process5`.
 */
export function buildProcessTree(
  standard: Standard,
  options: { idPrefix?: string } = {},
): ProcessTreeNode[] {
  const prefix = options.idPrefix ?? '';
  const processes = (standard.processes ?? []).filter(
    p => !prefix || p.id.startsWith(prefix),
  );
  const ids = new Set(processes.map(p => p.id));
  const nodes = new Map<string, ProcessTreeNode>();
  for (const p of processes) {
    nodes.set(p.id, {
      id: p.id.slice(prefix.length),
      composition: p.childComposition === 'gateway' ? 'gateway' : 'all',
      children: [],
    });
  }
  const roots: ProcessTreeNode[] = [];
  for (const p of processes) {
    const node = nodes.get(p.id)!;
    if (p.parent && ids.has(p.parent)) {
      nodes.get(p.parent)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

// ── coverage computation ─────────────────────────────────────────────

/** Per-component coverage row of a coverage report. */
export interface ComponentCoverage {
  id: string;
  coverage: CoverageLevel;
  directlyMapped: boolean;
  /** Implementation sources mapped directly to this component. */
  mappedBy: string[];
  /** Nearest mapped ancestor when the cover is inherited (else null). */
  inheritedFrom: string | null;
}

/** A discovery proposal — always flagged, never asserted. */
export interface DiscoveryProposal {
  kind: 'transitive' | 'inherited' | 'closure';
  sourceModel: string;
  source: string;
  targetModel: string;
  target: string;
  /** The chain/children that justify the proposal. */
  via: string[];
  rationale: string;
  /** Discovery never asserts: a human confirms with justification. */
  asserted: false;
}

/** Coverage level tallies over a report's components. */
export interface CoverageSummary {
  full: number;
  minimal: number;
  partial: number;
  none: number;
}

/**
 * A mapping pair whose target id is absent from the reference tree.
 * Dangling pairs are reported explicitly — never silently dropped — and
 * do NOT count their source as mapped.
 */
export interface UnresolvedMapping {
  source: string;
  /** The authored target, in qualified `Namespace#ElementID` form. */
  target: string;
}

/** The per-reference-package coverage report (concept doc §5.3, §5.6 c). */
export interface CoverageReport {
  implementation: string;
  reference: string;
  targetNamespace: string;
  /** Every reference component, in tree (DFS pre-order) order. */
  components: ComponentCoverage[];
  /**
   * Implementation processes with no RESOLVING mapping into this target
   * — a source whose mappings all dangle is not "mapped".
   */
  unmappedImplementation: string[];
  /** Mapping pairs whose target doesn't resolve against the reference tree. */
  unresolvedMappings: UnresolvedMapping[];
  /** Inherited + closure proposals (flagged, never asserted). */
  proposals: DiscoveryProposal[];
  summary: CoverageSummary;
}

function aggregateUp(
  composition: 'all' | 'gateway',
  childLevels: CoverageLevel[],
): CoverageLevel {
  if (childLevels.length === 0) {
    return 'none';
  }
  if (childLevels.every(l => l === 'full')) {
    return 'full';
  }
  if (composition === 'gateway') {
    // The gateway minimum: at least one branch fulfilled — a branch
    // counts when its own minimum is met (full or minimal cover).
    if (childLevels.some(l => l === 'full' || l === 'minimal')) {
      return 'minimal';
    }
  }
  if (childLevels.some(l => l !== 'none')) {
    return 'partial';
  }
  return 'none';
}

/**
 * Compute the coverage of one reference model by one implementation
 * model for ONE target namespace (multi-target mappings are computed
 * per target — mapSet namespaces stay independent, concept doc §5.6 c).
 *
 * `reference` is either the loaded reference Standard or a prebuilt
 * process forest (buildProcessTree — e.g. an alias forest lifted out of
 * the implementation model for the linter's C23).
 */
export function computeCoverage(
  implementation: Standard,
  reference: Standard | ProcessTreeNode[],
  mappings: MappingRecord[],
  targetNamespace: string,
  options: { implementationId?: string; referenceId?: string } = {},
): CoverageReport {
  const forest = Array.isArray(reference)
    ? reference
    : buildProcessTree(reference);
  const relevant = mappings.filter(m => m.targetModel === targetNamespace);

  // Directly-mapped reference components → their implementation sources.
  const direct = new Map<string, string[]>();
  for (const m of relevant) {
    const id = parseTargetRef(m.target, targetNamespace).id;
    (direct.get(id) ?? direct.set(id, []).get(id)!).push(m.source);
  }

  const levels = new Map<string, CoverageLevel>();
  const inheritedFrom = new Map<string, string>();

  // Inheritance down + aggregation up in one post-order walk: a node
  // under a mapped ancestor is full (the mapping covers the subtree);
  // otherwise a leaf is none and a parent aggregates its children.
  const walk = (
    node: ProcessTreeNode,
    mappedAncestor: string | null,
  ): CoverageLevel => {
    const selfMapped = direct.has(node.id);
    const nearest = selfMapped ? node.id : mappedAncestor;
    const childLevels = node.children.map(c => walk(c, nearest));
    let level: CoverageLevel;
    if (nearest !== null) {
      level = 'full';
      if (!selfMapped && mappedAncestor !== null) {
        inheritedFrom.set(node.id, mappedAncestor);
      }
    } else if (node.children.length === 0) {
      level = 'none';
    } else {
      level = aggregateUp(node.composition, childLevels);
    }
    levels.set(node.id, level);
    return level;
  };
  for (const root of forest) {
    walk(root, null);
  }

  // Components in tree order (DFS pre-order).
  const components: ComponentCoverage[] = [];
  const nodeIndex = new Map<string, ProcessTreeNode>();
  const visit = (node: ProcessTreeNode): void => {
    nodeIndex.set(node.id, node);
    components.push({
      id: node.id,
      coverage: levels.get(node.id) ?? 'none',
      directlyMapped: direct.has(node.id),
      mappedBy: direct.get(node.id) ?? [],
      inheritedFrom: inheritedFrom.get(node.id) ?? null,
    });
    node.children.forEach(visit);
  };
  forest.forEach(visit);

  const summary: CoverageSummary = {
    full: 0,
    minimal: 0,
    partial: 0,
    none: 0,
  };
  for (const c of components) {
    summary[c.coverage]++;
  }

  // Mappings whose target id is absent from the reference tree are
  // UNRESOLVED: they surface explicitly (never silently dropped) and do
  // not count their source as mapped — a source whose mappings into this
  // target ALL dangle is unmapped for this report.
  const unresolvedMappings: UnresolvedMapping[] = [];
  const resolvedSources = new Set<string>();
  for (const m of relevant) {
    const id = parseTargetRef(m.target, targetNamespace).id;
    if (nodeIndex.has(id)) {
      resolvedSources.add(m.source);
    } else {
      unresolvedMappings.push({ source: m.source, target: m.target });
    }
  }

  // Implementation processes with no resolving mapping into this target.
  const unmappedImplementation = (implementation.processes ?? [])
    .map(p => p.id)
    .filter(id => !resolvedSources.has(id));

  // ── discovery (flagged, never asserted) ──
  const proposals: DiscoveryProposal[] = [];
  const proposed = new Set<string>();
  const propose = (p: DiscoveryProposal): void => {
    const key = `${p.kind}|${p.sourceModel}|${p.source}|${p.target}`;
    if (!proposed.has(key)) {
      proposed.add(key);
      proposals.push(p);
    }
  };

  // Inherited: A ⇒ B and C is a subprocess of B ⊢ propose A ⇒ C
  // (slide 18) — making the inherited cover explicit is a human call.
  for (const m of relevant) {
    const targetId = parseTargetRef(m.target, targetNamespace).id;
    const node = nodeIndex.get(targetId);
    if (!node) {
      continue;
    }
    const descendants = (n: ProcessTreeNode, acc: ProcessTreeNode[]): void => {
      for (const c of n.children) {
        acc.push(c);
        descendants(c, acc);
      }
    };
    const desc: ProcessTreeNode[] = [];
    descendants(node, desc);
    for (const d of desc) {
      if ((direct.get(d.id) ?? []).includes(m.source)) {
        continue;
      }
      propose({
        kind: 'inherited',
        sourceModel: m.sourceModel,
        source: m.source,
        targetModel: targetNamespace,
        target: `${targetNamespace}#${d.id}`,
        via: [m.target],
        rationale:
          `${m.source} ⇒ ${m.target} covers ${targetNamespace}#${d.id} ` +
          'by inheritance — propose the pair explicitly for confirmation',
        asserted: false,
      });
    }
  }

  // Closure: all children covered ⇒ the parent is covered by aggregation
  // (asserted as a LEVEL) — but a direct pair to the parent is only
  // proposed, flagged for confirmation (slide 46), never asserted.
  for (const c of components) {
    const node = nodeIndex.get(c.id)!;
    if (
      c.directlyMapped ||
      c.coverage !== 'full' ||
      node.children.length === 0
    ) {
      continue;
    }
    const subtreeSources = new Set<string>();
    const collectSources = (n: ProcessTreeNode): void => {
      for (const s of direct.get(n.id) ?? []) {
        subtreeSources.add(s);
      }
      n.children.forEach(collectSources);
    };
    node.children.forEach(collectSources);
    for (const s of subtreeSources) {
      propose({
        kind: 'closure',
        sourceModel:
          relevant.find(m => m.source === s)?.sourceModel ??
          options.implementationId ??
          '',
        source: s,
        targetModel: targetNamespace,
        target: `${targetNamespace}#${c.id}`,
        via: node.children.map(ch => `${targetNamespace}#${ch.id}`),
        rationale:
          `all children of ${targetNamespace}#${c.id} are covered — ` +
          'closure candidate: confirm and assert a direct mapping',
        asserted: false,
      });
    }
  }

  return {
    implementation:
      options.implementationId ??
      implementation.packageManifest?.id ??
      implementation.meta?.namespace ??
      '',
    reference:
      options.referenceId ??
      (Array.isArray(reference)
        ? targetNamespace
        : (reference.packageManifest?.id ?? reference.meta?.namespace ?? '')),
    targetNamespace,
    components,
    unmappedImplementation,
    unresolvedMappings,
    proposals,
    summary,
  };
}

// ── cross-model discovery + the repo map ─────────────────────────────

/** One model's contribution to a cross-model discovery run. */
export interface ModelMappings {
  modelId: string;
  mappings: MappingRecord[];
}

/**
 * Process-level transitivity across a chain of models: A ⇒ B (in
 * model M→R1) and B ⇒ C (in model R1→R2) ⊢ propose A ⇒ C (slide 16).
 *
 * MODEL-LEVEL NON-TRANSITIVITY is enforced structurally (slide 15): two
 * mappings chain ONLY when they share the exact same component — the
 * first hop's target must equal the second hop's source in the middle
 * model's namespace. Two mappings with no common component carry no
 * logical information and yield NO proposal.
 */
export function discoverTransitive(
  models: ModelMappings[],
): DiscoveryProposal[] {
  const proposals: DiscoveryProposal[] = [];
  const proposed = new Set<string>();
  for (const from of models) {
    for (const m1 of from.mappings) {
      for (const mid of models) {
        if (mid.modelId !== m1.targetModel) {
          continue;
        }
        for (const m2 of mid.mappings) {
          // The shared component: m1 targets exactly m2's source.
          if (m1.target !== `${mid.modelId}#${m2.source}`) {
            continue;
          }
          const key = `${m1.sourceModel}|${m1.source}|${m2.target}`;
          if (proposed.has(key)) {
            continue;
          }
          proposed.add(key);
          proposals.push({
            kind: 'transitive',
            sourceModel: m1.sourceModel,
            source: m1.source,
            targetModel: m2.targetModel,
            target: m2.target,
            via: [m1.target],
            rationale:
              `${m1.sourceModel}#${m1.source} ⇒ ${m1.target} and ` +
              `${mid.modelId}#${m2.source} ⇒ ${m2.target} — transitive ` +
              'candidate through the shared component; confirm to assert',
            asserted: false,
          });
        }
      }
    }
  }
  return proposals;
}

/** One edge of the model-level repo map. */
export interface RepoMapEdge {
  from: string;
  to: string;
  /** Number of declared mapping pairs across this link. */
  pairs: number;
}

/**
 * The model-level repo map: which models map to which. DECLARED links
 * only — no transitive closure is computed at model level, because
 * model-level transitivity does not hold in general (slide 14/15): a
 * link aaa ⇒ bbb and a link bbb ⇒ ccc say nothing about aaa ⇒ ccc.
 */
export function repoMap(models: ModelMappings[]): RepoMapEdge[] {
  const edges = new Map<string, RepoMapEdge>();
  for (const model of models) {
    for (const m of model.mappings) {
      const key = `${model.modelId}→${m.targetModel}`;
      const edge = edges.get(key) ?? {
        from: model.modelId,
        to: m.targetModel,
        pairs: 0,
      };
      edge.pairs++;
      edges.set(key, edge);
    }
  }
  return [...edges.values()];
}

// ── views (read-only lenses) ─────────────────────────────────────────

/**
 * A view projection (concept doc §5.6 d): the model read THROUGH a lens —
 * the selected elements plus, when the view names a reference
 * (`against`), the coverage filtered to what the lens shows. Views are
 * READ-ONLY: the projection is a fresh, deeply frozen object; applying a
 * view never adds, removes, or edits the underlying model or its
 * mappings (linter rule C26).
 */
export interface ViewProjection {
  id: string;
  /** The reference namespace the view is read against ('' = none). */
  against: string;
  /** The element ids visible through the lens (empty whitelist = all). */
  elements: string[];
  /** The coverage report filtered to the lens (null when not supplied). */
  coverage: CoverageReport | null;
}

function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === 'object') {
    for (const v of Object.values(obj)) {
      deepFreeze(v);
    }
    Object.freeze(obj);
  }
  return obj;
}

/**
 * Apply a view profile to a model (+ optionally its coverage report
 * against the view's reference). Returns a FROZEN projection; the inputs
 * are never mutated.
 */
export function applyView(
  standard: Standard,
  view: ViewProfile,
  coverage: CoverageReport | null = null,
): ViewProjection {
  const whitelist = new Set(view.visibleElements ?? []);
  const filtered = whitelist.size > 0;
  const elements = filtered
    ? [...whitelist]
    : (standard.processes ?? []).map(p => p.id);

  let projected: CoverageReport | null = null;
  if (coverage) {
    // The lens selects IMPLEMENTATION elements; the coverage it shows is
    // the coverage attributable to the visible sources (a component
    // stays visible when a visible source maps to it — or when the view
    // whitelists the component id itself, e.g. a reference-side alias).
    const show = (c: ComponentCoverage): boolean =>
      !filtered ||
      whitelist.has(c.id) ||
      c.mappedBy.some(s => whitelist.has(s));
    const components = coverage.components.filter(show);
    const summary: CoverageSummary = {
      full: 0,
      minimal: 0,
      partial: 0,
      none: 0,
    };
    for (const c of components) {
      summary[c.coverage]++;
    }
    projected = {
      ...coverage,
      components,
      unmappedImplementation: coverage.unmappedImplementation.filter(
        id => !filtered || whitelist.has(id),
      ),
      proposals: coverage.proposals.filter(
        p => !filtered || whitelist.has(p.source),
      ),
      summary,
    };
  }

  return deepFreeze<ViewProjection>({
    id: view.id,
    against: view.against ?? '',
    elements,
    coverage: projected,
  });
}

// ── shared component index (linter + reports) ────────────────────────

/**
 * The ids a mapping (or view) may legally name: every typed component of
 * the model. Mappings attach at process granularity by default, but any
 * typed component can be mapped — a registry, an approval, a provision,
 * a conformance test (concept doc §5.2).
 */
export function componentIds(standard: Standard): Set<string> {
  const ids = new Set<string>();
  const add = (items: ReadonlyArray<{ id: string }> | undefined): void => {
    for (const i of items ?? []) {
      ids.add(i.id);
    }
  };
  add(standard.processes);
  add(standard.provisions);
  add(standard.regs);
  add(standard.approvals);
  add(standard.requirements);
  add(standard.conformanceTests);
  add(standard.forms);
  add(standard.symbols);
  add(standard.tables);
  add(standard.dataclasses);
  add(standard.terms);
  add(standard.notes);
  add(standard.roles);
  add(standard.subjects);
  add(standard.instruments);
  return ids;
}

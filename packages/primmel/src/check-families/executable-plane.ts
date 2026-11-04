// ─────────────────────────────────────────────────────────────────────
// The executable-plane family (C10-C16 the executable process bodies,
// C17-C20 instantiation and delegation, C21-C26 the mapping primitive
// + the coverage calculus; TODO.roadmap/02/03, the mapping doctrine):
// the process `does` bodies' dataflow and timing legs, the instance
// and delegation chains, and the mapping primitive + its coverage
// calculus (the ch. 5 computation run on both versions). The region
// moves verbatim from check.ts (the mapped-callee options and the
// loader narrowed to the context's resolvePackage); the compiler and
// the suite pin the move.
// ─────────────────────────────────────────────────────────────────────

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { effectiveUses, readPackageManifest } from '../ser-des/package';
import { loadPrm, prmToMapProfiles } from '../ser-des/prm';
import {
  buildProcessTree,
  componentIds,
  computeCoverage,
  mappingsFromProfile,
  parseTargetRef,
} from '../mapping-coverage';
import type MapProfile from '../types/MapProfile';
import type { PackageManifest } from '../types/Package';
import type { CheckOptions } from '../check';
import { delegationSuccessors } from '../instance-resolution';
import { findCycle } from '../graph';
import { DIM_ALIASES } from '../check-paths';
import type Standard from '../types/Standard';

export interface ExecutablePlaneContext {
  dir: string;
  standard: Standard;
  subjectIds: Set<string>;
  err: (check: string, message: string) => void;
  warn: (check: string, message: string) => void;
  resolvePackage?: (id: string) => string | undefined;
  checkOptions: CheckOptions;
}

/**
 * Dependency-manifest resolution for the supply-chain rules (C24's
 * product_reference exemption, C81, C83): the composition locator when
 * given, else the SIBLING-package scan (the checkManifestResolution
 * stopgap pattern) — manifest-only linting (no --with) must still see
 * package kinds and edition registers. Memoized per package id.
 */
export function createDepManifestResolver(
  dir: string,
  resolvePackage?: (id: string) => string | undefined,
): (id: string) => PackageManifest | null {
  const cache = new Map<string, PackageManifest | null>();
  const siblings = new Map<string, PackageManifest>();
  try {
    const parent = dirname(resolve(dir));
    for (const entry of readdirSync(parent).sort()) {
      const full = join(parent, entry);
      try {
        if (!statSync(full).isDirectory()) {
          continue;
        }
        const m = readPackageManifest(full);
        siblings.set(m.id, m);
      } catch {
        // Not a package dir (no/invalid manifest) — not a candidate.
      }
    }
  } catch {
    // No readable parent — no sibling fallback.
  }
  return (id: string): PackageManifest | null => {
    const cached = cache.get(id);
    if (cached !== undefined) {
      return cached;
    }
    let m: PackageManifest | null = null;
    const located = resolvePackage?.(id);
    if (located) {
      try {
        m = readPackageManifest(located);
      } catch {
        m = null;
      }
    }
    m ??= siblings.get(id) ?? null;
    cache.set(id, m);
    return m;
  };
}

export function runExecutablePlaneFamily({
  dir,
  standard,
  subjectIds,
  err,
  warn,
  resolvePackage,
  checkOptions,
}: ExecutablePlaneContext): void {
  // ── C10–C16: executable process bodies (TODO.roadmap/02) ──
  // These rules apply only to processes with a `does` body (the
  // executable form). Abstract processes (signature/invariants, no
  // `does`) are always valid; v2 canvas processes are untouched.
  for (const p of standard.processes ?? []) {
    const flow = p.does;
    if (!flow) {
      continue;
    }
    const steps = flow.steps ?? [];
    const edges = flow.edges ?? [];

    // C16 — step ids are unique within one does body
    // (process-step-ids-unique). Declared BEFORE the stepById map below
    // silently keeps the last duplicate.
    const seenStepIds = new Set<string>();
    for (const s of steps) {
      if (seenStepIds.has(s.id)) {
        err(
          'C16',
          `process ${p.id}: duplicate step id "${s.id}" in the does body (process-step-ids-unique)`,
        );
      }
      seenStepIds.add(s.id);
    }
    const stepById = new Map(steps.map(s => [s.id, s]));

    // The declared name vocabulary for step I/O and edge conditions:
    // registers + signature IN/OUT parameters + instance-parameter keys +
    // the process's own `state` (a declared HAS).
    const declared = new Set<string>(['state']);
    for (const r of p.registers ?? []) {
      declared.add(r.name);
    }
    for (const prm of p.signature?.inputs ?? []) {
      declared.add(prm.name);
    }
    for (const prm of p.signature?.outputs ?? []) {
      declared.add(prm.name);
    }
    for (const v of Object.values(p.instances?.values ?? {})) {
      for (const k of Object.keys(v)) {
        declared.add(k);
      }
    }

    // C10 — exactly one start event per executable process.
    const starts = steps.filter(s => s.kind === 'start_event');
    if (starts.length !== 1) {
      err(
        'C10',
        `process ${p.id}: executable process has ${starts.length} start events — exactly one required (process-one-start)`,
      );
    }

    // C11 — end events on every terminal path (mandatory on empty
    // gateway branches); flow edges reference declared steps.
    const outgoing = new Map<string, typeof edges>();
    for (const e of edges) {
      if (!stepById.has(e.from)) {
        err(
          'C11',
          `process ${p.id}: flow edge starts at undeclared step "${e.from}" (process-terminal-end)`,
        );
      }
      if (!stepById.has(e.to)) {
        err(
          'C11',
          `process ${p.id}: flow edge ends at undeclared step "${e.to}" (process-terminal-end)`,
        );
      }
      outgoing.set(e.from, [...(outgoing.get(e.from) ?? []), e]);
    }
    for (const s of steps) {
      if ((outgoing.get(s.id) ?? []).length === 0 && s.kind !== 'end_event') {
        err(
          'C11',
          `process ${p.id}: step "${s.id}" (${s.kind}) is a terminal path with no end event — every terminal path must close at an end_event, mandatory on empty gateway branches (process-terminal-end)`,
        );
      }
    }

    // C12 — gateway edge conditions and step I/O name declared registers.
    // The caller-side names of a call's `with` bindings are step I/O too
    // (TODO.roadmap/38): an in-binding READS the caller name, an
    // out-mapping WRITES it. The callee-side parameter names are checked
    // against the callee's signature by C76, not here.
    for (const s of steps) {
      const ioNames = [...s.reads, ...s.writes];
      if (s.wait) {
        ioNames.push(s.wait);
      }
      for (const b of s.callIn) {
        ioNames.push(b.bind);
      }
      for (const b of s.callOut) {
        ioNames.push(b.bind);
      }
      for (const n of ioNames) {
        if (!declared.has(n)) {
          err(
            'C12',
            `process ${p.id}: step "${s.id}" names undeclared register "${n}" (process-flow-names-resolve)`,
          );
        }
      }
      if (s.kind === 'gateway') {
        for (const e of outgoing.get(s.id) ?? []) {
          const re = /\bself\.([A-Za-z_][A-Za-z0-9_]*)/g;
          let m: RegExpExecArray | null;
          while ((m = re.exec(e.condition)) !== null) {
            if (!declared.has(m[1])) {
              err(
                'C12',
                `process ${p.id}: gateway "${s.id}" edge condition references undeclared register "${m[1]}" (process-flow-names-resolve)`,
              );
            }
          }
        }
      }
    }

    // C13 — the executable steps realize the signature: every OUT
    // parameter is written (error), every IN parameter is read (warning).
    // Call bindings count: an in-binding reads the caller name, an
    // out-mapping writes it (TODO.roadmap/38).
    if (p.signature) {
      const written = new Set<string>();
      const read = new Set<string>();
      for (const s of steps) {
        s.writes.forEach(n => written.add(n));
        s.reads.forEach(n => read.add(n));
        if (s.wait) {
          read.add(s.wait);
        }
        s.callOut.forEach(b => written.add(b.bind));
        s.callIn.forEach(b => read.add(b.bind));
      }
      for (const o of p.signature.outputs) {
        if (!written.has(o.name)) {
          err(
            'C13',
            `process ${p.id}: OUT parameter "${o.name}" is never written by any step (process-signature-realized)`,
          );
        }
      }
      for (const inp of p.signature.inputs) {
        if (!read.has(inp.name)) {
          warn(
            'C13',
            `process ${p.id}: IN parameter "${inp.name}" is never read by any step (process-signature-realized)`,
          );
        }
      }
    }

    // C14 — a recurrence (a cycle in the flow graph) must pass through a
    // timer event WITH a declared period: remove guarded timer nodes and
    // require the rest acyclic. A period-less timer_event is NOT a guard
    // (C15) and does not break the cycle here.
    const timerIds = new Set(
      steps.filter(s => s.kind === 'timer_event' && s.period).map(s => s.id),
    );
    const adj = new Map<string, string[]>();
    for (const e of edges) {
      if (timerIds.has(e.from) || timerIds.has(e.to)) {
        continue;
      }
      adj.set(e.from, [...(adj.get(e.from) ?? []), e.to]);
    }
    const cycle = findCycle(adj);
    if (cycle) {
      err(
        'C14',
        `process ${p.id}: recurrence ${cycle.join(' → ')} contains no timer event — an unguarded infinite self-loop (process-timer-recurrence)`,
      );
    }

    // C15 — a timer_event must declare its recurrence `period`: without
    // one it cannot guard a loop (C14) and is almost certainly a
    // modelling mistake (process-timer-period). The period FORMAT is
    // validated by C35 (time-format, TODO.roadmap/06); this rule checks
    // presence only.
    for (const s of steps) {
      if (s.kind === 'timer_event' && !s.period) {
        err(
          'C15',
          `process ${p.id}: timer_event "${s.id}" declares no period — a timer event without a recurrence period cannot guard a loop (process-timer-period)`,
        );
      }
    }
  }

  // ── C17–C20: instantiation and delegation (TODO.roadmap/03) ──
  // The instance plane: scope discipline on stated values (C17), INV-8
  // version pins (C18), subject-chain integrity (C19), and `of` reference
  // resolution (C20).
  const CHAIN_LEVEL_ORDER: Record<string, number> = {
    family: 0,
    group: 1,
    model: 2,
    sample: 3,
  };
  const instrumentIds = new Set((standard.instruments ?? []).map(i => i.id));
  const instanceIds = new Set((standard.instances ?? []).map(i => i.id));
  const dataclassIds = new Set((standard.dataclasses ?? []).map(c => c.id));
  // The BARE-PREFIX link spelling: a class's extends may name a class
  // without its plane segment (Organization for Organization#data —
  // the language's own link spelling; the pre-1.21.0 checker and the
  // platform linker resolve it). C156 resolves both spellings.
  const dataclassBareIds = new Set(
    (standard.dataclasses ?? []).map(c => c.id.split('#')[0]!),
  );
  const attrScopes = new Map(
    (standard.attributeDefinitions ?? []).map(a => [a.id, a.scope]),
  );
  // Classification-dimension scopes, by every spelling a classification
  // map may use: the instrument dimension id, the is_dimension attribute
  // mirror id, and the enum-name aliases (DIM_ALIASES).
  const dimScopes = new Map<string, string>();
  for (const inst of standard.instruments ?? []) {
    for (const d of inst.dimensions ?? []) {
      if (d.scope) {
        dimScopes.set(d.id, d.scope);
      }
    }
  }
  for (const a of standard.attributeDefinitions ?? []) {
    if (a.isDimension && a.scope && !dimScopes.has(a.id)) {
      dimScopes.set(a.id, a.scope);
    }
  }
  for (const [alias, canonical] of Object.entries(DIM_ALIASES)) {
    const s = dimScopes.get(canonical) ?? attrScopes.get(canonical);
    if (s && !dimScopes.has(alias)) {
      dimScopes.set(alias, s);
    }
  }

  for (const inst of standard.instances ?? []) {
    const levelIdx = CHAIN_LEVEL_ORDER[inst.level];

    // C17 — instance-scope: every stated value at its declared scope or
    // lower; sample-scope values only in a sample's test_context.
    // NOTE (sample-level override gap): the language PERMITS a
    // non-sample-scope attribute in a sample's has.attributes (the
    // lower-override law — a sample may restate a wider-scope value), and
    // C17 accepts it. But the current app plane has no sample
    // `parameters` field (only `test_context`), so such a value has no
    // app-side home: recs SHOULD NOT author sample-level attribute
    // overrides until the app plane grows one (tracked by TODO.roadmap
    // task 29). A future strict mode may make this an error.
    if (levelIdx === undefined) {
      err(
        'C17',
        `instance ${inst.id}: level "${inst.level}" is not a chain level (family | group | model | sample) (instance-scope)`,
      );
    }
    for (const key of Object.keys(inst.has?.attributes ?? {})) {
      const scope = attrScopes.get(key);
      if (scope === undefined) {
        err(
          'C17',
          `instance ${inst.id}: attribute "${key}" is not a declared attribute_definition — scope cannot be checked (instance-scope)`,
        );
      } else if (scope === 'sample') {
        err(
          'C17',
          `instance ${inst.id}: sample-scope attribute "${key}" stated in has.attributes — sample-scope values live in has.test_context and are never inherited (instance-scope)`,
        );
      } else if (
        scope &&
        levelIdx !== undefined &&
        CHAIN_LEVEL_ORDER[scope] !== undefined &&
        levelIdx < CHAIN_LEVEL_ORDER[scope]
      ) {
        err(
          'C17',
          `instance ${inst.id}: attribute "${key}" (scope ${scope}) stated at ${inst.level} level — values are stated at their declared scope or lower (instance-scope)`,
        );
      }
    }
    for (const key of Object.keys(inst.has?.testContext ?? {})) {
      if (inst.level !== 'sample') {
        err(
          'C17',
          `instance ${inst.id}: test_context value "${key}" on a ${inst.level}-level instance — test_context exists only at sample level (instance-scope)`,
        );
      }
      const scope = attrScopes.get(key);
      if (scope === undefined) {
        err(
          'C17',
          `instance ${inst.id}: attribute "${key}" is not a declared attribute_definition — scope cannot be checked (instance-scope)`,
        );
      } else if (scope !== 'sample') {
        err(
          'C17',
          `instance ${inst.id}: attribute "${key}" (scope ${scope}) stated in test_context — test_context holds sample-scope attributes only (instance-scope)`,
        );
      }
    }
    for (const key of Object.keys(inst.has?.dimensions ?? {})) {
      if (inst.level === 'sample') {
        err(
          'C17',
          `instance ${inst.id}: classification "${key}" on a sample-level instance — samples carry no classification (instance-scope)`,
        );
      }
      const scope = dimScopes.get(key);
      if (scope === undefined) {
        err(
          'C17',
          `instance ${inst.id}: classification dimension "${key}" is not declared (instance-scope)`,
        );
      } else if (
        levelIdx !== undefined &&
        CHAIN_LEVEL_ORDER[scope] !== undefined &&
        levelIdx < CHAIN_LEVEL_ORDER[scope]
      ) {
        err(
          'C17',
          `instance ${inst.id}: classification dimension "${key}" (scope ${scope}) stated at ${inst.level} level — values are stated at their declared scope or lower (instance-scope)`,
        );
      }
    }

    // C18 — instance-version-pin: every instance is version-pinned to its
    // definitions (INV-8); re-execution requires the pin.
    if (Object.keys(inst.definitionVersions ?? {}).length === 0) {
      err(
        'C18',
        `instance ${inst.id}: no definition_versions — every instance is version-pinned to its definitions (INV-8) (instance-version-pin)`,
      );
    }

    // C19 — chain-acyclic (integrity part 1): upward chain links resolve
    // to declared instances.
    for (const kind of ['model', 'group', 'family'] as const) {
      const target = inst[kind];
      if (target && !instanceIds.has(target)) {
        err(
          'C19',
          `instance ${inst.id}: chain link ${kind} "${target}" is not a declared instance (chain-acyclic)`,
        );
      }
    }

    // C20 — instance-of-resolves: the `of` reference names a declared
    // subject (v3), instrument (v2), or ANOTHER INSTANCE (the power-type
    // discipline — every instance can serve as the definition of further
    // instantiation).
    if (
      !subjectIds.has(inst.of) &&
      !instrumentIds.has(inst.of) &&
      !instanceIds.has(inst.of) &&
      !dataclassIds.has(inst.of)
    ) {
      err(
        'C20',
        `instance ${inst.id}: of "${inst.of}" is not a declared subject, instrument, class, or instance (instance-of-resolves)`,
      );
    }

    // C155 — power-type-chain (coherence leg): an instance whose `of`
    // names another instance carries NO upward subject-chain link — the
    // two are one pattern's two spellings, and mixing them makes the
    // delegation walk ambiguous.
    if (instanceIds.has(inst.of)) {
      const links = (['model', 'group', 'family'] as const).filter(
        k => inst[k],
      );
      if (links.length > 0) {
        err(
          'C155',
          `instance ${inst.id}: of "${inst.of}" names an instance and the instance carries an upward ${links.join('/')} link — the power-type chain and the subject-chain profile do not mix (power-type-chain)`,
        );
      }
    }
  }

  // C155 — power-type-chain (acyclicity leg): the MIXED delegation
  // graph — of-chains to instances AND the prototype hop (an `of` to a
  // class whose extends names an instance) — is acyclic: a cycle over
  // these edges would make the delegation walk non-terminating, and a
  // class instantiating its own prototype (`instance x of C` while
  // `C extends { x }`) is the shapes' own mutual recursion.
  const delegation = delegationSuccessors(standard);
  const ofAdj = new Map<string, string[]>();
  for (const [from, to] of delegation) {
    if (instanceIds.has(to)) {
      ofAdj.set(from, [to]);
    }
  }
  const ofCycle = findCycle(ofAdj);
  if (ofCycle) {
    err(
      'C155',
      `the power-type of-chain is cyclic: ${ofCycle.join(' → ')} (power-type-chain)`,
    );
  }

  // C156 — class-extends-resolves: a class's extends names a declared
  // class or a declared INSTANCE (the definition side of the power-type
  // discipline — a class extending an instance specializes that
  // individual). Successfully merged links clear at resolve time, so a
  // surviving link is exactly an unresolved one.
  for (const c of standard.dataclasses ?? []) {
    if (
      c.extends &&
      !dataclassIds.has(c.extends) &&
      !dataclassBareIds.has(c.extends) &&
      !instanceIds.has(c.extends)
    ) {
      warn(
        'C156',
        `class ${c.id}: extends "${c.extends}" is not a declared class or instance (class-extends-resolves)`,
      );
    }
  }

  // C19 — chain-acyclic (integrity part 2): the resolved link graph is
  // acyclic (a cycle would make delegation resolution non-terminating).
  const instAdj = new Map<string, string[]>();
  for (const inst of standard.instances ?? []) {
    const targets = [inst.model, inst.group, inst.family].filter(
      t => t && instanceIds.has(t),
    );
    if (targets.length > 0) {
      instAdj.set(inst.id, targets);
    }
  }
  const instCycle = findCycle(instAdj);
  if (instCycle) {
    err(
      'C19',
      `instance subject chain cycle: ${instCycle.join(' → ')} (chain-acyclic)`,
    );
  }

  // ── C21–C26: the mapping primitive + coverage calculus ──
  // (TODO.roadmap/04; concept doc §5.2, §5.6, §5.8). Mappings are the ONLY
  // compliance relation between an implementation model and a reference
  // model: both ends resolve (C21), the direction is fixed (C22), coverage
  // is computed not authored (C23), import ≠ mapping (C24), descriptions
  // are demanded at audit strictness (C25), and views are read-only (C26).
  const strictness = checkOptions.strictness ?? 'normal';
  const localNs = standard.packageManifest?.id ?? '';
  const compIds = componentIds(standard);

  // In-model map profiles + standalone .prm files in the package root —
  // both serializations of the same primitive, linted uniformly.
  const allProfiles: MapProfile[] = [...(standard.mapProfiles ?? [])];
  if (existsSync(dir)) {
    for (const entry of readdirSync(dir).sort()) {
      if (!entry.endsWith('.prm')) {
        continue;
      }
      const path = join(dir, entry);
      try {
        allProfiles.push(
          ...prmToMapProfiles(loadPrm(readFileSync(path, 'utf8'))),
        );
      } catch (e) {
        err('C21', `${entry}: ${(e as Error).message} (mapping-resolves)`);
      }
    }
  }

  // Dependency-manifest resolution for the supply-chain rules (C24's
  // product_reference exemption, C81, C83) — see createDepManifestResolver.
  const resolveDepManifest = createDepManifestResolver(dir, resolvePackage);

  for (const mp of allProfiles) {
    for (const [source, pairs] of Object.entries(mp.mappings)) {
      // C22 — direction: the source is a LOCAL component. A namespaced
      // source (NS#id) maps a reference element — the wrong way round.
      if (source.includes('#')) {
        err(
          'C22',
          `map_profile ${mp.namespace}: mapping source "${source}" is a namespaced reference element — the mapping direction is implementation → reference (mapping-direction)`,
        );
      } else if (!compIds.has(source)) {
        err(
          'C21',
          `map_profile ${mp.namespace}: mapping source "${source}" is not a declared component (mapping-resolves)`,
        );
      }
      for (const pair of pairs) {
        const ref = parseTargetRef(pair.target, mp.namespace);
        if (ref.namespace !== mp.namespace) {
          err(
            'C21',
            `map_profile ${mp.namespace}: target "${pair.target}" carries namespace "${ref.namespace}" ≠ the profile namespace "${mp.namespace}" (Namespace#ElementID aliasing) (mapping-resolves)`,
          );
        }
        if (localNs && ref.namespace === localNs) {
          err(
            'C22',
            `map_profile ${mp.namespace}: target "${pair.target}" is in the model's own namespace — mapping to one's own components inverts the direction (implementation → reference) (mapping-direction)`,
          );
        }
        if (!compIds.has(ref.qualified)) {
          err(
            'C21',
            `map_profile ${mp.namespace}: target "${ref.qualified}" has no declared alias element — the implementation model declares local copies of the reference elements it maps to (mapping-resolves)`,
          );
        }
        // C25 — a mapping without description is a warning at audit
        // strictness (silent in normal mode).
        if (strictness === 'audit' && !pair.description) {
          warn(
            'C25',
            `map_profile ${mp.namespace}: mapping ${source} -> ${ref.qualified} has no description — how the fulfilment works is demanded at audit strictness (mapping-description)`,
          );
        }
      }
    }
  }

  // C23 — mapping-calculus-consistency: coverage is COMPUTED, not
  // authored. An authored assertion that disagrees with the calculus is
  // an error — both the per-pair `coverage` on a mapping (its target is
  // directly mapped, hence fully covered) and the profile-level
  // `coverage { … }` tripwires over arbitrary reference components. The
  // reference tree comes from options.references when supplied, else
  // from the package's own Namespace#… alias forest.
  //
  // Usability notes when options.references is ABSENT: the alias forest
  // is built from the package's own `Namespace#ElementID` process
  // declarations, which are FRESH declarations — an alias of a gateway
  // parent must itself re-declare `child_composition gateway`, or the
  // alias aggregates with the default `all` and assertions compute
  // against the wrong composition. And closure proposals fire only at
  // FULL aggregation (every child full) — a gateway parent aggregated to
  // minimal/partial proposes nothing, so absence of a proposal is not
  // absence of cover.
  for (const mp of allProfiles) {
    const pairAssertions = Object.entries(mp.mappings).flatMap(
      ([source, pairs]) =>
        pairs
          .filter(p => p.coverage)
          .map(pair => ({
            source,
            pair,
            ref: parseTargetRef(pair.target, mp.namespace),
          })),
    );
    const profileAssertions = Object.entries(mp.coverage ?? {}).map(
      ([ref, level]) => ({ ref: parseTargetRef(ref, mp.namespace), level }),
    );
    if (pairAssertions.length === 0 && profileAssertions.length === 0) {
      continue;
    }
    const reference = checkOptions.references?.[mp.namespace];
    const forest = reference
      ? buildProcessTree(reference)
      : buildProcessTree(standard, { idPrefix: mp.namespace + '#' });
    const report = computeCoverage(
      standard,
      forest,
      mappingsFromProfile(mp, localNs),
      mp.namespace,
      { implementationId: localNs, referenceId: mp.namespace },
    );
    const computed = new Map(report.components.map(c => [c.id, c.coverage]));
    for (const a of pairAssertions) {
      const level = computed.get(a.ref.id);
      if (level === undefined) {
        continue; // C21 already flags the unresolvable target
      }
      if (level !== a.pair.coverage) {
        err(
          'C23',
          `map_profile ${mp.namespace}: ${a.source} -> ${a.ref.qualified} asserts coverage "${a.pair.coverage}" but the calculus computes "${level}" — coverage is computed, not authored (mapping-calculus-consistency)`,
        );
      }
    }
    for (const a of profileAssertions) {
      const level = computed.get(a.ref.id);
      if (level === undefined) {
        err(
          'C23',
          `map_profile ${mp.namespace}: coverage assertion for "${a.ref.qualified}" names a component outside the reference tree (mapping-calculus-consistency)`,
        );
        continue;
      }
      if (level !== a.level) {
        err(
          'C23',
          `map_profile ${mp.namespace}: coverage assertion "${a.ref.qualified}: ${a.level}" disagrees with the computed "${level}" — coverage is computed, not authored (mapping-calculus-consistency)`,
        );
      }
    }
  }

  // C24 — import-not-mapping: an import (uses/extends) is structural
  // inclusion; a mapping is a fulfilment claim. Neither may be expressed
  // as the other (concept doc §5.6 b) — one rule, both directions: the
  // imported set and the mapped set must be disjoint.
  //
  // Supply-chain exemption (TODO.roadmap/36, doctrine ch. 15 §15.3): an
  // ABSTRACT IMPORT of a product reference package is reference content
  // cited at a pinned edition, never structural inclusion — the composer
  // does not merge it (ser-des/package.ts). Mode-1 consumption IS a
  // mapping ("the user's model maps its usage to the product's promised
  // aspects"), so a map_profile whose namespace is an imported
  // product_reference package is the intended pattern, not a violation.
  const imported = new Set(
    [
      standard.packageManifest?.extends,
      ...(standard.packageManifest?.uses ?? []),
    ].filter((x): x is string => !!x),
  );
  for (const mp of allProfiles) {
    if (imported.has(mp.namespace)) {
      if (resolveDepManifest(mp.namespace)?.kind === 'product_reference') {
        continue;
      }
      err(
        'C24',
        `map_profile ${mp.namespace}: namespace "${mp.namespace}" is imported (uses/extends) — an import may not be expressed as a mapping, nor a mapping as an import; inclusion ≠ fulfilment (import-not-mapping)`,
      );
    }
  }

  // C26 — view-read-only: a view is a read-only lens. It may only name
  // declared elements, and its `against` reference must be a namespace
  // the model actually maps to — a view never adds, removes, or edits
  // the mappings of the model it reads (the grammar gives view_profile
  // no mapping slots, and applyView returns a frozen projection).
  const mappedNamespaces = new Set(allProfiles.map(p => p.namespace));
  for (const vp of standard.viewProfiles ?? []) {
    for (const el of vp.visibleElements ?? []) {
      if (!compIds.has(el)) {
        err(
          'C26',
          `view_profile ${vp.id}: visible element "${el}" is not a declared component — a view reads the model, it does not invent it (view-read-only)`,
        );
      }
    }
    if (vp.against && !mappedNamespaces.has(vp.against)) {
      err(
        'C26',
        `view_profile ${vp.id}: against "${vp.against}" names no declared map_profile/mapSet namespace — a view reads coverage, it does not create it (view-read-only)`,
      );
    }
  }
  // ── C81–C83: the model supply chain (TODO.roadmap/36; doctrine ch. 15
  // §15.9) ──
  // Three publishers — the standard (reference), the manufacturer
  // (product reference), the user (implementation) — and mapping is the
  // only relation between them. C81: a product reference package's
  // declaration resolves (manufacturer, product designation, and the
  // standards-reference packages it maps to — its map profiles and its
  // maps_to manifest register must agree, and every maps_to target must
  // resolve). C82: an unmapped IS promise is a brochure claim — flagged
  // at authoring (a warning; the mapping is the conformance claim made
  // computable). C83: abstract imports pin a version — no unpinned
  // reference consumption, and the pin resolves against the product
  // package's edition register.
  const productManifest = standard.packageManifest;
  if (productManifest?.kind === 'product_reference') {
    if (!productManifest.manufacturer) {
      err(
        'C81',
        `package "${productManifest.id}": a product reference package declares its manufacturer — the model speaks for them (product-maps-resolves)`,
      );
    }
    if (!productManifest.product) {
      err(
        'C81',
        `package "${productManifest.id}": a product reference package declares its product designation (product-maps-resolves)`,
      );
    }
    const mapsTo = productManifest.mapsTo ?? [];
    if (mapsTo.length === 0) {
      err(
        'C81',
        `package "${productManifest.id}": a product reference package declares the standards-reference packages it maps to (maps_to) — an unmapped product model is a brochure (product-maps-resolves)`,
      );
    }
    for (const target of mapsTo) {
      const dm = resolveDepManifest(target);
      if (!dm) {
        err(
          'C81',
          `package "${productManifest.id}": maps_to "${target}" does not resolve to a known package — the standards reference a product maps to must resolve (product-maps-resolves)`,
        );
      } else if (dm.kind === 'product_reference') {
        err(
          'C81',
          `package "${productManifest.id}": maps_to "${target}" is itself a product reference package — a product maps to the standard, never to another product (product-maps-resolves)`,
        );
      }
      if (!mappedNamespaces.has(target)) {
        err(
          'C81',
          `package "${productManifest.id}": maps_to "${target}" names a standards reference the model never maps to — declare the map_profile/.prm mapSet or drop the entry (product-maps-resolves)`,
        );
      }
    }
    for (const ns of mappedNamespaces) {
      if (!mapsTo.includes(ns)) {
        err(
          'C81',
          `map_profile ${ns}: the model maps to a standards reference it does not declare in its manifest maps_to register (product-maps-resolves)`,
        );
      }
    }

    // C82 — every block-form IS promise is a mapping SOURCE (statement-
    // only shorthand entries are prose, not mappable claims).
    const mappedSources = new Set<string>();
    for (const mp of allProfiles) {
      for (const source of Object.keys(mp.mappings)) {
        mappedSources.add(source);
      }
    }
    for (const s of standard.subjects ?? []) {
      for (const p of s.is?.promises ?? []) {
        if (!p.id) {
          continue;
        }
        if (!mappedSources.has(p.id)) {
          warn(
            'C82',
            `subject ${s.id}: promise "${p.id}" is not mapped to any standard — an unmapped promise is a brochure claim; the mapping is the conformance claim made computable (product-unmapped-promises)`,
          );
        }
      }
    }
  }

  // C83 — abstract-import-pinned: a uses/extends edge to a product
  // reference package carries a version pin (uses { <id>@<edition> }),
  // and the pin resolves against the product package's edition register
  // (the C80 register discipline applied to the import edge).
  if (productManifest) {
    for (const dep of effectiveUses(productManifest)) {
      const dm = resolveDepManifest(dep);
      if (dm?.kind !== 'product_reference') {
        continue;
      }
      const pin = productManifest.usePins?.[dep];
      if (!pin) {
        err(
          'C83',
          `package "${productManifest.id}" imports product reference package "${dep}" without a version pin — abstract imports pin a version (uses { ${dep}@<edition> }); no unpinned reference consumption (abstract-import-pinned)`,
        );
        continue;
      }
      const register = new Set([
        ...(dm.editions ?? []),
        ...(dm.version ? [dm.version] : []),
      ]);
      if (register.size > 0 && !register.has(pin)) {
        err(
          'C83',
          `package "${productManifest.id}" pins "${dep}" at "${pin}", which does not resolve against the product package's edition register { ${[...register].join(' ')} } — the pin names a declared edition (abstract-import-pinned)`,
        );
      }
    }
  }
}

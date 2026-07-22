// ─────────────────────────────────────────────────────────────────────
// Delegation resolution (INV-10) — the language's attribute-resolution
// algorithm for the subject chain (TODO.roadmap/03, doctrine ch. 3.4).
//
// THE DELEGATION RESOLUTION SPEC
//
// Instances of the subject chain link upward: sample → model → (group →)
// family. Resolving an attribute for an instance walks that chain:
//
//   resolve(instance, attr):
//     if attr is sample-scoped:        return instance.test_context[attr]
//                                                            # never inherited
//     if attr has value on instance:   return instance.attributes[attr]
//     walk upward (model, then group, then family):
//       first level that sets attr wins
//     else:                            undefined → InstanceResolutionError
//                                      (closed under reference)
//
// Three laws:
//   1. UPWARD RESOLUTION — a value not set locally resolves to the nearest
//      enclosing level that sets it.
//   2. LOWER OVERRIDE — a value set at a lower level shadows the inherited
//      one (deliberate, visible in the data; the linter's instance-scope
//      rule allows stating a value at its declared scope or lower).
//   3. NEVER COPIED DOWN — values live at one level only; resolution READS
//      through the chain, it never materializes inherited values onto
//      lower levels.
//
// Scope discipline (declared on each attribute_definition):
//   - sample-scope (test-dependent) values live ONLY in the starting
//     instance's has.testContext and are NEVER inherited — resolution
//     never consults another level for them, and never consults
//     test_context for other scopes;
//   - classification values (has.dimensions) resolve upward the same way,
//     but samples carry no classification — the walk skips sample nodes.
//
// The path vocabulary mirrors the app's bind paths:
//   parameters.<attr>    test_context.<attr>    classification.<dim>
// with an optional level prefix (model.parameters.e_max). The prefix is
// VALIDATED (it must name a chain level) and then IGNORED: the answer is
// always delegated from the anchor instance upward. That equals a
// level-anchored read only when no lower override exists — anchored at
// the sample, `family.parameters.p_lc` still returns the model's
// overriding value when the model restates p_lc (lower-override law),
// not the family's own. Level-anchored reads (the app's
// `model.parameters.*` bind form, "the model level's effective value")
// are a separate vocabulary consumed by the app, not by this resolver.
//
// Undefined is NEVER returned silently: an unresolvable path throws an
// InstanceResolutionError (kind 'undefined-value').
// ─────────────────────────────────────────────────────────────────────

import type Standard from './types/Standard';
import type { Instance, InstanceValue } from './types/Instance';

export type ResolutionErrorKind =
  'unknown-instance' | 'bad-path' | 'undefined-value' | 'chain-cycle';

/** Typed resolution failure — resolution is closed under reference, so an
 *  unresolvable value is an error, never a silent `undefined`. */
export class InstanceResolutionError extends Error {
  readonly kind: ResolutionErrorKind;

  constructor(kind: ResolutionErrorKind, message: string) {
    super(message);
    this.name = 'InstanceResolutionError';
    this.kind = kind;
  }
}

export type InstanceArea = 'parameters' | 'classification' | 'test_context';

export interface InstancePath {
  /**
   * Optional level prefix (vocabulary compatibility only): validated
   * against the chain levels by parseInstancePath, then IGNORED — the
   * answer is delegated from the anchor instance, never re-anchored to
   * the named level (see the module header).
   */
  level: string;
  area: InstanceArea;
  key: string;
}

const CHAIN_LEVELS = new Set(['family', 'group', 'model', 'sample']);
const AREAS = new Set<string>(['parameters', 'classification', 'test_context']);

/**
 * Parse `parameters.<attr>` / `<level>.parameters.<attr>` path forms. The
 * level prefix is validated (it must name a chain level) and returned for
 * information only — resolution IGNORES it: the answer is delegated from
 * the anchor instance upward (module header), which may differ from a
 * level-anchored read when a lower override exists. The app's
 * level-anchored `model.parameters.*` bind form is a separate vocabulary
 * consumed by the app, not by this resolver.
 */
export function parseInstancePath(path: string): InstancePath {
  const parts = path.split('.');
  let level = '';
  if (parts.length === 3) {
    level = parts[0];
    if (!CHAIN_LEVELS.has(level)) {
      throw new InstanceResolutionError(
        'bad-path',
        `resolve: path "${path}" — unknown level "${level}" (family | group | model | sample)`,
      );
    }
    parts.shift();
  }
  if (parts.length !== 2 || !AREAS.has(parts[0]) || !parts[1]) {
    throw new InstanceResolutionError(
      'bad-path',
      `resolve: path "${path}" — expected [level.]{parameters|classification|test_context}.<key>`,
    );
  }
  return { level, area: parts[0] as InstanceArea, key: parts[1] };
}

function findInstance(standard: Standard, id: string): Instance | undefined {
  return (standard.instances ?? []).find(i => i.id === id);
}

function attributeScope(standard: Standard, attrId: string): string {
  return (
    (standard.attributeDefinitions ?? []).find(a => a.id === attrId)?.scope ??
    ''
  );
}

/**
 * The upward walk from one instance: [start, …, family]. At each node the
 * next link is `model ?? group ?? family` (a sample links only its model;
 * a model links its group, or its family when the Recommendation has no
 * group level). A dangling link ENDS the walk leniently (the linter's
 * chain-acyclic rule reports it; app-side resolution behaves the same when
 * a chain entity is absent). A cycle throws — the linter reports it
 * statically, but the resolver never loops.
 */
export function instanceChain(
  standard: Standard,
  instanceId: string,
): Instance[] {
  const start = findInstance(standard, instanceId);
  if (!start) {
    throw new InstanceResolutionError(
      'unknown-instance',
      `resolve: unknown instance "${instanceId}"`,
    );
  }
  const chain: Instance[] = [start];
  const visited = new Set([start.id]);
  let current = start;
  for (;;) {
    const nextId = current.model || current.group || current.family;
    if (!nextId) {
      return chain;
    }
    if (visited.has(nextId)) {
      throw new InstanceResolutionError(
        'chain-cycle',
        `resolve: subject chain cycle ${[...chain.map(i => i.id), nextId].join(' → ')}`,
      );
    }
    const next = findInstance(standard, nextId);
    if (!next) {
      return chain;
    }
    visited.add(nextId);
    chain.push(next);
    current = next;
  }
}

function undefinedValue(instanceId: string, path: string, why: string): never {
  throw new InstanceResolutionError(
    'undefined-value',
    `resolve: "${path}" is undefined for instance "${instanceId}" — ${why}`,
  );
}

/**
 * Resolve one value for an instance per the delegation spec above.
 * Parameters and test_context resolve to InstanceValue (QuantityValue:
 * value + optional unit); classification resolves to the dimension value
 * id (a string). A level prefix on the path is validated then ignored:
 * the answer is delegated from `instanceId` (the anchor) upward, so it
 * reflects any lower override between the anchor and the named level.
 */
export function resolveInstanceValue(
  standard: Standard,
  instanceId: string,
  path: string,
): InstanceValue | string {
  const { area, key } = parseInstancePath(path);
  const chain = instanceChain(standard, instanceId);
  const start = chain[0];

  if (area === 'test_context') {
    // The test plane: only the starting instance's own test_context,
    // regardless of scope — never inherited.
    const v = start.has.testContext[key];
    if (v === undefined) {
      undefinedValue(instanceId, path, 'test_context is never inherited');
    }
    return v;
  }

  if (area === 'parameters') {
    if (attributeScope(standard, key) === 'sample') {
      // Sample-scope: only the starting instance's test_context. The walk
      // NEVER consults an enclosing level for a test-dependent value.
      const v = start.has.testContext[key];
      if (v === undefined) {
        undefinedValue(
          instanceId,
          path,
          `attribute "${key}" is sample-scoped — its value lives only in the sample's test_context (never inherited)`,
        );
      }
      return v;
    }
    for (const node of chain) {
      const v = node.has.attributes[key];
      if (v !== undefined) {
        return v;
      }
    }
    undefinedValue(instanceId, path, 'no level of the subject chain sets it');
  }

  // classification — upward over dimensions; samples carry no classification.
  for (const node of chain) {
    if (node.level === 'sample') {
      continue;
    }
    const v = node.has.dimensions[key];
    if (v !== undefined) {
      return v;
    }
  }
  undefinedValue(instanceId, path, 'no level of the subject chain sets it');
}

/**
 * The full effective attribute layer for one instance — every resolvable
 * parameter value, lower levels overriding (family first, the starting
 * instance last). Sample-scope attributes are included ONLY from the
 * starting instance's test_context (never inherited); the test_context
 * overlay applies last (it is the plane tests write into) and is
 * scope-consistent with the single-value rule: test_context answers ONLY
 * sample-scope attributes, so a non-sample-scope key stated there (out of
 * discipline — C17 reports it) does NOT shadow the delegated chain value
 * the single-value resolver would return. This is the primmel-side
 * counterpart of the app's INV-10 delegation merge
 * (browser/src/services/test-run.service.ts resolveAttributeValues).
 */
export function resolveInstanceAttributes(
  standard: Standard,
  instanceId: string,
): Map<string, InstanceValue> {
  const chain = instanceChain(standard, instanceId);
  const out = new Map<string, InstanceValue>();
  for (const node of [...chain].reverse()) {
    for (const [k, v] of Object.entries(node.has.attributes)) {
      if (attributeScope(standard, k) === 'sample') {
        continue; // never inherited
      }
      out.set(k, v);
    }
  }
  for (const [k, v] of Object.entries(chain[0].has.testContext)) {
    if (attributeScope(standard, k) !== 'sample') {
      continue; // test_context answers only sample-scope attributes
    }
    out.set(k, v);
  }
  return out;
}

/** The full effective classification layer (family → group → model merge;
 *  samples carry none). */
export function resolveInstanceClassification(
  standard: Standard,
  instanceId: string,
): Map<string, string> {
  const chain = instanceChain(standard, instanceId);
  const out = new Map<string, string>();
  for (const node of [...chain].reverse()) {
    if (node.level === 'sample') {
      continue;
    }
    for (const [k, v] of Object.entries(node.has.dimensions)) {
      out.set(k, v);
    }
  }
  return out;
}

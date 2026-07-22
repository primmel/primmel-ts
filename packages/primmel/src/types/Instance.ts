/**
 * Instantiation (Primmel v3, TODO.roadmap/03): the `instance` construct —
 * the instance plane of the definition/instance duality (doctrine ch. 3).
 *
 * A subject DEFINITION (subject/instrument constructs) says what kinds of
 * things exist; an `instance` says THIS one exists — the canonical case is
 * a Sample instance of a Model subject. Instances of the subject chain
 * (family → group → model → sample) link upward (`model`/`group`/`family`
 * carry the next enclosing instance id), and attribute values resolve by
 * delegation along that chain (INV-10: upward resolution, lower override,
 * never copied down — see src/instance-resolution.ts).
 *
 * Scope discipline: every attribute_definition declares the chain level at
 * which its value is stated (`scope` family | group | model | sample).
 * Instance values are checked against it by the linter (C17 instance-scope):
 * a value may be stated at its declared scope or LOWER (a visible override),
 * never higher; sample-scope (test-dependent) values live ONLY in
 * has.testContext of a sample-level instance and are never inherited.
 * Classification (dimension) values live in has.dimensions on the
 * family/group/model levels — samples carry no classification.
 *
 * INV-8: every instance is version-pinned to its definitions via
 * `definitionVersions` (definition id → version string); the linter (C18)
 * rejects unpinned instances.
 *
 * Grammar sketch:
 *   instance smp-hbk-hlci-001 of LoadCellSample {
 *     level sample
 *     model mod-hbk-hlci-2-2t-c3
 *     definition_versions { LoadCellSample : "2021" attributes : "1.0.0" }
 *     has {
 *       attributes { serial_note : "calibration sticker present" }
 *       dimensions { }                       // samples: none
 *       test_context { d_min : 0 kg d_max : 2.2 t v : 0.037 kg n : 6000 }
 *     }
 *   }
 */

import type { QuantityValue } from './Quantity';

/** The four subject-chain levels, from outermost to innermost. */
export type ChainLevel = 'family' | 'group' | 'model' | 'sample';

/**
 * One exhibited attribute value on an instance — the QuantityValue shape
 * (TODO.roadmap/06): `value` + optional `unit`, `quantityKind`,
 * `uncertainty` (measured side), `tolerance` (specified side). INV-1: a
 * value for a declared physical quantity is never a bare number — it
 * carries a unit (linter C32). `value` holds a number when the source
 * token was an unquoted numeric literal, otherwise the string as written
 * (quote a numeric string to keep it a string, e.g.
 * software_identification : "2.1").
 *
 * Growth note: `{value, unit?}` (task 03) widened to the full
 * QuantityValue contract (task 06) — the two new facets are optional, so
 * existing values type-check unchanged.
 */
export type InstanceValue = QuantityValue;

/** has { … } — the instance's own exhibited values (never merged downward). */
export interface InstanceHas {
  /**
   * Own attribute values (the parameters plane): attribute id → value.
   * Holds values stated at this instance's level — including deliberate
   * lower-level overrides of values declared at a wider scope.
   *
   * NOTE (sample-level override gap): the language permits a
   * non-sample-scope attribute in a SAMPLE's has.attributes (the
   * lower-override law), but the current app plane has no sample
   * `parameters` field (only `test_context`) — recs SHOULD NOT author
   * such values until the app plane grows one (tracked by TODO.roadmap
   * task 29); a future strict mode may make this an error.
   */
  attributes: Record<string, InstanceValue>;
  /** Classification membership: dimension id → value id (not on samples). */
  dimensions: Record<string, string>;
  /**
   * Sample-scope (test-dependent) attribute values — the plane tests write
   * into. Legal only on sample-level instances; never inherited (values
   * here are never consulted when resolving from another instance).
   */
  testContext: Record<string, InstanceValue>;
}

/** instance <id> — one instance of a subject definition. */
export interface Instance {
  id: string;
  /**
   * The definition this is an instance of — a subject (v3) or instrument
   * (v2) id. Resolution is checked by the linter (C20 instance-of-resolves).
   */
  of: string;
  /**
   * The instance's subject-chain level (family | group | model | sample),
   * raw as written — the linter (C17) validates the enum and the scope
   * discipline of every value against it.
   */
  level: string;
  /** Upward chain links (instance ids): sample → model. */
  model: string;
  /** Upward chain links: model → group (optional level). */
  group: string;
  /** Upward chain links: model|group → family. */
  family: string;
  /** INV-8 pins: definition id → version string (linter C18 requires ≥1). */
  definitionVersions: Record<string, string>;
  has: InstanceHas;
  referenceIds: string[];
}

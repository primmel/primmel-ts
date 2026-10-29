// ─────────────────────────────────────────────────────────────────────
// The LML-aligned constructs (TODO.lang-gaps 03 04 09 11 13; the spec's
// clauses 9.6, 10.2, 10.15, 11.2, 16.6): the data-modelling substrate
// Primmel inherits from LML, declared in the package surface.
// ─────────────────────────────────────────────────────────────────────

import type { SourceRef } from './Subject';

/** The declared wire form of one class, per format (LML RS 3001
 *  §Serialization). The materialized id is `<format>:<Class>`. */
export interface WireMapping {
  id: string;
  format: 'xml' | 'yaml' | 'json' | 'toml' | 'csv';
  /** The class the mapping binds. */
  target: string;
  /** The xml surface. */
  element: string;
  namespaceRef: string;
  /** map_content: the attribute serialized as the element's content. */
  content: string;
  mixed: boolean;
  renderNil: boolean | null;
  /** The key-value surface: map / map_element / map_attribute entries. */
  entries: WireMapEntry[];
  source: SourceRef | null;
}

export interface WireMapEntry {
  kind: 'element' | 'attribute' | 'content' | 'map';
  /** The wire name (the serialized key). */
  wire: string;
  /** The model attribute. */
  name: string;
  /** map_key to_instance / map_value as_attribute modifiers. */
  modifier: string;
}

/** The grammar-backed string form of a class (LML RS 3010 §String
 *  formats) — a thin reference; the artifact owns the captures. */
export interface StringFormat {
  /** The registered format name (the `:name` sigil). */
  id: string;
  artifact: string;
  root: string;
  source: SourceRef | null;
}

/** A named uri + prefix pair (LML RS 3001 §Namespacing). */
export interface NamespaceDecl {
  id: string;
  uri: string;
  prefix: string;
  isDefault: boolean;
  source: SourceRef | null;
}

/** The unified named, typed, unit-ed value (TODO.lang-gaps 04). The
 *  unit and quantity kind reference the authoritative registries
 *  (`si:`, `unitsdb:` — C167); render hints name their notation. */
export interface Datum {
  id: string;
  type: string;
  unit: string;
  quantityKind: string;
  origin: 'declared' | 'design-fixed' | 'observed' | 'computed';
  scope: string;
  renders: DatumRender[];
  label: string;
  description: string;
  source: SourceRef | null;
}

export interface DatumRender {
  notation: 'asciimath' | 'latex' | 'unicodemath' | 'mathml' | 'omml';
  text: string;
}

/** The consolidated boolean verdict (TODO.lang-gaps 03): expression +
 *  operator + threshold, named inputs — signature coverage is C160. */
export interface Check {
  id: string;
  inputs: string[];
  expression: string;
  operator: string;
  /** The threshold expression or bound symbol name. */
  threshold: string;
  source: SourceRef | null;
  /**
   * The quarantined prose (TODO.lang-gaps/02, the block form only): the
   * retired spellings' criteria prose lands here when an author migrates
   * a pass_fail onto the canonical check. Free text only — a citation
   * belongs in a urn reference, never in the description body.
   */
  description?: string;
  /**
   * The fold provenance (spec §16 C161, TODO.lang-gaps/03): set when
   * this check materialized from a retired boolean spelling at parse —
   * `owner` is `<kind>:<id>` of the construct carrying the spelling,
   * `facet` the slot the verdict folded from (`pass_fail`, `limit:2`,
   * `acceptance_criteria:criterion-id`, …). A folded check is the
   * parse-side view of its owner: the serializer emits the canonical
   * form only, so the fold never serializes (dump skips it) and C160
   * judges the owner's spelling, not the view. (The validate_measurement
   * facet's fold retired with its spelling's parse refusal — wave 03
   * PR 3.)
   */
  folds?: { owner: string; facet: string };
}

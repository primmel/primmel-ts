import Resolvable from './Resolvable';

// ─────────────────────────────────────────────────────────────────────
// Map profile (TODO.roadmap/04) — the mapping primitive: the ONLY
// compliance relation between an implementation model and a reference
// model (concept doc §5.2). A mapping A ⇒ B reads "fulfilling A fulfils
// B" — implication, never equivalence, never refinement.
//
// v3 extensions over v2 (backwards compatible):
//   - one source may map to SEVERAL targets in the same namespace
//     (mappings values are lists, not single targets);
//   - each pair may carry `description` (how the fulfilment works),
//     `justification` (why the claim holds — demanded by auditors), and
//     an authored `coverage` ASSERTION that the linter (C23) checks
//     against the computed coverage calculus.
// ─────────────────────────────────────────────────────────────────────

/** The four coverage levels of the coverage calculus (concept doc §5.3). */
export type CoverageLevel = 'full' | 'minimal' | 'partial' | 'none';

/** One mapping pair: source component ⇒ target component. */
export interface MappingPair {
  /**
   * Target element as authored — the `Namespace#ElementID` aliasing form
   * (e.g. `StdS#Process5`) or a bare id scoped by the profile's namespace
   * (the v2 spelling). Both normalize against the profile namespace.
   */
  target: string;
  /** How the fulfilment works (warning at audit strictness when missing). */
  description: string;
  /** Why the claim holds (optional per pair, demanded by auditors). */
  justification: string;
  /**
   * Authored coverage assertion for the TARGET component ('' = none).
   * Coverage is COMPUTED, not authored — an assertion that disagrees
   * with the calculus is a lint error (C23).
   */
  coverage: CoverageLevel | '';
}

interface MapProfile {
  /** The TARGET (reference model) namespace this profile maps into. */
  namespace: string;
  description: string;
  /**
   * source component id (local to the owning model) → the pairs it maps
   * to. One source may fulfil several reference components at once —
   * "write once, comply twice" (concept doc §5.6 c).
   */
  mappings: Record<string, MappingPair[]>;
  /**
   * Authored coverage ASSERTIONS about reference components (bare or
   * `Namespace#ElementID`-qualified ids) — e.g. pinning "Process1 is
   * partially covered" as a regression tripwire. Coverage is COMPUTED,
   * not authored: the linter (C23) flags every assertion that disagrees
   * with the calculus.
   */
  coverage: Record<string, CoverageLevel>;
}

export default MapProfile;

// Map profiles have no external relations to resolve
export type ResolvableMapProfile = Resolvable<MapProfile, never>;

/**
 * The `formulas_used` construct (smart gap-close E11,
 * analysis/architecture-gaps-2026-07.md; the smart contract
 * data/schemas/formulas-used.yaml + data/r60/specification/
 * formulas-used.yaml): the per-test evaluation-formula trace of a
 * Recommendation — the first-class replacement for the hand-authored
 * supplemental YAML the R 60 MDLO trace rides today:
 *
 *   formulas_used /conf/metrological-tests/measurement-error-repeatability-mdlo {
 *     name "MDLO evaluation formulas"
 *     description "The evaluation-level quantities of R 60-3, 2.1 the MDLO test derives from the indication output: …"
 *     formulas { conversion_factor_f e_l e_r c_m }
 *     source { doc "urn:oiml:pub:r:60-3:2021" clause "2.1" }
 *   }
 *
 * The design (DECIDED — the 9.5-era file header contemplated a facet):
 * a top-level registry block keyed by the conformance-test reference,
 * NOT a facet on conformance_test — the YAML projection stays trivially
 * byte-identical, the conformance_test grammar is untouched (OCP), and
 * the shape mirrors the invariant/test_sequence pattern exactly. The
 * block symbol IS the test reference — a bare reference-shaped id, the
 * `text /req/….statement` construct's idiom (the ref alphabet `/`,
 * letters, `-` is bare-token-safe; a quoted spelling round-trips as its
 * own id, so authors pick one spelling).
 *
 * The facets (the smart side's formulas-used.yaml contract — the
 * projection the kernel model feeds):
 *   - name — the short trace name, MANDATORY (C94).
 *   - description — what the listed formulas compute, with the clause
 *     evidence, MANDATORY (C94). The default spelling's value is
 *     authored inline; alternates ride the ISO 24229
 *     `text <test-ref>.description { spell <code> "…" }` blocks
 *     (TODO.roadmap/25 — the same machinery every prose field uses).
 *   - formulas — the registry formula ids the test's evaluation
 *     invokes, MANDATORY non-empty (C94): the registries' QUANTITY
 *     names (calculation output names — conversion_factor_f, e_l, e_r,
 *     c_m; the same ids the test declares as its variables).
 *     Well-formedness is the snake_case identifier shape (C94);
 *     RESOLUTION (does e_l exist in the calculations ∪ formulas
 *     registries) is the smart-side linker rule R41's crosswalk —
 *     the kernel checks syntax/shape only, exactly like E9's C90/C91
 *     vs R38 and E10's C92/C93 vs R39 split.
 *   - source — clause-URN provenance, the platform's content doctrine:
 *     repeated `source { doc "urn:…" clause "…" }` blocks collecting
 *     into sourceRefs (the requirement family's idiom). The trace is
 *     keyed by test, so entry uniqueness is the parse-time
 *     duplicate-id rule's — the collection key IS the test ref.
 *
 * Linter rules (check.ts, family base):
 *   C94 formulas-used-shape.
 */

import type { SourceRef } from './Subject';

/**
 * The formula-identifier shape (C94): the snake_case identifier the
 * calculations registry uses for output names (conversion_factor_f,
 * e_l, e_r, c_m) — lowercase, digits and underscores after a leading
 * letter. Shape only; an identifier that parses here may still dangle
 * (resolution is the smart-side linker rule R41's job, never the
 * kernel's).
 */
export const FORMULA_ID_SHAPE = /^[a-z][a-z0-9_]*$/;

/**
 * formulas_used <test-ref> — one per-test evaluation-formula trace
 * (smart gap-close E11). Top-level construct, a sibling collection of
 * `testSequences`: declared once per conformance test, composed through
 * `uses` like every doctrine collection (MERGE_FIELDS).
 */
export interface FormulasUsed {
  /**
   * The conformance test whose evaluation invokes the formulas — the
   * absolute test reference (e.g.
   * /conf/metrological-tests/measurement-error-repeatability-mdlo).
   * The block symbol itself; the trace is keyed by it (uniqueness is
   * the parse-time duplicate-id rule's). Test-ref RESOLUTION (does the
   * ref name a declared conformance test) is the smart-side linker R41.
   */
  id: string;
  /** The short trace name ('' = undeclared — C94). */
  name: string;
  /**
   * What the listed formulas compute, with the clause evidence ('' =
   * undeclared — C94). The package-default spelling's value inline;
   * alternates ride the ISO 24229 `text <id>.description` blocks.
   */
  description: string;
  /**
   * The registry formula ids the test's evaluation invokes, in declared
   * order ([] = undeclared — C94). Well-formedness is FORMULA_ID_SHAPE
   * (C94); resolution is the smart-side linker R41's.
   */
  formulas: string[];
  /** Clause-URN provenance (the requirement family's repeated source blocks). */
  sourceRefs: SourceRef[];
  /** The unified typed references (docs/primmel/18). */
  refs?: import('./Ref').Ref[];
}

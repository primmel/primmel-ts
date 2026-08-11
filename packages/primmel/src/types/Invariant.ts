/**
 * The `invariant` construct (smart gap-close E9,
 * analysis/architecture-gaps-2026-07.md; the smart doctrine
 * docs/oiml-core/09-invariants.md): a named architecture invariant of
 * the platform — a rule the model, its linker, and its gates must
 * never break:
 *
 *   invariant INV-1 {
 *     name "No bare numbers"
 *     statement "every physical quantity is a QuantityValue (value + unit [+ uncertainty])."
 *     severity error
 *     applies_to { QuantityValue }
 *     source "docs/oiml-core/09-invariants.md#9.2"
 *     enforcement { kernel:C32 kernel:C33 linker:quantity-coherence gate:schema-quantity-value }
 *   }
 *
 *   invariant INV-99 {
 *     name "…"
 *     statement "…"
 *     severity notice
 *     enforcement aspirational
 *   }
 *
 * Today these ride the generic `note` family with pipe-delimited
 * structure inside the message string; the construct makes them
 * first-class. The facets (the smart side's invariants.yaml contract —
 * the projection the kernel model feeds):
 *   - name — the short rule name, MANDATORY (C90).
 *   - statement — the rule's prose, MANDATORY (C90). The default
 *     spelling's value is authored inline; alternates ride the ISO
 *     24229 `text INV-1.statement { spell <code> "…" }` blocks
 *     (TODO.roadmap/25 — the same machinery every prose field uses).
 *   - severity — free vocabulary, MANDATORY non-empty (C90). The smart
 *     side owns the severity semantics; the kernel judges presence
 *     only, never the vocabulary.
 *   - applies_to — the construct/entity names the invariant constrains,
 *     OPTIONAL (empty/absent allowed).
 *   - source — provenance (doc path + anchor), OPTIONAL.
 *   - enforcement — EITHER a non-empty claim list OR the literal marker
 *     `aspirational`; never empty, never both (C90). A claim's grammar
 *     is `kernel:C<n>` | `linker:<kebab-name>` | `gate:<kebab-name>`
 *     (C91 — syntax only; claim TARGET resolution is the smart-side
 *     linker rule R38's crosswalk, never the kernel's).
 *
 * Linter rules (check.ts, family base):
 *   C90 invariant-shape, C91 invariant-enforcement-grammar.
 */

/**
 * How an invariant is enforced: a non-empty claim list XOR the literal
 * `aspirational` marker (declared, not yet machine-enforced). C90 owns
 * the XOR; C91 owns the claim grammar.
 */
export interface InvariantEnforcement {
  /** true = the bare `enforcement aspirational` marker. */
  aspirational: boolean;
  /** The enforcement claims — empty when aspirational (C90 judges both). */
  claims: string[];
}

/**
 * invariant <id> — a named architecture invariant (smart gap-close E9).
 * Top-level construct, a sibling collection of `notes` (the generic
 * family it replaces): declared once per invariant, composed through
 * `uses` like every doctrine collection (MERGE_FIELDS).
 */
export interface Invariant {
  id: string;
  /** The short rule name ('' = undeclared — C90). */
  name: string;
  /** The rule's prose in the package's default spelling ('' = undeclared
   *  — C90; alternates ride `text <id>.statement` blocks). */
  statement: string;
  /** The severity token — free vocabulary, the smart side owns the
   *  semantics ('' = undeclared — C90). */
  severity: string;
  /** The construct/entity names the invariant constrains (empty allowed). */
  appliesTo: string[];
  /** Provenance: doc path + anchor ('' = absent). */
  source: string;
  sourceRefs?: import('./Subject').SourceRef[];
  /** The enforcement claims XOR the aspirational marker (C90/C91). */
  enforcement: InvariantEnforcement;
}

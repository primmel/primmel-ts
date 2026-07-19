/**
 * Shared source_discrepancy block (data/schemas/rc.yaml
 * $defs/source_discrepancy, TODO.refactor/11).
 *
 * First-class annotation for a self-contradicting source: when two
 * clauses of the source disagree, the element declares the conflict
 * instead of silently picking a side. Attachable to requirements,
 * requirement limits, limit accepts blocks, conformance tests, form
 * fields, field evaluation rules, tables, table profiles, and notes.
 */

export default interface SourceDiscrepancy {
  /** One-line statement of the contradiction. */
  summary: string;
  /** Clause URNs of the conflicting sources. */
  sources: string[];
  /** follows_clause_x (model follows one cited clause) | annotated_only. */
  resolution: string;
  /** Why the model resolves the contradiction this way. */
  rationale: string;
}

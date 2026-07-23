import Resolvable from './Resolvable';
import type SourceDiscrepancy from './SourceDiscrepancy';
import type { SourceRef } from './Subject';

/** Typed column declaration (structured `columns { … }` form). */
export interface TableColumnDef {
  name: string;
  type: string;
  unit: string;
}

/** Structured profile (dimension → per-value binding) declaration. */
export interface TableProfileDef {
  name: string;
  description: string;
  dimension: string;
  unit: string;
  /** Binding kind (e.g. range, integer, tier). */
  type: string;
  sourceDiscrepancy: SourceDiscrepancy | null;
  /**
   * Dimension value → binding payload: bare scalar (number when numeric),
   * a { k: v } object, or an array of such objects.
   */
  binding: Record<string, unknown>;
}

/** Declared permission to accept fewer rows than the normative count. */
export interface TableOverride {
  condition: string;
  by: string;
}

interface Table {
  id: string;
  title: string;
  description: string;
  columns: string;
  /** Structured column declarations (supersedes the legacy string form). */
  columnDefs?: TableColumnDef[] | null;
  display: string;
  data: string[][];
  domain: Record<string, unknown> | null;
  /** Per-dimension value bindings, e.g. accuracy_class → tiers (v2 G6). */
  profiles?: Record<string, Record<string, unknown>>;
  /** Structured profile declarations (supersedes the legacy raw form). */
  profileDefs?: TableProfileDef[] | null;
  /** Count overrides per test context. */
  overrides?: Record<string, TableOverride> | null;
  sourceRef?: SourceRef | null;
  /** All structured provenance bindings when the table cites several
   * fragments (TODO.roadmap/24 — repeated `source {}` blocks; sourceRef is
   * the first entry, kept for back-compatibility). */
  sourceRefs?: SourceRef[];
  sourceDiscrepancy?: SourceDiscrepancy | null;
}

export default Table;

// Tables have no external relations to resolve
export type ResolvableTable = Resolvable<Table, never>;

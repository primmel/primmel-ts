import Resolvable from './Resolvable';

interface Table {
  id: string;
  title: string;
  columns: string;
  display: string;
  data: string[][];
  domain: Record<string, unknown> | null;
  /** Per-dimension value bindings, e.g. accuracy_class → tiers (v2 G6). */
  profiles?: Record<string, Record<string, unknown>>;
}

export default Table;

// Tables have no external relations to resolve
export type ResolvableTable = Resolvable<Table, never>;

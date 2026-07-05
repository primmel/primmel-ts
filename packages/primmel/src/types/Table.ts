import Resolvable from './Resolvable';

interface Table {
  id: string;
  title: string;
  columns: string;
  display: string;
  data: string[][];
  domain: Record<string, unknown> | null;
}

export default Table;

// Tables have no external relations to resolve
export type ResolvableTable = Resolvable<Table, never>;

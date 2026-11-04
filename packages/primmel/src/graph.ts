// The cycle finder shared by the checker core and the family modules
// (the verdict-chain / mapping / instantiation acyclicity legs).

export function findCycle(adj: Map<string, string[]>): string[] | null {
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  const stack: string[] = [];
  let cycle: string[] | null = null;
  const visit = (n: string): void => {
    if (cycle) {
      return;
    }
    color.set(n, GRAY);
    stack.push(n);
    for (const m of adj.get(n) ?? []) {
      if (cycle) {
        return;
      }
      const c = color.get(m) ?? 0;
      if (c === GRAY) {
        cycle = [...stack.slice(stack.indexOf(m)), m];
        return;
      }
      if (c !== BLACK) {
        visit(m);
      }
    }
    stack.pop();
    color.set(n, BLACK);
  };
  for (const n of adj.keys()) {
    if (cycle) {
      break;
    }
    if (!color.has(n)) {
      visit(n);
    }
  }
  return cycle;
}

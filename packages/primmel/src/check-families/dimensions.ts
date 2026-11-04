// ─────────────────────────────────────────────────────────────────────
// The dimensions family — checkDimensions moved wholesale from check.ts (the
// family-module decomposition). The compiler and the suite pin the
// move.
// ─────────────────────────────────────────────────────────────────────

import type { CheckIssue } from '../check';
import { findCycle } from '../graph';
import type Standard from '../types/Standard';
import type { ClassificationDimension } from '../types/Subject';

export function checkDimensions(standard: Standard): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const err = (message: string) =>
    issues.push({ check: 'C111', severity: 'error', message });
  const warn = (message: string) =>
    issues.push({ check: 'C111', severity: 'warning', message });

  const checkShape = (owner: string, d: ClassificationDimension) => {
    const seen = new Set<string>();
    for (const v of d.values) {
      if (seen.has(v.id)) {
        err(
          `${owner} dimension ${d.id}: duplicate value id "${v.id}" (dimension-shape)`,
        );
      }
      seen.add(v.id);
    }
    const valueIds = new Set(d.values.map(v => v.id));
    const adj = new Map<string, string[]>();
    for (const v of d.values) {
      for (const target of v.implies ?? []) {
        if (!valueIds.has(target)) {
          err(
            `${owner} dimension ${d.id}: value ${v.id} implies "${target}", which is not a value of this dimension — implies targets resolve inside their own dimension (dimension-shape)`,
          );
        }
      }
      adj.set(
        v.id,
        (v.implies ?? []).filter(t => valueIds.has(t)),
      );
    }
    const cycle = findCycle(adj);
    if (cycle) {
      err(
        `${owner} dimension ${d.id}: implies cycle ${cycle.join(' → ')} — the applicability engine walks the implication closure, so the graph must be acyclic (dimension-shape)`,
      );
    }
    if (d.valuesOf && d.values.length > 0) {
      err(
        `${owner} dimension ${d.id}: declares both values and values_of — a dimension carries one value domain (dimension-shape)`,
      );
    }
    if (d.valuesOf && d.valuesOf !== 'capabilities') {
      warn(
        `${owner} dimension ${d.id}: values_of "${d.valuesOf}" names a register the kernel does not document (the documented register is capabilities) — the value domain stays open (dimension-shape)`,
      );
    }
  };

  for (const inst of standard.instruments ?? []) {
    for (const d of inst.dimensions ?? []) {
      checkShape(`instrument ${inst.id}:`, d);
    }
  }
  for (const d of standard.dimensions ?? []) {
    checkShape('top-level', d);
  }

  // Namespace uniqueness. The inline-vs-attribute mirror is tolerated
  // (see the rule's doc comment); every other double declaration is an
  // error.
  const inlineHome = new Map<string, string>(); // dim id → instrument id
  for (const inst of standard.instruments ?? []) {
    for (const d of inst.dimensions ?? []) {
      const prior = inlineHome.get(d.id);
      if (prior !== undefined && prior !== inst.id) {
        err(
          `dimension ${d.id}: declared inline on both instrument ${prior} and instrument ${inst.id} — one dimension identifier once per applicability namespace (dimension-shape)`,
        );
      } else {
        inlineHome.set(d.id, inst.id);
      }
    }
  }
  const attrDims = new Set(
    (standard.attributeDefinitions ?? [])
      .filter(a => a.isDimension === true)
      .map(a => a.id),
  );
  for (const d of standard.dimensions ?? []) {
    if (inlineHome.has(d.id)) {
      err(
        `dimension ${d.id}: declared both top-level and inline on instrument ${inlineHome.get(d.id)} — one dimension identifier once per applicability namespace (dimension-shape)`,
      );
    }
    if (attrDims.has(d.id)) {
      err(
        `dimension ${d.id}: declared both top-level and as the is_dimension attribute definition of the same id — one dimension identifier once per applicability namespace (dimension-shape)`,
      );
    }
  }
  return issues;
}

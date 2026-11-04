// ─────────────────────────────────────────────────────────────────────
// The unitsdb-bindings family — checkUnitsDbBindings moved wholesale from check.ts (the
// family-module decomposition). The compiler and the suite pin the
// move.
// ─────────────────────────────────────────────────────────────────────

import type { CheckIssue } from '../check';
import type Standard from '../types/Standard';
import { UnitsDb } from '../unitsdb';

export function checkUnitsDbBindings(
  standard: Standard,
  db?: import('../unitsdb').UnitsDbData,
): CheckIssue[] {
  const issues: CheckIssue[] = [];
  if (!db) {
    return issues;
  }
  const unitsdb = new UnitsDb(db);
  for (const reg of standard.quantityRegisters ?? []) {
    for (const unit of reg.units ?? []) {
      const pin = unit.unitsdb;
      if (!pin || (!pin.nist && !pin.unitsml)) {
        continue;
      }
      for (const [kind, id] of [
        ['nist', pin.nist],
        ['unitsml', pin.unitsml],
      ] as const) {
        if (!id) {
          continue;
        }
        try {
          const structure = unitsdb.resolveUnit(id);
          if (structure.siBases.length === 0) {
            issues.push({
              check: 'C185',
              severity: 'error',
              message: `quantity_register ${reg.id}: unit ${unit.id} pins ${kind} "${id}", whose decomposition resolves to no SI base (unitsdb-binding-coherent)`,
            });
          }
        } catch (e) {
          issues.push({
            check: 'C185',
            severity: 'error',
            message: `quantity_register ${reg.id}: unit ${unit.id} pins ${kind} "${id}", which does not resolve in the supplied UnitsDB data — ${(e as Error).message.replace('[unitsdb] ', '')} (unitsdb-binding-coherent)`,
          });
        }
      }
    }
  }
  return issues;
}

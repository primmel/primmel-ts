// ─────────────────────────────────────────────────────────────────────
// primmel check — cross-layer linter (Primmel v2 plan, W8).
//
// First-class package checks beyond parse-time validation:
//   C1 attribute scope vs bind path scope (forms)
//   C2 reference targets resolve (req targets, test targets, form
//      conformance ids, capability req/test refs, behavior verified_by,
//      requirement binds_to/limit uses)
//   C3 classification dimension enums (dimension ids + values referenced
//      in applicability blocks and test subjects exist)
//   C4 store names unique (storable classes)
//   C5 every requirement is targeted by ≥1 test; every test targets ≥1 req
// Each check returns issues: { check, severity, message }.
// ─────────────────────────────────────────────────────────────────────

import { loadPackage } from './ser-des/package';
import type Standard from './types/Standard';

export interface CheckIssue {
  check: string;
  severity: 'error' | 'warning';
  message: string;
}

const BIND_SCOPES: Record<string, string> = {
  'family.parameters': 'family',
  'group.parameters': 'group',
  'model.parameters': 'model',
  'sample.test_context': 'sample',
};

/** Identity paths (not AttributeDefinitions — fields on the entity classes). */
const IDENTITY_PREFIXES = [
  'model.identity.',
  'model.model_designation',
  'model.hardware_revision',
  'family.family_designation',
  'manufacturer.',
  'sample.serial_number',
  'sample.sample_number',
  'sample.status',
  'sample.condition',
  'application.',
  'test_report.',
  'test_request.',
];

/** Enum-name aliases: a classification path may use the enum name while the
 *  attribute/dimension id differs (app resolves both spellings). */
const DIM_ALIASES: Record<string, string> = {
  humidity_class: 'humidity_symbol',
};

function isIdentityPath(path: string): boolean {
  return IDENTITY_PREFIXES.some(p => path.startsWith(p));
}

function attrId(standard: Standard, id: string): any {
  return (standard.attributeDefinitions ?? []).find((a: any) => a.id === id);
}

export function checkPackage(dir: string): CheckIssue[] {
  const standard = loadPackage(dir);
  const issues: CheckIssue[] = [];
  const err = (check: string, message: string) => issues.push({ check, severity: 'error', message });
  const warn = (check: string, message: string) => issues.push({ check, severity: 'warning', message });

  const reqIds = new Set((standard.requirements ?? []).map((r: any) => r.id));
  const testIds = new Set((standard.conformanceTests ?? []).map((t: any) => t.id));
  const attrIds = new Set((standard.attributeDefinitions ?? []).map((a: any) => a.id));
  const dimIds = new Map<string, Set<string>>();
  for (const inst of standard.instruments ?? []) {
    for (const d of inst.dimensions ?? []) {
      dimIds.set(d.id, new Set(d.values.map((v: any) => v.id)));
    }
  }

  // C1 — bind path scope vs attribute scope
  for (const form of standard.forms ?? []) {
    const checkField = (f: any) => {
      if (f.bind) {
        const parts = String(f.bind).split('.');
        const prefix = parts.slice(0, 2).join('.');
        const id = parts[2];
        const scope = BIND_SCOPES[prefix];
        if (isIdentityPath(String(f.bind))) {
          // identity binds are always valid
        } else if (scope) {
          if (!attrIds.has(id)) {
            err('C1', `form ${form.id}: bind "${f.bind}" — attribute "${id}" not defined`);
          } else {
            const a = attrId(standard, id);
            if (a.scope && a.scope !== scope) {
              err('C1', `form ${form.id}: bind "${f.bind}" — attribute scope "${a.scope}" ≠ path scope "${scope}"`);
            }
          }
        }
      }
      (f.fields ?? []).forEach(checkField);
    };
    (form.fields ?? []).forEach(checkField);
  }

  // C2 — reference targets resolve
  for (const t of standard.conformanceTests ?? []) {
    for (const target of t.targets ?? []) {
      if (!reqIds.has(target)) err('C2', `conformance test ${t.id}: target "${target}" is not a declared requirement`);
    }
    if (t.inheritsFrom && !testIds.has(t.inheritsFrom)) {
      err('C2', `conformance test ${t.id}: inherits_from "${t.inheritsFrom}" not found`);
    }
  }
  for (const form of standard.forms ?? []) {
    for (const pid of form.conformanceProcessIds ?? (form.conformanceProcessId ? [form.conformanceProcessId] : [])) {
      if (!testIds.has(pid)) err('C2', `form ${form.id}: conformance_process "${pid}" not found`);
    }
  }
  for (const c of standard.capabilities ?? []) {
    for (const r of c.satisfiesRequirements ?? []) {
      if (!reqIds.has(r)) err('C2', `capability ${c.id}: satisfies_requirements "${r}" not found`);
    }
    for (const t of c.verifiedByTests ?? []) {
      if (!testIds.has(t)) err('C2', `capability ${c.id}: verified_by_tests "${t}" not found`);
    }
  }
  for (const b of standard.behaviors ?? []) {
    for (const t of b.verifiedBy ?? []) {
      if (!testIds.has(t)) err('C2', `behavior ${b.id}: verified_by "${t}" not found`);
    }
  }
  for (const r of standard.requirements ?? []) {
    for (const p of r.bindsTo ?? []) {
      const parts = String(p).split('.');
      const id = parts[2];
      if (!id) continue;
      if (parts[1] === 'classification') {
        // classification paths reference DIMENSION ids (with enum-name aliases)
        const dim = DIM_ALIASES[id] ?? id;
        if (!dimIds.has(dim) && !attrIds.has(id) && !attrIds.has(dim)) {
          err('C2', `requirement ${r.id}: binds_to "${p}" — dimension "${id}" not declared`);
        }
        continue;
      }
      if (isIdentityPath(String(p))) continue;
      if (!attrIds.has(id)) {
        err('C2', `requirement ${r.id}: binds_to "${p}" — attribute "${id}" not defined`);
      }
    }
    for (const u of r.limit?.uses ?? []) {
      if (u.startsWith('observable:')) {
        // Observables live in the symbols registry, not the attribute layer.
        continue;
      }
      // `uses` may carry bare ids or full paths — compare the last segment.
      const leaf = u.split('.').pop() ?? u;
      if (!attrIds.has(leaf) && !attrIds.has(u) && !reqIds.has(u) && u !== 'load') {
        warn('C2', `requirement ${r.id}: limit.uses "${u}" is not a declared attribute`);
      }
    }
  }

  // C3 — dimension ids + values exist
  for (const t of standard.conformanceTests ?? []) {
    for (const [dim, value] of Object.entries(t.testSubject ?? {})) {
      if (!dimIds.has(dim)) {
        err('C3', `conformance test ${t.id}: test_subject dimension "${dim}" not declared`);
      } else if (!dimIds.get(dim)!.has(String(value))) {
        err('C3', `conformance test ${t.id}: test_subject ${dim}="${value}" not in the dimension's values`);
      }
    }
  }
  for (const rc of standard.requirementClasses ?? []) {
    void rc;
  }
  for (const r of standard.requirements ?? []) {
    for (const a of r.applicability ?? []) {
      if (!dimIds.has(a.dimension)) {
        err('C3', `requirement ${r.id}: applicability dimension "${a.dimension}" not declared`);
      } else {
        for (const v of a.values ?? []) {
          if (!dimIds.get(a.dimension)!.has(v)) {
            err('C3', `requirement ${r.id}: applicability ${a.dimension}="${v}" not in the dimension's values`);
          }
        }
      }
    }
  }

  // C4 — store names unique
  const stores = new Map<string, string>();
  for (const c of standard.dataclasses ?? []) {
    if (c.store) {
      if (stores.has(c.store)) {
        err('C4', `store "${c.store}" declared by both ${stores.get(c.store)} and ${c.id}`);
      }
      stores.set(c.store, c.id);
    }
  }

  // C5 — coverage: req ⇄ test linkage
  const covered = new Set<string>();
  for (const t of standard.conformanceTests ?? []) {
    for (const target of t.targets ?? []) covered.add(target);
  }
  for (const r of standard.requirements ?? []) {
    if (!covered.has(r.id)) warn('C5', `requirement ${r.id}: no conformance test targets it`);
  }
  for (const t of standard.conformanceTests ?? []) {
    if ((t.targets ?? []).length === 0) warn('C5', `conformance test ${t.id}: targets no requirement`);
  }

  return issues;
}

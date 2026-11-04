// ─────────────────────────────────────────────────────────────────────
// The typed-payloads family — checkTypedPayloads moved wholesale from check.ts (the
// family-module decomposition). The compiler and the suite pin the
// move.
// ─────────────────────────────────────────────────────────────────────

import type { CheckIssue } from '../check';
import type Standard from '../types/Standard';
import type { ClassificationDimension } from '../types/Subject';

export function checkTypedPayloads(standard: Standard): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const err = (check: string, message: string) =>
    issues.push({ check, severity: 'error', message });

  const classFields = new Map<string, Set<string>>();
  for (const c of standard.dataclasses ?? []) {
    classFields.set(c.id, new Set(c.attributes.map(a => a.id)));
  }
  // The power-type discipline reaches the typing bridge: an INSTANCE
  // is a class, and its shape is the fields of the class its `of`
  // chain terminates at (the prototype hop's mirror — an individual
  // typed by its definition's fields).
  const instanceShape = (id: string): Set<string> | undefined => {
    const inst = (standard.instances ?? []).find(i => i.id === id);
    if (!inst) {
      return undefined;
    }
    let cur = inst;
    const seen = new Set<string>([cur.id]);
    while (cur.of) {
      const next = (standard.instances ?? []).find(i => i.id === cur.of);
      if (!next || seen.has(next.id)) {
        break;
      }
      seen.add(next.id);
      cur = next;
    }
    return cur.of !== '' ? classFields.get(cur.of) : undefined;
  };
  const typedFields = (id: string): Set<string> | undefined =>
    classFields.get(id) ?? instanceShape(id);

  const checkDim = (owner: string, d: ClassificationDimension) => {
    if (!d.payloadClass) {
      return;
    }
    const fields = typedFields(d.payloadClass);
    if (!fields) {
      err(
        'C152',
        `${owner} dimension ${d.id}: payload_class "${d.payloadClass}" is not a declared class (payload-typed-by-class)`,
      );
      return;
    }
    for (const v of d.values) {
      const keys = Object.keys(v.payload ?? {});
      if (keys.length === 0) {
        err(
          'C152',
          `${owner} dimension ${d.id}: value ${v.id} carries no payload — a value of a payload_class dimension IS its definition (payload-typed-by-class)`,
        );
        continue;
      }
      for (const key of keys) {
        if (!fields.has(key)) {
          err(
            'C152',
            `${owner} dimension ${d.id}: value ${v.id} payload field "${key}" is not a field of class "${d.payloadClass}" (payload-typed-by-class)`,
          );
        }
      }
    }
  };

  for (const inst of standard.instruments ?? []) {
    for (const d of inst.dimensions ?? []) {
      checkDim(`instrument ${inst.id}`, d);
    }
  }
  for (const d of standard.dimensions ?? []) {
    checkDim('top-level', d);
  }

  for (const a of standard.attributeDefinitions ?? []) {
    if (a.classRef && !typedFields(a.classRef)) {
      err(
        'C152',
        `attribute_definition ${a.id}: class "${a.classRef}" is not a declared class (payload-typed-by-class)`,
      );
    }
  }
  return issues;
}

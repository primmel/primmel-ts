// ─────────────────────────────────────────────────────────────────────
// The three-way structural merge (CRITIQUE-3 REVIEW #10's backlog item,
// TODO.lang-gaps/21): base / ours / theirs over the id-keyed Standard
// plane. The prerequisites are the diff machinery's — elementIndex (the
// id-keyed elements), canonical() (the deterministic equality) — and
// the merge is their third consumer:
//
//   adds        theirs added an element ours does not carry → spliced;
//               both-added ids conflict unless canonically equal.
//   removes     theirs removed an element ours did not touch → removed;
//               theirs removed an element ours changed → CONFLICT
//               (modify/delete).
//   shared      theirs unchanged → kept-ours; ours unchanged →
//               took-theirs; both changed → the FIELD-level three-way:
//               a field only one side touched takes that side, a field
//               both touched differently conflicts.
//
// The output: the merged Standard (ours as the base object, the taken
// elements spliced in), the dispositions, and the conflicts. The merged
// result then runs the checker — the semantic collision plane (C96 and
// friends) is the checker's, never the merger's.
// ─────────────────────────────────────────────────────────────────────

import { canonical } from './model-diff';
import type Standard from './types/Standard';

export interface MergeConflict {
  /** `${field}:${id}` — the element the conflict sits on. */
  key: string;
  field: string;
  /** The field-level conflicts (empty for whole-element ones). */
  fields: { name: string; ours: string; theirs: string }[];
  /** The modify/delete or both-added conflict. */
  element: boolean;
}

export interface MergeDisposition {
  key: string;
  field: string;
  /** kept-ours | took-theirs | removed | added-theirs | merged-fields */
  outcome: string;
}

export interface MergeResult {
  standard: Standard;
  dispositions: MergeDisposition[];
  conflicts: MergeConflict[];
}

const idOf = (el: Record<string, unknown>): string =>
  String(el['id'] ?? el['entityName'] ?? '');

const byId = (items: unknown): Map<string, Record<string, unknown>> => {
  const out = new Map<string, Record<string, unknown>>();
  if (Array.isArray(items)) {
    for (const el of items) {
      if (el && typeof el === 'object') {
        out.set(
          idOf(el as Record<string, unknown>),
          el as Record<string, unknown>,
        );
      }
    }
  }
  return out;
};

const mergeFieldsOf = (standard: Standard): string[] =>
  Object.keys(standard as unknown as Record<string, unknown>).filter(field => {
    const items = (standard as unknown as Record<string, unknown[]>)[field];
    return (
      Array.isArray(items) &&
      items.some(
        el =>
          el && typeof el === 'object' && ('id' in el || 'entityName' in el),
      )
    );
  });

export function mergeStandards(
  base: Standard,
  ours: Standard,
  theirs: Standard,
): MergeResult {
  const merged: Standard = structuredClone(ours);
  const mergedAny = merged as unknown as Record<string, unknown[]>;
  const dispositions: MergeDisposition[] = [];
  const conflicts: MergeConflict[] = [];

  for (const field of mergeFieldsOf(ours)) {
    const items = mergedAny[field];
    if (!Array.isArray(items)) {
      continue;
    }
    const baseById = byId(
      (base as unknown as Record<string, unknown[]>)[field],
    );
    const theirsById = byId(
      (theirs as unknown as Record<string, unknown[]>)[field],
    );

    // ── adds: theirs added an element ours does not carry ──────────
    for (const [id, el] of theirsById) {
      const oursHas = items.some(
        x =>
          x &&
          typeof x === 'object' &&
          idOf(x as Record<string, unknown>) === id,
      );
      if (oursHas || baseById.has(id)) {
        continue;
      }
      items.push(structuredClone(el));
      dispositions.push({
        key: `${field}:${id}`,
        field,
        outcome: 'added-theirs',
      });
    }

    // ── removes: theirs removed, ours did not touch → remove ───────
    const removed: string[] = [];
    for (const [id, elBase] of baseById) {
      const oursEl = items.find(
        x =>
          x &&
          typeof x === 'object' &&
          idOf(x as Record<string, unknown>) === id,
      ) as Record<string, unknown> | undefined;
      const theirsEl = theirsById.get(id);
      if (theirsEl || !oursEl) {
        continue;
      }
      const oursChanged = canonical(oursEl) !== canonical(elBase);
      if (oursChanged) {
        conflicts.push({
          key: `${field}:${id}`,
          field,
          fields: [],
          element: true,
        });
      } else {
        removed.push(id);
        dispositions.push({ key: `${field}:${id}`, field, outcome: 'removed' });
      }
    }
    for (const id of removed) {
      const idx = items.findIndex(
        x =>
          x &&
          typeof x === 'object' &&
          idOf(x as Record<string, unknown>) === id,
      );
      if (idx >= 0) {
        items.splice(idx, 1);
      }
    }

    // ── shared elements: the field-level three-way ─────────────────
    for (const el of items) {
      if (!el || typeof el !== 'object') {
        continue;
      }
      const id = idOf(el as Record<string, unknown>);
      const elBase = baseById.get(id);
      const elTheirs = theirsById.get(id);
      if (!elBase || !elTheirs) {
        continue;
      }
      const oursChanged =
        canonical(el as Record<string, unknown>) !== canonical(elBase);
      const theirsChanged = canonical(elTheirs) !== canonical(elBase);
      if (!theirsChanged) {
        dispositions.push({
          key: `${field}:${id}`,
          field,
          outcome: 'kept-ours',
        });
        continue;
      }
      if (!oursChanged) {
        const idx = items.indexOf(el);
        items[idx] = structuredClone(elTheirs);
        dispositions.push({
          key: `${field}:${id}`,
          field,
          outcome: 'took-theirs',
        });
        continue;
      }
      // both changed: the field-level resolution
      const fieldConflicts: MergeConflict['fields'] = [];
      const names = new Set([
        ...Object.keys(el as Record<string, unknown>),
        ...Object.keys(elTheirs),
      ]);
      for (const name of names) {
        const o = canonical((el as Record<string, unknown>)[name]);
        const t = canonical(elTheirs[name]);
        const b = canonical(elBase[name]);
        if (o === t) {
          continue;
        }
        if (o === b) {
          (el as Record<string, unknown>)[name] = structuredClone(
            elTheirs[name],
          );
          dispositions.push({
            key: `${field}:${id}`,
            field,
            outcome: `took-theirs(${name})`,
          });
        } else if (t !== b) {
          fieldConflicts.push({
            name,
            ours: o.slice(0, 120),
            theirs: t.slice(0, 120),
          });
        }
        // t === b: ours' change stands
      }
      if (fieldConflicts.length > 0) {
        conflicts.push({
          key: `${field}:${id}`,
          field,
          fields: fieldConflicts,
          element: false,
        });
      } else {
        dispositions.push({
          key: `${field}:${id}`,
          field,
          outcome: 'merged-fields',
        });
      }
    }
  }

  return { standard: merged, dispositions, conflicts };
}

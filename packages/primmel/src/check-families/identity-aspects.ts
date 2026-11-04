// ─────────────────────────────────────────────────────────────────────
// The identity-aspects family (C130, smart TODO.roadmap/40 batch 3,
// the packages-as-SSOT epic): the documentary identity slots + the
// qualitative aspect register (smart TODO.roadmap/47). Legs: the slot
// shape leg (at least one presentation channel — the slot's content is
// presented somewhere); the aspect references — term_ref → the term
// register, component → an instrument component, attribute → an
// attribute_definition (a reference, never a redeclaration — INV-3),
// and the contains entries → EITHER a model.identity.<slot> path into
// the slot register OR a bare attribute/dimension id (the two
// namespaces coexist; each leg checked only when its target register
// composes — per-register gating, the C58 doctrine); and the R28
// bind-path consumer leg — a requirement/test binds_to path of the
// model.identity.<slot> or model.aspects.<id> form names a declared
// slot/aspect when the register is in scope.
//
// THE FAMILY-MODULE PATTERN (the check.ts decomposition, one family
// at a time): the family takes the context record it actually uses —
// `standard`, the precomputed id sets it reads, and the emit closure
// — and nothing else. The bodies move verbatim from check.ts; the
// compiler and the suite pin the move.
// ─────────────────────────────────────────────────────────────────────

import type Standard from '../types/Standard';

export interface IdentityAspectsContext {
  standard: Standard;
  attrIds: Set<string>;
  dimIds: Map<string, Set<string> | null>;
  err: (check: string, message: string) => void;
}

export function runIdentityAspectsFamily({
  standard,
  attrIds,
  dimIds,
  err,
}: IdentityAspectsContext): void {
  const slotIds = new Set((standard.identitySlots ?? []).map(s => s.id));
  const aspectIds = new Set((standard.aspects ?? []).map(a => a.id));
  const termIds = new Set((standard.terms ?? []).map(t => t.id));
  const componentIds = new Set(
    (standard.instruments ?? []).flatMap(i =>
      (i.components ?? []).map(c => c.id),
    ),
  );
  for (const s of standard.identitySlots ?? []) {
    if (s.presentation.length === 0) {
      err(
        'C130',
        `identity_slot ${s.id}: at least one presentation channel is required — the slot's content is presented somewhere (identity-and-aspect-references)`,
      );
    }
  }
  // A contains entry resolves through the model.identity path into the
  // slot register, or as a bare id into the attribute/dimension
  // registers; null = no target register in scope (the gated skip).
  const containsResolves = (entry: string): boolean | null => {
    if (entry.startsWith('model.identity.')) {
      const slot = entry.slice('model.identity.'.length);
      return slotIds.size > 0 ? slotIds.has(slot) : null;
    }
    if (attrIds.size > 0 || dimIds.size > 0) {
      return attrIds.has(entry) || dimIds.has(entry);
    }
    return null;
  };
  for (const a of standard.aspects ?? []) {
    const where = `aspect ${a.id}`;
    if (a.termRef && termIds.size > 0 && !termIds.has(a.termRef)) {
      err(
        'C130',
        `${where}: term_ref "${a.termRef}" is not a declared term (identity-and-aspect-references)`,
      );
    }
    if (
      a.component &&
      componentIds.size > 0 &&
      !componentIds.has(a.component)
    ) {
      err(
        'C130',
        `${where}: component "${a.component}" is not a declared instrument component (identity-and-aspect-references)`,
      );
    }
    if (a.attribute && attrIds.size > 0 && !attrIds.has(a.attribute)) {
      err(
        'C130',
        `${where}: attribute "${a.attribute}" is not a declared attribute_definition — an aspect points at a quantity, never redeclares it (identity-and-aspect-references)`,
      );
    }
    for (const entry of a.contains ?? []) {
      if (containsResolves(entry) === false) {
        err(
          'C130',
          `${where}: contains entry "${entry}" resolves to neither a model.identity slot nor a declared attribute/dimension (identity-and-aspect-references)`,
        );
      }
    }
  }
  // The R28 bind-path consumer leg (requirement + conformance-test
  // binds_to), per-register gated.
  const bindOwners: [string, string[]][] = [
    ...(standard.requirements ?? []).map(
      r => [`requirement ${r.id}`, r.bindsTo ?? []] as [string, string[]],
    ),
    ...(standard.conformanceTests ?? []).map(
      t => [`conformance_test ${t.id}`, t.bindsTo ?? []] as [string, string[]],
    ),
  ];
  for (const [owner, paths] of bindOwners) {
    for (const p of paths) {
      const path = String(p);
      if (path.startsWith('model.identity.') && slotIds.size > 0) {
        const slot = path.slice('model.identity.'.length);
        if (!slotIds.has(slot)) {
          err(
            'C130',
            `${owner}: binds_to "${path}" — identity slot "${slot}" is not declared (identity-and-aspect-references)`,
          );
        }
      } else if (path.startsWith('model.aspects.') && aspectIds.size > 0) {
        const aspect = path.slice('model.aspects.'.length);
        if (!aspectIds.has(aspect)) {
          err(
            'C130',
            `${owner}: binds_to "${path}" — aspect "${aspect}" is not declared (identity-and-aspect-references)`,
          );
        }
      }
    }
  }
}

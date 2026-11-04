// ─────────────────────────────────────────────────────────────────────
// The registry-approvals family (C157 + C143): two register-resolution
// mini-families. C157 (the MMEL v2 validation's registry→dataclass leg,
// the rename contract's last flagged invariant): every data_registry's
// data_class names a declared dataclass — read through the RESOLVED
// field, since the resolver silently nulls unresolvable references. And
// C143 (smart TODO.roadmap/40 batch 5, the packages-as-SSOT epic): the
// first approval rule ever (the codec was dormant — no package declared
// an approval before batch 5) — actor / approve_by resolve to declared
// roles, the approval_record entries to declared entity-class stores.
// Per-register gated (the C58 doctrine): an empty register means the
// register is not in scope, not that every reference dangles; the
// rules read the RAW reference ids where the resolved fields silently
// drop unresolvable ones.
//
// THE FAMILY-MODULE PATTERN (the check.ts decomposition, one family
// at a time): the family takes the context record it actually uses —
// `standard` and the emit closure — and nothing else. The bodies move
// verbatim from check.ts; the compiler and the suite pin the move.
// ─────────────────────────────────────────────────────────────────────

import type Standard from '../types/Standard';

export interface RegistryApprovalsContext {
  standard: Standard;
  err: (check: string, message: string) => void;
}

export function runRegistryApprovalsFamily({
  standard,
  err,
}: RegistryApprovalsContext): void {
  // ── C157: registry-dataclass-resolves (the MMEL v2 validation's
  // registry→dataclass leg — the rename contract's last flagged
  // invariant): every data_registry's data_class names a declared
  // dataclass. The resolver silently nulls unresolvable references,
  // so the rule reads the resolved field; a null data means the
  // authored data_class id resolved to nothing — the registry's rows
  // would be formless (the legacy threw at load; the workspace forms,
  // the cross-registry pickers, and the measurement table lookups all
  // key on the pairing).
  {
    for (const reg of standard.regs ?? []) {
      if (reg.data === null) {
        err(
          'C157',
          `data_registry ${reg.id}: the data_class resolves to no declared dataclass — the registry's rows are formless (the pairing the workspace forms and the pickers key on) (registry-dataclass-resolves)`,
        );
      }
    }
  }

  // ── C143: approval-references-resolve (smart TODO.roadmap/40 batch ──
  // 5; the packages-as-SSOT epic) ─────────────────────────────────────
  // The first approval rule ever (the codec was dormant — no package
  // declared an approval before batch 5): actor / approve_by resolve to
  // declared roles, the approval_record entries to declared entity-class
  // stores (the dataclass `store { … }` names — the workflow values are
  // store names like `applications`, not data_registry ids). Per-register
  // gated (the C58 doctrine): an empty register means the register is
  // not in scope, not that every reference dangles. The rule reads the
  // RAW reference ids (actorRef / approverRef / recordRefs) — the
  // resolved fields silently drop unresolvable ids.
  {
    const approvalRoleIds = new Set((standard.roles ?? []).map(r => r.id));
    const approvalStores = new Set<string>();
    for (const c of standard.dataclasses ?? []) {
      if (c.store) {
        for (const s of c.store.split(/\s+/)) {
          if (s) {
            approvalStores.add(s);
          }
        }
      }
    }
    for (const a of standard.approvals ?? []) {
      const where = `approval ${a.id}`;
      if (
        a.actorRef &&
        approvalRoleIds.size > 0 &&
        !approvalRoleIds.has(a.actorRef)
      ) {
        err(
          'C143',
          `${where}: actor "${a.actorRef}" is not a declared role (approval-references-resolve)`,
        );
      }
      if (
        a.approverRef &&
        approvalRoleIds.size > 0 &&
        !approvalRoleIds.has(a.approverRef)
      ) {
        err(
          'C143',
          `${where}: approver "${a.approverRef}" is not a declared role (approval-references-resolve)`,
        );
      }
      for (const store of a.recordRefs ?? []) {
        if (approvalStores.size > 0 && !approvalStores.has(store)) {
          err(
            'C143',
            `${where}: approval_record "${store}" is not a declared entity-class store (approval-references-resolve)`,
          );
        }
      }
    }
  }
}

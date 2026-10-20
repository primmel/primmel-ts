// ─────────────────────────────────────────────────────────────────────
// `approval` construct — the workflow approval step (who asks, who
// approves, which record store the decision lands in).
//
// The workflow fidelity facets (smart TODO.roadmap/40 batch 5; closes
// the kernel half of smart's TODO.refactor/16): the raw reference ids
// (actorRef / approverRef / recordRefs) survive resolution even when
// they name no declared construct — the process.provisionRefs
// precedent — so the dump stays byte-faithful and C143
// (approval-references-resolve) can check them; and the clause-URN
// provenance facet `ref derives-from "…#clause-…"` (free citation
// strings land in the doc slot — the YAML `reference: "PD-05 §4.2"`
// citation folds here; the kernel `reference { <id>+ }` facet is an
// opaque id list (referenceIds), never resolved).
// ─────────────────────────────────────────────────────────────────────

import Approval, { ResolvableApproval } from '../../types/Approval';
import { resolveFromContext } from '../resolve';
import {
  escapeString,
  stripWrapping,
  tokenizePackage,
  unwrapBlock,
} from '../tokenize';
import { forEachEntry, unwrapped } from '../parse-block';
import { readSource } from './field-parser';
import { Dumper, Parser, Resolver } from '../types';
import type { Registry } from '../../types/data';
import type Role from '../../types/Role';
import { refTargetToSourceRef, dumpSourceRefAsRef } from './ref';

export const parseApproval: Parser = function (id, data) {
  const result: ResolvableApproval = {
    id: id,
    name: '',
    modality: '',
    actorRef: '',
    approverRef: '',
    recordRefs: [],
    actor: null,
    approver: null,
    records: [],
    referenceIds: [],
    source: null,
    _relations: {
      actor: '',
      approver: '',
      records: [],
    },
  };

  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'modality') {
        result.modality = value();
      } else if (keyword === 'name') {
        result.name = unwrapped(value);
      } else if (keyword === 'actor') {
        result._relations.actor = value();
      } else if (keyword === 'approve_by') {
        result._relations.approver = value();
      } else if (keyword === 'approval_record') {
        result._relations.records = tokenizePackage(value());
      } else if (keyword === 'reference') {
        result.referenceIds = tokenizePackage(value());
      } else if (keyword === 'source') {
        // Clause-URN provenance — citation strings land in doc.
        result.source = readSource(unwrapBlock(value()));
      } else if (keyword === 'ref') {
        const predicate = stripWrapping(value());
        const target = stripWrapping(value());
        if (predicate === 'derives-from') {
          const b = refTargetToSourceRef(target);
          if (b) {
            result.source = b;
          }
        }
      } else {
        return false;
      }
      return true;
    },
    { construct: 'approval', id },
  );

  return ctx => {
    ctx.approvals[id] = result;
    return ctx;
  };
};

export const resolveApproval: Resolver<Approval, ResolvableApproval> =
  function (ctx, unresolved) {
    const { _relations, ...rest } = unresolved;
    const p: Approval = {
      ...rest,
      // The raw reference ids survive resolution even when they name no
      // declared construct — the linter (C143) and the dumper read these.
      actorRef: _relations.actor,
      approverRef: _relations.approver,
      recordRefs: [..._relations.records],
      records: [],
    };
    if (_relations.actor !== '') {
      p.actor =
        resolveFromContext<Role>(ctx, 'roles', _relations.actor) ?? null;
    }
    if (_relations.approver !== '') {
      p.approver =
        resolveFromContext<Role>(ctx, 'roles', _relations.approver) ?? null;
    }
    for (const id of _relations.records) {
      const r = resolveFromContext<Registry>(ctx, 'regs', id);
      if (r !== undefined) {
        p.records.push(r);
      }
    }
    return p;
  };

export const dumpApproval: Dumper<Approval> = function (approval) {
  let out: string = 'approval ' + approval.id + ' {\n';
  out += '  name "' + escapeString(approval.name) + '"\n';
  // The reference facets dump from the RAW ids — an unresolved id still
  // round-trips byte-clean (the provisionRefs precedent).
  if (approval.actorRef) {
    out += '  actor ' + approval.actorRef + '\n';
  }
  if (approval.modality !== '') {
    out += '  modality ' + approval.modality + '\n';
  }
  if (approval.approverRef) {
    out += '  approve_by ' + approval.approverRef + '\n';
  }
  if (approval.recordRefs.length > 0) {
    out += '  approval_record {\n';
    for (const id of approval.recordRefs) {
      out += '    ' + id + '\n';
    }
    out += '  }\n';
  }
  if (approval.referenceIds.length > 0) {
    out += '  reference {\n';
    for (const id of approval.referenceIds) {
      out += '    ' + id + '\n';
    }
    out += '  }\n';
  }
  if (approval.source && (approval.source.doc || approval.source.clause)) {
    out += dumpSourceRefAsRef(approval.source, '  ', escapeString);
  }
  out += '}\n';
  return out;
};

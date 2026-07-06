import Approval, { ResolvableApproval } from '../../types/Approval';
import { resolveFromContext } from '../resolve';
import { removePackage, tokenizePackage } from '../tokenize';
import { Dumper, Parser, Resolver } from '../types';
import type { Registry } from '../../types/data';
import type Reference from '../../types/Reference';
import type Role from '../../types/Role';

export const parseApproval: Parser = function (id, data) {
  const result: ResolvableApproval = {
    id: id,
    name: '',
    modality: '',
    actor: null,
    approver: null,
    records: [],
    ref: [],
    _relations: {
      actor: '',
      approver: '',
      records: [],
      ref: [],
    },
  };

  if (data !== '') {
    const t: string[] = tokenizePackage(data);
    let i = 0;
    while (i < t.length) {
      const keyword: string = t[i++];
      if (i < t.length) {
        if (keyword === 'modality') {
          result.modality = t[i++];
        } else if (keyword === 'name') {
          result.name = removePackage(t[i++]);
        } else if (keyword === 'actor') {
          result._relations.actor = t[i++];
        } else if (keyword === 'approve_by') {
          result._relations.approver = t[i++];
        } else if (keyword === 'approval_record') {
          result._relations.records = tokenizePackage(t[i++]);
        } else if (keyword === 'reference') {
          result._relations.ref = tokenizePackage(t[i++]);
        } else {
          i++; // forward-compatible: skip unknown keyword value
        }
      } else {
        throw new Error(
          `Parsing error: approval. ID ${id}: Expecting value for ${keyword}`,
        );
      }
    }
  }
  return ctx => {
    ctx.approvals[id] = result;
    return ctx;
  };
};

export const resolveApproval: Resolver<Approval, ResolvableApproval> =
  function (ctx, unresolved) {
    const { _relations, ...rest } = unresolved;
    const p: Approval = { ...rest, records: [], ref: [] };
    if (_relations.actor !== '') {
      p.actor =
        resolveFromContext<Role>(ctx, 'roles', _relations.actor) ?? null;
    }
    if (_relations.approver !== '') {
      p.approver =
        resolveFromContext<Role>(ctx, 'roles', _relations.approver) ?? null;
    }
    for (const id of _relations.records) {
      const r = resolveFromContext<Registry>(ctx, 'registers', id);
      if (r !== undefined) {
        p.records.push(r);
      }
    }
    for (const id of _relations.ref) {
      const r = resolveFromContext<Reference>(ctx, 'references', id);
      if (r !== undefined) {
        p.ref.push(r);
      }
    }
    return p;
  };

export const dumpApproval: Dumper<Approval> = function (approval) {
  let out: string = 'approval ' + approval.id + ' {\n';
  out += '  name "' + approval.name + '"\n';
  if (approval.actor !== null) {
    out += '  actor ' + approval.actor.id + '\n';
  }
  out += '  modality ' + approval.modality + '\n';
  if (approval.approver !== null) {
    out += '  approve_by ' + approval.approver.id + '\n';
  }
  if (approval.records.length > 0) {
    out += '  approval_record {\n';
    for (const dr of approval.records) {
      out += '    ' + dr.id + '\n';
    }
    out += '  }\n';
  }
  if (approval.ref.length > 0) {
    out += '  reference {\n';
    for (const r of approval.ref) {
      out += '    ' + r.id + '\n';
    }
    out += '  }\n';
  }
  out += '}\n';
  return out;
};

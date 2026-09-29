// ─────────────────────────────────────────────────────────────────────
// `attestation` construct (the typed kernel; clause 19 of the language
// specification) — the claim that a third party has verified a subject
// against a declared promise set (types/Attestation.ts carries the
// banner and the grammar sketch). Reference resolution is
// check-enforced (C150 attestation-references-resolve, C151
// attestation-claim-lineage) — the codec stays total.

import type { Dumper, Parser } from '../types';
import { stripWrapping, unwrapBlock } from '../tokenize';
import { forEachEntry } from '../parse-block';
import { dumpBareSafe, stripColon } from './field-parser';
import Attestation, {
  AttestationClaim,
  AttestationLimit,
} from '../../types/Attestation';

export const parseAttestation: Parser = (id: string, data: string) => {
  const a: Attestation = {
    id,
    subject: '',
    promises: '',
    basis: [],
    authority: { role: '', name: '' },
    statement: '',
    limits: [],
    claims: [],
    referenceIds: [],
  };

  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'subject') {
        a.subject = stripWrapping(stripColon(value()));
      } else if (keyword === 'promises') {
        a.promises = stripWrapping(stripColon(value()));
      } else if (keyword === 'basis') {
        const kind = stripWrapping(stripColon(value()));
        const eid = stripWrapping(value());
        a.basis.push({ kind, id: eid });
      } else if (keyword === 'authority') {
        const role = stripWrapping(stripColon(value()));
        const name = stripWrapping(value());
        a.authority = { role, name };
      } else if (keyword === 'statement') {
        a.statement = stripWrapping(value());
      } else if (keyword === 'limits') {
        forEachEntry(
          unwrapBlock(value()),
          (label, text) => {
            const limit: AttestationLimit = {
              label: stripColon(label),
              text: stripWrapping(text()),
            };
            a.limits.push(limit);
            return true;
          },
          { construct: 'attestation', id },
        );
      } else if (keyword === 'claims') {
        forEachEntry(
          unwrapBlock(value()),
          (promise, claimValue) => {
            const claim: AttestationClaim = {
              promise: stripColon(promise),
              declared: '',
              validatedBy: '',
            };
            forEachEntry(
              unwrapBlock(claimValue()),
              (k2, v2) => {
                if (k2 === 'declared') {
                  claim.declared = stripWrapping(stripColon(v2()));
                } else if (k2 === 'validated_by') {
                  claim.validatedBy = stripWrapping(stripColon(v2()));
                } else {
                  return false;
                }
                return true;
              },
              { construct: 'attestation', id },
            );
            a.claims.push(claim);
            return true;
          },
          { construct: 'attestation', id },
        );
      } else {
        return false;
      }
      return true;
    },
    { construct: 'attestation', id },
  );

  return ctx => {
    ctx.attestations[id] = a;
    return ctx;
  };
};

export const dumpAttestation: Dumper<Attestation> = function (a) {
  let out: string = 'attestation ' + dumpBareSafe(a.id) + ' {\n';
  if (a.subject) {
    out += '  subject ' + dumpBareSafe(a.subject) + '\n';
  }
  if (a.promises) {
    out += '  promises ' + dumpBareSafe(a.promises) + '\n';
  }
  for (const b of a.basis) {
    out +=
      '  basis ' +
      dumpBareSafe(b.kind) +
      ' "' +
      b.id.replace(/"/g, '\\"') +
      '"\n';
  }
  if (a.authority.role || a.authority.name) {
    out +=
      '  authority ' +
      dumpBareSafe(a.authority.role) +
      ' "' +
      a.authority.name.replace(/"/g, '\\"') +
      '"\n';
  }
  if (a.statement) {
    out += '  statement "' + a.statement.replace(/"/g, '\\"') + '"\n';
  }
  if (a.limits.length > 0) {
    out += '  limits {\n';
    for (const l of a.limits) {
      out +=
        '    ' +
        dumpBareSafe(l.label) +
        ' "' +
        l.text.replace(/"/g, '\\"') +
        '"\n';
    }
    out += '  }\n';
  }
  if (a.claims.length > 0) {
    out += '  claims {\n';
    for (const c of a.claims) {
      out += '    ' + dumpBareSafe(c.promise) + ' {\n';
      out += '      declared ' + dumpBareSafe(c.declared) + '\n';
      out += '      validated_by ' + dumpBareSafe(c.validatedBy) + '\n';
      out += '    }\n';
    }
    out += '  }\n';
  }
  out += '}\n';
  return out;
};

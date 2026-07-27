// ─────────────────────────────────────────────────────────────────────
// discrepancy_record construct (TODO.roadmap/54 — BUG.R60-SSOT gap 13's
// corpus-level extension of the shipped source_discrepancy facet): a
// named, top-level record that two or more source fragments CONFLICT,
// where no model node owns the disagreement (the conflict attaches to
// DOCUMENTS — PD-02, 11.1 vs OD-01, 13.4; D 32's G.7.1.1-4 numbering gap;
// OD-01's defective printed Contents). The facet fields are identical to
// the node-attached source_discrepancy block; the corpus wrapper adds
// status (open | resolved) and governing (the followed source, required
// when resolution is follows_clause_x — enforced by the smart repo's
// linker rule discrepancy-references, which also resolves every URN):
//
//   discrepancy_record pd-02-vs-od-01-expert-review-cycle {
//     status resolved
//     summary "PD-02, 11.1 prescribes a four-year expert-review cycle 'as
//       outlined in OD-01, 13.4', which prescribes a 3-yearly cycle"
//     sources { "urn:oiml:pub:cs:pd-02:2022#clause-11.1" "urn:oiml:pub:cs:od-01:2022#clause-13.4" }
//     resolution annotated_only
//     rationale "Both official texts verified verbatim … a CID-01 clarification candidate."
//   }
// ─────────────────────────────────────────────────────────────────────

import type DiscrepancyRecord from '../../types/DiscrepancyRecord';
import tokenize from '../tokenize';
import { escapeString, stripWrapping, tokenizePackage } from '../tokenize';
import type { Dumper, Parser } from '../types';
import { VALID_RESOLUTIONS } from './sourceDiscrepancy';

const VALID_STATUSES = ['open', 'resolved'];

export const parseDiscrepancyRecord: Parser = function (id, data) {
  const result: DiscrepancyRecord = {
    id,
    status: '',
    summary: '',
    sources: [],
    resolution: '',
    governing: '',
    rationale: '',
  };

  const t = tokenizePackage(data);
  let i = 0;
  while (i < t.length) {
    const keyword = t[i++];
    if (i >= t.length) {
      throw new Error(
        `Parsing error: discrepancy_record. ID ${id}: Expecting value for ${keyword}`,
      );
    }
    if (keyword === 'status') {
      const s = stripWrapping(t[i++]);
      if (!VALID_STATUSES.includes(s)) {
        throw new Error(
          `Parsing error: discrepancy_record. ID ${id}: Unknown status ${s} (valid: ${VALID_STATUSES.join(
            ', ',
          )})`,
        );
      }
      result.status = s;
    } else if (keyword === 'summary') {
      result.summary = stripWrapping(t[i++]);
    } else if (keyword === 'sources') {
      result.sources = tokenize(stripWrapping(t[i++]))
        .map(stripWrapping)
        .filter(s => s.length > 0);
    } else if (keyword === 'resolution') {
      const r = stripWrapping(t[i++]);
      if (!VALID_RESOLUTIONS.includes(r)) {
        throw new Error(
          `Parsing error: discrepancy_record. ID ${id}: Unknown resolution ${r} (valid: ${VALID_RESOLUTIONS.join(
            ', ',
          )})`,
        );
      }
      result.resolution = r;
    } else if (keyword === 'governing') {
      result.governing = stripWrapping(t[i++]);
    } else if (keyword === 'rationale') {
      result.rationale = stripWrapping(t[i++]);
    } else {
      i++; // forward-compat: skip unknown keyword value
    }
  }

  return ctx => {
    ctx.discrepancyRecords[id] = result;
    return ctx;
  };
};

export const dumpDiscrepancyRecord: Dumper<DiscrepancyRecord> = function (r) {
  let out = 'discrepancy_record ' + r.id + ' {\n';
  if (r.status) {
    out += '  status ' + r.status + '\n';
  }
  if (r.summary) {
    out += '  summary "' + escapeString(r.summary) + '"\n';
  }
  out +=
    '  sources { ' +
    r.sources.map(s => '"' + escapeString(s) + '"').join(' ') +
    ' }\n';
  if (r.resolution) {
    out += '  resolution ' + r.resolution + '\n';
  }
  if (r.governing) {
    out += '  governing "' + escapeString(r.governing) + '"\n';
  }
  if (r.rationale) {
    out += '  rationale "' + escapeString(r.rationale) + '"\n';
  }
  out += '}\n';
  return out;
};

// ─────────────────────────────────────────────────────────────────────
// `informative_annex` construct (smart TODO.roadmap/40 batch 2; the
// packages-as-SSOT epic) — a guidance document bound into a document
// module (types/InformativeAnnex.ts carries the banner and the grammar
// sketch).
//
// `highlight <id> { … }` is a two-token facet (the id, then the block),
// so it claims through peek/value manually. The document role vocabulary
// is parse-enforced (the fail-closed precedent) — single-valued today
// (informative), expected to grow.
// ─────────────────────────────────────────────────────────────────────

import type { Dumper, Parser } from '../types';
import { escapeString, stripWrapping, unwrapBlock } from '../tokenize';
import { forEachEntry } from '../parse-block';
import { dumpBareSafe } from './field-parser';
import InformativeAnnex, {
  AnnexDocument,
  AnnexHighlight,
} from '../../types/InformativeAnnex';

const ANNEX_DOCUMENT_ROLES = ['informative'] as const;

function parseAnnexDocument(block: string, annexId: string): AnnexDocument {
  const doc: AnnexDocument = {
    id: '',
    title: '',
    edition: 0,
    year: 0,
    role: '',
    source: '',
  };
  forEachEntry(
    block,
    (keyword, value) => {
      if (keyword === 'id') {
        doc.id = stripWrapping(value());
      } else if (keyword === 'title') {
        doc.title = stripWrapping(value());
      } else if (keyword === 'edition') {
        doc.edition = parseInt(stripWrapping(value()), 10) || 0;
      } else if (keyword === 'year') {
        doc.year = parseInt(stripWrapping(value()), 10) || 0;
      } else if (keyword === 'role') {
        const role = stripWrapping(value());
        if (!(ANNEX_DOCUMENT_ROLES as readonly string[]).includes(role)) {
          throw new Error(
            `Parsing error: informative_annex. ID ${annexId}: Unknown document role "${role}" (valid: ${ANNEX_DOCUMENT_ROLES.join(', ')})`,
          );
        }
        doc.role = role;
      } else if (keyword === 'source') {
        doc.source = stripWrapping(value());
      } else {
        return false;
      }
      return true;
    },
    { construct: 'informative_annex document', id: annexId },
  );
  return doc;
}

function parseAnnexHighlight(id: string, block: string): AnnexHighlight {
  const highlight: AnnexHighlight = {
    id,
    clause: '',
    title: '',
    statement: '',
    dischargedBy: '',
  };
  forEachEntry(
    block,
    (keyword, value) => {
      if (keyword === 'clause') {
        highlight.clause = stripWrapping(value());
      } else if (keyword === 'title') {
        highlight.title = stripWrapping(value());
      } else if (keyword === 'statement') {
        highlight.statement = stripWrapping(value());
      } else if (keyword === 'discharged_by') {
        highlight.dischargedBy = stripWrapping(value());
      } else {
        return false;
      }
      return true;
    },
    { construct: 'informative_annex highlight', id },
  );
  return highlight;
}

export const parseInformativeAnnex: Parser = (id: string, data: string) => {
  const annex: InformativeAnnex = {
    id,
    document: { id: '', title: '', edition: 0, year: 0, role: '', source: '' },
    appliesTo: '',
    appliedBy: '',
    scope: '',
    numberingCaution: '',
    highlights: [],
  };

  forEachEntry(
    data,
    (keyword, value, peek) => {
      if (keyword === 'document') {
        annex.document = parseAnnexDocument(unwrapBlock(value()), id);
      } else if (keyword === 'applies_to') {
        annex.appliesTo = stripWrapping(value());
      } else if (keyword === 'applied_by') {
        annex.appliedBy = stripWrapping(value());
      } else if (keyword === 'scope') {
        annex.scope = stripWrapping(value());
      } else if (keyword === 'numbering_caution') {
        annex.numberingCaution = stripWrapping(value());
      } else if (keyword === 'highlight') {
        const hlId = stripWrapping(value());
        const head = peek();
        if (head === undefined || !head.startsWith('{')) {
          throw new Error(
            `Parsing error: informative_annex. ID ${id}: highlight ${hlId} is missing its block`,
          );
        }
        annex.highlights.push(parseAnnexHighlight(hlId, unwrapBlock(value())));
      } else {
        return false;
      }
      return true;
    },
    { construct: 'informative_annex', id },
  );

  return ctx => {
    ctx.informativeAnnexes[id] = annex;
    return ctx;
  };
};

export const dumpInformativeAnnex: Dumper<InformativeAnnex> = function (a) {
  let out: string = 'informative_annex ' + a.id + ' {\n';
  out += '  document {\n';
  if (a.document.id) {
    out += '    id "' + escapeString(a.document.id) + '"\n';
  }
  if (a.document.title) {
    out += '    title "' + escapeString(a.document.title) + '"\n';
  }
  if (a.document.edition) {
    out += '    edition ' + a.document.edition + '\n';
  }
  if (a.document.year) {
    out += '    year ' + a.document.year + '\n';
  }
  if (a.document.role) {
    out += '    role ' + dumpBareSafe(a.document.role) + '\n';
  }
  if (a.document.source) {
    out += '    source "' + escapeString(a.document.source) + '"\n';
  }
  out += '  }\n';
  if (a.appliesTo) {
    out += '  applies_to ' + dumpBareSafe(a.appliesTo) + '\n';
  }
  if (a.appliedBy) {
    out += '  applied_by "' + escapeString(a.appliedBy) + '"\n';
  }
  if (a.scope) {
    out += '  scope "' + escapeString(a.scope) + '"\n';
  }
  if (a.numberingCaution) {
    out += '  numbering_caution "' + escapeString(a.numberingCaution) + '"\n';
  }
  for (const h of a.highlights) {
    out += '  highlight ' + dumpBareSafe(h.id) + ' {\n';
    if (h.clause) {
      out += '    clause "' + escapeString(h.clause) + '"\n';
    }
    if (h.title) {
      out += '    title "' + escapeString(h.title) + '"\n';
    }
    if (h.statement) {
      out += '    statement "' + escapeString(h.statement) + '"\n';
    }
    if (h.dischargedBy) {
      out += '    discharged_by "' + escapeString(h.dischargedBy) + '"\n';
    }
    out += '  }\n';
  }
  out += '}\n';
  return out;
};

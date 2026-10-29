// ─────────────────────────────────────────────────────────────────────
// The framework-document constructs (smart TODO.roadmap/40; the
// packages-as-SSOT epic) — B 18:2025 clause 6 + §4.2:
//
//   framework_document b18 {
//     rank 1
//     doc "OIML B 18"
//     title "Framework for the OIML Certification System (OIML-CS)"
//     approved_by ciml
//     clause "6 a)"
//     ref derives-from "urn:oiml:pub:b:18:2025#clause-6"
//   }
//
//   document_precedence higher_position_prevails {
//     clause "6"
//     statement "In the event of a conflict, contradiction or
//       inconsistency … the provisions of the document listed in a
//       higher position take precedence …"
//     ref derives-from "urn:oiml:pub:b:18:2025#clause-6"
//   }
//
//   auto_inclusion auto_inclusion {
//     clause "4.2"
//     statement "Categories of measuring instruments … are
//       automatically included in the OIML-CS when the relevant OIML
//       Recommendation specifies all of the following (§4.2) …"
//     condition metrological-technical-requirements {
//       clause "4.2 a)"
//       description "The Recommendation specifies the metrological and
//         technical requirements for the category."
//     }
//     note "The two report formats (conditions c and d) may be
//       specified in separate Parts of a Recommendation …"
//     ref derives-from "urn:oiml:pub:b:18:2025#clause-4.2"
//   }
// ─────────────────────────────────────────────────────────────────────

import type { Dumper, Parser } from '../types';
import { escapeString, stripWrapping, unwrapBlock } from '../tokenize';
import { forEachEntry, proseBlock } from '../parse-block';
import { dumpBareSafe, readSource } from './field-parser';
import FrameworkDocument, {
  DocumentPrecedence,
} from '../../types/FrameworkDocument';
import { dumpSourceRefAsRef, refTargetToSourceRef } from './ref';

function dumpSourceBlock(src: { doc: string; clause: string }): string {
  return dumpSourceRefAsRef(src, '  ', escapeString);
}

export const parseFrameworkDocument: Parser = (id: string, data: string) => {
  const doc: FrameworkDocument = {
    id,
    rank: 0,
    doc: '',
    title: '',
    approved_by: '',
    clause: '',
    note: '',
    source: { doc: '', clause: '' },
  };
  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'rank') {
        doc.rank = parseInt(stripWrapping(value()), 10) || 0;
      } else if (keyword === 'doc') {
        doc.doc = stripWrapping(value());
      } else if (keyword === 'title') {
        doc.title = stripWrapping(value());
      } else if (keyword === 'approved_by') {
        doc.approved_by = stripWrapping(value());
      } else if (keyword === 'clause') {
        doc.clause = stripWrapping(value());
      } else if (keyword === 'note') {
        doc.note = stripWrapping(value());
      } else if (keyword === 'source') {
        doc.source = readSource(unwrapBlock(value()));
      } else if (keyword === 'ref') {
        const predicate = stripWrapping(value());
        const target = stripWrapping(value());
        if (predicate === 'derives-from') {
          const b = refTargetToSourceRef(target);
          if (b) {
            doc.source = b;
          }
        }
      } else {
        return false;
      }
      return true;
    },
    { construct: 'framework_document', id },
  );
  return ctx => {
    ctx.frameworkDocuments[id] = doc;
    return ctx;
  };
};

export const dumpFrameworkDocument: Dumper<FrameworkDocument> = function (d) {
  let out: string = 'framework_document ' + d.id + ' {\n';
  if (d.rank > 0) {
    out += '  rank ' + d.rank + '\n';
  }
  if (d.doc) {
    out += '  doc "' + escapeString(d.doc) + '"\n';
  }
  if (d.title) {
    out += '  title "' + escapeString(d.title) + '"\n';
  }
  if (d.approved_by) {
    out += '  approved_by ' + dumpBareSafe(d.approved_by) + '\n';
  }
  if (d.clause) {
    out += '  clause "' + escapeString(d.clause) + '"\n';
  }
  if (d.note) {
    out += '  note "' + escapeString(d.note) + '"\n';
  }
  if (d.source.doc || d.source.clause) {
    out += dumpSourceBlock(d.source);
  }
  out += '}\n';
  return out;
};

export const parseDocumentPrecedence: Parser = (id: string, data: string) => {
  const rule: DocumentPrecedence = {
    id,
    clause: '',
    statement: '',
    source: { doc: '', clause: '' },
  };
  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'clause') {
        rule.clause = stripWrapping(value());
      } else if (keyword === 'statement') {
        // THE PROSE QUARANTINE (TODO.lang-gaps/02): the block form only.
        rule.statement = proseBlock(value(), 'decision_rule', id, 'statement');
      } else if (keyword === 'source') {
        rule.source = readSource(unwrapBlock(value()));
      } else if (keyword === 'ref') {
        const predicate = stripWrapping(value());
        const target = stripWrapping(value());
        if (predicate === 'derives-from') {
          const b = refTargetToSourceRef(target);
          if (b) {
            rule.source = b;
          }
        }
      } else {
        return false;
      }
      return true;
    },
    { construct: 'document_precedence', id },
  );
  return ctx => {
    ctx.documentPrecedences[id] = rule;
    return ctx;
  };
};

export const dumpDocumentPrecedence: Dumper<DocumentPrecedence> = function (p) {
  let out: string = 'document_precedence ' + p.id + ' {\n';
  if (p.clause) {
    out += '  clause "' + escapeString(p.clause) + '"\n';
  }
  if (p.statement) {
    out += '  statement { ' + p.statement + ' }\n';
  }
  if (p.source.doc || p.source.clause) {
    out += dumpSourceBlock(p.source);
  }
  out += '}\n';
  return out;
};

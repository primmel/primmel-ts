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
//     source { doc "urn:oiml:pub:b:18:2025" clause "6" }
//   }
//
//   document_precedence higher_position_prevails {
//     clause "6"
//     statement "In the event of a conflict, contradiction or
//       inconsistency … the provisions of the document listed in a
//       higher position take precedence …"
//     source { doc "urn:oiml:pub:b:18:2025" clause "6" }
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
//     source { doc "urn:oiml:pub:b:18:2025" clause "4.2" }
//   }
// ─────────────────────────────────────────────────────────────────────

import type { Dumper, Parser } from '../types';
import { escapeString, stripWrapping, unwrapBlock } from '../tokenize';
import { forEachEntry } from '../parse-block';
import { dumpBareSafe, readSource } from './field-parser';
import FrameworkDocument, {
  AutoInclusion,
  AutoInclusionCondition,
  DocumentPrecedence,
} from '../../types/FrameworkDocument';

function dumpSourceBlock(src: { doc: string; clause: string }): string {
  let out = '  source {\n';
  if (src.doc) {
    out += '    doc "' + escapeString(src.doc) + '"\n';
  }
  if (src.clause) {
    out += '    clause "' + escapeString(src.clause) + '"\n';
  }
  out += '  }\n';
  return out;
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
        rule.statement = stripWrapping(value());
      } else if (keyword === 'source') {
        rule.source = readSource(unwrapBlock(value()));
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
    out += '  statement "' + escapeString(p.statement) + '"\n';
  }
  if (p.source.doc || p.source.clause) {
    out += dumpSourceBlock(p.source);
  }
  out += '}\n';
  return out;
};

function parseCondition(id: string, block: string): AutoInclusionCondition {
  const condition: AutoInclusionCondition = { id, clause: '', description: '' };
  forEachEntry(
    block,
    (keyword, value) => {
      if (keyword === 'clause') {
        condition.clause = stripWrapping(value());
      } else if (keyword === 'description') {
        condition.description = stripWrapping(value());
      } else {
        return false;
      }
      return true;
    },
    { construct: 'auto_inclusion condition', id },
  );
  return condition;
}

export const parseAutoInclusion: Parser = (id: string, data: string) => {
  const inclusion: AutoInclusion = {
    id,
    clause: '',
    statement: '',
    conditions: [],
    note: '',
    source: { doc: '', clause: '' },
  };
  // `condition <id> { … }` — the two-token nested-entry shape.
  forEachEntry(
    data,
    (keyword, value, peek) => {
      if (keyword === 'clause') {
        inclusion.clause = stripWrapping(value());
      } else if (keyword === 'statement') {
        inclusion.statement = stripWrapping(value());
      } else if (keyword === 'condition') {
        const condId = stripWrapping(value());
        const head = peek();
        if (head === undefined || !head.startsWith('{')) {
          throw new Error(
            `Parsing error: auto_inclusion. ID ${id}: condition ${condId} is missing its block`,
          );
        }
        inclusion.conditions.push(parseCondition(condId, unwrapBlock(value())));
      } else if (keyword === 'note') {
        inclusion.note = stripWrapping(value());
      } else if (keyword === 'source') {
        inclusion.source = readSource(unwrapBlock(value()));
      } else {
        return false;
      }
      return true;
    },
    { construct: 'auto_inclusion', id },
  );
  return ctx => {
    ctx.autoInclusions[id] = inclusion;
    return ctx;
  };
};

export const dumpAutoInclusion: Dumper<AutoInclusion> = function (a) {
  let out: string = 'auto_inclusion ' + a.id + ' {\n';
  if (a.clause) {
    out += '  clause "' + escapeString(a.clause) + '"\n';
  }
  if (a.statement) {
    out += '  statement "' + escapeString(a.statement) + '"\n';
  }
  for (const c of a.conditions) {
    out += '  condition ' + dumpBareSafe(c.id) + ' {\n';
    if (c.clause) {
      out += '    clause "' + escapeString(c.clause) + '"\n';
    }
    if (c.description) {
      out += '    description "' + escapeString(c.description) + '"\n';
    }
    out += '  }\n';
  }
  if (a.note) {
    out += '  note "' + escapeString(a.note) + '"\n';
  }
  if (a.source.doc || a.source.clause) {
    out += dumpSourceBlock(a.source);
  }
  out += '}\n';
  return out;
};

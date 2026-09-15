// ─────────────────────────────────────────────────────────────────────
// `document_module` construct (smart TODO.roadmap/40 batch 2; the
// packages-as-SSOT epic) — one governing document's content module made
// first-class (types/DocumentModule.ts carries the banner and the
// grammar sketch).
//
// The sequence/register sub-grammar is SHARED with process_model — the
// readers/writers live in config/processModel.ts. `register <id> { … }`
// is a two-token facet and claims through peek/value manually.
// ─────────────────────────────────────────────────────────────────────

import type { Dumper, Parser } from '../types';
import { escapeString, stripWrapping, unwrapBlock } from '../tokenize';
import { forEachEntry } from '../parse-block';
import { dumpBareSafe, readSource } from './field-parser';
import {
  dumpProcessRegister,
  dumpProcessSequence,
  parseProcessRegister,
  parseProcessSequence,
} from './processModel';
import DocumentModule from '../../types/DocumentModule';

export const parseDocumentModule: Parser = (id: string, data: string) => {
  const module: DocumentModule = {
    id,
    document: '',
    title: '',
    edition: '',
    year: 0,
    namespace: '',
    sequence: [],
    registers: [],
    source: { doc: '', clause: '' },
  };

  forEachEntry(
    data,
    (keyword, value, peek) => {
      if (keyword === 'document') {
        module.document = stripWrapping(value());
      } else if (keyword === 'title') {
        module.title = stripWrapping(value());
      } else if (keyword === 'edition') {
        module.edition = stripWrapping(value());
      } else if (keyword === 'year') {
        module.year = parseInt(stripWrapping(value()), 10) || 0;
      } else if (keyword === 'namespace') {
        module.namespace = stripWrapping(value());
      } else if (keyword === 'sequence') {
        module.sequence = parseProcessSequence(unwrapBlock(value()));
      } else if (keyword === 'register') {
        const regId = stripWrapping(value());
        const head = peek();
        if (head === undefined || !head.startsWith('{')) {
          throw new Error(
            `Parsing error: document_module. ID ${id}: register ${regId} is missing its block`,
          );
        }
        module.registers.push(
          parseProcessRegister(regId, unwrapBlock(value())),
        );
      } else if (keyword === 'source') {
        module.source = readSource(unwrapBlock(value()));
      } else {
        return false;
      }
      return true;
    },
    { construct: 'document_module', id },
  );

  return ctx => {
    ctx.documentModules[id] = module;
    return ctx;
  };
};

export const dumpDocumentModule: Dumper<DocumentModule> = function (m) {
  let out: string = 'document_module ' + m.id + ' {\n';
  if (m.document) {
    out += '  document "' + escapeString(m.document) + '"\n';
  }
  if (m.title) {
    out += '  title "' + escapeString(m.title) + '"\n';
  }
  if (m.edition) {
    out += '  edition "' + escapeString(m.edition) + '"\n';
  }
  if (m.year) {
    out += '  year ' + m.year + '\n';
  }
  if (m.namespace) {
    out += '  namespace ' + dumpBareSafe(m.namespace) + '\n';
  }
  const seq = dumpProcessSequence(m.sequence);
  if (seq) {
    out += '  ' + seq + '\n';
  }
  for (const r of m.registers) {
    out += dumpProcessRegister(r, '  ');
  }
  if (m.source.doc || m.source.clause) {
    out += '  source {\n';
    if (m.source.doc) {
      out += '    doc "' + escapeString(m.source.doc) + '"\n';
    }
    if (m.source.clause) {
      out += '    clause "' + escapeString(m.source.clause) + '"\n';
    }
    out += '  }\n';
  }
  out += '}\n';
  return out;
};

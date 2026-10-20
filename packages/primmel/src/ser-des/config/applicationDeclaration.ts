// ─────────────────────────────────────────────────────────────────────
// `application_declaration` construct (smart TODO.roadmap/40 batch 3;
// the packages-as-SSOT epic) — the rec's applicant-facing documentation
// register (types/ApplicationDeclaration.ts carries the banner and the
// grammar sketch). The obligation vocabulary is parse-enforced (the
// fail-closed precedent); the declaration_form resolution and the
// document-id uniqueness are check-enforced (C132) — the codec stays
// total.
// ─────────────────────────────────────────────────────────────────────

import type { Dumper, Parser } from '../types';
import { escapeString, stripWrapping, unwrapBlock } from '../tokenize';
import { forEachEntry } from '../parse-block';
import { dumpBareSafe, readSource, stripColon } from './field-parser';
import ApplicationDeclaration, {
  ApplicationDocument,
} from '../../types/ApplicationDeclaration';
import { refTargetToSourceRef, dumpSourceRefAsRef } from './ref';

const APPLICATION_DOCUMENT_OBLIGATIONS = ['shall', 'should', 'may'] as const;

export const parseApplicationDeclaration: Parser = (
  id: string,
  data: string,
) => {
  const decl: ApplicationDeclaration = {
    id,
    declarationForm: '',
    documents: [],
  };

  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'declaration_form') {
        decl.declarationForm = stripWrapping(value());
      } else if (keyword === 'document') {
        const doc: ApplicationDocument = {
          id: stripWrapping(stripColon(value())),
          name: '',
          description: '',
          obligation: '',
          source: null,
        };
        forEachEntry(
          unwrapBlock(value()),
          (k2, v2) => {
            if (k2 === 'name') {
              doc.name = stripWrapping(v2());
            } else if (k2 === 'description') {
              doc.description = stripWrapping(v2());
            } else if (k2 === 'obligation') {
              const o = stripWrapping(v2());
              if (
                !(
                  APPLICATION_DOCUMENT_OBLIGATIONS as readonly string[]
                ).includes(o)
              ) {
                throw new Error(
                  `Parsing error: application_declaration. ID ${id}: Unknown obligation "${o}" (valid: ${APPLICATION_DOCUMENT_OBLIGATIONS.join(', ')})`,
                );
              }
              doc.obligation = o;
            } else if (k2 === 'source') {
              doc.source = readSource(unwrapBlock(v2()));
            } else if (k2 === 'ref') {
              const predicate = stripWrapping(v2());
              const target = stripWrapping(v2());
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
          { construct: 'application_declaration', id },
        );
        decl.documents.push(doc);
      } else {
        return false;
      }
      return true;
    },
    { construct: 'application_declaration', id },
  );

  return ctx => {
    ctx.applicationDeclarations[id] = decl;
    return ctx;
  };
};

export const dumpApplicationDeclaration: Dumper<ApplicationDeclaration> =
  function (d) {
    let out: string = 'application_declaration ' + dumpBareSafe(d.id) + ' {\n';
    if (d.declarationForm) {
      out += '  declaration_form ' + dumpBareSafe(d.declarationForm) + '\n';
    }
    for (const doc of d.documents) {
      out += '  document ' + dumpBareSafe(doc.id) + ' {\n';
      if (doc.name) {
        out += '    name "' + escapeString(doc.name) + '"\n';
      }
      if (doc.description) {
        out += '    description "' + escapeString(doc.description) + '"\n';
      }
      if (doc.obligation) {
        out += '    obligation ' + dumpBareSafe(doc.obligation) + '\n';
      }
      if (doc.source && (doc.source.doc || doc.source.clause)) {
        out += dumpSourceRefAsRef(doc.source, '    ', escapeString);
      }
      out += '  }\n';
    }
    out += '}\n';
    return out;
  };

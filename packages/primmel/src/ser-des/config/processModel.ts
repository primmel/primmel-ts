// ─────────────────────────────────────────────────────────────────────
// `process_model` construct (smart TODO.roadmap/40 batch 2; the
// packages-as-SSOT epic) — the shared home for the file-level facets of
// the abstract-process model (types/ProcessModel.ts carries the banner
// and the grammar sketch):
//
//   process_model evaluation {
//     sequence { application assessment review decision }
//     register lme_register {
//       label "ILAC-IAF-OIML list of Legal Metrology Experts"
//       clause "PD-02, 9"
//       maintainer executive_secretary
//       published "The OIML-CS pages of the OIML website …"
//       entries "Per Legal Metrology Expert: identity, …"
//     }
//     source { doc "urn:oiml:pub:cs:pd-05:2024" clause "4" }
//   }
//
// `register <id> { … }` is a two-token facet (the id, then the block), so
// it claims through peek/value manually. The sequence/register
// sub-grammar is SHARED with document_module (config/documentModule.ts
// imports these readers/writers) — one grammar, two placements.
//
// Cross-references (sequence → process, register maintainer →
// governance_organ) resolve at check time (C121), per-register gated;
// the codec stays total.
// ─────────────────────────────────────────────────────────────────────

import type { Dumper, Parser } from '../types';
import { escapeString, stripWrapping, unwrapBlock } from '../tokenize';
import { tokenizePackage } from '../tokenize';
import { forEachEntry } from '../parse-block';
import { dumpBareSafe, readSource, stripColon } from './field-parser';
import ProcessModel, { ProcessModelRegister } from '../../types/ProcessModel';

/** Read the `sequence { <process-id>+ }` list (shared with document_module). */
export function parseProcessSequence(block: string): string[] {
  return tokenizePackage(block)
    .map(stripColon)
    .map(stripWrapping)
    .filter(s => s.length > 0);
}

/** Read one `register <id> { … }` body (shared with document_module). */
export function parseProcessRegister(
  id: string,
  block: string,
): ProcessModelRegister {
  const register: ProcessModelRegister = {
    id,
    label: '',
    clause: '',
    maintainer: '',
    published: '',
    entries: '',
  };
  forEachEntry(
    block,
    (keyword, value) => {
      if (keyword === 'label') {
        register.label = stripWrapping(value());
      } else if (keyword === 'clause') {
        register.clause = stripWrapping(value());
      } else if (keyword === 'maintainer') {
        register.maintainer = stripWrapping(value());
      } else if (keyword === 'published') {
        register.published = stripWrapping(value());
      } else if (keyword === 'entries') {
        register.entries = stripWrapping(value());
      } else {
        return false;
      }
      return true;
    },
    { construct: 'process_model register', id },
  );
  return register;
}

export const parseProcessModel: Parser = (id: string, data: string) => {
  const model: ProcessModel = {
    id,
    sequence: [],
    registers: [],
    source: { doc: '', clause: '' },
  };

  forEachEntry(
    data,
    (keyword, value, peek) => {
      if (keyword === 'sequence') {
        model.sequence = parseProcessSequence(unwrapBlock(value()));
      } else if (keyword === 'register') {
        const regId = stripWrapping(value());
        const head = peek();
        if (head === undefined || !head.startsWith('{')) {
          throw new Error(
            `Parsing error: process_model. ID ${id}: register ${regId} is missing its block`,
          );
        }
        model.registers.push(parseProcessRegister(regId, unwrapBlock(value())));
      } else if (keyword === 'source') {
        model.source = readSource(unwrapBlock(value()));
      } else {
        return false;
      }
      return true;
    },
    { construct: 'process_model', id },
  );

  return ctx => {
    ctx.processModels[id] = model;
    return ctx;
  };
};

/** Dump the `sequence { … }` line ('' when undeclared). */
export function dumpProcessSequence(sequence: string[]): string {
  if (sequence.length === 0) {
    return '';
  }
  return 'sequence { ' + sequence.map(dumpBareSafe).join(' ') + ' }';
}

/** Dump one `register <id> { … }` block at the given indent. */
export function dumpProcessRegister(
  r: ProcessModelRegister,
  indent: string,
): string {
  let out = indent + 'register ' + dumpBareSafe(r.id) + ' {\n';
  if (r.label) {
    out += indent + '  label "' + escapeString(r.label) + '"\n';
  }
  if (r.clause) {
    out += indent + '  clause "' + escapeString(r.clause) + '"\n';
  }
  if (r.maintainer) {
    out += indent + '  maintainer ' + dumpBareSafe(r.maintainer) + '\n';
  }
  if (r.published) {
    out += indent + '  published "' + escapeString(r.published) + '"\n';
  }
  if (r.entries) {
    out += indent + '  entries "' + escapeString(r.entries) + '"\n';
  }
  out += indent + '}\n';
  return out;
}

export const dumpProcessModel: Dumper<ProcessModel> = function (m) {
  let out: string = 'process_model ' + m.id + ' {\n';
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

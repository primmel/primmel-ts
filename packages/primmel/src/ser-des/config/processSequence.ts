// Shared process-register/sequence helpers (the document_module's
// grammar reuses them; the process_model construct itself is retired —
// phase 6 of the reconfiguration).

import { escapeString, stripWrapping, tokenizePackage } from '../tokenize';
import { dumpBareSafe, stripColon } from './field-parser';
import { forEachEntry } from '../parse-block';

export interface ProcessModelRegister {
  /** Snake-case register id (lme_register). */
  id: string;
  /** The register's label. */
  label: string;
  /** The clause establishing the register (e.g. "PD-02, 9"). */
  clause: string;
  /** The governance_organ id maintaining the register (C121). */
  maintainer: string;
  /** Where the register is published. */
  published: string;
  /** What one register entry carries. */
  entries: string;
}

export function parseProcessSequence(block: string): string[] {
  return tokenizePackage(block)
    .map(stripColon)
    .map(stripWrapping)
    .filter(s => s.length > 0);
}

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

export function dumpProcessSequence(sequence: string[]): string {
  if (sequence.length === 0) {
    return '';
  }
  return 'sequence { ' + sequence.map(dumpBareSafe).join(' ') + ' }';
}

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

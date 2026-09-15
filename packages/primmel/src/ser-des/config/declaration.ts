// ─────────────────────────────────────────────────────────────────────
// The Declaration constructs (smart TODO.roadmap/40; the packages-as-
// SSOT epic) — B 18:2025 §5.5–5.6 + PD-08:
//
//   declaration_kind utilizer_declaration {
//     label "Utilizer Declaration"
//     holder utilizer
//     clause "5.6.1"
//     procedure "PD-08"
//     definition "Declaration signed by a Utilizer indicating its scope
//       of acceptance of OIML certificates and/or OIML type evaluation
//       reports issued under Scheme A and/or Scheme B (§5.6.1)."
//     scope_model categories_x_schemes
//     content mtl_acceptance_policy {
//       clause "5.6.3"
//       description "Whether the Utilizer accepts OIML certificates
//         and/or type evaluation reports issued on the basis of test
//         reports from a Manufacturer's Test Laboratory (§5.6.3) — …"
//     }
//     source { doc "urn:oiml:pub:b:18:2025" clause "5.6.1" }
//   }
//
//   declaration_status signed {
//     description "Signed by the participant and recorded by the
//       Executive Secretary — the only status that discharges the
//       signing gate."
//   }
//
//   declaration_gate declaration-signed-before-issuance {
//     clause "PD-08 cl. 5"
//     statement "An OIML Issuing Authority shall not issue any OIML
//       certificate or OIML type evaluation report before its
//       Declaration covering the instrument category and Scheme is
//       signed …"
//     holder issuing_authority
//     declaration issuing_authority_declaration
//     blocks { issue evaluation }
//     blocks_note "The gated abstract processes of the scheme process
//       model: issue (certificate issuance) and evaluation (…)."
//     scope_checked { category scheme }
//     source { doc "urn:oiml:pub:b:18:2025" clause "5.5.1" }
//   }
// ─────────────────────────────────────────────────────────────────────

import type { Dumper, Parser } from '../types';
import {
  escapeString,
  stripWrapping,
  tokenizePackage,
  unwrapBlock,
} from '../tokenize';
import { forEachEntry } from '../parse-block';
import { dumpBareSafe, readSource } from './field-parser';
import DeclarationKind, {
  DeclarationContentSlot,
  DeclarationGate,
  DeclarationStatus,
} from '../../types/Declaration';

function parseContentSlot(id: string, block: string): DeclarationContentSlot {
  const slot: DeclarationContentSlot = { id, clause: '', description: '' };
  forEachEntry(
    block,
    (keyword, value) => {
      if (keyword === 'clause') {
        slot.clause = stripWrapping(value());
      } else if (keyword === 'description') {
        slot.description = stripWrapping(value());
      } else {
        return false;
      }
      return true;
    },
    { construct: 'declaration_kind content', id },
  );
  return slot;
}

export const parseDeclarationKind: Parser = (id: string, data: string) => {
  const kind: DeclarationKind = {
    id,
    label: '',
    holder: '',
    clause: '',
    procedure: '',
    definition: '',
    scope_model: '',
    scheme_a_obligation: '',
    content: [],
    source: { doc: '', clause: '' },
  };

  // `content <id> { … }` is a two-token facet (the slot id, then the
  // block) — the same shape as participant_kind's `subkind`.
  forEachEntry(
    data,
    (keyword, value, peek) => {
      if (keyword === 'label') {
        kind.label = stripWrapping(value());
      } else if (keyword === 'holder') {
        kind.holder = stripWrapping(value());
      } else if (keyword === 'clause') {
        kind.clause = stripWrapping(value());
      } else if (keyword === 'procedure') {
        kind.procedure = stripWrapping(value());
      } else if (keyword === 'definition') {
        kind.definition = stripWrapping(value());
      } else if (keyword === 'scope_model') {
        kind.scope_model = stripWrapping(value());
      } else if (keyword === 'scheme_a_obligation') {
        kind.scheme_a_obligation = stripWrapping(value());
      } else if (keyword === 'content') {
        const slotId = stripWrapping(value());
        const head = peek();
        if (head === undefined || !head.startsWith('{')) {
          throw new Error(
            `Parsing error: declaration_kind. ID ${id}: content ${slotId} is missing its block`,
          );
        }
        kind.content.push(parseContentSlot(slotId, unwrapBlock(value())));
      } else if (keyword === 'source') {
        kind.source = readSource(unwrapBlock(value()));
      } else {
        return false;
      }
      return true;
    },
    { construct: 'declaration_kind', id },
  );

  return ctx => {
    ctx.declarationKinds[id] = kind;
    return ctx;
  };
};

function dumpContentSlot(s: DeclarationContentSlot): string {
  let out = '  content ' + dumpBareSafe(s.id) + ' {\n';
  if (s.clause) {
    out += '    clause "' + escapeString(s.clause) + '"\n';
  }
  if (s.description) {
    out += '    description "' + escapeString(s.description) + '"\n';
  }
  out += '  }\n';
  return out;
}

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

export const dumpDeclarationKind: Dumper<DeclarationKind> = function (k) {
  let out: string = 'declaration_kind ' + k.id + ' {\n';
  if (k.label) {
    out += '  label "' + escapeString(k.label) + '"\n';
  }
  if (k.holder) {
    out += '  holder ' + dumpBareSafe(k.holder) + '\n';
  }
  if (k.clause) {
    out += '  clause "' + escapeString(k.clause) + '"\n';
  }
  if (k.procedure) {
    out += '  procedure "' + escapeString(k.procedure) + '"\n';
  }
  if (k.definition) {
    out += '  definition "' + escapeString(k.definition) + '"\n';
  }
  if (k.scope_model) {
    out += '  scope_model ' + dumpBareSafe(k.scope_model) + '\n';
  }
  if (k.scheme_a_obligation) {
    out +=
      '  scheme_a_obligation "' + escapeString(k.scheme_a_obligation) + '"\n';
  }
  for (const s of k.content) {
    out += dumpContentSlot(s);
  }
  if (k.source.doc || k.source.clause) {
    out += dumpSourceBlock(k.source);
  }
  out += '}\n';
  return out;
};

export const parseDeclarationStatus: Parser = (id: string, data: string) => {
  const status: DeclarationStatus = { id, description: '' };
  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'description') {
        status.description = stripWrapping(value());
      } else {
        return false;
      }
      return true;
    },
    { construct: 'declaration_status', id },
  );
  return ctx => {
    ctx.declarationStatuses[id] = status;
    return ctx;
  };
};

export const dumpDeclarationStatus: Dumper<DeclarationStatus> = function (s) {
  let out: string = 'declaration_status ' + s.id + ' {\n';
  if (s.description) {
    out += '  description "' + escapeString(s.description) + '"\n';
  }
  out += '}\n';
  return out;
};

export const parseDeclarationGate: Parser = (id: string, data: string) => {
  const gate: DeclarationGate = {
    id,
    clause: '',
    statement: '',
    holder: '',
    declaration: '',
    blocks: [],
    blocks_note: '',
    scope_checked: [],
    source: { doc: '', clause: '' },
  };
  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'clause') {
        gate.clause = stripWrapping(value());
      } else if (keyword === 'statement') {
        gate.statement = stripWrapping(value());
      } else if (keyword === 'holder') {
        gate.holder = stripWrapping(value());
      } else if (keyword === 'declaration') {
        gate.declaration = stripWrapping(value());
      } else if (keyword === 'blocks') {
        gate.blocks = tokenizePackage(unwrapBlock(value())).filter(
          s => s.length > 0,
        );
      } else if (keyword === 'blocks_note') {
        gate.blocks_note = stripWrapping(value());
      } else if (keyword === 'scope_checked') {
        gate.scope_checked = tokenizePackage(unwrapBlock(value())).filter(
          s => s.length > 0,
        );
      } else if (keyword === 'source') {
        gate.source = readSource(unwrapBlock(value()));
      } else {
        return false;
      }
      return true;
    },
    { construct: 'declaration_gate', id },
  );
  return ctx => {
    ctx.declarationGates[id] = gate;
    return ctx;
  };
};

export const dumpDeclarationGate: Dumper<DeclarationGate> = function (g) {
  let out: string = 'declaration_gate ' + g.id + ' {\n';
  if (g.clause) {
    out += '  clause "' + escapeString(g.clause) + '"\n';
  }
  if (g.statement) {
    out += '  statement "' + escapeString(g.statement) + '"\n';
  }
  if (g.holder) {
    out += '  holder ' + dumpBareSafe(g.holder) + '\n';
  }
  if (g.declaration) {
    out += '  declaration ' + dumpBareSafe(g.declaration) + '\n';
  }
  if (g.blocks.length > 0) {
    out += '  blocks { ' + g.blocks.map(dumpBareSafe).join(' ') + ' }\n';
  }
  if (g.blocks_note) {
    out += '  blocks_note "' + escapeString(g.blocks_note) + '"\n';
  }
  if (g.scope_checked.length > 0) {
    out +=
      '  scope_checked { ' +
      g.scope_checked.map(dumpBareSafe).join(' ') +
      ' }\n';
  }
  if (g.source.doc || g.source.clause) {
    out += dumpSourceBlock(g.source);
  }
  out += '}\n';
  return out;
};

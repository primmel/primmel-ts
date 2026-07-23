// ─────────────────────────────────────────────────────────────────────
// Twin interface constructs (Primmel v3, TODO.roadmap/32 — doctrine
// ch. 14 §14.4, concept doc §10.2–10.3).
//
// The endpoint/serve grammar (nested in the subject anatomy, §14.11):
//
//   subject LoadCellModel {
//     is {
//       endpoint lc500_api {
//         operation get_indication {
//           kind query
//           serves indication
//           payload { quantity_kind mass unit kg timestamp true }
//         }
//         operation watch_state {
//           kind subscribe
//           serves state, environmental_context
//           payload { quantity_kind state unit 1 timestamp true }
//         }
//         operation run_self_test {
//           kind invoke
//           does self_test
//           payload { quantity_kind diagnostic_report unit 1 timestamp true }
//         }
//         access {
//           public { get_indication }
//           registered { watch_state }
//           authority { run_self_test }
//         }
//         profile rest_json
//       }
//     }
//     has {
//       serve sample.test_context.d_min via get_indication { fresh_within 5s }
//       serve sample.state via watch_state { fresh_within 1s }
//     }
//   }
//
// …plus the foundations-level connector-profile registry construct:
//
//   connector_profile bacnet {
//     protocol "BACnet/IP"
//     description "Building-automation profile added by a package (OCP)."
//   }
//
// Surface-syntax notes (deviations from the docs chapter's illustrative
// sketch, §14.4/§14.11 — the chapter is the spec for SEMANTICS, not for
// delimiters):
//   - access lists are `{ … }` blocks, not the sketch's `[ … ]` — PRL id
//     lists are brace-delimited everywhere (verified_by { … }, targets
//     { … }, links { … });
//   - an operation's serves/does names read as a comma- or
//     space-separated stream up to the next operation keyword (kind |
//     serves | does | payload) — the sketch's bare form; the dump emits
//     the unambiguous block form `serves { … }`.
//
// The endpoint/serve parsers are CONSUMED BY subject.ts (the anatomy
// slots is.endpoints / has.serves); this module owns the grammar so the
// subject ser-des stays a dispatcher. Round-trip: both forms re-parse to
// the same model — the fixpoint is proven in test/twin-interface.test.ts.
// ─────────────────────────────────────────────────────────────────────

import tokenize from '../tokenize';
import {
  escapeString,
  stripWrapping,
  tokenizePackage,
  unwrapBlock,
} from '../tokenize';
import { dumpBareSafe, stripColon } from './field-parser';
import type { ConstructDefinition } from './index';
import type {
  ConnectorProfile,
  Endpoint,
  EndpointAccessScope,
  EndpointOperation,
  ServeBinding,
} from '../../types/Twin';
import { ENDPOINT_ACCESS_SCOPES } from '../../types/Twin';

// ── endpoint (is-slot) ───────────────────────────────────────────────

/** Operation-block keywords that terminate a serves/does name stream. */
const OPERATION_KEYWORDS = new Set(['kind', 'serves', 'does', 'payload']);

/** Read a comma- or space-separated name stream: `{ a b }` block form, or
 *  bare tokens up to the next operation keyword / end of block. */
function readNameStream(
  t: string[],
  i: number,
): { names: string[]; next: number } {
  const first = t[i] ?? '';
  if (first.startsWith('{')) {
    const names = tokenize(unwrapBlock(first))
      .flatMap(s => s.split(','))
      .map(s => stripWrapping(s.trim()))
      .filter(s => s.length > 0);
    return { names, next: i + 1 };
  }
  const names: string[] = [];
  let j = i;
  while (
    j < t.length &&
    !OPERATION_KEYWORDS.has(t[j]) &&
    !t[j].startsWith('{')
  ) {
    for (const part of t[j].split(',')) {
      const name = stripWrapping(part.trim());
      if (name) {
        names.push(name);
      }
    }
    j++;
  }
  return { names, next: j };
}

/** Parse one `operation <name> { … }` block (the block is already unwrapped). */
function parseOperation(name: string, block: string): EndpointOperation {
  const op: EndpointOperation = {
    name,
    kind: '',
    serves: [],
    does: [],
    payload: null,
  };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i > t.length) {
      break;
    }
    if (cmd === 'kind') {
      op.kind = stripWrapping(t[i++] ?? '');
    } else if (cmd === 'serves') {
      const read = readNameStream(t, i);
      op.serves = read.names;
      i = read.next;
    } else if (cmd === 'does') {
      const read = readNameStream(t, i);
      op.does = read.names;
      i = read.next;
    } else if (cmd === 'payload') {
      const inner = tokenize(unwrapBlock(t[i++] ?? ''));
      const payload = { quantityKind: '', unit: '', timestamp: false };
      let j = 0;
      while (j < inner.length) {
        const field = stripColon(inner[j++]);
        if (j >= inner.length) {
          break;
        }
        if (field === 'quantity_kind') {
          payload.quantityKind = stripWrapping(inner[j++]);
        } else if (field === 'unit') {
          payload.unit = stripWrapping(inner[j++]);
        } else if (field === 'timestamp') {
          payload.timestamp = stripWrapping(inner[j++]) === 'true';
        } else {
          unwrapBlock(inner[j++]);
        }
      }
      op.payload = payload;
    } else {
      unwrapBlock(t[i++] ?? '');
    }
  }
  return op;
}

/** Parse the `access { <scope> { ops… } … }` block (already unwrapped). */
function parseAccess(block: string): Endpoint['access'] {
  const access: Endpoint['access'] = {};
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const scope = stripColon(t[i++]) as EndpointAccessScope;
    if (!scope) {
      break;
    }
    if (i < t.length && t[i].startsWith('{')) {
      const ops = tokenize(unwrapBlock(t[i++]))
        .map(s => stripWrapping(s))
        .filter(s => s.length > 0);
      access[scope] = [...(access[scope] ?? []), ...ops];
    }
    // An unknown scope name is kept on parse (the linter's C62 flags it) —
    // the model records what the author wrote, the linter judges.
  }
  return access;
}

/**
 * Parse one `endpoint <id> { … }` entry of a subject's is-block. `block`
 * is the already-unwrapped endpoint body. Unknown keywords are skipped
 * (forward compatibility).
 */
export function parseEndpoint(id: string, block: string): Endpoint {
  const endpoint: Endpoint = { id, operations: [], access: {}, profile: '' };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i > t.length) {
      break;
    }
    if (cmd === 'operation') {
      const name = stripColon(t[i++] ?? '');
      const body = i < t.length ? unwrapBlock(t[i++]) : '';
      if (name) {
        endpoint.operations.push(parseOperation(name, body));
      }
    } else if (cmd === 'access') {
      endpoint.access = parseAccess(unwrapBlock(t[i++] ?? ''));
    } else if (cmd === 'profile') {
      endpoint.profile = stripWrapping(t[i++] ?? '');
    } else {
      unwrapBlock(t[i++] ?? '');
    }
  }
  return endpoint;
}

/** Dump one operation block (single-line — the fields are all short). */
function dumpOperation(op: EndpointOperation, indent: string): string {
  let out = indent + 'operation ' + dumpBareSafe(op.name) + ' {';
  if (op.kind) {
    out += ' kind ' + dumpBareSafe(op.kind);
  }
  if (op.serves.length > 0) {
    out += ' serves { ' + op.serves.map(dumpBareSafe).join(' ') + ' }';
  }
  if (op.does.length > 0) {
    out += ' does { ' + op.does.map(dumpBareSafe).join(' ') + ' }';
  }
  if (op.payload) {
    out +=
      ' payload { quantity_kind ' +
      dumpBareSafe(op.payload.quantityKind) +
      ' unit ' +
      dumpBareSafe(op.payload.unit) +
      ' timestamp ' +
      (op.payload.timestamp ? 'true' : 'false') +
      ' }';
  }
  return out + ' }\n';
}

/** Dump one endpoint as `endpoint <id> { … }` at the given indent. */
export function dumpEndpoint(e: Endpoint, indent: string): string {
  let out = indent + 'endpoint ' + dumpBareSafe(e.id) + ' {\n';
  for (const op of e.operations) {
    out += dumpOperation(op, indent + '  ');
  }
  const scopes = ENDPOINT_ACCESS_SCOPES.filter(
    s => (e.access[s] ?? []).length > 0,
  );
  const unknownScopes = Object.keys(e.access).filter(
    s => !(ENDPOINT_ACCESS_SCOPES as readonly string[]).includes(s),
  );
  if (scopes.length + unknownScopes.length > 0) {
    out += indent + '  access {';
    for (const s of [...scopes, ...unknownScopes]) {
      out +=
        ' ' +
        s +
        ' { ' +
        (e.access[s as EndpointAccessScope] ?? []).map(dumpBareSafe).join(' ') +
        ' }';
    }
    out += ' }\n';
  }
  if (e.profile) {
    out += indent + '  profile ' + dumpBareSafe(e.profile) + '\n';
  }
  return out + indent + '}\n';
}

// ── serve (has-slot) ─────────────────────────────────────────────────

/**
 * Read one `serve <aspect> via <operation> [{ fresh_within <duration> }]`
 * entry of a subject's has-block. `t[i]` is the token AFTER the `serve`
 * keyword; returns the binding and the next unconsumed index. A missing
 * `via`/operation or freshness block parses as empty fields — the linter
 * (C60/C63) reports them; the parser stays total.
 */
export function parseServeEntry(
  t: string[],
  i: number,
): { binding: ServeBinding; next: number } {
  const binding: ServeBinding = { aspect: '', via: '', freshWithin: '' };
  binding.aspect = stripWrapping(t[i++] ?? '');
  if (t[i] === 'via') {
    i++;
    binding.via = stripWrapping(t[i++] ?? '');
  }
  if (i < t.length && t[i].startsWith('{')) {
    const inner = tokenize(unwrapBlock(t[i++]));
    let j = 0;
    while (j < inner.length) {
      const cmd = inner[j++];
      if (j >= inner.length) {
        break;
      }
      if (cmd === 'fresh_within') {
        binding.freshWithin = stripWrapping(inner[j++]);
      } else {
        unwrapBlock(inner[j++]);
      }
    }
  }
  return { binding, next: i };
}

/** Dump one serve entry (block form only when a freshness window is set —
 *  both forms re-parse to the same model). */
export function dumpServe(b: ServeBinding, indent: string): string {
  let out =
    indent + 'serve ' + dumpBareSafe(b.aspect) + ' via ' + dumpBareSafe(b.via);
  if (b.freshWithin) {
    out += ' { fresh_within ' + dumpBareSafe(b.freshWithin) + ' }';
  }
  return out + '\n';
}

// ── connector_profile (foundations registry) ─────────────────────────

const parseConnectorProfile: ConstructDefinition['parse'] = function (
  id,
  data,
) {
  const result: ConnectorProfile = {
    id,
    protocol: '',
    description: '',
    referenceIds: [],
  };
  const t = tokenizePackage(data);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'protocol') {
      result.protocol = stripWrapping(t[i++]);
    } else if (cmd === 'description') {
      result.description = stripWrapping(t[i++]);
    } else if (cmd === 'reference') {
      result.referenceIds = tokenize(unwrapBlock(t[i++]))
        .map(s => stripWrapping(s))
        .filter(s => s.length > 0);
    } else {
      unwrapBlock(t[i++]);
    }
  }
  return ctx => {
    ctx.connectorProfiles[id] = result;
    return ctx;
  };
};

const dumpConnectorProfile = function (p: ConnectorProfile): string {
  let out = 'connector_profile ' + p.id + ' {\n';
  if (p.protocol) {
    out += '  protocol "' + escapeString(p.protocol) + '"\n';
  }
  if (p.description) {
    out += '  description "' + escapeString(p.description) + '"\n';
  }
  if (p.referenceIds.length > 0) {
    out += '  reference { ' + p.referenceIds.join(' ') + ' }\n';
  }
  out += '}\n';
  return out;
};

export const connectorProfileConstruct = {
  keyword: 'connector_profile',
  field: 'connectorProfiles',
  takesID: true,
  parse: parseConnectorProfile,
  dump: dumpConnectorProfile,
} as const;

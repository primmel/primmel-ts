// ─────────────────────────────────────────────────────────────────────
// The composition facet construct (TODO.integration/14 — types/
// Composition.ts): `composed_of` nested in the subject anatomy
// (is.composedOf). Consumed BY subject.ts (the anatomy dispatcher),
// exactly like twin.ts's endpoint/serve grammars.
//
// Grammar:
//
//   composed_of {
//     component analyzer {
//       product acme-cgm-200@2026
//       endpoint cgm_api
//       serial "CGM200-DEMO-0001"
//       certificate null
//     }
//     decomposition {
//       sample.indication_co -> analyzer.indication_co
//       sample.test_context.flow -> sample_line.flow
//       sample.state -> rule any_fault_else_analyzer
//     }
//     revision 1
//   }
//
// Round-trip: the dump emits the canonical multi-line form; both the
// authored and dumped forms re-parse to the same model.
// ─────────────────────────────────────────────────────────────────────

import tokenize from '../tokenize';
import {
  escapeString,
  stripWrapping,
  tokenizePackage,
  unwrapBlock,
} from '../tokenize';
import { dumpBareSafe } from './field-parser';
import type {
  CompositionComponent,
  CompositionDecl,
  DecompositionEntry,
} from '../../types/Composition';

function parseComponent(id: string, block: string): CompositionComponent {
  const component: CompositionComponent = {
    id,
    product: '',
    endpoint: '',
    serial: '',
    certificate: null,
  };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (cmd === 'product') {
      component.product = stripWrapping(t[i++] ?? '');
    } else if (cmd === 'endpoint') {
      component.endpoint = stripWrapping(t[i++] ?? '');
    } else if (cmd === 'serial') {
      component.serial = stripWrapping(t[i++] ?? '');
    } else if (cmd === 'certificate') {
      const v = stripWrapping(t[i++] ?? '');
      component.certificate = v === 'null' ? null : v;
    } else {
      unwrapBlock(t[i++] ?? '');
    }
  }
  return component;
}

function parseDecomposition(block: string): DecompositionEntry[] {
  const entries: DecompositionEntry[] = [];
  // <register> -> <component>.<register> | rule <rule-id> — one per line.
  for (const rawLine of block.split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    const ruleMatch = /^(\S+)\s*->\s*rule\s+(\S+)\s*$/.exec(line);
    if (ruleMatch) {
      entries.push({
        register: ruleMatch[1]!,
        component: 'composite',
        rule: ruleMatch[2],
      });
      continue;
    }
    const m = /^(\S+)\s*->\s*(\S+)\.(\S+)\s*$/.exec(line);
    if (m) {
      entries.push({
        register: m[1]!,
        component: m[2]!,
        componentRegister: m[3],
      });
    }
    // Unparseable lines drop silently — the linter reports a malformed
    // decomposition (the parser stays total).
  }
  return entries;
}

/** Parse the `composed_of { … }` block of a subject's is-anatomy. */
export function parseComposedOf(block: string): CompositionDecl {
  const decl: CompositionDecl = { components: [], decomposition: [] };
  const t = tokenizePackage(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (cmd === 'component') {
      const id = t[i++] ?? '';
      const body = i < t.length ? unwrapBlock(t[i++]) : '';
      if (id) {
        decl.components.push(parseComponent(id, body));
      }
    } else if (cmd === 'decomposition') {
      decl.decomposition = parseDecomposition(unwrapBlock(t[i++] ?? ''));
    } else if (cmd === 'revision') {
      const v = Number(t[i++] ?? '');
      if (Number.isFinite(v)) {
        decl.revision = v;
      }
    } else {
      unwrapBlock(t[i++] ?? '');
    }
  }
  return decl;
}

/** Dump one component as `component <id> { … }` at the given indent. */
function dumpComponent(c: CompositionComponent, indent: string): string {
  let out = indent + 'component ' + dumpBareSafe(c.id) + ' {\n';
  out += indent + '  product ' + dumpBareSafe(c.product) + '\n';
  out += indent + '  endpoint ' + dumpBareSafe(c.endpoint) + '\n';
  out += indent + '  serial ' + escapeString(c.serial) + '\n';
  out +=
    indent +
    '  certificate ' +
    (c.certificate === null ? 'null' : escapeString(c.certificate)) +
    '\n';
  return out + indent + '}\n';
}

/** Dump the `composed_of { … }` block at the given indent. */
export function dumpComposedOf(decl: CompositionDecl, indent: string): string {
  let out = indent + 'composed_of {\n';
  for (const c of decl.components) {
    out += dumpComponent(c, indent + '  ');
  }
  if (decl.decomposition.length > 0) {
    out += indent + '  decomposition {\n';
    for (const e of decl.decomposition) {
      out +=
        indent +
        '    ' +
        dumpBareSafe(e.register) +
        ' -> ' +
        (e.component === 'composite'
          ? 'rule ' + dumpBareSafe(e.rule ?? '')
          : dumpBareSafe(e.component) +
            '.' +
            dumpBareSafe(e.componentRegister ?? '')) +
        '\n';
    }
    out += indent + '  }\n';
  }
  if (decl.revision !== undefined) {
    out += indent + '  revision ' + String(decl.revision) + '\n';
  }
  return out + indent + '}\n';
}

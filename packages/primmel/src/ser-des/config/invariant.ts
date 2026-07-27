// ─────────────────────────────────────────────────────────────────────
// `invariant` construct (smart gap-close E9,
// analysis/architecture-gaps-2026-07.md; the smart doctrine
// docs/oiml-core/09-invariants.md): a named architecture invariant of
// the platform — the first-class replacement for the note-family
// encoding (pipe-delimited structure inside a note's message string):
//
//   invariant INV-1 {
//     name "No bare numbers"
//     statement "every physical quantity is a QuantityValue (value + unit [+ uncertainty])."
//     severity error
//     applies_to { QuantityValue }
//     source "docs/oiml-core/09-invariants.md#9.2"
//     enforcement { kernel:C32 kernel:C33 linker:quantity-coherence gate:schema-quantity-value }
//   }
//
//   invariant INV-99 {
//     name "…"
//     statement "…"
//     severity notice
//     enforcement aspirational
//   }
//
// Surface-syntax notes (the passport construct's conventions,
// ser-des/config/passport.ts):
//   - list facets are `{ … }` blocks; `,` and `;` are optional noise;
//   - `enforcement aspirational` (the bare token) is the marker; any
//     braced value is a claims list — `{ aspirational }` is a claims
//     list containing the marker token, which the linter's C91 flags
//     (never mixed);
//   - the parser stays TOTAL: missing facets land as ''/[] and the
//     linter (C90/C91) judges the shape — unknown keywords stay ignored
//     (forward compatibility for newer facets);
//   - name/statement/severity are scalar facets; statement is the
//     package-default spelling's value inline, alternates ride the ISO
//     24229 `text <id>.statement` blocks (TODO.roadmap/25).
//
// Round-trip: the dump emits the canonical form — scalars first
// (name, statement, severity), then applies_to, source, and the
// enforcement (marker line, or one claims block; a malformed both-set
// model dumps the marker line AND the claims block so the re-parse
// reproduces it exactly) — the fixpoint is proven in
// test/invariant.test.ts.
// ─────────────────────────────────────────────────────────────────────

import { escapeString, stripWrapping } from '../tokenize';
import { forEachEntry } from '../parse-block';
import { dumpBareSafe, readEntryTokens } from './field-parser';
import type { ConstructDefinition } from './index';
import type { Invariant } from '../../types/Invariant';

const parseInvariant: ConstructDefinition['parse'] = function (id, data) {
  const invariant: Invariant = {
    id,
    name: '',
    statement: '',
    severity: '',
    appliesTo: [],
    source: '',
    enforcement: { aspirational: false, claims: [] },
  };

  forEachEntry(
    data,
    (command, value) => {
      if (command === 'name') {
        invariant.name = stripWrapping(value());
      } else if (command === 'statement') {
        invariant.statement = stripWrapping(value());
      } else if (command === 'severity') {
        invariant.severity = stripWrapping(value());
      } else if (command === 'applies_to') {
        invariant.appliesTo.push(...readEntryTokens(value()));
      } else if (command === 'source') {
        // Always quoted on dump (a doc path carries `#` — the comment
        // character); stripWrapping consumes either spelling.
        invariant.source = stripWrapping(value());
      } else if (command === 'enforcement') {
        // The value thunk consumes a token per call — read it ONCE. The
        // bare token `aspirational` is the marker; anything else (one
        // bare claim, or a `{ … }` block) is a claims list. Repeated
        // facets accumulate so the linter sees a both-set declaration
        // (C90) instead of the parser silently picking one.
        const v = value();
        if (!v.startsWith('{') && stripWrapping(v) === 'aspirational') {
          invariant.enforcement.aspirational = true;
        } else {
          invariant.enforcement.claims.push(...readEntryTokens(v));
        }
      } else {
        return false;
      }
      return true;
    },
    { construct: 'invariant', id },
  );

  return ctx => {
    ctx.invariants[id] = invariant;
    return ctx;
  };
};

// ── dump (canonical form) ────────────────────────────────────────────

const dumpInvariant = function (inv: Invariant): string {
  let out = 'invariant ' + inv.id + ' {\n';
  if (inv.name !== '') {
    out += '  name "' + escapeString(inv.name) + '"\n';
  }
  if (inv.statement !== '') {
    out += '  statement "' + escapeString(inv.statement) + '"\n';
  }
  if (inv.severity !== '') {
    out += '  severity ' + dumpBareSafe(inv.severity) + '\n';
  }
  if (inv.appliesTo.length > 0) {
    out +=
      '  applies_to { ' + inv.appliesTo.map(dumpBareSafe).join(' ') + ' }\n';
  }
  if (inv.source !== '') {
    // Quoted ALWAYS: the doc path + anchor carries `#` — the tokenizer's
    // comment character — so a bare emission would not re-parse.
    out += '  source "' + escapeString(inv.source) + '"\n';
  }
  if (inv.enforcement.aspirational) {
    out += '  enforcement aspirational\n';
  }
  if (inv.enforcement.claims.length > 0) {
    out +=
      '  enforcement { ' +
      inv.enforcement.claims.map(dumpBareSafe).join(' ') +
      ' }\n';
  }
  out += '}\n';
  return out;
};

export const invariantConstruct = {
  keyword: 'invariant',
  field: 'invariants',
  takesID: true,
  parse: parseInvariant,
  dump: dumpInvariant,
} as const;

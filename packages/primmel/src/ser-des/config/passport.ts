// ─────────────────────────────────────────────────────────────────────
// `passport` construct (Primmel v3, TODO.roadmap/35 — doctrine ch. 14
// §14.6, ch. 15 §15.6, grammar sketch §15.8): the model-native Digital
// Product Passport — a named, access-classed projection of the product
// model + live instance state, declared on a product reference package:
//
//   passport lc500_passport {
//     upi { pattern upi:acme:lc500 level model }
//     carrier { kind qr payload "https://passport.acme.example/passport/upi:acme:lc500.json" }
//     public { identity composition promises_as_verified }
//     restricted { composition.internal_materials }
//     authority { live_compliance_status artifacts.type_evaluation_dossier }
//   }
//
// Surface-syntax notes (deviations from the §15.8 sketch — the chapter
// is the spec for SEMANTICS, not for delimiters; the convention the twin
// constructs established, ser-des/config/twin.ts + monitor.ts headers):
//   - the sketch's `identifier upi:acme:lc500` head facet parses as the
//     UPI pattern with no level — the canonical form is the
//     `upi { pattern … level … }` block (ESPR demands the level:
//     model | batch | item; the linter's C88 flags the sketch spelling);
//   - the sketch's comma-separated entry lists
//     (`public { identity, composition, … }`) parse identically to the
//     canonical whitespace form — `,` and `;` are optional noise;
//   - a content entry is `<class>` (the whole class) or
//     `<class>.<ref>` (one aspect/promise/artifact — the ref may itself
//     contain dots, e.g. an attribute path; the split is on the FIRST
//     dot);
//   - the access vocabulary is FAIL-CLOSED (task-35 review): an unknown
//     block-valued keyword (`restriced { … }`) is a parse-time error —
//     a misspelled access class must never parse into entries no class
//     serves. Unknown non-block keywords stay ignored (forward
//     compatibility for scalar facets).
//
// Round-trip: the dump emits the canonical form — entries grouped by
// access class (public, restricted, authority, then unknown classes in
// first-seen order), each class one line; the sketch spellings re-parse
// to the same model — the fixpoint is proven in test/passport.test.ts.
// ─────────────────────────────────────────────────────────────────────

import { stripWrapping, tokenizePackage, unwrapBlock } from '../tokenize';
import { forEachEntry } from '../parse-block';
import { dumpBareSafe } from './field-parser';
import type { ConstructDefinition } from './index';
import {
  PASSPORT_ACCESS_CLASSES,
  type Passport,
  type PassportCarrier,
  type PassportContentEntry,
} from '../../types/Passport';

/** Strip the sketch's optional `;` separators from a sub-block stream. */
function subBlockTokens(block: string): string[] {
  return tokenizePackage(block)
    .map(s => s.replace(/^;+|;+$/g, ''))
    .filter(s => s.length > 0);
}

/** Read a content-entry token stream: `{ a b }` block, or a single bare
 *  entry. Commas are optional noise (the §15.8 sketch spelling). */
function readEntryTokens(value: string): string[] {
  if (value.startsWith('{')) {
    return subBlockTokens(unwrapBlock(value))
      .flatMap(s => s.split(','))
      .map(s => stripWrapping(s.trim()))
      .filter(s => s.length > 0);
  }
  const single = stripWrapping(value);
  return single === '' ? [] : [single];
}

/**
 * Parse one access-class value (the `{ … }` block token, or a single bare
 * entry) into content entries. The split is on the FIRST dot: `<class>`
 * or `<class>.<ref>` — the ref may itself contain dots (an attribute
 * path such as `composition.sample.test_context.indication`).
 */
function parseEntries(access: string, value: string): PassportContentEntry[] {
  return readEntryTokens(value).map(token => {
    const dot = token.indexOf('.');
    return dot === -1
      ? { access, contentClass: token, ref: '' }
      : {
          access,
          contentClass: token.slice(0, dot),
          ref: token.slice(dot + 1),
        };
  });
}

const parsePassport: ConstructDefinition['parse'] = function (id, data) {
  const passport: Passport = {
    id,
    upi: { pattern: '', level: '' },
    carriers: [],
    entries: [],
    referenceIds: [],
  };

  forEachEntry(
    data,
    (command, value) => {
      if (command === 'upi') {
        // upi { pattern <token> level <model|batch|item> }
        forEachEntry(
          unwrapBlock(value()),
          (facet, facetValue) => {
            if (facet === 'pattern') {
              passport.upi.pattern = stripWrapping(facetValue());
            } else if (facet === 'level') {
              passport.upi.level = stripWrapping(facetValue());
            } else {
              return false;
            }
            return true;
          },
          { construct: 'passport.upi', id },
        );
      } else if (command === 'identifier') {
        // The §15.8 sketch spelling: `identifier upi:acme:lc500` — the
        // bare UPI pattern with no level (C88 flags the missing level).
        passport.upi.pattern = stripWrapping(value());
      } else if (command === 'carrier') {
        // carrier { kind <token> payload <endpoint-url> }
        const carrier: PassportCarrier = { kind: '', payload: '' };
        forEachEntry(
          unwrapBlock(value()),
          (facet, facetValue) => {
            if (facet === 'kind') {
              carrier.kind = stripWrapping(facetValue());
            } else if (facet === 'payload') {
              carrier.payload = stripWrapping(facetValue());
            } else {
              return false;
            }
            return true;
          },
          { construct: 'passport.carrier', id },
        );
        passport.carriers.push(carrier);
      } else if (command === 'reference') {
        passport.referenceIds = readEntryTokens(value());
      } else {
        // The value thunk consumes a token per call — read it ONCE. An
        // access-class block or bare entry must name one of the three
        // DECLARED access classes: an unknown block-valued keyword is a
        // parse-time error — FAIL-CLOSED (task-35 review, Minor 4): a
        // misspelled access class (`restriced { … }`) must never parse
        // into entries no class serves (a leak could hide behind the
        // typo). Unknown NON-block keywords stay ignored (forward
        // compatibility for scalar facets; a typo'd `identifier`/`upi`
        // is still caught — C88 fires on the missing pattern).
        const v = value();
        if ((PASSPORT_ACCESS_CLASSES as readonly string[]).includes(command)) {
          passport.entries.push(...parseEntries(command, v));
        } else if (v.startsWith('{')) {
          throw new Error(
            `Parsing error: passport. ID ${id}: unknown access class "${command}" — access classes are ${PASSPORT_ACCESS_CLASSES.join(' | ')} (fail-closed: an unknown access class is never served)`,
          );
        }
      }
      return true;
    },
    { construct: 'passport', id },
  );

  return ctx => {
    ctx.passports[id] = passport;
    return ctx;
  };
};

// ── dump (canonical form) ────────────────────────────────────────────

function dumpEntry(entry: PassportContentEntry): string {
  return dumpBareSafe(
    entry.ref === ''
      ? entry.contentClass
      : entry.contentClass + '.' + entry.ref,
  );
}

const dumpPassport = function (p: Passport): string {
  let out = 'passport ' + p.id + ' {\n';
  if (p.upi.pattern !== '' || p.upi.level !== '') {
    out += '  upi {';
    if (p.upi.pattern !== '') {
      out += ' pattern ' + dumpBareSafe(p.upi.pattern);
    }
    if (p.upi.level !== '') {
      out += ' level ' + dumpBareSafe(p.upi.level);
    }
    out += ' }\n';
  }
  for (const c of p.carriers) {
    out +=
      '  carrier { kind ' +
      dumpBareSafe(c.kind) +
      ' payload ' +
      dumpBareSafe(c.payload) +
      ' }\n';
  }
  // Entries grouped by access class: the three declared classes in
  // canonical order, then any unknown access tokens in first-seen order.
  const accessOrder = [
    ...PASSPORT_ACCESS_CLASSES,
    ...[...new Set(p.entries.map(e => e.access))].filter(
      a => !(PASSPORT_ACCESS_CLASSES as readonly string[]).includes(a),
    ),
  ];
  for (const access of accessOrder) {
    const entries = p.entries.filter(e => e.access === access);
    if (entries.length > 0) {
      out += '  ' + access + ' { ' + entries.map(dumpEntry).join(' ') + ' }\n';
    }
  }
  if (p.referenceIds.length > 0) {
    out +=
      '  reference { ' + p.referenceIds.map(dumpBareSafe).join(' ') + ' }\n';
  }
  out += '}\n';
  return out;
};

export const passportConstruct = {
  keyword: 'passport',
  field: 'passports',
  takesID: true,
  parse: parsePassport,
  dump: dumpPassport,
} as const;

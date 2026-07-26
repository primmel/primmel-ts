// ─────────────────────────────────────────────────────────────────────
// `text` construct (ISO 24229 multilinguality — TODO.roadmap/25,
// doctrine ch. 10 §10.6): the per-spelling ALTERNATES of one prose
// field, addressed `<element-id>.<field>`:
//
//   text /req/metrological/measuring-range-max.statement {
//     spell fra-Latn "La valeur de la plus grande charge …"
//     spell zho-Latn via BGN-PCGN:zho-Hans:Latn:1979 "…"
//   }
//
// The default spelling's value stays inline on the addressed element
// (`name "…"`); a `text` block never replaces it — it adds spellings.
// Code syntax is linter rule C89 (src/spelling.ts validates shape;
// register resolution is the consumer's vendored-snapshot discipline).
//
// The spell facet carries two value tokens (`<code>` then the quoted
// string, with an optional `via <system-code>` pair between), so the
// block walks tokens directly rather than pairwise (forEachEntry).
// ─────────────────────────────────────────────────────────────────────

import type { Dumper, Parser } from '../types';
import { escapeString, tokenizePackage, unescapeString } from '../tokenize';
import type TextContent from '../../types/Text';

export const parseText: Parser = function (id, data) {
  const result: TextContent = {
    id,
    entries: [],
  };

  const t = tokenizePackage(data);
  let i = 0;
  while (i < t.length) {
    const keyword = t[i++];
    if (keyword !== 'spell') {
      throw new Error(
        `Parsing error: text. ID ${id}: unknown facet "${keyword}" (a text block carries spell facets only)`,
      );
    }
    if (i >= t.length) {
      throw new Error(
        `Parsing error: text. ID ${id}: Expecting spelling code for spell`,
      );
    }
    const spelling = t[i++];
    let via: string | undefined;
    if (t[i] === 'via') {
      i++;
      if (i >= t.length) {
        throw new Error(
          `Parsing error: text. ID ${id}: Expecting conversion system code after via`,
        );
      }
      via = t[i++];
    }
    const raw = t[i++];
    if (
      raw === undefined ||
      raw.length < 2 ||
      raw.charAt(0) !== '"' ||
      raw.charAt(raw.length - 1) !== '"'
    ) {
      throw new Error(
        `Parsing error: text. ID ${id}: spell ${spelling} expects a quoted value — spell <code> [via <system-code>] "<value>"`,
      );
    }
    const entry = { spelling, value: unescapeString(raw.slice(1, -1)) };
    if (via !== undefined) {
      result.entries.push({ ...entry, via });
    } else {
      result.entries.push(entry);
    }
  }

  return ctx => {
    // Alternate spellings of one field may be split across files (a
    // package's l10n files) — merge into the one content set per path.
    const existing = ctx.texts[id];
    if (existing) {
      existing.entries.push(...result.entries);
    } else {
      ctx.texts[id] = result;
    }
    return ctx;
  };
};

export const dumpText: Dumper<TextContent> = function (t) {
  let out: string = 'text ' + t.id + ' {\n';
  for (const e of t.entries) {
    out +=
      '  spell ' +
      e.spelling +
      (e.via ? ' via ' + e.via : '') +
      ' "' +
      escapeString(e.value) +
      '"\n';
  }
  out += '}\n';
  return out;
};

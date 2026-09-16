// ─────────────────────────────────────────────────────────────────────
// `part_annex` construct (smart TODO.roadmap/40 batch 4; the packages-
// as-SSOT epic) — the rec's own annex-volume index (types/PartAnnex.ts
// carries the banner and the grammar sketch). The obligation vocabulary
// is parse-enforced (the fail-closed precedent); the letter-uniqueness
// and source-required legs are check-enforced (C128) — the codec stays
// total.
// ─────────────────────────────────────────────────────────────────────

import type { Dumper, Parser } from '../types';
import { escapeString, stripWrapping, unwrapBlock } from '../tokenize';
import { forEachEntry } from '../parse-block';
import { dumpBareSafe, readSource } from './field-parser';
import PartAnnex from '../../types/PartAnnex';

const PART_ANNEX_OBLIGATIONS = ['normative', 'informative'] as const;

export const parsePartAnnex: Parser = (id: string, data: string) => {
  const annex: PartAnnex = {
    id,
    letter: '',
    title: '',
    obligation: '',
    summary: '',
    realization: '',
    source: { doc: '', clause: '' },
  };

  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'letter') {
        annex.letter = stripWrapping(value());
      } else if (keyword === 'title') {
        annex.title = stripWrapping(value());
      } else if (keyword === 'obligation') {
        const obligation = stripWrapping(value());
        if (
          !(PART_ANNEX_OBLIGATIONS as readonly string[]).includes(obligation)
        ) {
          throw new Error(
            `Parsing error: part_annex. ID ${id}: Unknown obligation "${obligation}" (valid: ${PART_ANNEX_OBLIGATIONS.join(', ')})`,
          );
        }
        annex.obligation = obligation;
      } else if (keyword === 'summary') {
        annex.summary = stripWrapping(value());
      } else if (keyword === 'realization') {
        annex.realization = stripWrapping(value());
      } else if (keyword === 'source') {
        annex.source = readSource(unwrapBlock(value()));
      } else {
        return false;
      }
      return true;
    },
    { construct: 'part_annex', id },
  );

  return ctx => {
    ctx.partAnnexes[id] = annex;
    return ctx;
  };
};

export const dumpPartAnnex: Dumper<PartAnnex> = function (a) {
  let out: string = 'part_annex ' + a.id + ' {\n';
  if (a.letter) {
    out += '  letter "' + escapeString(a.letter) + '"\n';
  }
  if (a.title) {
    out += '  title "' + escapeString(a.title) + '"\n';
  }
  if (a.obligation) {
    out += '  obligation ' + dumpBareSafe(a.obligation) + '\n';
  }
  if (a.summary) {
    out += '  summary "' + escapeString(a.summary) + '"\n';
  }
  if (a.realization) {
    out += '  realization "' + escapeString(a.realization) + '"\n';
  }
  if (a.source.doc || a.source.clause) {
    out += '  source {\n';
    if (a.source.doc) {
      out += '    doc "' + escapeString(a.source.doc) + '"\n';
    }
    if (a.source.clause) {
      out += '    clause "' + escapeString(a.source.clause) + '"\n';
    }
    out += '  }\n';
  }
  out += '}\n';
  return out;
};

// ─────────────────────────────────────────────────────────────────────
// `evaluation_profile` construct (smart TODO.roadmap/40 batch 3; the
// packages-as-SSOT epic) — the named dimension-value presets
// (types/EvaluationProfile.ts carries the banner and the grammar
// sketch). The dimensions map is open-keyed (no schema lock-in); the
// key/value resolution is check-enforced (C135) — the codec stays
// total.
// ─────────────────────────────────────────────────────────────────────

import type { Dumper, Parser } from '../types';
import tokenize, {
  escapeString,
  stripWrapping,
  unwrapBlock,
} from '../tokenize';
import { forEachEntry } from '../parse-block';
import { dumpBareSafe, stripColon } from './field-parser';
import EvaluationProfile from '../../types/EvaluationProfile';

export const parseEvaluationProfile: Parser = (id: string, data: string) => {
  const profile: EvaluationProfile = { id, dimensions: {}, description: '' };

  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'dimensions') {
        // The open dimension-keyed map: alternating key/value tokens. A
        // set-cardinality dimension presets to a value LIST — the value
        // arrives as one balanced `{ … }` token (the tokenizer's block
        // rule); a scalar stays a single token.
        const t = tokenize(unwrapBlock(value()));
        for (let i = 0; i + 1 < t.length; i += 2) {
          const k = stripWrapping(stripColon(t[i]!));
          const raw = t[i + 1]!;
          const v = raw.startsWith('{')
            ? tokenize(unwrapBlock(raw)).map(tok => stripWrapping(tok))
            : stripWrapping(raw);
          if (k) {
            profile.dimensions[k] = v;
          }
        }
      } else if (keyword === 'description') {
        profile.description = stripWrapping(value());
      } else {
        return false;
      }
      return true;
    },
    { construct: 'evaluation_profile', id },
  );

  return ctx => {
    ctx.evaluationProfiles[id] = profile;
    return ctx;
  };
};

export const dumpEvaluationProfile: Dumper<EvaluationProfile> = function (p) {
  let out: string = 'evaluation_profile ' + dumpBareSafe(p.id) + ' {\n';
  const keys = Object.keys(p.dimensions);
  if (keys.length > 0) {
    out +=
      '  dimensions { ' +
      keys
        .map(k => {
          const v = p.dimensions[k]!;
          // Set-cardinality presets dump as a value list (`{ co no }`).
          return Array.isArray(v)
            ? dumpBareSafe(k) + ' { ' + v.map(dumpBareSafe).join(' ') + ' }'
            : dumpBareSafe(k) + ' ' + dumpBareSafe(v);
        })
        .join(' ') +
      ' }\n';
  }
  if (p.description) {
    out += '  description "' + escapeString(p.description) + '"\n';
  }
  out += '}\n';
  return out;
};

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
        // The open dimension-keyed map: alternating key/value tokens.
        const t = tokenize(unwrapBlock(value()));
        for (let i = 0; i + 1 < t.length; i += 2) {
          const k = stripWrapping(stripColon(t[i]!));
          const v = stripWrapping(t[i + 1]!);
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
        .map(k => dumpBareSafe(k) + ' ' + dumpBareSafe(p.dimensions[k]!))
        .join(' ') +
      ' }\n';
  }
  if (p.description) {
    out += '  description "' + escapeString(p.description) + '"\n';
  }
  out += '}\n';
  return out;
};

// ─────────────────────────────────────────────────────────────────────
// `promise_set` construct (smart TODO.roadmap/40 batch 3; the
// packages-as-SSOT epic) — the rec's promise register as a file-grade
// construct (types/PromiseSet.ts carries the banner and the grammar
// sketch). Thin by design: the promise sub-parser/dumper are the
// subject's OWN (readPromiseEntry / dumpPromiseEntry, config/subject.ts)
// reused verbatim, so a promise reads identically in both homes. The
// certificate projection's obligation vocabulary is parse-enforced (in
// the shared reader); the resolution and XOR legs are check-enforced
// (C42–C44 generalized + C131) — the codec stays total.
// ─────────────────────────────────────────────────────────────────────

import type { Dumper, Parser } from '../types';
import { stripWrapping, unwrapBlock } from '../tokenize';
import { forEachEntry } from '../parse-block';
import { dumpBareSafe, stripColon } from './field-parser';
import { dumpPromiseEntry, readPromiseEntry } from './subject';
import PromiseSet from '../../types/PromiseSet';

export const parsePromiseSet: Parser = (id: string, data: string) => {
  const set: PromiseSet = { id, promises: [] };

  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'promise') {
        const pid = stripWrapping(stripColon(value()));
        set.promises.push(readPromiseEntry(pid, unwrapBlock(value())));
      } else {
        return false;
      }
      return true;
    },
    { construct: 'promise_set', id },
  );

  return ctx => {
    ctx.promiseSets[id] = set;
    return ctx;
  };
};

export const dumpPromiseSet: Dumper<PromiseSet> = function (s) {
  let out: string = 'promise_set ' + dumpBareSafe(s.id) + ' {\n';
  for (const p of s.promises) {
    out += dumpPromiseEntry(p, '  ', 'promise ');
  }
  out += '}\n';
  return out;
};

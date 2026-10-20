// ─────────────────────────────────────────────────────────────────────
// `common_test_condition` construct (smart TODO.roadmap/40 batch 4; the
// packages-as-SSOT epic) — the model-wide test-conditions register, one
// construct per entry (types/CommonTestCondition.ts carries the banner
// and the grammar sketch). Lives in model/conditions.prl behind the
// condition sets.
//
// The register is self-contained — no cross-references, so C127 checks
// the declaration SHAPE only (title + description carried); the
// citation coverage stays app-side (the linker's oracle).
// ─────────────────────────────────────────────────────────────────────

import type { Dumper, Parser } from '../types';
import { escapeString, stripWrapping, unwrapBlock } from '../tokenize';
import { forEachEntry } from '../parse-block';
import { readSource } from './field-parser';
import CommonTestCondition from '../../types/CommonTestCondition';
import { refTargetToSourceRef, dumpSourceRefAsRef } from './ref';

export const parseCommonTestCondition: Parser = (id: string, data: string) => {
  const condition: CommonTestCondition = {
    id,
    title: '',
    reference: '',
    description: '',
    source: null,
  };

  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'title') {
        condition.title = stripWrapping(value());
      } else if (keyword === 'reference') {
        condition.reference = stripWrapping(value());
      } else if (keyword === 'description') {
        condition.description = stripWrapping(value());
      } else if (keyword === 'source') {
        condition.source = readSource(unwrapBlock(value()));
      } else if (keyword === 'ref') {
        const predicate = stripWrapping(value());
        const target = stripWrapping(value());
        if (predicate === 'derives-from') {
          const b = refTargetToSourceRef(target);
          if (b) {
            condition.source = b;
          }
        }
      } else {
        return false;
      }
      return true;
    },
    { construct: 'common_test_condition', id },
  );

  return ctx => {
    ctx.commonTestConditions[id] = condition;
    return ctx;
  };
};

export const dumpCommonTestCondition: Dumper<CommonTestCondition> = function (
  c,
) {
  let out: string = 'common_test_condition ' + c.id + ' {\n';
  if (c.title) {
    out += '  title "' + escapeString(c.title) + '"\n';
  }
  if (c.reference) {
    out += '  reference "' + escapeString(c.reference) + '"\n';
  }
  if (c.description) {
    out += '  description "' + escapeString(c.description) + '"\n';
  }
  if (c.source && (c.source.doc || c.source.clause)) {
    out += dumpSourceRefAsRef(c.source, '  ', escapeString);
  }
  out += '}\n';
  return out;
};

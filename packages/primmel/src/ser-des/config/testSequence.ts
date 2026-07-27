// ─────────────────────────────────────────────────────────────────────
// `test_sequence` construct (smart gap-close E10,
// analysis/architecture-gaps-2026-07.md; the smart contract
// data/schemas/test-sequences.yaml + data/r60/specification/
// test-sequences.yaml): a required test ordering of a Recommendation —
// the first-class replacement for the hand-authored supplemental YAML
// R 60's required orderings (MDLO → creep → DR; the temperature-cycling
// environment program) ride today:
//
//   test_sequence mdlo-creep-dr {
//     name "MDLO → Creep → DR sequence"
//     description "The three performance tests must run in this order on the same sample …"
//     step 1 {
//       test "/conf/metrological-tests/measurement-error-repeatability-mdlo"
//       role baseline
//     }
//     step 2 {
//       test "/conf/metrological-tests/creep"
//       role follow_up
//       depends_on 1
//     }
//     step 3 {
//       test "/conf/metrological-tests/dr"
//       role follow_up
//       depends_on 2
//     }
//     sample_applicability all
//     source { doc "urn:oiml:pub:r:60-2:2021" clause "2.10" }
//     source { doc "urn:oiml:pub:r:60-2:2021" clause "2.11.1" }
//   }
//
// Surface-syntax notes (the invariant/passport conventions,
// ser-des/config/invariant.ts + passport.ts):
//   - name/description are prose facets: the package-default spelling's
//     value inline; alternates ride the ISO 24229 `text <id>.description`
//     blocks (TODO.roadmap/25 — test_sequences registered in C89's
//     element-id collections);
//   - a step is `step <order> { … }` — the head scalar is the declared
//     order (the test_point_set `point <id> { … }` idiom, minus the
//     wrapper block: steps sit directly in the body, so the body parses
//     with a manual token walk — forEachEntry cannot interleave a
//     head-scalar + block pair with scalar facets);
//   - `source { doc "…" clause "…" }` repeats, collecting into
//     sourceRefs (the requirement family's idiom, TODO.roadmap/24);
//   - the parser stays TOTAL: missing facets land as ''/null/[] and the
//     linter (C92/C93) judges the shape — a missing step head (`step
//     { … }`) parses with order null, a missing block leaves the step's
//     facets undeclared, unknown keywords stay ignored (forward
//     compatibility for newer facets);
//   - test-ref RESOLUTION (does /conf/… name a declared conformance
//     test) is the smart-side linker rule R39's job — the kernel checks
//     syntax/shape only, exactly like E9's C90/C91 vs R38 split.
//
// Round-trip: the dump emits the canonical form — scalars first (name,
// description), then the steps in declared order, then
// sample_applicability and the source blocks. name, description, test,
// phase, doc, and clause are quoted ALWAYS — free strings may carry the
// tokenizer's comment character # (the E9 source-quoting hazard), so a
// bare emission would not re-parse; role and sample_applicability are
// vocabulary tokens (dumpBareSafe). A malformed model (order null, a
// both-set test+phase step) dumps a form the re-parse reproduces
// exactly — the fixpoint is proven in test/test-sequence.test.ts.
// ─────────────────────────────────────────────────────────────────────

import {
  escapeString,
  stripWrapping,
  tokenizePackage,
  unwrapBlock,
} from '../tokenize';
import { forEachEntry } from '../parse-block';
import { dumpBareSafe, readSource } from './field-parser';
import type { ConstructDefinition } from './index';
import type { TestSequence, TestSequenceStep } from '../../types/TestSequence';

/** Read one step's `{ … }` facets (the passport nested-block idiom).
 *  Scalar facets are last-wins; the linter (C92/C93) judges the shape. */
function parseStepFacets(
  block: string,
  step: TestSequenceStep,
  id: string,
): void {
  forEachEntry(
    block,
    (facet, value) => {
      if (facet === 'test') {
        step.test = stripWrapping(value());
      } else if (facet === 'phase') {
        step.phase = stripWrapping(value());
      } else if (facet === 'role') {
        step.role = stripWrapping(value());
      } else if (facet === 'depends_on') {
        step.dependsOn = Number(stripWrapping(value()));
      } else {
        return false;
      }
      return true;
    },
    { construct: 'test_sequence.step', id },
  );
}

const parseTestSequence: ConstructDefinition['parse'] = function (id, data) {
  const sequence: TestSequence = {
    id,
    name: '',
    description: '',
    steps: [],
    sampleApplicability: '',
    sourceRefs: [],
  };

  // Manual token walk (the test_point_set parsePoints idiom): a step is
  // a head-scalar + block pair, which forEachEntry's (keyword, value)
  // pairing cannot interleave with the scalar facets.
  const t = tokenizePackage(data);
  let i = 0;
  while (i < t.length) {
    const command = t[i++];
    if (i >= t.length) {
      throw new Error(
        `Parsing error: test_sequence. ID ${id}: Expecting value for ${command}`,
      );
    }
    if (command === 'name') {
      sequence.name = stripWrapping(t[i++]);
    } else if (command === 'description') {
      sequence.description = stripWrapping(t[i++]);
    } else if (command === 'sample_applicability') {
      sequence.sampleApplicability = stripWrapping(t[i++]);
    } else if (command === 'source') {
      // Repeated source blocks collect into sourceRefs (the requirement
      // family's idiom).
      sequence.sourceRefs.push(readSource(unwrapBlock(t[i++])));
    } else if (command === 'step') {
      const step: TestSequenceStep = {
        order: null,
        test: '',
        phase: '',
        role: '',
        dependsOn: null,
      };
      let value = t[i++];
      if (!value.startsWith('{')) {
        // The head scalar is the declared order — Number() stays total
        // (garbage lands as NaN for C92, never a parse error).
        step.order = Number(stripWrapping(value));
        value = i < t.length && t[i].startsWith('{') ? t[i++] : '';
      }
      if (value.startsWith('{')) {
        parseStepFacets(unwrapBlock(value), step, id);
      }
      sequence.steps.push(step);
    } else {
      // Forward compatibility: skip the unknown facet's value.
      i++;
    }
  }

  return ctx => {
    ctx.testSequences[id] = sequence;
    return ctx;
  };
};

// ── dump (canonical form) ────────────────────────────────────────────

const dumpTestSequence = function (seq: TestSequence): string {
  let out = 'test_sequence ' + seq.id + ' {\n';
  if (seq.name !== '') {
    out += '  name "' + escapeString(seq.name) + '"\n';
  }
  if (seq.description !== '') {
    out += '  description "' + escapeString(seq.description) + '"\n';
  }
  for (const step of seq.steps) {
    out += '  step' + (step.order !== null ? ' ' + step.order : '') + ' {';
    // test/phase are quoted ALWAYS (free strings — the comment-character
    // hazard); role is a vocabulary token (dumpBareSafe).
    if (step.test !== '') {
      out += ' test "' + escapeString(step.test) + '"';
    }
    if (step.phase !== '') {
      out += ' phase "' + escapeString(step.phase) + '"';
    }
    if (step.role !== '') {
      out += ' role ' + dumpBareSafe(step.role);
    }
    if (step.dependsOn !== null) {
      out += ' depends_on ' + step.dependsOn;
    }
    out += ' }\n';
  }
  if (seq.sampleApplicability !== '') {
    out +=
      '  sample_applicability ' + dumpBareSafe(seq.sampleApplicability) + '\n';
  }
  for (const src of seq.sourceRefs) {
    out +=
      '  source { doc "' +
      escapeString(src.doc) +
      '" clause "' +
      escapeString(src.clause) +
      '"' +
      (src.fragment ? ' fragment "' + escapeString(src.fragment) + '"' : '') +
      ' }\n';
  }
  out += '}\n';
  return out;
};

export const testSequenceConstruct = {
  keyword: 'test_sequence',
  field: 'testSequences',
  takesID: true,
  parse: parseTestSequence,
  dump: dumpTestSequence,
} as const;

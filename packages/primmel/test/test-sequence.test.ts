// ─────────────────────────────────────────────────────────────────────
// The `test_sequence` construct (smart gap-close E10,
// analysis/architecture-gaps-2026-07.md; the smart contract
// data/schemas/test-sequences.yaml + data/r60/specification/
// test-sequences.yaml): the required test orderings of a
// Recommendation — the first-class replacement for the hand-authored
// supplemental YAML. The fixtures are the two REAL R 60 sequences with
// their clause provenance (MDLO → creep → DR, and the temperature-
// cycling environment program). Covers the parse (all facet shapes,
// incl. the head-less/malformed step spellings), the round-trip
// fixpoint (incl. a malformed both-set step model), the linter rules
//   C92 test-sequence-shape
//   C93 test-sequence-integrity
// the `uses` composition leg (test sequences merge like the invariant
// collection — MERGE_FIELDS), the C89 text-addressing leg
// (text <id>.description resolves against the construct), and the
// corpus-clean leg: the 23 shipped packages show zero errors and zero
// test-sequence-rule issues (additive/OCP — packages without a test
// sequence are untouched).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { loadPackage } from '../src/ser-des/package';
import { checkPackage } from '../src/check';

// The real corpus lives in the sibling smart repo checkout, which CI and
// fresh clones do not have — the corpus-clean spec then SKIPs gracefully.
// Set PRIMMEL_PACKAGES to a primmel-packages directory to enable it.
const CORPUS =
  process.env.PRIMMEL_PACKAGES ??
  '/Users/mulgogi/src/oimlsmart/smart/primmel-packages';
const CORPUS_AVAILABLE = existsSync(CORPUS);
const CORPUS_SKIP: string | false = CORPUS_AVAILABLE
  ? false
  : `no primmel-packages corpus at ${CORPUS} — set PRIMMEL_PACKAGES to enable the corpus-clean leg`;
if (!CORPUS_AVAILABLE) {
  console.log(
    `test-sequence.test.ts: skipping the corpus-clean spec — ${CORPUS_SKIP}`,
  );
}

// The two real R 60 sequences (data/r60/specification/test-sequences.yaml)
// recoded to the construct — the semantic contract's dogfood fixture.
const MDLO_CREEP_DR = `
test_sequence mdlo-creep-dr {
  name "MDLO → Creep → DR sequence"
  description "The three performance tests must run in this order on the same sample within the same lab visit: the MDLO test (measurement error, repeatability) establishes the baseline; creep follows it; the DR reading follows the creep loading (R 60-2, 2.10 + 2.11.1/2.11.2 — the recommended per-temperature sequence of fig-2/fig-3 — and 2.9.2). Running creep before MDLO contaminates the baseline."
  step 1 {
    test "/conf/metrological-tests/measurement-error-repeatability-mdlo"
    role baseline
  }
  step 2 {
    test "/conf/metrological-tests/creep"
    role follow_up
    depends_on 1
  }
  step 3 {
    test "/conf/metrological-tests/dr"
    role follow_up
    depends_on 2
  }
  sample_applicability all
  source { doc "urn:oiml:pub:r:60-2:2021" clause "2.10" }
  source { doc "urn:oiml:pub:r:60-2:2021" clause "2.11.1" }
  source { doc "urn:oiml:pub:r:60-2:2021" clause "2.11.2" }
  source { doc "urn:oiml:pub:r:60-2:2021" clause "2.9.2" }
}
`;

const TEMPERATURE_CYCLING = `
test_sequence temperature-cycling {
  name "Temperature cycling (20 → T_high → T_low → 20)"
  description "The environment program of the MDLO test: stabilize at the 20 °C reference, then the higher temperature, then the lower temperature, then return to 20 °C (R 60-2, 2.10.1.13; concurrent conduct per temperature per 2.10). Phase-shaped steps carry no test ref; the program gates no run by itself — it orders the environment, not the tests."
  step 1 { phase "20 °C reference" }
  step 2 { phase "T_high" }
  step 3 { phase "T_low" }
  step 4 { phase "20 °C return" }
  source { doc "urn:oiml:pub:r:60-2:2021" clause "2.10.1.13" }
  source { doc "urn:oiml:pub:r:60-2:2021" clause "2.10" }
}
`;

const CLEAN = MDLO_CREEP_DR + TEMPERATURE_CYCLING;

function makeTmpPackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-test-sequence-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'test-sequences.prl'), body);
  return dir;
}

const TEST_SEQUENCE_RULES = ['C92', 'C93'];

function testSequenceIssues(dir: string) {
  return checkPackage(dir).filter(i => TEST_SEQUENCE_RULES.includes(i.check));
}

describe('test_sequence — parse (smart gap-close E10)', () => {
  it('parses the full test-sequence block (the R 60 MDLO → creep → DR sequence)', () => {
    const m = load(MDLO_CREEP_DR);
    assert.equal(m.testSequences.length, 1);
    const seq = m.testSequences[0];
    assert.equal(seq.id, 'mdlo-creep-dr');
    assert.equal(seq.name, 'MDLO → Creep → DR sequence');
    assert.ok(seq.description.startsWith('The three performance tests'));
    assert.equal(seq.sampleApplicability, 'all');
    assert.deepEqual(seq.sourceRefs, [
      { doc: 'urn:oiml:pub:r:60-2:2021', clause: '2.10' },
      { doc: 'urn:oiml:pub:r:60-2:2021', clause: '2.11.1' },
      { doc: 'urn:oiml:pub:r:60-2:2021', clause: '2.11.2' },
      { doc: 'urn:oiml:pub:r:60-2:2021', clause: '2.9.2' },
    ]);
    assert.equal(seq.steps.length, 3);
    assert.deepEqual(seq.steps[0], {
      order: 1,
      test: '/conf/metrological-tests/measurement-error-repeatability-mdlo',
      phase: '',
      role: 'baseline',
      dependsOn: null,
    });
    assert.deepEqual(seq.steps[1], {
      order: 2,
      test: '/conf/metrological-tests/creep',
      phase: '',
      role: 'follow_up',
      dependsOn: 1,
    });
    assert.deepEqual(seq.steps[2], {
      order: 3,
      test: '/conf/metrological-tests/dr',
      phase: '',
      role: 'follow_up',
      dependsOn: 2,
    });
  });

  it('parses the phase-step environment program (temperature-cycling)', () => {
    const m = load(TEMPERATURE_CYCLING);
    const seq = m.testSequences[0];
    assert.equal(seq.id, 'temperature-cycling');
    assert.equal(seq.sampleApplicability, '');
    assert.deepEqual(seq.steps, [
      {
        order: 1,
        test: '',
        phase: '20 °C reference',
        role: '',
        dependsOn: null,
      },
      { order: 2, test: '', phase: 'T_high', role: '', dependsOn: null },
      { order: 3, test: '', phase: 'T_low', role: '', dependsOn: null },
      { order: 4, test: '', phase: '20 °C return', role: '', dependsOn: null },
    ]);
    assert.equal(seq.sourceRefs.length, 2);
  });

  it('parses the bare spellings — unquoted test ref, quoted role, escapes inside prose', () => {
    const m = load(`
test_sequence bare {
  name "Bare \\"quoted\\" name"
  description "d"
  step 1 { test /conf/metrological-tests/creep role "baseline" }
}
`);
    const seq = m.testSequences[0];
    assert.equal(seq.name, 'Bare "quoted" name');
    assert.deepEqual(seq.steps[0], {
      order: 1,
      test: '/conf/metrological-tests/creep',
      phase: '',
      role: 'baseline',
      dependsOn: null,
    });
  });

  it('stays total on a malformed test_sequence (the linter judges, not the parser)', () => {
    const m = load('test_sequence broken {\n  name "B"\n}\n');
    assert.equal(m.testSequences.length, 1);
    const seq = m.testSequences[0];
    assert.equal(seq.name, 'B');
    assert.equal(seq.description, '');
    assert.deepEqual(seq.steps, []);
    assert.equal(seq.sampleApplicability, '');
    assert.deepEqual(seq.sourceRefs, []);
  });

  it('parses a step with no order head as order null (C92 judges the shape)', () => {
    const m = load(
      'test_sequence s {\n  name "S"\n  description "d"\n  step { test "/conf/x" }\n}\n',
    );
    assert.deepEqual(m.testSequences[0].steps[0], {
      order: null,
      test: '/conf/x',
      phase: '',
      role: '',
      dependsOn: null,
    });
  });

  it('parses a step with no block as a facets-undeclared step (C92 judges the shape)', () => {
    const m = load(
      'test_sequence s {\n  name "S"\n  description "d"\n  step 2\n  step 1 { test "/conf/x" }\n}\n',
    );
    assert.deepEqual(m.testSequences[0].steps[0], {
      order: 2,
      test: '',
      phase: '',
      role: '',
      dependsOn: null,
    });
    assert.equal(m.testSequences[0].steps[1].order, 1);
  });

  it('ignores unknown facets (forward compatibility) — C92 still catches the missing shape', () => {
    const m = load(
      'test_sequence future {\n  name "F" description "d" rationale "not yet a facet"\n  step 1 { test "/conf/x" note "future facet" }\n}\n',
    );
    const seq = m.testSequences[0];
    assert.equal(seq.name, 'F');
    assert.equal(seq.description, 'd');
    assert.equal(seq.steps[0].test, '/conf/x');
  });

  it('round-trips the whole model losslessly (fixpoint)', () => {
    const m1 = load(CLEAN);
    const dumped = dump(m1);
    const m2 = load(dumped);
    assert.deepEqual(m2.testSequences, m1.testSequences);
    assert.equal(dump(m2), dumped);
  });

  it('parses a garbage order head as NaN, dumps as `step NaN`, and re-parses to itself (the total-parser doctrine, pinned)', () => {
    // Number() stays total: a non-numeric order head lands as NaN for C92
    // to judge, never a parse error. The dump must emit `step NaN` — and
    // Number('NaN') re-parses to NaN, so the fixpoint holds even on the
    // malformed spelling.
    const garbage = `
test_sequence g {
  name "G"
  description "d"
  step garbage { test "/conf/x" }
}
`;
    const m1 = load(garbage);
    assert.ok(
      Number.isNaN(m1.testSequences[0].steps[0].order),
      `expected a NaN order for the garbage head, got: ${m1.testSequences[0].steps[0].order}`,
    );
    const dumped = dump(m1);
    assert.ok(
      dumped.includes('step NaN {'),
      `expected the NaN order dumped as \`step NaN\`, got:\n${dumped}`,
    );
    const m2 = load(dumped);
    assert.deepEqual(m2.testSequences, m1.testSequences);
    assert.equal(dump(m2), dumped);
  });

  it('round-trips a MALFORMED model byte-clean (both-set step, order-null step)', () => {
    // The parser stays total on a step carrying both test and phase and
    // on a step with no order head; the dump must re-emit BOTH facets
    // and the head-less step so the re-parse reproduces the malformed
    // model exactly — the linter (C92), not the codec, owns the
    // judgment.
    const malformed = `
test_sequence both {
  name "Both"
  description "malformed but total."
  step { test "/conf/x" phase "T_high" }
}
`;
    const m1 = load(malformed);
    const dumped = dump(m1);
    const m2 = load(dumped);
    assert.deepEqual(m2.testSequences, m1.testSequences);
    assert.equal(dump(m2), dumped);
  });

  it('quotes the free strings on dump (the comment-character # hazard)', () => {
    // A description carrying the tokenizer's comment character must
    // re-parse exactly — free strings never go bare (the E9
    // source-quoting pin); test refs stay quoted too.
    const withHash = `
test_sequence hash {
  name "H"
  description "see docs/tests.md#anchor for the rationale"
  step 1 { test "/conf/x" }
}
`;
    const dumped = dump(load(withHash));
    assert.ok(
      dumped.includes(
        'description "see docs/tests.md#anchor for the rationale"',
      ),
      `expected the description quoted in the dump, got:\n${dumped}`,
    );
    assert.ok(
      dumped.includes('test "/conf/x"'),
      `expected the test ref quoted in the dump, got:\n${dumped}`,
    );
    const m2 = load(dumped);
    assert.equal(
      m2.testSequences[0].description,
      'see docs/tests.md#anchor for the rationale',
    );
    assert.equal(m2.testSequences[0].steps[0].test, '/conf/x');
  });

  it('quotes a vocabulary value STARTING with the comment character # (the dumpBareSafe exposure)', () => {
    // The tokenizer treats `#` as a comment only BETWEEN tokens: a
    // mid-token `#` is literal, so `see#1` dumps BARE and round-trips
    // (the v2 map_profile `StdS#Process5` form depends on exactly this);
    // a LEADING `#` starts a comment on re-parse and the value vanishes,
    // so `#1` must dump quoted.
    const wrap = (applicability: string) => `
test_sequence hash-vocab {
  name "H"
  description "d"
  step 1 { test "/conf/x" }
  sample_applicability "${applicability}"
}
`;
    const mid = load(wrap('see#1'));
    assert.equal(mid.testSequences[0].sampleApplicability, 'see#1');
    const midDump = dump(mid);
    assert.ok(
      midDump.includes('sample_applicability see#1'),
      `expected the mid-token # value to stay bare, got:\n${midDump}`,
    );
    assert.deepEqual(load(midDump).testSequences, mid.testSequences);

    const leading = load(wrap('#1'));
    assert.equal(leading.testSequences[0].sampleApplicability, '#1');
    const leadingDump = dump(leading);
    assert.ok(
      leadingDump.includes('sample_applicability "#1"'),
      `expected the leading-# value quoted in the dump, got:\n${leadingDump}`,
    );
    assert.deepEqual(load(leadingDump).testSequences, leading.testSequences);
    assert.equal(dump(load(leadingDump)), leadingDump);
  });
});

describe('test_sequence lint rules (C92–C93)', () => {
  it('stays silent on clean test-sequence declarations', () => {
    const issues = testSequenceIssues(makeTmpPackage(CLEAN));
    assert.deepEqual(
      issues,
      [],
      `expected no test-sequence issues, got: ${issues.map(e => `[${e.check}] ${e.message}`).join('\n')}`,
    );
  });

  it('C92 fires on a missing name, description, or steps', () => {
    const noName = testSequenceIssues(
      makeTmpPackage(
        MDLO_CREEP_DR.replace('  name "MDLO → Creep → DR sequence"\n', ''),
      ),
    ).filter(i => i.check === 'C92');
    assert.ok(noName.some(i => i.message.includes('no name')));

    const noDescription = testSequenceIssues(
      makeTmpPackage(
        MDLO_CREEP_DR.replace(
          / {2}description "The three performance[^"]*"\n/,
          '',
        ),
      ),
    ).filter(i => i.check === 'C92');
    assert.ok(noDescription.some(i => i.message.includes('no description')));

    const noSteps = testSequenceIssues(
      makeTmpPackage('test_sequence s {\n  name "S"\n  description "d"\n}\n'),
    ).filter(i => i.check === 'C92');
    assert.ok(noSteps.some(i => i.message.includes('no steps')));
  });

  it('C92 fires on a missing, non-positive, non-integer, or duplicate step order', () => {
    const issues = (body: string) =>
      testSequenceIssues(makeTmpPackage(body)).filter(i => i.check === 'C92');
    const wrap = (step: string) =>
      `test_sequence s {\n  name "S"\n  description "d"\n${step}}\n`;

    assert.ok(
      issues(wrap('  step { test "/conf/x" }\n')).some(i =>
        i.message.includes('no positive-integer order'),
      ),
    );
    assert.ok(
      issues(wrap('  step 0 { test "/conf/x" }\n')).some(i =>
        i.message.includes('no positive-integer order'),
      ),
    );
    assert.ok(
      issues(wrap('  step -1 { test "/conf/x" }\n')).some(i =>
        i.message.includes('no positive-integer order'),
      ),
    );
    assert.ok(
      issues(wrap('  step 1.5 { test "/conf/x" }\n')).some(i =>
        i.message.includes('no positive-integer order'),
      ),
    );
    const dup = issues(
      wrap('  step 1 { test "/conf/x" }\n  step 1 { test "/conf/y" }\n'),
    );
    assert.ok(dup.some(i => i.message.includes('declared twice')));
  });

  it('C92 fires when a step carries neither test nor phase — or both', () => {
    const issues = (step: string) =>
      testSequenceIssues(
        makeTmpPackage(
          `test_sequence s {\n  name "S"\n  description "d"\n${step}}\n`,
        ),
      ).filter(i => i.check === 'C92');

    assert.ok(
      issues('  step 1 { role baseline }\n').some(i =>
        i.message.includes('neither test nor phase'),
      ),
    );
    assert.ok(
      issues('  step 1 { test "/conf/x" phase "T_high" }\n').some(i =>
        i.message.includes('both test and phase'),
      ),
    );
  });

  it('C92 fires on a role declared on a phase step, and on a role outside the vocabulary', () => {
    const issues = (step: string) =>
      testSequenceIssues(
        makeTmpPackage(
          `test_sequence s {\n  name "S"\n  description "d"\n${step}}\n`,
        ),
      ).filter(i => i.check === 'C92');

    const phaseRole = issues('  step 1 { phase "T_high" role baseline }\n');
    assert.ok(phaseRole.some(i => i.message.includes('on a phase step')));

    // The neither-test-nor-phase case names the step accurately (the E10
    // message mislabel — it is not "a phase step").
    const neitherRole = issues('  step 1 { role baseline }\n');
    assert.ok(
      neitherRole.some(i =>
        i.message.includes(
          'declares role "baseline" on a step carrying neither test nor phase',
        ),
      ),
      `expected the neither-case role message, got: ${neitherRole.map(i => i.message).join('\n')}`,
    );

    const badRole = issues('  step 1 { test "/conf/x" role primary }\n');
    assert.ok(
      badRole.some(
        i =>
          i.message.includes('"primary"') &&
          i.message.includes('baseline | follow_up'),
      ),
    );

    // The vocabulary's positive branches pass.
    assert.deepEqual(issues('  step 1 { test "/conf/x" role baseline }\n'), []);
    assert.deepEqual(
      issues('  step 1 { test "/conf/x" role follow_up }\n'),
      [],
    );
  });

  it('C92 fires on a non-integer depends_on (C93 leaves the shape to C92)', () => {
    const issues = testSequenceIssues(
      makeTmpPackage(
        'test_sequence s {\n  name "S"\n  description "d"\n  step 1 { test "/conf/x" }\n  step 2 { test "/conf/y" depends_on 1.5 }\n}\n',
      ),
    );
    assert.ok(
      issues.some(
        i => i.check === 'C92' && i.message.includes('depends_on 1.5'),
      ),
    );
    assert.deepEqual(
      issues.filter(i => i.check === 'C93'),
      [],
      'a non-integer depends_on is C92 shape, never C93 integrity',
    );
  });

  it('C92 does NOT judge the sample_applicability vocabulary (the smart side owns it)', () => {
    const issues = testSequenceIssues(
      makeTmpPackage(
        MDLO_CREEP_DR.replace(
          'sample_applicability all',
          'sample_applicability banana',
        ),
      ),
    ).filter(i => i.check === 'C92');
    assert.deepEqual(issues, []);
  });

  it('C93 fires on a self-reference, a forward reference, and a dangling order', () => {
    const issues = (steps: string) =>
      testSequenceIssues(
        makeTmpPackage(
          `test_sequence s {\n  name "S"\n  description "d"\n${steps}}\n`,
        ),
      ).filter(i => i.check === 'C93');

    const self = issues('  step 1 { test "/conf/x" depends_on 1 }\n');
    assert.ok(self.some(i => i.message.includes('depends on itself')));

    const forward = issues(
      '  step 1 { test "/conf/x" depends_on 2 }\n  step 2 { test "/conf/y" }\n',
    );
    assert.ok(forward.some(i => i.message.includes('LATER step')));

    const dangling = issues(
      '  step 1 { test "/conf/x" }\n  step 2 { test "/conf/y" depends_on 7 }\n',
    );
    assert.ok(dangling.some(i => i.message.includes('names no step')));
  });

  it('C93 accepts a back-reference chain (the R 60 MDLO → creep → DR shape)', () => {
    const issues = testSequenceIssues(
      makeTmpPackage(
        'test_sequence s {\n  name "S"\n  description "d"\n  step 1 { test "/conf/a" role baseline }\n  step 2 { test "/conf/b" role follow_up depends_on 1 }\n  step 3 { test "/conf/c" role follow_up depends_on 1 }\n}\n',
      ),
    ).filter(i => i.check === 'C93');
    assert.deepEqual(issues, []);
  });

  it('test sequences are additive: a package without one shows no test-sequence issues', () => {
    const issues = testSequenceIssues(
      makeTmpPackage('term t {\n  label "t"\n}\n'),
    );
    assert.deepEqual(issues, []);
  });
});

describe('test_sequence — uses composition (MERGE_FIELDS, the invariant-collection parity)', () => {
  it('composes test sequences through `uses` like the doctrine collections', () => {
    // The smart layout: shared doctrine lives in a foundation package;
    // every rec package composes it. The composed model must carry the
    // test sequences — as it does the invariants today.
    const coreDir = mkdtempSync(join(tmpdir(), 'primmel-ts-core-'));
    writeFileSync(
      join(coreDir, 'package.primmel'),
      'package { id toy-core kind core }',
    );
    mkdirSync(join(coreDir, 'specification'));
    writeFileSync(
      join(coreDir, 'specification', 'test-sequences.prl'),
      MDLO_CREEP_DR,
    );

    const recDir = mkdtempSync(join(tmpdir(), 'primmel-ts-rec-'));
    writeFileSync(
      join(recDir, 'package.primmel'),
      'package { id toy-rec kind rec uses { toy-core } }',
    );
    mkdirSync(join(recDir, 'model'));
    writeFileSync(
      join(recDir, 'model', 'terms.prl'),
      'term t {\n  label "t"\n}\n',
    );

    const dirs = new Map([
      ['toy-core', coreDir],
      ['toy-rec', recDir],
    ]);
    const composed = loadPackage(recDir, {
      resolvePackage: (id: string) => dirs.get(id),
    });
    assert.equal(composed.testSequences.length, 1);
    assert.equal(composed.testSequences[0].id, 'mdlo-creep-dr');
  });

  it('uses-no-redefine protects a test_sequence id across packages', () => {
    const coreDir = mkdtempSync(join(tmpdir(), 'primmel-ts-core-'));
    writeFileSync(
      join(coreDir, 'package.primmel'),
      'package { id toy-core kind core }',
    );
    mkdirSync(join(coreDir, 'specification'));
    writeFileSync(
      join(coreDir, 'specification', 'test-sequences.prl'),
      MDLO_CREEP_DR,
    );

    const recDir = mkdtempSync(join(tmpdir(), 'primmel-ts-rec-'));
    writeFileSync(
      join(recDir, 'package.primmel'),
      'package { id toy-rec kind rec uses { toy-core } }',
    );
    mkdirSync(join(recDir, 'model'));
    writeFileSync(join(recDir, 'model', 'test-sequences.prl'), MDLO_CREEP_DR);

    const dirs = new Map([
      ['toy-core', coreDir],
      ['toy-rec', recDir],
    ]);
    assert.throws(
      () =>
        loadPackage(recDir, {
          resolvePackage: (id: string) => dirs.get(id),
        }),
      /redefines testSequences id "mdlo-creep-dr"/,
    );
  });
});

describe('test_sequence — ISO 24229 text addressing (TODO.roadmap/25)', () => {
  it('text <id>.description resolves against the test sequence (C89 stays silent)', () => {
    // The description's alternate spellings ride the same machinery
    // every prose field uses — the test sequence is a registered
    // element id.
    const issues = checkPackage(
      makeTmpPackage(
        MDLO_CREEP_DR +
          `
text mdlo-creep-dr.description {
  spell fra-Latn "les trois essais de performance se déroulent dans cet ordre."
}
`,
      ),
    ).filter(i => i.check === 'C89');
    assert.deepEqual(
      issues,
      [],
      `expected text mdlo-creep-dr.description to resolve, got: ${issues.map(i => i.message).join('\n')}`,
    );
  });
});

describe('corpus-clean leg (additive/OCP — the 23 shipped packages)', () => {
  it(
    'shows zero errors and zero test-sequence-rule issues across the corpus',
    { skip: CORPUS_SKIP },
    () => {
      const dirs = readdirSync(CORPUS)
        .map(d => join(CORPUS, d))
        .filter(d => existsSync(join(d, 'package.primmel')))
        .sort();
      assert.equal(
        dirs.length,
        23,
        `expected the 23-package corpus at ${CORPUS}`,
      );
      for (const dir of dirs) {
        const issues = checkPackage(dir);
        const errors = issues.filter(i => i.severity === 'error' && !i.known);
        assert.deepEqual(
          errors,
          [],
          `${dir}: expected zero errors, got: ${errors.map(e => `[${e.check}] ${e.message}`).join('\n')}`,
        );
        assert.deepEqual(
          issues.filter(i => TEST_SEQUENCE_RULES.includes(i.check)),
          [],
          `${dir}: a package without a test sequence must show no test-sequence-rule issues`,
        );
      }
    },
  );
});

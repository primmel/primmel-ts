// ─────────────────────────────────────────────────────────────────────
// The executable test programs on `conformance_test` (smart
// TODO.twin-demo/03 — the model-drive bindings): `preparation { … }`
// (the ordered warm-up / preload / zero-check discipline) and
// `stimulus { … }` (the ordered measurement program — drive, argument
// expressions over the subject's declared parameters, hold, the read's
// fresh_within bound, the per-point acceptance reference). The fixture
// is a small R 60-2 load-cell accuracy test: warm-up + preload + zero
// preparation and a five-point stimulus program over e_max fractions,
// with clause-URN provenance. Covers the parse (all facet shapes, incl.
// the head-less/malformed entry spellings), the round-trip fixpoint
// (incl. the canonical ref derives-from provenance emission re-parsing
// into sourceRefs), the linter rules
//   C147 test-program-shape
//   C148 test-program-duration
// the end-to-end package leg (a real package directory loads, checks
// clean, and dump-fixpoints), and the corpus-clean leg: the shipped
// packages show zero test-program-rule issues (additive/OCP — packages
// without a test program are untouched).
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
import { loadPackageWithIssues } from '../src/ser-des/package';
import { checkPackage } from '../src/check';
import { CORPUS, CORPUS_AVAILABLE, CORPUS_SKIP } from './helpers/corpus';

// The corpus resolution (env-first, repo-relative default, loud skip) has
// one home — test/helpers/corpus.ts (TODO.v2/13 item 3c).
if (!CORPUS_AVAILABLE) {
  console.log(
    `test-program.test.ts: skipping the corpus-clean spec — ${CORPUS_SKIP}`,
  );
}

// The dogfood fixture: a small R 60-2 load-cell test — the warm-up,
// the preload discipline, the zero check, and the five-point stimulus
// program over e_max fractions, with clause-URN provenance.
const LOAD_CELL_TEST = `
conformance_test /conf/metrological-tests/load-step-accuracy {
  name "Load-step accuracy"
  type metrological
  preparation {
    description "Warm-up, preload discipline, and zero check"
    step 1 {
      action "Energize the instrument and allow the indication to stabilize"
      hold 30min
    }
    step 2 {
      action "Apply the preload three times, returning to zero between applications"
      drive ladApply
      args { load: "e_max" repetitions: "3" }
      hold PT1M
    }
    step 3 {
      action "Verify the zero indication"
      verify { read zero_indication tolerance "/req/metrological/zero-error" }
    }
    source { doc "urn:oiml:pub:r:60-2:2021" clause "2.10.1.2" }
    source { doc "urn:oiml:pub:r:60-2:2021" clause "2.10.1.3" }
  }
  stimulus {
    description "The five-point ascending load program"
    point 1 {
      drive ladApply
      args { load: "0.1 * e_max" }
      hold PT1M
      fresh_within 5s
      acceptance "/req/metrological/mpe"
    }
    point 2 {
      drive ladApply
      args { load: "0.2 * e_max" }
      hold PT1M
      fresh_within 5s
      acceptance "/req/metrological/mpe"
    }
    point 3 {
      drive ladApply
      args { load: "0.4 * e_max" }
      hold PT1M
      fresh_within 5s
      acceptance "/req/metrological/mpe"
    }
    point 4 {
      drive ladApply
      args { load: "0.6 * e_max" }
      hold PT1M
      fresh_within 5s
      acceptance "/req/metrological/mpe"
    }
    point 5 {
      drive ladApply
      args { load: "e_max" }
      hold PT1M
      fresh_within 5s
      acceptance "/req/metrological/mpe"
    }
    source { doc "urn:oiml:pub:r:60-2:2021" clause "2.10.1.7" }
  }
}
`;

function makeTmpPackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-test-program-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'tests.prl'), body);
  return dir;
}

const TEST_PROGRAM_RULES = ['C147', 'C148'];

function testProgramIssues(dir: string) {
  return checkPackage(dir).filter(i => TEST_PROGRAM_RULES.includes(i.check));
}

describe('test programs — parse (smart TODO.twin-demo/03)', () => {
  it('parses the preparation program (warm-up, preload, zero check)', () => {
    const m = load(LOAD_CELL_TEST);
    const ct = m.conformanceTests[0];
    const prep = ct.preparation;
    assert.ok(prep, 'expected the preparation program');
    assert.equal(
      prep.description,
      'Warm-up, preload discipline, and zero check',
    );
    assert.equal(prep.entries.length, 3);
    assert.deepEqual(prep.entries[0], {
      order: 1,
      action: 'Energize the instrument and allow the indication to stabilize',
      drive: '',
      args: {},
      hold: '30min',
      verify: null,
    });
    assert.deepEqual(prep.entries[1], {
      order: 2,
      action:
        'Apply the preload three times, returning to zero between applications',
      drive: 'ladApply',
      args: { load: 'e_max', repetitions: '3' },
      hold: 'PT1M',
      verify: null,
    });
    assert.deepEqual(prep.entries[2], {
      order: 3,
      action: 'Verify the zero indication',
      drive: '',
      args: {},
      hold: '',
      verify: {
        read: 'zero_indication',
        tolerance: '/req/metrological/zero-error',
      },
    });
    assert.deepEqual(prep.sourceRefs, [
      { doc: 'urn:oiml:pub:r:60-2:2021', clause: '2.10.1.2' },
      { doc: 'urn:oiml:pub:r:60-2:2021', clause: '2.10.1.3' },
    ]);
  });

  it('parses the five-point stimulus program', () => {
    const m = load(LOAD_CELL_TEST);
    const stim = m.conformanceTests[0].stimulus;
    assert.ok(stim, 'expected the stimulus program');
    assert.equal(stim.description, 'The five-point ascending load program');
    assert.equal(stim.entries.length, 5);
    assert.deepEqual(stim.entries[0], {
      order: 1,
      drive: 'ladApply',
      args: { load: '0.1 * e_max' },
      hold: 'PT1M',
      freshWithin: '5s',
      acceptance: '/req/metrological/mpe',
    });
    assert.deepEqual(stim.entries[4], {
      order: 5,
      drive: 'ladApply',
      args: { load: 'e_max' },
      hold: 'PT1M',
      freshWithin: '5s',
      acceptance: '/req/metrological/mpe',
    });
    assert.deepEqual(stim.sourceRefs, [
      { doc: 'urn:oiml:pub:r:60-2:2021', clause: '2.10.1.7' },
    ]);
  });

  it('parses the argument-expression spellings — quoted, bare, and inline ocl{…}', () => {
    const m = load(`
conformance_test /conf/t {
  name "T"
  stimulus {
    point 1 {
      drive ladApply
      args { quoted: "0.1 * e_max" bare: e_max inline: ocl{0.5 * e_max} }
      fresh_within 5s
      acceptance "/req/mpe"
    }
  }
}
`);
    const point = m.conformanceTests[0].stimulus!.entries[0];
    assert.deepEqual(point.args, {
      quoted: '0.1 * e_max',
      bare: 'e_max',
      inline: 'ocl{0.5 * e_max}',
    });
  });

  it('stays total on a head-less entry (order null — C147 judges the shape)', () => {
    const m = load(`
conformance_test /conf/t {
  name "T"
  preparation {
    step { action "no order head" }
  }
  stimulus {
    point { drive ladApply fresh_within 5s acceptance "/req/mpe" }
  }
}
`);
    const ct = m.conformanceTests[0];
    assert.equal(ct.preparation!.entries[0].order, null);
    assert.equal(ct.preparation!.entries[0].action, 'no order head');
    assert.equal(ct.stimulus!.entries[0].order, null);
    assert.equal(ct.stimulus!.entries[0].drive, 'ladApply');
  });

  it('parses a garbage order head as NaN (the total-parser doctrine)', () => {
    const m = load(`
conformance_test /conf/t {
  name "T"
  stimulus {
    point garbage { drive ladApply fresh_within 5s acceptance "/req/mpe" }
  }
}
`);
    assert.ok(Number.isNaN(m.conformanceTests[0].stimulus!.entries[0].order));
  });

  it('ignores unknown facets (forward compatibility)', () => {
    const m = load(`
conformance_test /conf/t {
  name "T"
  preparation {
    rationale "not yet a facet"
    step 1 { action "a" future_facet "x" }
  }
  stimulus {
    point 1 { drive ladApply note "future" fresh_within 5s acceptance "/req/mpe" }
  }
}
`);
    const ct = m.conformanceTests[0];
    assert.equal(ct.preparation!.entries[0].action, 'a');
    assert.equal(ct.stimulus!.entries[0].drive, 'ladApply');
  });

  it('leaves the programs null when the facets are absent (additive)', () => {
    const m = load('conformance_test /conf/t {\n  name "T"\n}\n');
    const ct = m.conformanceTests[0];
    assert.equal(ct.preparation, null);
    assert.equal(ct.stimulus, null);
  });
});

describe('test programs — round-trip (the serializer fixpoint)', () => {
  it('round-trips the load-cell fixture losslessly (fixpoint)', () => {
    const m1 = load(LOAD_CELL_TEST);
    const dumped = dump(m1);
    const m2 = load(dumped);
    assert.deepEqual(m2.conformanceTests, m1.conformanceTests);
    assert.equal(dump(m2), dumped);
  });

  it('re-parses the canonical ref derives-from provenance emission into sourceRefs', () => {
    // The dump emits the program's source blocks in the canonical
    // provenance spelling (docs/primmel/18 §18.4 — one derives-from ref
    // line per block); the re-parse must fold them back into sourceRefs
    // or the fixpoint breaks.
    const dumped = dump(load(LOAD_CELL_TEST));
    assert.ok(
      dumped.includes(
        '    ref derives-from "urn:oiml:pub:r:60-2:2021#clause-2.10.1.2"',
      ),
      `expected the canonical provenance emission, got:\n${dumped}`,
    );
    const m2 = load(dumped);
    assert.deepEqual(m2.conformanceTests[0].preparation!.sourceRefs, [
      { doc: 'urn:oiml:pub:r:60-2:2021', clause: '2.10.1.2' },
      { doc: 'urn:oiml:pub:r:60-2:2021', clause: '2.10.1.3' },
    ]);
  });

  it('round-trips a MALFORMED program byte-clean (order-null entries)', () => {
    // The parser stays total on head-less entries; the dump re-emits
    // them head-less so the re-parse reproduces the malformed model
    // exactly — the linter (C147), not the codec, owns the judgment.
    const malformed = `
conformance_test /conf/t {
  name "T"
  preparation {
    step { action "no order" }
  }
  stimulus {
    point { drive ladApply fresh_within 5s acceptance "/req/mpe" }
  }
}
`;
    const m1 = load(malformed);
    const dumped = dump(m1);
    assert.ok(
      dumped.includes('    step {'),
      `expected the head-less step re-emitted, got:\n${dumped}`,
    );
    assert.ok(
      dumped.includes('    point {'),
      `expected the head-less point re-emitted, got:\n${dumped}`,
    );
    const m2 = load(dumped);
    assert.deepEqual(m2.conformanceTests, m1.conformanceTests);
    assert.equal(dump(m2), dumped);
  });

  it('quotes the argument expressions on dump (free strings — the comment-character hazard)', () => {
    const m1 = load(`
conformance_test /conf/t {
  name "T"
  stimulus {
    point 1 { drive ladApply args { load: "0.1 * e_max" note: "see tests.md#anchor" } fresh_within 5s acceptance "/req/mpe" }
  }
}
`);
    const dumped = dump(m1);
    assert.ok(
      dumped.includes(
        'args { load: "0.1 * e_max" note: "see tests.md#anchor" }',
      ),
      `expected the args values quoted in the dump, got:\n${dumped}`,
    );
    const m2 = load(dumped);
    assert.deepEqual(m2.conformanceTests, m1.conformanceTests);
    assert.equal(dump(m2), dumped);
  });
});

describe('test programs — lint rules (C147–C148)', () => {
  it('stays silent on the clean load-cell fixture', () => {
    const issues = testProgramIssues(makeTmpPackage(LOAD_CELL_TEST));
    assert.deepEqual(
      issues,
      [],
      `expected no test-program issues, got: ${issues.map(e => `[${e.check}] ${e.message}`).join('\n')}`,
    );
  });

  it('C147 fires on a preparation step carrying neither action nor drive', () => {
    const issues = testProgramIssues(
      makeTmpPackage(`
conformance_test /conf/t {
  name "T"
  preparation {
    step 1 { hold 30min }
  }
}
`),
    );
    assert.ok(
      issues.some(
        i =>
          i.check === 'C147' && i.message.includes('neither action nor drive'),
      ),
      `expected the action/drive leg, got: ${issues.map(i => i.message).join('\n')}`,
    );
  });

  it('C147 fires on duplicate and non-positive entry orders', () => {
    const issues = testProgramIssues(
      makeTmpPackage(`
conformance_test /conf/t {
  name "T"
  stimulus {
    point 1 { drive ladApply fresh_within 5s acceptance "/req/mpe" }
    point 1 { drive ladApply fresh_within 5s acceptance "/req/mpe" }
    point 0 { drive ladApply fresh_within 5s acceptance "/req/mpe" }
  }
}
`),
    );
    assert.ok(
      issues.some(
        i => i.check === 'C147' && i.message.includes('declared twice'),
      ),
      `expected the duplicate-order leg, got: ${issues.map(i => i.message).join('\n')}`,
    );
    assert.ok(
      issues.some(
        i =>
          i.check === 'C147' && i.message.includes('no positive-integer order'),
      ),
      `expected the non-positive-order leg, got: ${issues.map(i => i.message).join('\n')}`,
    );
  });

  it('C147 fires on a verify block missing read or tolerance', () => {
    const issues = testProgramIssues(
      makeTmpPackage(`
conformance_test /conf/t {
  name "T"
  preparation {
    step 1 { action "zero check" verify { read zero_indication } }
  }
}
`),
    );
    assert.ok(
      issues.some(
        i => i.check === 'C147' && i.message.includes('without tolerance'),
      ),
      `expected the verify leg, got: ${issues.map(i => i.message).join('\n')}`,
    );
  });

  it('C147 fires on a stimulus point without a drive or an acceptance reference', () => {
    const issues = testProgramIssues(
      makeTmpPackage(`
conformance_test /conf/t {
  name "T"
  stimulus {
    point 1 { fresh_within 5s }
  }
}
`),
    );
    assert.ok(
      issues.some(i => i.check === 'C147' && i.message.includes('no drive')),
      `expected the drive leg, got: ${issues.map(i => i.message).join('\n')}`,
    );
    assert.ok(
      issues.some(
        i => i.check === 'C147' && i.message.includes('no acceptance'),
      ),
      `expected the acceptance leg, got: ${issues.map(i => i.message).join('\n')}`,
    );
  });

  it('C148 fires on an unparseable hold', () => {
    const issues = testProgramIssues(
      makeTmpPackage(`
conformance_test /conf/t {
  name "T"
  preparation {
    step 1 { action "warm up" hold "a while" }
  }
}
`),
    );
    assert.ok(
      issues.some(
        i =>
          i.check === 'C148' && i.message.includes('not a parseable duration'),
      ),
      `expected the hold leg, got: ${issues.map(i => i.message).join('\n')}`,
    );
  });

  it('C148 fires on a stimulus point without fresh_within, and on an unparseable one', () => {
    const missing = testProgramIssues(
      makeTmpPackage(`
conformance_test /conf/t {
  name "T"
  stimulus {
    point 1 { drive ladApply acceptance "/req/mpe" }
  }
}
`),
    );
    assert.ok(
      missing.some(
        i => i.check === 'C148' && i.message.includes('no fresh_within'),
      ),
      `expected the freshness-required leg, got: ${missing.map(i => i.message).join('\n')}`,
    );
    const bad = testProgramIssues(
      makeTmpPackage(`
conformance_test /conf/t {
  name "T"
  stimulus {
    point 1 { drive ladApply fresh_within soon acceptance "/req/mpe" }
  }
}
`),
    );
    assert.ok(
      bad.some(
        i =>
          i.check === 'C148' &&
          i.message.includes('not a parseable freshness window'),
      ),
      `expected the freshness-shape leg, got: ${bad.map(i => i.message).join('\n')}`,
    );
  });
});

describe('test programs — the end-to-end package leg', () => {
  it('a package authoring the programs loads, checks clean, and dump-fixpoints', () => {
    const dir = makeTmpPackage(LOAD_CELL_TEST);
    const { standard } = loadPackageWithIssues(dir);
    assert.ok(standard, 'expected the package to load');
    const ct = standard!.conformanceTests[0];
    assert.equal(ct.preparation!.entries.length, 3);
    assert.equal(ct.stimulus!.entries.length, 5);
    const first = dump(standard!);
    const second = dump(load(first));
    assert.equal(second, first, 'the serializer fixpoint holds');
  });
});

describe('test programs — corpus-clean (additive/OCP)', () => {
  it(
    'the shipped packages show zero test-program-rule issues',
    { skip: CORPUS_SKIP },
    () => {
      const dirs = readdirSync(CORPUS)
        .map(d => join(CORPUS, d))
        .filter(d => existsSync(join(d, 'package.primmel')))
        .sort();
      for (const dir of dirs) {
        const issues = checkPackage(dir).filter(i =>
          TEST_PROGRAM_RULES.includes(i.check),
        );
        assert.deepEqual(
          issues,
          [],
          `${dir}: a package without a test program must show no test-program-rule issues, got: ${issues.map(e => `[${e.check}] ${e.message}`).join('\n')}`,
        );
      }
    },
  );
});

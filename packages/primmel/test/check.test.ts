// ─────────────────────────────────────────────────────────────────────
// W8 primmel check — cross-layer linter tests.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkPackage } from '../src/check';
import { R60, R60_AVAILABLE, R60_SKIP } from './helpers/corpus';

// The corpus/R 60 resolution (env-first, repo-relative default, loud
// skip) has one home — test/helpers/corpus.ts (TODO.v2/13 item 3c).
if (!R60_AVAILABLE) {
  console.log(`check.test.ts: skipping the R 60 package specs — ${R60_SKIP}`);
}

describe('primmel check (W8)', () => {
  it('the R 60 package passes with zero errors', { skip: R60_SKIP }, () => {
    const issues = checkPackage(R60);
    const errors = issues.filter(i => i.severity === 'error');
    assert.deepEqual(
      errors,
      [],
      `expected 0 errors, got: ${errors.map(e => `[${e.check}] ${e.message}`).join('\n')}`,
    );
  });

  it('catches scope mismatches, dangling refs, and bad dimensions (fixture)', () => {
    // Synthetic fixture via a temp package
    const dir = makeTmpPackage();
    const issues = checkPackage(dir);
    const messages = issues.map(i => `[${i.check}] ${i.message}`).join('\n');
    assert.ok(
      messages.includes('attribute "bogus_attr" not defined'),
      'C1 bogus attr caught',
    );
    assert.ok(
      messages.includes('not a declared requirement'),
      'C2 dangling target caught',
    );
    assert.ok(
      messages.includes('not in the dimension'),
      'C3 bad dimension value caught',
    );
    assert.ok(messages.includes('both'), 'C4 duplicate store caught');
  });

  it('catches subject-anatomy violations C6/C7/C8 (fixture)', () => {
    const dir = makeAnatomyTmpPackage();
    const issues = checkPackage(dir);
    const messages = issues.map(i => `[${i.check}] ${i.message}`).join('\n');
    // C6 — wrong family: `attributes` block under `is`
    assert.ok(
      messages.includes('[C6]') && messages.includes('belongs to "has"'),
      'C6 wrong-family aspect caught',
    );
    // C6 — test-dependent value among design parameters
    assert.ok(messages.includes('test-dependent'), 'C6 test-dependent caught');
    // C6 — condition tier among has.attributes
    assert.ok(messages.includes('condition tier'), 'C6 condition tier caught');
    // C7 — characteristic without a derivation
    assert.ok(
      messages.includes('[C7]') && messages.includes('creep'),
      'C7 missing derivation caught',
    );
    // C8 — does.behavior ref with no declared behavior
    assert.ok(
      messages.includes('[C8]') && messages.includes('"fly"'),
      'C8 dangling behavior caught',
    );
    // Every issue in this fixture is an anatomy error (no noise).
    const nonAnatomy = issues.filter(
      i => !['C6', 'C7', 'C8'].includes(i.check),
    );
    assert.deepEqual(nonAnatomy, []);
  });

  it('clean subject anatomy stays silent on C6/C7/C8 (fixture)', () => {
    const dir = makeCleanAnatomyTmpPackage();
    const issues = checkPackage(dir);
    const anatomy = issues.filter(i => ['C6', 'C7', 'C8'].includes(i.check));
    assert.deepEqual(
      anatomy,
      [],
      `expected no anatomy issues, got: ${anatomy
        .map(e => `[${e.check}] ${e.message}`)
        .join('\n')}`,
    );
  });

  it('warns when a subject extends an undeclared subject (C9, fixture)', () => {
    const dir = makeDanglingExtendsTmpPackage();
    const issues = checkPackage(dir);
    const c9 = issues.filter(i => i.check === 'C9');
    assert.ok(c9.length > 0, 'C9 fired');
    assert.ok(
      c9.every(i => i.severity === 'warning'),
      'C9 is a warning, not an error',
    );
    assert.ok(
      c9.some(i => i.message.includes('"Ghost"')),
      `C9 names the missing parent, got: ${c9.map(i => i.message).join('\n')}`,
    );
  });

  it('declared extends parents stay silent on C9 (fixture)', () => {
    const dir = makeCleanExtendsTmpPackage();
    const issues = checkPackage(dir);
    const c9 = issues.filter(i => i.check === 'C9');
    assert.deepEqual(
      c9,
      [],
      `expected no C9 issues, got: ${c9
        .map(e => `[${e.check}] ${e.message}`)
        .join('\n')}`,
    );
  });
});

describe('primmel check — process lint rules (C14 guard, C15, C16)', () => {
  it('C15 fires on a timer_event with no period (fixture)', () => {
    const dir = makeProcessTmpPackage(`process p {
  does {
    start_event s
    action a { executor machine }
    timer_event tick
    end_event e
    flow { s -> a -> tick -> e }
  }
}
`);
    const c15 = checkPackage(dir).filter(i => i.check === 'C15');
    assert.equal(c15.length, 1);
    assert.equal(c15[0].severity, 'error');
    assert.ok(c15[0].message.includes('"tick"'));
    assert.ok(c15[0].message.includes('process-timer-period'));
  });

  it('a timer_event with a declared period stays silent on C15 (fixture)', () => {
    const dir = makeProcessTmpPackage(`process p {
  does {
    start_event s
    action a { executor machine }
    timer_event tick { period "P1M" }
    end_event e
    flow { s -> a -> tick -> e }
  }
}
`);
    const c15 = checkPackage(dir).filter(i => i.check === 'C15');
    assert.deepEqual(c15, []);
  });

  it('C14 fires when the only loop "guard" is a period-less timer_event (fixture)', () => {
    const dir = makeProcessTmpPackage(`process p {
  does {
    start_event s
    action a { executor machine }
    timer_event tick
    end_event e
    flow {
      s -> a
      a -> tick
      tick -> a
      a -> e
    }
  }
}
`);
    const c14 = checkPackage(dir).filter(i => i.check === 'C14');
    assert.equal(c14.length, 1);
    assert.ok(c14[0].message.includes('no timer event'));
    assert.equal(c14[0].severity, 'error');
  });

  it('a loop guarded by a timer WITH a period stays silent on C14 (fixture)', () => {
    const dir = makeProcessTmpPackage(`process p {
  does {
    start_event s
    action a { executor machine }
    timer_event tick { period "P1M" }
    end_event e
    flow {
      s -> a
      a -> tick
      tick -> a
      a -> e
    }
  }
}
`);
    const issues = checkPackage(dir).filter(i =>
      ['C14', 'C15'].includes(i.check),
    );
    assert.deepEqual(issues, []);
  });

  it('C16 fires on a duplicate step id in one does body (fixture)', () => {
    const dir = makeProcessTmpPackage(`process p {
  does {
    start_event s
    action a { executor machine }
    action a { executor actor }
    end_event e
    flow { s -> a a -> e }
  }
}
`);
    const c16 = checkPackage(dir).filter(i => i.check === 'C16');
    assert.equal(c16.length, 1);
    assert.equal(c16[0].severity, 'error');
    assert.ok(c16[0].message.includes('"a"'));
    assert.ok(c16[0].message.includes('process-step-ids-unique'));
  });

  it('unique step ids stay silent on C16 (fixture)', () => {
    const dir = makeProcessTmpPackage(`process p {
  does {
    start_event s
    action a { executor machine }
    action b { executor actor }
    end_event e
    flow { s -> a -> b -> e }
  }
}
`);
    const c16 = checkPackage(dir).filter(i => i.check === 'C16');
    assert.deepEqual(c16, []);
  });
});

function makeTmpPackage(): string {
  const { mkdtempSync, mkdirSync, writeFileSync } = require('fs');
  const { tmpdir } = require('os');
  const { join } = require('path');
  const dir = mkdtempSync(join(tmpdir(), 'primmel-check-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(
    join(dir, 'model', 'instrument.prl'),
    `instrument T {
  dimension accuracy_class {
    scope group
    values { A B }
  }
}
attribute_definition e_max { symbol "E_max" origin design-fixed scope model }`,
  );
  mkdirSync(join(dir, 'entities'));
  writeFileSync(
    join(dir, 'entities', 'a.prl'),
    `class A#data { store { things } id: string { modality SHALL } }
class B#data { store { things } id: string { modality SHALL } }`,
  );
  mkdirSync(join(dir, 'specification'));
  writeFileSync(
    join(dir, 'specification', 'requirements.prl'),
    `requirement /req/x {
  binds_to { model.parameters.bogus_attr }
  applicability { accuracy_class: [Z] }
}
conformance_test /conf/t {
  targets { /req/missing }
  test_subject { accuracy_class: "Z" }
}`,
  );
  mkdirSync(join(dir, 'execution'));
  writeFileSync(
    join(dir, 'execution', 'f.prl'),
    `form F {
  name "F"
  field x { bind model.parameters.bogus_attr }
}`,
  );
  return dir;
}

/**
 * Subject-anatomy violation fixture (TODO.roadmap/01):
 *  - C6: `attributes` block under `is` (wrong family);
 *        design parameter d_min marked test_dependent;
 *        condition tier `rated` among has.attributes.
 *  - C7: characteristic creep names no derivation.
 *  - C8: does behavior `fly` has no declared behavior (measure does).
 */
function makeAnatomyTmpPackage(): string {
  const { mkdtempSync, mkdirSync, writeFileSync } = require('fs');
  const { tmpdir } = require('os');
  const { join } = require('path');
  const dir = mkdtempSync(join(tmpdir(), 'primmel-anatomy-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(
    join(dir, 'model', 'subject.prl'),
    `behavior measure { kind measurement }
subject LoadCell {
  is {
    design_parameters { d_min : mass test_dependent }
    attributes { e_max : mass by design }
  }
  has {
    attributes { rated : temperature }
    characteristics { creep c_c }
  }
  does {
    behavior measure
    behavior fly
  }
}`,
  );
  return dir;
}

/** Clean subject-anatomy fixture — no C6/C7/C8 issue may fire. */
function makeCleanAnatomyTmpPackage(): string {
  const { mkdtempSync, mkdirSync, writeFileSync } = require('fs');
  const { tmpdir } = require('os');
  const { join } = require('path');
  const dir = mkdtempSync(join(tmpdir(), 'primmel-anatomy-clean-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(
    join(dir, 'model', 'subject.prl'),
    `behavior measure { kind measurement }
behavior creep { kind temporal }
subject LoadCell {
  extends MeasuringInstrumentModel
  is {
    metadata { name "Load cell" source "urn:oiml:pub:r:60-1:2021#clause-3.1.3" }
    design_parameters { e_max : mass by design }
    designed_conditions { reference ref-conds rated rated-conds }
    promises { "holds class C over the rated range" }
  }
  has {
    attributes { d_min : mass test_dependent indication : counts test_dependent time : time test_dependent }
    dimensions { accuracy_class in {A,B,C,D} }
    characteristics {
      creep c_c = ocl{self.indication.delta / self.time.delta}
    }
  }
  does {
    behavior measure
    behavior creep
  }
}`,
  );
  return dir;
}

/**
 * Dangling-extends fixture (C9): the subject extends a parent that is
 * not a declared subject id.
 */
function makeDanglingExtendsTmpPackage(): string {
  const { mkdtempSync, mkdirSync, writeFileSync } = require('fs');
  const { tmpdir } = require('os');
  const { join } = require('path');
  const dir = mkdtempSync(join(tmpdir(), 'primmel-extends-dangling-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(
    join(dir, 'model', 'subject.prl'),
    `subject Child {
  extends Ghost
  is { metadata { name "Child" } }
}`,
  );
  return dir;
}

/** Clean-extends fixture — the parent is declared, so C9 stays silent. */
function makeCleanExtendsTmpPackage(): string {
  const { mkdtempSync, mkdirSync, writeFileSync } = require('fs');
  const { tmpdir } = require('os');
  const { join } = require('path');
  const dir = mkdtempSync(join(tmpdir(), 'primmel-extends-clean-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(
    join(dir, 'model', 'subject.prl'),
    `subject Base {
  is { metadata { name "Base" } }
}
subject Child {
  extends Base
  is { metadata { name "Child" } }
}`,
  );
  return dir;
}

/** Process fixture package — one `model/process.prl` with the given body. */
function makeProcessTmpPackage(body: string): string {
  const { mkdtempSync, mkdirSync, writeFileSync } = require('fs');
  const { tmpdir } = require('os');
  const { join } = require('path');
  const dir = mkdtempSync(join(tmpdir(), 'primmel-proc-check-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'process.prl'), body);
  return dir;
}

describe('C103 declared-predicate (docs/primmel/18 §18.6)', () => {
  it('an undeclared ref predicate is an error once a registry exists', () => {
    const dir = makePredicatesTmpPackage(
      `predicate equivalent {
  kind semantic
  subject_kinds { requirement }
  target_kinds { model-element }
}`,
      `requirement /req/demo {
  name "Demo"
  statement "S"
  ref equvialent "/req/other"
}`,
    );
    const c103 = checkPackage(dir).filter(i => i.check === 'C103');
    assert.equal(c103.length, 1);
    assert.ok(c103[0].message.includes('equvialent'), 'names the typo');
    assert.equal(c103[0].severity, 'error');
  });

  it('a declared predicate stays silent', () => {
    const dir = makePredicatesTmpPackage(
      `predicate equivalent {
  kind semantic
  subject_kinds { requirement }
  target_kinds { model-element }
}`,
      `requirement /req/demo {
  name "Demo"
  statement "S"
  ref equivalent "/req/other"
}`,
    );
    const c103 = checkPackage(dir).filter(i => i.check === 'C103');
    assert.deepEqual(c103, []);
  });

  it('no declared registry — the rule is dormant (the codec is program-agnostic)', () => {
    const dir = makePredicatesTmpPackage(
      '',
      `requirement /req/demo {
  name "Demo"
  statement "S"
  ref anything-goes "/req/other"
}`,
    );
    const c103 = checkPackage(dir).filter(i => i.check === 'C103');
    assert.deepEqual(c103, []);
  });
});

/** Registry + requirement fixture package for the C103 leg. */
function makePredicatesTmpPackage(
  predicatesBody: string,
  requirementBody: string,
): string {
  const { mkdtempSync, mkdirSync, writeFileSync } = require('fs');
  const { tmpdir } = require('os');
  const { join } = require('path');
  const dir = mkdtempSync(join(tmpdir(), 'primmel-c103-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'specification'));
  if (predicatesBody) {
    writeFileSync(join(dir, 'specification', 'predicates.prl'), predicatesBody);
  }
  writeFileSync(
    join(dir, 'specification', 'requirements.prl'),
    requirementBody,
  );
  return dir;
}

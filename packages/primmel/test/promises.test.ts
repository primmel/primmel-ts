// ─────────────────────────────────────────────────────────────────────
// Promises (Primmel v3, TODO.roadmap/08) — first-class manufacturer claims
// on characteristics and behavior (is.promises): rich entries with
// target/level/conditions/statement/verified_by, the statement-only
// shorthand, round-trip losslessness, and the linter rules
//   C42 promise-target-resolves
//   C43 promise-verifiable
//   C44 promise-not-bare-value
// (+ C2 resolution of declared verified_by ids).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const PACKAGE = `
behavior creep {
  kind temporal
  stimulus force
  response "Change in load cell output with time under constant load."
  verified_by { /conf/metrological-tests/creep }
}

requirement /req/metrological/mpe {
  name "Maximum permissible errors"
  statement "The error of indication shall not exceed the MPE."
  limit {
    expression "ocl{abs(e_l) <= mpe}"
    uses { e_l mpe }
  }
}

conformance_test /conf/metrological-tests/mpe-test {
  name "Measurement error test"
  targets { /req/metrological/mpe }
}

conformance_test /conf/metrological-tests/creep {
  name "Creep test"
}

subject LoadCell {
  is {
    design_parameters { e_max : mass by design }
    promises {
      accuracy-class {
        target error-hold
        level symbolic C6
        conditions ocl{self.temperature >= rated.t_min and self.temperature <= rated.t_max}
        statement "Holds accuracy class C6 across the rated range −10…+40 °C."
        verified_by { /req/metrological/mpe /conf/metrological-tests/mpe-test }
        source { doc "urn:oiml:pub:r:60-1:2021" clause "5.1" }
      }
      creep-limit {
        target creep
        level { value 0.7 unit v }
        statement "Creep stays within 0.7 v over the 30-minute test."
      }
      temp-envelope {
        target creep
        level range { min -10 max 40 unit degC }
        conditions "over the rated temperature range"
        statement "The rated envelope spans −10…+40 °C."
      }
      "a statement-only claim"
    }
  }
  has {
    attributes { d_min : mass test_dependent indication : counts test_dependent reference : counts test_dependent }
    characteristics {
      error-hold e_l = ocl{self.indication - self.reference}
    }
  }
  does {
    behavior creep
  }
}
`;

describe('is.promises — rich promise entries (TODO.roadmap/08)', () => {
  it('parses rich entries: target, level kinds, conditions, statement, verified_by, source', () => {
    const m = load(PACKAGE);
    const s = m.subjects.find(x => x.id === 'LoadCell')!;
    assert.equal(s.is.promises.length, 4);

    const [cls, creep, env, prose] = s.is.promises;
    assert.deepEqual(cls, {
      id: 'accuracy-class',
      target: 'error-hold',
      level: { kind: 'symbolic', symbolic: 'C6' },
      conditions:
        'ocl{self.temperature >= rated.t_min and self.temperature <= rated.t_max}',
      statement: 'Holds accuracy class C6 across the rated range −10…+40 °C.',
      verifiedBy: [
        '/req/metrological/mpe',
        '/conf/metrological-tests/mpe-test',
      ],
      source: { doc: 'urn:oiml:pub:r:60-1:2021', clause: '5.1' },
    });
    assert.deepEqual(creep, {
      id: 'creep-limit',
      target: 'creep',
      level: { kind: 'quantity', quantity: { value: 0.7, unit: 'v' } },
      conditions: '',
      statement: 'Creep stays within 0.7 v over the 30-minute test.',
      verifiedBy: [],
      source: null,
    });
    assert.deepEqual(env, {
      id: 'temp-envelope',
      target: 'creep',
      level: { kind: 'range', min: -10, max: 40, unit: 'degC' },
      conditions: 'over the rated temperature range',
      statement: 'The rated envelope spans −10…+40 °C.',
      verifiedBy: [],
      source: null,
    });
    // The statement-only shorthand (legacy string-list form).
    assert.deepEqual(prose, {
      id: '',
      target: '',
      level: null,
      conditions: '',
      statement: 'a statement-only claim',
      verifiedBy: [],
      source: null,
    });
  });

  it('parses range bounds that are symbolic or quoted', () => {
    const m = load(`subject S {
  is {
    promises {
      open-range {
        target creep
        level range { min 0 max "unlimited" unit v }
      }
    }
  }
}
`);
    const p = m.subjects[0].is.promises[0];
    assert.deepEqual(p.level, {
      kind: 'range',
      min: 0,
      max: 'unlimited',
      unit: 'v',
    });
  });

  it('round-trips rich + shorthand promises losslessly (fixpoint)', () => {
    const m1 = load(PACKAGE);
    const dumped = dump(m1);
    const m2 = load(dumped);
    assert.deepEqual(m2.subjects, m1.subjects);
    assert.deepEqual(m2.behaviors, m1.behaviors);
    assert.equal(dump(m2), dumped);
  });

  it('keeps the legacy single-line dump for statement-only blocks (byte-compat)', () => {
    const m1 = load(`subject S {
  is { promises { "holds class C over the rated range" } }
}
`);
    const dumped = dump(m1);
    assert.ok(
      dumped.includes('promises { "holds class C over the rated range" }'),
    );
    const m2 = load(dumped);
    assert.deepEqual(m2.subjects, m1.subjects);
    assert.equal(dump(m2), dumped);
  });

  it('extends merges promises as a list — parent entries first', () => {
    const m = load(`
subject Base {
  is {
    promises {
      base-claim { target creep level symbolic C statement "base" }
    }
  }
}
subject Child {
  extends Base
  is {
    promises {
      child-claim { target creep statement "child" }
    }
  }
}
`);
    const child = m.subjects.find(x => x.id === 'Child')!;
    assert.deepEqual(
      child.is.promises.map(p => p.id),
      ['base-claim', 'child-claim'],
    );
  });
});

// ── linter fixtures ──────────────────────────────────────────────────

/** Write a one-file fixture package and return its directory. */
function makeTmpPackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-promises-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'subject.prl'), body);
  return dir;
}

/** A clean promise set: targets resolve, verification declared or derivable. */
const CLEAN = `
behavior creep {
  kind temporal
  verified_by { /conf/metrological-tests/creep }
}
requirement /req/metrological/mpe {
  name "MPE"
  limit {
    expression "ocl{abs(e_l) <= mpe}"
    uses { e_l mpe }
  }
}
conformance_test /conf/metrological-tests/mpe-test {
  name "MPE test"
  targets { /req/metrological/mpe }
}
conformance_test /conf/metrological-tests/creep {
  name "Creep test"
}
subject LoadCell {
  is {
    promises {
      accuracy-class {
        target error-hold
        level symbolic C6
        statement "Holds accuracy class C6."
        verified_by { /req/metrological/mpe }
      }
      derived-verification {
        target error-hold
        statement "Derivable via the MPE requirement binding e_l."
      }
      behavior-claim {
        target creep
        statement "Derivable via the behavior's verified_by."
      }
    }
  }
  has {
    characteristics { error-hold e_l = ocl{self.indication - self.reference} }
  }
}
`;

describe('promise lint rules (C42/C43/C44 + C2 verified_by)', () => {
  it('stays silent on a clean promise set', () => {
    const issues = checkPackage(makeTmpPackage(CLEAN));
    const promiseIssues = issues.filter(i =>
      ['C42', 'C43', 'C44'].includes(i.check),
    );
    assert.deepEqual(
      promiseIssues,
      [],
      `expected no promise issues, got: ${promiseIssues
        .map(e => `[${e.check}] ${e.message}`)
        .join('\n')}`,
    );
    // No C2 noise from the declared verified_by either.
    assert.deepEqual(
      issues.filter(i => i.check === 'C2' && i.message.includes('promise')),
      [],
    );
  });

  it('C42 fires when the target is not a declared characteristic or behavior', () => {
    const dir = makeTmpPackage(`subject S {
  is {
    promises {
      bogus { target no-such-thing statement "claims the impossible" }
    }
  }
  has { characteristics { creep c_c = ocl{self.a} } }
}
`);
    const c42 = checkPackage(dir).filter(i => i.check === 'C42');
    assert.equal(c42.length, 1);
    assert.equal(c42[0].severity, 'error');
    assert.ok(c42[0].message.includes('subject S: promise "bogus"'));
    assert.ok(c42[0].message.includes('"no-such-thing"'));
    assert.ok(c42[0].message.includes('(promise-target-resolves)'));
  });

  it('C44 rejects a promise that merely restates a declared attribute value', () => {
    const dir = makeTmpPackage(`attribute_definition t_min {
  symbol "T_min"
  origin declared
}
subject S {
  is {
    design_parameters { e_max : mass by design }
    promises {
      bare-attr { target t_min level { value -10 unit degC } statement "t_min = −10 °C" }
      bare-design { target e_max level { value 500 unit kg } statement "E_max = 500 kg" }
      bare-exhibited { target d_min level { value 0 unit kg } statement "d_min = 0 kg" }
    }
  }
  has { attributes { d_min : mass test_dependent } }
}
`);
    const c44 = checkPackage(dir).filter(i => i.check === 'C44');
    assert.equal(c44.length, 3);
    assert.ok(c44.every(i => i.severity === 'error'));
    for (const id of ['bare-attr', 'bare-design', 'bare-exhibited']) {
      assert.ok(
        c44.some(i => i.message.includes(`promise "${id}"`)),
        `C44 names ${id}`,
      );
    }
    assert.ok(
      c44[0].message.includes('only restates the declared attribute value'),
    );
    assert.ok(c44[0].message.includes('origin: declared attributes'));
    assert.ok(c44[0].message.includes('(promise-not-bare-value)'));
    // A bare-value target is NOT additionally reported as unresolved (C42).
    assert.deepEqual(
      checkPackage(dir).filter(i => i.check === 'C42'),
      [],
    );
  });

  it('C44 stays silent on genuine claims ABOUT an attribute target', () => {
    // The crime is restating a bare value, not targeting an attribute:
    // conditioned, envelope/range, symbolic-level, verified, and level-less
    // claims about attribute/dimension targets are all legal (the R 60
    // pilot's shape — data/r60/model/promises.yaml).
    const dir = makeTmpPackage(`attribute_definition t_min {
  symbol "T_min"
  origin declared
}
requirement /req/metrological/temperature {
  name "Temperature limits"
  statement "Holds across the rated range."
}
subject S {
  is {
    design_parameters { e_max : mass by design }
    promises {
      conditioned { target t_min level { value -10 unit degC } conditions "ocl{self.climate == 'cold'}" statement "t_min = −10 °C for the cold-climate variant." }
      symbolic-level { target e_max level symbolic heavy statement "Rated for the heavy-duty tier." }
      envelope { target t_min level range { min -10 max 40 unit degC } statement "Holds across −10…+40 °C." }
      verified { target t_min level { value -10 unit degC } verified_by { /req/metrological/temperature } statement "t_min = −10 °C, verified." }
      citation { target e_max statement "Maximum capacity per model — reads the exhibited value." }
    }
  }
  has { attributes { d_min : mass test_dependent } }
}
`);
    const issues = checkPackage(dir);
    assert.deepEqual(
      issues.filter(i => i.check === 'C44'),
      [],
      'no C44 on conditioned/symbolic/range/verified/citation claims',
    );
    assert.deepEqual(
      issues.filter(i => i.check === 'C42'),
      [],
      'attribute targets do not degrade to C42',
    );
  });

  it('C44 stays silent on characteristic/behavior targets (name-collision precedence)', () => {
    // A characteristic/behavior name wins the collision with an attribute
    // id — even with the exact C44-firing shape (bare quantity level, no
    // conditions, no verified_by), these are claims on the characteristic/
    // behavior, never restatements.
    const dir = makeTmpPackage(`attribute_definition creep {
  symbol "c"
  origin declared
}
attribute_definition error-hold {
  symbol "e_h"
  origin declared
}
behavior creep {
  kind temporal
  verified_by { /conf/metrological-tests/creep }
}
requirement /req/metrological/hold {
  name "Error hold"
  statement "The error holds."
  limit {
    expression "ocl{abs(e_l) <= 1}"
    uses { e_l }
  }
}
conformance_test /conf/metrological-tests/creep {
  name "Creep test"
}
subject S {
  is {
    promises {
      behavior-wins { target creep level { value 0.7 unit v } statement "Creep stays within 0.7 v." }
      characteristic-wins { target error-hold level { value 1 unit v } statement "The error characteristic holds." }
    }
  }
  has {
    characteristics { error-hold e_l = ocl{self.indication - self.reference} }
  }
}
`);
    const issues = checkPackage(dir);
    assert.deepEqual(
      issues.filter(i => ['C42', 'C43', 'C44'].includes(i.check)),
      [],
      `expected no promise issues, got: ${issues
        .filter(i => ['C42', 'C43', 'C44'].includes(i.check))
        .map(e => `[${e.check}] ${e.message}`)
        .join('\n')}`,
    );
  });

  it('C43 warns when no verification is declared or derivable', () => {
    const dir = makeTmpPackage(`behavior creep { kind temporal }
subject S {
  is {
    promises {
      lonely { target creep statement "nothing verifies this" }
      "statement-only claim"
    }
  }
}
`);
    const c43 = checkPackage(dir).filter(i => i.check === 'C43');
    assert.equal(c43.length, 2);
    assert.ok(c43.every(i => i.severity === 'warning'));
    assert.ok(
      c43.some(
        i =>
          i.message.includes('promise "lonely"') &&
          i.message.includes('no requirement/test binds its target "creep"'),
      ),
      'C43 on an underivable target',
    );
    assert.ok(
      c43.some(
        i =>
          i.message.includes('statement-only claim') &&
          i.message.includes('no target and no verified_by'),
      ),
      'C43 on the statement-only shorthand',
    );
  });

  it('C43 stays silent when verification is derivable from requirement/test bindings', () => {
    // CLEAN's `derived-verification` promise declares no verified_by; the
    // MPE requirement binds the target's symbol e_l via limit.uses, and the
    // mpe-test targets that requirement — derivation must silence C43.
    const issues = checkPackage(makeTmpPackage(CLEAN));
    assert.deepEqual(
      issues.filter(i => i.check === 'C43'),
      [],
    );
  });

  it('C2 rejects a dangling verified_by id', () => {
    const dir = makeTmpPackage(`behavior creep { kind temporal }
subject S {
  is {
    promises {
      bad-ref { target creep verified_by { /req/ghost } statement "dangling" }
    }
  }
}
`);
    const c2 = checkPackage(dir).filter(
      i => i.check === 'C2' && i.message.includes('promise'),
    );
    assert.equal(c2.length, 1);
    assert.equal(c2[0].severity, 'error');
    assert.ok(c2[0].message.includes('verified_by "/req/ghost"'));
    assert.ok(
      c2[0].message.includes('not a declared requirement or conformance test'),
    );
    // A declared (resolving-or-not) verified_by satisfies C43.
    assert.deepEqual(
      checkPackage(dir).filter(i => i.check === 'C43'),
      [],
    );
  });
});

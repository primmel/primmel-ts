// ─────────────────────────────────────────────────────────────────────
// promise_set construct (smart TODO.roadmap/40 batch 3) — the rec
// promise register as a file-grade construct: the subject-promise
// sub-grammar reused verbatim (level, conditions, verified_by, the
// certificate print projection), the codec fixpoint, the C42–C44
// generalization (the set id binds the owning subject — the
// characteristic leg gates on that subject composing), and C131 on the
// set's certificate blocks.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const SUBJECT_AND_REGISTERS = `
attribute_definition e_max {
  symbol "E_max"
  name "Maximum capacity"
  definition "The maximum load the cell measures."
  value_type quantity
}
attribute_definition accuracy_class {
  symbol "Acc"
  name "Accuracy class"
  definition "The accuracy class."
  value_type string
}
behavior creep {
  kind temporal
  stimulus force
  response "Change in load cell output with time under constant load."
}
subject LoadCell {
  is {
    design_parameters { e_max : mass by design }
  }
  has {
    characteristics {
      error-hold e_l = ocl{self.indication - self.reference}
    }
  }
  does {
    behavior creep
  }
}
`;

const SET = `
promise_set LoadCell {
  promise e_max_values {
    target e_max
    statement "Maximum capacity E_max per model."
    certificate {
      attribute e_max
      type string
      label "E_max values"
      obligation mandatory
    }
    source { doc "urn:oiml:pub:r:60-1:2021" clause "3.5.5" }
  }
  promise accuracy_class_envelope {
    target accuracy_class
    level symbolic C6
    conditions ocl{self.temperature >= rated.t_min and self.temperature <= rated.t_max}
    statement "Holds class C6 across the rated range."
    certificate {
      type statement
      label "Accuracy envelope"
      obligation optional
    }
  }
}
`;

function makePackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-promiseset-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'package.prl'), body);
  return dir;
}

describe('promise_set construct (smart TODO.roadmap/40 batch 3)', () => {
  it('parses the register with the shared promise sub-grammar', () => {
    const m = load(SET);
    assert.equal(m.promiseSets.length, 1);
    const s = m.promiseSets[0]!;
    assert.equal(s.id, 'LoadCell');
    assert.equal(s.promises.length, 2);
    const a = s.promises[0]!;
    assert.equal(a.id, 'e_max_values');
    assert.equal(a.target, 'e_max');
    assert.equal(a.certificate?.attribute, 'e_max');
    assert.equal(a.certificate?.type, 'string');
    assert.equal(a.certificate?.obligation, 'mandatory');
    assert.equal(a.source?.clause, '3.5.5');
    const b = s.promises[1]!;
    assert.equal(b.level?.kind, 'symbolic');
    assert.match(b.conditions, /^ocl\{/);
    assert.equal(b.certificate?.type, 'statement');
    assert.deepEqual(b.certificate?.attributes, []);
  });

  it('round-trips byte-clean (the codec fixpoint)', () => {
    const out = dump(load(SET));
    assert.ok(out.includes('  promise e_max_values {\n'));
    assert.ok(out.includes('    certificate {\n'));
    assert.equal(dump(load(out)), out);
  });

  it('C42–C44 fire on set entries exactly as on subject promises', () => {
    const body =
      SUBJECT_AND_REGISTERS +
      `
promise_set LoadCell {
  promise ghost_target {
    target ghost_characteristic
    statement "A claim on nothing."
  }
  promise bare_value {
    target e_max
    level { value 500 unit kg }
    statement "A bare restatement."
  }
  promise orphan {
    statement "No target, no verification."
  }
}
`;
    const issues = checkPackage(makePackage(body));
    const c42 = issues.filter(i => i.check === 'C42');
    assert.equal(c42.length, 1);
    assert.match(
      c42[0]!.message,
      /promise_set LoadCell: promise "ghost_target"/,
    );
    const c44 = issues.filter(i => i.check === 'C44');
    assert.equal(c44.length, 1);
    assert.match(c44[0]!.message, /promise_set LoadCell: promise "bare_value"/);
    const c43 = issues.filter(i => i.check === 'C43');
    assert.equal(c43.length, 1);
    assert.match(c43[0]!.message, /promise_set LoadCell: promise "orphan"/);
  });

  it('C42 gates the characteristic leg on the owning subject composing', () => {
    // No subject named LoadCell in scope: a non-attribute target cannot
    // be KNOWN not to be a characteristic — C42 stays silent.
    const issues = checkPackage(
      makePackage(`
promise_set LoadCell {
  promise ghost_target {
    target ghost_characteristic
    statement "A claim on nothing."
  }
}
`),
    ).filter(i => i.check === 'C42');
    assert.deepEqual(issues, []);
  });

  it('C42 stays silent on dimension and symbol targets (smart R15)', () => {
    // The register doctrine (smart's linker R15) resolves a promise target
    // to a declared attribute, dimension, characteristic (symbol id), or
    // behavior — a claim ABOUT a classification dimension or a
    // symbol-registry id is legal (the R 91 register's shape:
    // data/r91/model/promises.yaml targets the metrological_class /
    // mode_of_use dimensions and the v / d / alpha symbols).
    const issues = checkPackage(
      makePackage(
        SUBJECT_AND_REGISTERS +
          `
instrument Meter {
  dimension mode_of_use { values { stationary mobile } }
}
symbol v { name "Speed" }
promise_set LoadCell {
  promise mode_row {
    target mode_of_use
    statement "The type holds its declared mode of use."
  }
  promise speed_interval {
    target v
    statement "The measuring speed interval."
  }
  promise ghost_target {
    target ghost_characteristic
    statement "A claim on nothing."
  }
}
`,
      ),
    ).filter(i => i.check === 'C42');
    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /"ghost_target"/);
    assert.match(
      issues[0]!.message,
      /not a declared characteristic, behavior, attribute, dimension, or symbol/,
    );
  });

  it('C131 fires on the set certificate blocks', () => {
    const body =
      SUBJECT_AND_REGISTERS +
      `
promise_set LoadCell {
  promise broken {
    target e_max
    certificate {
      attribute e_max
      attributes { e_max }
      type blob
    }
  }
}
`;
    const issues = checkPackage(makePackage(body)).filter(
      i => i.check === 'C131',
    );
    assert.equal(issues.length, 3);
    assert.match(issues[0]!.message, /XOR/);
    assert.match(issues[1]!.message, /type "blob"/);
    assert.match(issues[2]!.message, /label is required/);
  });

  it('stays silent on a clean register (C42–C44 + C131)', () => {
    const issues = checkPackage(
      makePackage(SUBJECT_AND_REGISTERS + SET),
    ).filter(i => ['C42', 'C43', 'C44', 'C131'].includes(i.check ?? ''));
    assert.deepEqual(issues, []);
  });
});

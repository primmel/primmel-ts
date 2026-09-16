// ─────────────────────────────────────────────────────────────────────
// calculation_context construct (smart TODO.roadmap/40 batch 3) — the
// evaluation-side wiring of computation inputs to their subject-chain
// sources: the singleton shape, the codec fixpoint, and C133
// (computed⇔expression presence, the classification./parameters.
// resolutions per-register gated, the legacy-token rejection ungated,
// the free-identifier WARNING leg with the function-call exemption).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const CONTEXT = `
calculation_context evaluation {
  field accuracy_class { source classification.accuracy_class }
  field p_lc { source parameters.p_lc }
  field e_max { source parameters.e_max }
  field e_min { source parameters.e_min }
  field n_lc { source parameters.n_lc }
  field v_min { source computed expression "(e_max - e_min) / (n_lc * f)" }
}
`;

const DIMENSIONS = `
dimension accuracy_class {
  cardinality single
  values {
    A { label "Class A" }
    B { label "Class B" }
  }
}
`;

const ATTRIBUTES = `
attribute_definition p_lc {
  name "Relative resolution"
  value_type number
  is_dimension false
}
attribute_definition e_max {
  name "Maximum capacity"
  value_type QuantityValue
  is_dimension false
}
attribute_definition e_min {
  name "Minimum capacity"
  value_type QuantityValue
  is_dimension false
}
attribute_definition n_lc {
  name "Number of verification intervals"
  value_type integer
  is_dimension false
}
`;

function makePackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-calcctx-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'package.prl'), body);
  return dir;
}

describe('calculation_context construct (smart TODO.roadmap/40 batch 3)', () => {
  it('parses the register entries', () => {
    const m = load(CONTEXT);
    assert.equal(m.calculationContexts.length, 1);
    const c = m.calculationContexts[0]!;
    assert.equal(c.id, 'evaluation');
    assert.equal(c.fields.length, 6);
    assert.equal(c.fields[0]!.id, 'accuracy_class');
    assert.equal(c.fields[0]!.source, 'classification.accuracy_class');
    assert.equal(c.fields[0]!.expression, '');
    const v = c.fields[5]!;
    assert.equal(v.id, 'v_min');
    assert.equal(v.source, 'computed');
    assert.equal(v.expression, '(e_max - e_min) / (n_lc * f)');
  });

  it('round-trips byte-clean (the codec fixpoint)', () => {
    const out = dump(load(CONTEXT));
    assert.ok(
      out.includes(
        '  field v_min { source computed expression "(e_max - e_min) / (n_lc * f)" }\n',
      ),
    );
    assert.ok(
      out.includes(
        '  field accuracy_class { source classification.accuracy_class }\n',
      ),
    );
    assert.equal(dump(load(out)), out);
  });

  it('C133: source computed without an expression is flagged', () => {
    const issues = checkPackage(
      makePackage(
        'calculation_context evaluation { field v_min { source computed } }',
      ),
    ).filter(i => i.check === 'C133');
    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /requires the expression facet/);
  });

  it('C133: a non-computed source carrying an expression is flagged', () => {
    const issues = checkPackage(
      makePackage(
        'calculation_context evaluation { field p_lc { source parameters.p_lc expression "p_lc * 2" } }',
      ),
    ).filter(i => i.check === 'C133');
    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /carries no expression/);
  });

  it('C133: a classification source naming no declared dimension is flagged', () => {
    const issues = checkPackage(makePackage(DIMENSIONS + CONTEXT)).filter(
      i => i.check === 'C133',
    );
    // Only the runtime-bound `f` warning fires — every source resolves.
    assert.equal(issues.length, 1);
    assert.equal(issues[0]!.severity, 'warning');
    assert.match(issues[0]!.message, /"f"/);
  });

  it('C133: the classification leg reports the unknown dimension (gated)', () => {
    const body = `
${DIMENSIONS}
calculation_context evaluation {
  field technology { source classification.technology }
}
`;
    const issues = checkPackage(makePackage(body)).filter(
      i => i.check === 'C133' && i.severity === 'error',
    );
    assert.equal(issues.length, 1);
    assert.match(
      issues[0]!.message,
      /"technology" is not a declared classification dimension/,
    );
  });

  it('C133: the parameters leg reports the unknown attribute (gated)', () => {
    const body = `
${ATTRIBUTES}
calculation_context evaluation {
  field p_lc { source parameters.p_lc }
  field bogus { source parameters.bogus }
}
`;
    const issues = checkPackage(makePackage(body)).filter(
      i => i.check === 'C133',
    );
    assert.equal(issues.length, 1);
    assert.match(
      issues[0]!.message,
      /"bogus" is not a declared attribute_definition/,
    );
  });

  it('C133 gates per register — no dimensions or attributes, no resolution legs', () => {
    const body = `
calculation_context evaluation {
  field technology { source classification.technology }
  field anything { source parameters.anything }
}
`;
    const issues = checkPackage(makePackage(body)).filter(
      i => i.check === 'C133',
    );
    assert.deepEqual(issues, []);
  });

  it('C133: a legacy schema token is rejected ungated', () => {
    for (const source of [
      'dimensions.accuracy_class',
      'application',
      'application.specs',
      'lookup',
    ]) {
      const issues = checkPackage(
        makePackage(
          `calculation_context evaluation { field x { source ${source} } }`,
        ),
      ).filter(i => i.check === 'C133' && i.severity === 'error');
      assert.equal(issues.length, 1, source);
      assert.match(issues[0]!.message, /is not a subject-chain source/);
    }
  });

  it('C133: a free expression identifier that is no field warns (runtime-bound input)', () => {
    const issues = checkPackage(makePackage(CONTEXT)).filter(
      i => i.check === 'C133',
    );
    assert.equal(issues.length, 1);
    assert.equal(issues[0]!.severity, 'warning');
    assert.match(
      issues[0]!.message,
      /expression identifier "f" is not a field/,
    );
  });

  it('C133: a function-call identifier is exempt from the free-identifier leg', () => {
    const body = `
calculation_context evaluation {
  field a { source computed expression "1" }
  field b { source computed expression "max(a, 2) + min(a, 3)" }
}
`;
    const issues = checkPackage(makePackage(body)).filter(
      i => i.check === 'C133',
    );
    assert.deepEqual(issues, []);
  });
});

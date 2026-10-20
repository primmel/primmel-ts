// ─────────────────────────────────────────────────────────────────────
// The uncertainty budget (register W5): the GUM plane's language side —
// the components, the coverage, C179. The budget is a declaration: the
// propagation law is the evaluation plane's, never the model's.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPackage } from '../src/ser-des/package';
import { dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const BUDGET = `verdict mpe_error {
  quantity { kind mass unit "kg" }
  derive {
    abs(served - reference)
  }
  inputs { served reference }
}
symbol served { label "s" }
symbol reference { label "r" }
uncertainty_budget u_ref {
  target mpe_error
  coverage k 2
  component u_cal {
    type B
    distribution rectangular
    half_width 0.5
    unit "kg"
    ref derives-from "urn:example:cert:2026#clause-5.1"
    description "The force standard's certificate half-width."
  }
  component u_rep {
    type A
    series reference_pair_error
  }
}
conformance_test /conf/t {
  name "T"
  variables {
    variable reference_pair_error { type number unit "kg" source measured
      series {
        axis time { unit "s" }
        cell reference_pair_error { unit "kg" }
      }
    }
  }
}
`;

function make(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-ub-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'), { recursive: true });
  writeFileSync(join(dir, 'model', 'r.prl'), body);
  return dir;
}

describe('the uncertainty budget', () => {
  it('parses, dumps to a fixpoint, and checks clean', () => {
    const dir = make(BUDGET);
    const m = loadPackage(dir);
    const b = m.uncertaintyBudgets[0];
    assert.equal(b.id, 'u_ref');
    assert.equal(b.target, 'mpe_error');
    assert.equal(b.coverageK, '2');
    assert.equal(b.components.length, 2);
    assert.equal(b.components[0]?.type, 'B');
    assert.equal(b.components[0]?.distribution, 'rectangular');
    assert.equal(b.components[1]?.type, 'A');
    assert.equal(b.components[1]?.series, 'reference_pair_error');
    const dir2 = make(dump(m));
    const m2 = loadPackage(dir2);
    assert.deepEqual(
      JSON.parse(JSON.stringify(m2.uncertaintyBudgets)),
      JSON.parse(JSON.stringify(m.uncertaintyBudgets)),
    );
    const issues = checkPackage(dir).filter(
      i => i.check === 'C179' && i.severity === 'error',
    );
    assert.deepEqual(issues, []);
    rmSync(dir, { recursive: true, force: true });
    rmSync(dir2, { recursive: true, force: true });
  });

  it('names the ghost target', () => {
    const dir = make(BUDGET.replace('target mpe_error', 'target ghost'));
    const msgs = checkPackage(dir)
      .filter(i => i.check === 'C179')
      .map(i => i.message);
    assert.ok(msgs.some(m => m.includes('"ghost"')));
    rmSync(dir, { recursive: true, force: true });
  });

  it('demands a captured series from a Type A component', () => {
    const dir = make(
      BUDGET.replace(
        'series reference_pair_error\n  }',
        'series ghost_series\n  }',
      ),
    );
    const msgs = checkPackage(dir)
      .filter(i => i.check === 'C179')
      .map(i => i.message);
    assert.ok(msgs.some(m => m.includes('"ghost_series"')));
    rmSync(dir, { recursive: true, force: true });
  });

  it('demands the distribution and the half-width from a Type B component', () => {
    const dir = make(
      BUDGET.replace(
        '    distribution rectangular\n    half_width 0.5\n    unit "kg"\n',
        '',
      ),
    );
    const msgs = checkPackage(dir)
      .filter(i => i.check === 'C179')
      .map(i => i.message);
    assert.ok(
      msgs.some(m => m.includes('u_cal') && m.includes('distribution')),
    );
    assert.ok(msgs.some(m => m.includes('u_cal') && m.includes('half_width')));
    rmSync(dir, { recursive: true, force: true });
  });
});

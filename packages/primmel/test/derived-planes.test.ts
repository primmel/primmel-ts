// ─────────────────────────────────────────────────────────────────────
// The derived-plane fixpoint guard (CRITIQUE-2 #3): every declared
// plane stays out of the wire, and the dump is a fixpoint —
// dump(load(dump(x))) is dump(x). A new derived plane declares itself
// in DERIVED_PLANES and the guard grows with it.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DERIVED_PLANES } from '../src/ser-des/derived-planes';
import { loadPackage, dump } from '../src/ser-des/index';

function pkg(): string {
  const dir = mkdtempSync(join(tmpdir(), 'prl-derived-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id probe }');
  mkdirSync(join(dir, 'model'), { recursive: true });
  // a process whose STEPS carry requires (the stepRequires plane) and
  // a requirement limit that folds a check (the folds plane)
  writeFileSync(
    join(dir, 'model', 'm.prl'),
    `process P {
  name "P"
  step s1 {
    name "S1"
    requires { r1 r2 }
  }
}
requirement /req/x {
  name "X"
  statement { S }
  limit {
    expression {
      1 <= 2
    }
  }
}
`,
  );
  return dir;
}

describe('the derived-plane fixpoint guard (CRITIQUE-2 #3)', () => {
  it('declares the known derived planes', () => {
    const paths = DERIVED_PLANES.map(p => p.path);
    assert.ok(
      paths.includes('processes[].stepRequires'),
      'the C160 plane is declared',
    );
    assert.ok(
      paths.includes('checks[].folds'),
      'the boolean-fold plane is declared',
    );
    for (const p of DERIVED_PLANES) {
      assert.ok(p.doctrine.length > 40, `${p.path} states its doctrine`);
    }
  });

  it('the wire carries no derived plane', () => {
    const dir = pkg();
    const std = loadPackage(dir) as unknown as {
      processes: { id: string; stepRequires?: string[] }[];
    };
    // the parse DID derive the plane (the guard guards a live plane)
    assert.ok(
      (std.processes[0]?.stepRequires ?? []).length > 0,
      'stepRequires derives on load',
    );
    const wire = dump(std as never);
    // a process-level `requires` line would be the leak (the steps'
    // own requires lines are indented deeper — the regex keys on the
    // two-space process-level indentation)
    assert.doesNotMatch(
      wire,
      /^ {2}requires /m,
      'the process-level requires plane never serializes',
    );
    assert.doesNotMatch(
      wire,
      /:limit:1 \{/,
      'the folded checks never serialize',
    );
  });

  it('the dump is a fixpoint', () => {
    const dir = pkg();
    const once = dump(loadPackage(dir) as never);
    const dir2 = mkdtempSync(join(tmpdir(), 'prl-derived2-'));
    writeFileSync(join(dir2, 'package.primmel'), 'package { id probe }');
    mkdirSync(join(dir2, 'model'), { recursive: true });
    writeFileSync(join(dir2, 'model', 'm.prl'), once);
    const twice = dump(loadPackage(dir2) as never);
    assert.equal(twice, once, 'dump(load(dump(x))) is dump(x)');
  });
});

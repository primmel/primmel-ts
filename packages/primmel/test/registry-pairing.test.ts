import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkPackage } from '../src/check';

// C157 — registry-dataclass-resolves: the MMEL v2 validation's
// registry→dataclass leg (the rename contract's last flagged
// invariant). The resolver nulls unresolvable references silently;
// the rule makes the formless registry an error.
function fixture(dataClassLine: string): string {
  const dir = join(tmpdir(), `primmel-regpair-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'package.primmel'),
    'package {\n  id regpair\n  kind rec\n}\n',
  );
  writeFileSync(
    join(dir, 'model.prl'),
    [
      'root home',
      'metadata { title "T" schema "MMEL 0.1" edition "1" author "A" namespace "T" shortname "" }',
      `data_registry RiskPlan {`,
      '  title "Risk Plan"',
      `  ${dataClassLine}`,
      '}',
      'class RealClass#data {',
      '  attribute a, string { definition "A" }',
      '}',
      'start_event s { }',
      'process p1 { name "P1" }',
      'end_event e { }',
      'canvas home {',
      '  elements { s { x 0 y 0 } p1 { x 0 y 100 } e { x 0 y 200 } }',
      '  process_flow {',
      '    E1 { from s to p1 }',
      '    E2 { from p1 to e }',
      '  }',
      '  data { RiskPlan { x 50 y 50 } }',
      '}',
    ].join('\n'),
  );
  return dir;
}

describe('C157 registry-dataclass-resolves', () => {
  it('a dangling data_class is an error (the formless registry)', () => {
    const dir = fixture('data_class RiskPlan#data');
    const issues = checkPackage(dir);
    const c157 = issues.filter(i => i.check === 'C157');
    assert.equal(c157.length, 1);
    assert.match(c157[0]!.message, /resolves to no declared dataclass/);
    rmSync(dir, { recursive: true, force: true });
  });

  it('a resolved pairing passes silently', () => {
    const dir = fixture('data_class RealClass#data');
    const issues = checkPackage(dir);
    assert.equal(issues.filter(i => i.check === 'C157').length, 0);
    rmSync(dir, { recursive: true, force: true });
  });
});

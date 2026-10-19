import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const SRC = `
condition_set load-cell-reference {
  role reference
  entries {
    temperature { value "20" unit "degC" tolerance "5" }
  }
}
`;

function make(model: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-cs-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'), { recursive: true });
  writeFileSync(join(dir, 'model', 'r.prl'), model);
  return dir;
}

describe('the condition-set deprecation (the register migrates to tables)', () => {
  it('parses the legacy spelling and warns C154 with the migration note', () => {
    const m = load(SRC);
    assert.equal(m.conditionSets.length, 1);
    const dir = make(SRC);
    try {
      const issues = checkPackage(dir).filter(i => i.check === 'C154');
      assert.equal(issues.length, 1);
      assert.match(issues[0]!.message, /condition_set/);
      assert.match(issues[0]!.message, /typed table/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

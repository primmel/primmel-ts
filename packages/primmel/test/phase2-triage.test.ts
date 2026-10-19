// ─────────────────────────────────────────────────────────────────────
// Phase 2 — the triage dispositions and the deprecation report:
// storyline and demo_world are retracted (unused), the workflow trio is
// deprecated with its migration note, and every use warns under C154.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CONSTRUCTS } from '../src/ser-des/config';
import { checkPackage } from '../src/check';

function makePackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-phase2-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'package.prl'), body);
  return dir;
}

describe('phase 2 triage dispositions', () => {
  it('the retracted and retired constructs no longer parse', () => {
    // Phase 2 retracted storyline and demo_world (unused); phase 6
    // removed the deprecated workflow trio after the migration window.
    const keywords = new Set(CONSTRUCTS.map(c => c.keyword));
    for (const kw of [
      'storyline',
      'demo_world',
      'process_model',
      'workflow_stage',
      'workflow_config',
    ]) {
      assert.equal(keywords.has(kw), false, kw);
    }
  });

  it('no construct carries a deprecation note — the report is empty', () => {
    assert.deepEqual(
      CONSTRUCTS.filter(c => c.deprecated).map(c => c.keyword),
      [],
    );
    const issues = checkPackage(
      makePackage('instrument X { definition "X." }'),
    ).filter(i => i.check === 'C154');
    assert.deepEqual(issues, []);
  });
});

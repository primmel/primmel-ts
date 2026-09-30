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
  it('storyline and demo_world are retracted — the keywords no longer parse', () => {
    const keywords = new Set(CONSTRUCTS.map(c => c.keyword));
    assert.equal(keywords.has('storyline'), false);
    assert.equal(keywords.has('demo_world'), false);
  });

  it('the workflow trio is deprecated with its migration note', () => {
    const notes = new Map(
      CONSTRUCTS.filter(c => c.deprecated).map(c => [c.keyword, c.deprecated]),
    );
    for (const kw of ['process_model', 'workflow_stage', 'workflow_config']) {
      assert.match(notes.get(kw) ?? '', /canvas for stage groupings/);
    }
  });

  it('C154 warns on every deprecated-construct use', () => {
    const issues = checkPackage(
      makePackage('workflow_stage stage_one { elements { a { x 0 y 0 } } }'),
    ).filter(i => i.check === 'C154');
    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /"workflow_stage".*deprecated/);
    assert.match(issues[0]!.message, /canvas for stage groupings/);
  });

  it('a package that uses no deprecated construct raises no C154', () => {
    const issues = checkPackage(
      makePackage('instrument X { definition "X." }'),
    ).filter(i => i.check === 'C154');
    assert.deepEqual(issues, []);
  });
});

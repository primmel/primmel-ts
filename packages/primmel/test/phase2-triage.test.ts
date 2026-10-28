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

  it('the deprecation register carries exactly the swept constructs', () => {
    // The deprecation ladder is live again (TODO.lang-spec/09): `link`
    // (the MMEL REPO/URL pointer — zero corpus uses) warns C154; the
    // typed ref plane carries the pointer. The presentation sidecar's
    // cargo follows (TODO.lang-spec/12): `canvas` and `view_profile`
    // are the layout's ladder rung — the canvas file beside the model
    // carries the pages and their geometry.
    assert.deepEqual(
      CONSTRUCTS.filter(c => c.deprecated).map(c => c.keyword),
      ['canvas', 'link', 'view_profile'],
    );
    const issues = checkPackage(
      makePackage('link repo_x { kind REPO target "https://x" }'),
    ).filter(i => i.check === 'C154');
    assert.equal(issues.length, 1);
    assert.ok(issues[0]!.message.includes('the typed ref plane'));
    const canvas = checkPackage(makePackage('canvas p { }')).filter(
      i => i.check === 'C154',
    );
    assert.equal(canvas.length, 1);
    assert.ok(canvas[0]!.message.includes('presentation sidecar'));
    const profile = checkPackage(makePackage('view_profile vp { }')).filter(
      i => i.check === 'C154',
    );
    assert.equal(profile.length, 1);
    assert.ok(profile[0]!.message.includes('presentation sidecar'));
    const clean = checkPackage(
      makePackage('instrument X { definition "X." }'),
    ).filter(i => i.check === 'C154');
    assert.deepEqual(clean, []);
  });
});

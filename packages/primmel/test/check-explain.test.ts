// ─────────────────────────────────────────────────────────────────────
// --explain (CLAUDE-2 #7): the adjudication printed, not folklore.
// The output is assembled from the same constants the checker
// finalizes with — these tests pin the composition against drift.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { explainRule } from '../src/check-explain';
import { CHECK_RULES } from '../src/check-rules';

describe('check --explain', () => {
  it('an unknown id says so', () => {
    assert.deepEqual(explainRule('NOPE'), [
      'no rule "NOPE" in the catalog (primmel check --rules)',
    ]);
  });

  it('an audit-level budgeted warning carries the dormant + budget lines', () => {
    const lines = explainRule('C51');
    const text = lines.join('\n');
    assert.match(text, /C51 — coverage-test-evidence/);
    assert.match(text, /coverage_budget/);
    assert.match(text, /dormant at the default level/);
    assert.match(text, /C55's error/);
  });

  it('an error rule names KNOWN as the one suppression', () => {
    const text = explainRule('C57').join('\n');
    assert.match(text, /C57 — allowlist-stale/);
    assert.match(text, /KNOWN remains the one suppression/);
    assert.match(text, /the entry must die/);
  });

  it('every rule explains without throwing', () => {
    // the composition must survive the whole catalog — a new rule's
    // family/severity/level combination can't break the printer
    for (const r of CHECK_RULES) {
      const lines = explainRule(r.id);
      assert.ok(lines.length > 4, `${r.id} explains`);
      assert.ok(
        lines.some(l => l.includes('the adjudication matrix')),
        `${r.id} carries the matrix`,
      );
    }
  });
});

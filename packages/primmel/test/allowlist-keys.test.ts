// ─────────────────────────────────────────────────────────────────────
// W9: the allowlist entries' structured element key — the entry pins
// its element identity, not its prose.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  entryMatches,
  issueElementId,
  type AllowlistEntry,
} from '../src/check-allowlist';

const entry = (over: Partial<AllowlistEntry>): AllowlistEntry => ({
  rule: 'C171',
  match: '*air inside the formula*',
  reason: 'r',
  auditRef: 'a',
  ...over,
});
const issue = (message: string) => ({
  check: 'C171',
  severity: 'error' as const,
  message,
});

describe('the structured allowlist keys (W9)', () => {
  it('extracts the leading element identity', () => {
    assert.equal(
      issueElementId('requirement /req/x: the limit names "y"'),
      '/req/x',
    );
    assert.equal(
      issueElementId('constraint fees_settled: the check names "z"'),
      'fees_settled',
    );
    assert.equal(issueElementId('a message with no element prefix'), '');
  });

  it('pins the entry to its element', () => {
    const e = entry({ id: '/req/x' });
    assert.equal(entryMatches(e, issue('requirement /req/x: air inside the formula')), true);
    assert.equal(entryMatches(e, issue('requirement /req/y: air inside the formula')), false);
  });

  it('stays prose-matched without the key', () => {
    const e = entry({});
    assert.equal(entryMatches(e, issue('requirement /req/y: air inside the formula')), true);
  });

  it('the key and the glob compose', () => {
    const e = entry({ id: 'fees_*', match: '*not a declared verdict*' });
    assert.equal(
      entryMatches(e, issue('uncertainty_budget fees_budget: target "ghost" is not a declared verdict')),
      true,
    );
    assert.equal(
      entryMatches(e, issue('uncertainty_budget other_budget: target "ghost" is not a declared verdict')),
      false,
    );
  });
});

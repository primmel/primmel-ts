// ─────────────────────────────────────────────────────────────────────
// The unified adjudication ledger: a conformance test's evidence
// exclusion is adjudicated in coverage.json (the reasoned entry) —
// the same structure as the sentence allowances — instead of riding a
// budget line in the allowlist. The C51 walk consults it; a stale
// exclusion (the test gone) is C73's error.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkPackage } from '../src/check';

const make = (body: string, coverage?: object): string => {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-evid-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'specification'), { recursive: true });
  writeFileSync(join(dir, 'specification', 'm.prl'), body);
  if (coverage) {
    mkdirSync(join(dir, 'sources-prd'), { recursive: true });
    writeFileSync(
      join(dir, 'sources-prd', 'coverage.json'),
      JSON.stringify({ prd_coverage: '0.1.0', ...coverage }),
    );
  }
  return dir;
};

const REVIEW_TEST = `conformance_test /conf/examinations/redundancy-review {
  label "Measuring-process redundancy review"
  method "Design review of the redundancy concept."
  type Inspection
  targets { /req/a }
}
requirement /req/a {
  label "Redundancy"
  statement { The measuring process has sufficient redundancy. }
  verification { method documentation description "A design review." }
}
`;

describe('the evidence exclusion ledger', () => {
  it('an excluded test rides no C51 finding', () => {
    const dir = make(REVIEW_TEST, {
      evidence_exclusions: [
        {
          test: '/conf/examinations/redundancy-review',
          reason:
            'A design review — evaluated over the type life, never a report page.',
          since: '2026-11-03',
        },
      ],
    });
    const c51 = checkPackage(dir, { strictness: 'audit' }).filter(
      i => i.check === 'C51',
    );
    assert.deepEqual(c51, []);
    rmSync(dir, { recursive: true, force: true });
  });

  it('without the exclusion the C51 finding fires', () => {
    const dir = make(REVIEW_TEST);
    const c51 = checkPackage(dir, { strictness: 'audit' }).filter(
      i => i.check === 'C51',
    );
    assert.equal(c51.length, 1);
    assert.ok(c51[0].message.includes('redundancy-review'));
    rmSync(dir, { recursive: true, force: true });
  });

  it('a stale exclusion (the test gone) is C73', () => {
    const dir = make(
      'requirement /req/a {\n label "R"\n statement { S }\n}\n',
      {
        evidence_exclusions: [
          { test: '/conf/examinations/gone', reason: 'The test retired.' },
        ],
      },
    );
    const c73 = checkPackage(dir).filter(i => i.check === 'C73');
    assert.equal(c73.length, 1);
    assert.ok(c73[0].message.includes('/conf/examinations/gone'));
    assert.ok(c73[0].message.includes('must die'));
    rmSync(dir, { recursive: true, force: true });
  });
});

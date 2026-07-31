// ─────────────────────────────────────────────────────────────────────
// TODO.roadmap/17 — the package allowlist (.primmel-allowlist.prl):
//   KNOWN   — matching issues print, suppressed, never errors;
//   STALE   — an active-rule entry matching nothing is a C57 error;
//   C56     — malformed entries (unknown rule, empty match/reason/
//             audit_ref);
//   C55     — the coverage budget caps C51/C52 warnings (exceeded:
//             error; slack: warning — the allowlist only shrinks).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { checkPackage, type CheckIssue, type CheckOptions } from '../src/check';
import { globMatch, loadAllowlist } from '../src/check-allowlist';

function makeTmpPackage(
  files: Record<string, string>,
  allowlist?: string,
): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-allow-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  for (const [rel, body] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
  if (allowlist !== undefined) {
    writeFileSync(join(dir, '.primmel-allowlist.prl'), allowlist);
  }
  return dir;
}

const checked = (
  files: Record<string, string>,
  allowlist: string | undefined,
  options: CheckOptions = {},
): CheckIssue[] => {
  const dir = makeTmpPackage(files, allowlist);
  try {
    return checkPackage(dir, options);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

/** A package with one genuine C5 warning (testing method, no test). */
const ORPHAN_REQ: Record<string, string> = {
  'model/a.prl': `attribute_definition e_max {
  symbol "E_max" origin design-fixed scope model unit t quantity_kind mass
}`,
  'specification/r.prl': `requirement /req/orphan {
  binds_to { model.parameters.e_max }
  verification { method testing description "needs a test" }
}`,
};

const ORPHAN_ENTRY = `allowlist_entry {
  rule C5
  match "requirement /req/orphan:*"
  reason "Seeded debt for the allowlist tests."
  audit_ref "TODO.roadmap/17"
}
`;

describe('globMatch', () => {
  it('matches full strings with * wildcards', () => {
    assert.ok(
      globMatch(
        'requirement /req/orphan:*',
        'requirement /req/orphan: no test',
      ),
    );
    assert.ok(globMatch('exact', 'exact'));
    assert.ok(!globMatch('exact', 'exactly'));
    assert.ok(!globMatch('a*b', 'acb'.replace('c', '/')) === false);
    assert.ok(globMatch('a*b', 'a/many/things/b'));
    assert.ok(globMatch('*', 'anything at all'));
  });
});

describe('allowlist KNOWN discipline', () => {
  it('a matching entry suppresses the issue (known, never an error)', () => {
    const issues = checked(ORPHAN_REQ, ORPHAN_ENTRY);
    const c5 = issues.filter(i => i.check === 'C5');
    assert.equal(c5.length, 1);
    assert.equal(c5[0].known, true);
    assert.equal(c5[0].severity, 'warning');
    assert.deepEqual(
      issues.filter(i => i.check === 'C57'),
      [],
      'no STALE report for a matching entry',
    );
  });

  it('KNOWN stays suppressed under --strict', () => {
    const issues = checked(ORPHAN_REQ, ORPHAN_ENTRY, { strict: true });
    const errors = issues.filter(i => i.severity === 'error' && !i.known);
    assert.deepEqual(errors, []);
    assert.equal(issues.find(i => i.check === 'C5')?.known, true);
    assert.equal(issues.find(i => i.check === 'C5')?.severity, 'warning');
  });

  it('without the entry, --strict promotes the warning to an error', () => {
    const issues = checked(ORPHAN_REQ, undefined, { strict: true });
    const c5 = issues.filter(i => i.check === 'C5');
    assert.equal(c5.length, 1);
    assert.equal(c5[0].severity, 'error');
  });
});

describe('allowlist STALE discipline (C57)', () => {
  it('an entry matching no issue is a C57 error', () => {
    const issues = checked(
      ORPHAN_REQ,
      `allowlist_entry {
  rule C5
  match "requirement /req/no-such-req:*"
  reason "Fixed already."
  audit_ref "TODO.roadmap/17"
}
`,
    );
    const c57 = issues.filter(i => i.check === 'C57');
    assert.equal(c57.length, 1);
    assert.equal(c57[0].severity, 'error');
    assert.ok(c57[0].message.includes('STALE'));
    assert.ok(c57[0].message.includes('/req/no-such-req'));
  });

  it('an entry for an audit-level rule is dormant at the default level', () => {
    const issues = checked(
      ORPHAN_REQ,
      `allowlist_entry {
  rule C51
  match "conformance test /conf/nothing:*"
  reason "Audit-level debt; dormant at default level."
  audit_ref "TODO.roadmap/17"
}
`,
    );
    assert.deepEqual(
      issues.filter(i => i.check === 'C57'),
      [],
      'a dormant entry is not STALE',
    );
  });
});

describe('allowlist malformed entries (C56)', () => {
  it('unknown rule id', () => {
    const issues = checked(
      ORPHAN_REQ,
      `allowlist_entry {
  rule C103
  match "x"
  reason "r"
  audit_ref "a"
}
`,
    );
    assert.ok(
      issues.some(
        i => i.check === 'C56' && i.message.includes('unknown rule "C103"'),
      ),
    );
  });

  it('empty match / reason / audit_ref each fail', () => {
    const issues = checked(
      ORPHAN_REQ,
      `allowlist_entry {
  rule C5
  reason "no match at all"
  audit_ref "a"
}
allowlist_entry {
  rule C5
  match "y"
  audit_ref "a"
}
allowlist_entry {
  rule C5
  match "z"
  reason "no audit ref"
}
`,
    );
    const c56 = issues.filter(i => i.check === 'C56');
    assert.equal(c56.length, 3);
    assert.ok(c56.some(i => i.message.includes('empty match glob')));
    assert.ok(c56.some(i => i.message.includes('no reason')));
    assert.ok(c56.some(i => i.message.includes('no audit_ref')));
  });

  it('an unknown directive fails', () => {
    const issues = checked(ORPHAN_REQ, 'bogus_directive 1\n');
    assert.ok(
      issues.some(
        i => i.check === 'C56' && i.message.includes('unknown directive'),
      ),
    );
  });
});

describe('coverage budget (C55)', () => {
  /** Two evidence-less tests → two C51 warnings at audit strictness. */
  const TWO_GAPS: Record<string, string> = {
    'model/a.prl': `attribute_definition e_max {
  symbol "E_max" origin design-fixed scope model unit t quantity_kind mass
}`,
    'specification/r.prl': `requirement /req/a {
  binds_to { model.parameters.e_max }
  verification { method testing description "t" }
}
requirement /req/b {
  binds_to { model.parameters.e_max }
  verification { method testing description "t" }
}
conformance_test /conf/ta { targets { /req/a } }
conformance_test /conf/tb { targets { /req/b } }
`,
  };

  it('within budget: silent', () => {
    const issues = checked(TWO_GAPS, 'coverage_budget 2\n', {
      strictness: 'audit',
    });
    assert.deepEqual(
      issues.filter(i => i.check === 'C55'),
      [],
    );
    assert.equal(issues.filter(i => i.check === 'C51' && !i.known).length, 2);
  });

  it('exceeding the budget is a C55 error', () => {
    const issues = checked(TWO_GAPS, 'coverage_budget 1\n', {
      strictness: 'audit',
    });
    const c55 = issues.filter(i => i.check === 'C55');
    assert.equal(c55.length, 1);
    assert.equal(c55[0].severity, 'error');
    assert.ok(c55[0].message.includes('exceed the package budget'));
  });

  it('budget slack warns (the allowlist only shrinks)', () => {
    const issues = checked(TWO_GAPS, 'coverage_budget 5\n', {
      strictness: 'audit',
    });
    const c55 = issues.filter(i => i.check === 'C55');
    assert.equal(c55.length, 1);
    assert.equal(c55[0].severity, 'warning');
    assert.ok(c55[0].message.includes('slack'));
  });

  it('budgeted coverage warnings stay warnings under --strict', () => {
    const issues = checked(TWO_GAPS, 'coverage_budget 2\n', {
      strictness: 'audit',
      strict: true,
    });
    const c51 = issues.filter(i => i.check === 'C51');
    assert.equal(c51.length, 2);
    assert.ok(
      c51.every(i => i.severity === 'warning'),
      'the budget is the allowance — within it, no promotion',
    );
  });

  it('without a budget, --strict promotes the coverage warnings', () => {
    const issues = checked(TWO_GAPS, undefined, {
      strictness: 'audit',
      strict: true,
    });
    const c51 = issues.filter(i => i.check === 'C51');
    assert.ok(c51.every(i => i.severity === 'error'));
  });

  it('the budget is dormant at the default level (C51/C52 do not run)', () => {
    const issues = checked(TWO_GAPS, 'coverage_budget 2\n');
    assert.deepEqual(
      issues.filter(i => i.check === 'C55'),
      [],
      'no slack/exceeded findings when the budgeted rules are inactive',
    );
  });

  it('a C55 allowlist entry is dormant at the default level (C55 is audit-level)', () => {
    // C55 fires only when C51/C52 run — cataloguing it as normal-level
    // would judge the entry STALE at default, where no C55 issue exists.
    const issues = checked(
      TWO_GAPS,
      `allowlist_entry {
  rule C55
  match "*exceed the package budget*"
  reason "Audit-level debt; dormant at default level."
  audit_ref "TODO.roadmap/17"
}
`,
    );
    assert.deepEqual(
      issues.filter(i => i.check === 'C57'),
      [],
      'a dormant C55 entry is not STALE at the default level',
    );
  });

  it('an optional quoted reason rides along on the budget', () => {
    const issues = checked(
      TWO_GAPS,
      'coverage_budget 1 "Seeded budget debt — burn-down tracked in TODO.roadmap/17."\n',
      { strictness: 'audit' },
    );
    assert.deepEqual(
      issues.filter(i => i.check === 'C56'),
      [],
      'a reasoned budget is not malformed',
    );
    const c55 = issues.filter(i => i.check === 'C55');
    assert.equal(c55.length, 1);
    assert.equal(c55[0].severity, 'error', 'the budget still caps');
  });

  it('loadAllowlist captures the budget reason (absent → null)', () => {
    const dir = makeTmpPackage(
      {},
      'coverage_budget 63 "63 of R 91\'s 64 tests lack form evidence."\n',
    );
    try {
      const withReason = loadAllowlist(dir);
      assert.deepEqual(withReason.issues, []);
      assert.equal(withReason.allowlist.coverageBudget, 63);
      assert.equal(
        withReason.allowlist.coverageBudgetReason,
        "63 of R 91's 64 tests lack form evidence.",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    const bare = makeTmpPackage({}, 'coverage_budget 63\n');
    try {
      assert.equal(loadAllowlist(bare).allowlist.coverageBudgetReason, null);
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });
});

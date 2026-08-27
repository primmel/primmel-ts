// ─────────────────────────────────────────────────────────────────────
// The `policy` construct (Primmel v3.1, TODO.primmel/10; MN 114 clause
// 19.2): a usage-policy set in Primmel's OWN policy grammar (rules of
// kind permission | obligation | prohibition over the dataspace's
// artifact classes and their actions, constraints in the embedded
// expression dialect; ODRL 2.2 is a codec output, never an import).
// Covers the parse (incl. the fail-closed vocabularies), the round-trip
// fixpoint, and the linter rule
//   C107 policy-shape
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const FULL = `
policy restricted-exchange {
  name "Restricted exchange"
  description "Restricted artifact classes exchange under an active agreement only."
  default_posture true
  governs { evaluation-report }

  rule read-under-agreement {
    kind permission
    action read
    artifact evaluation-report
    constraint "ocl{agreement.state = #active}"
    constraint "ocl{requester.accredited = true}"
  }
  rule retain-nothing { kind prohibition action retain }
  rule log-every-access { kind obligation action log }

  ref derives-from "urn:example:bfs:2026#clause-6.2"
}
`;

describe('policy: parse', () => {
  it('parses every facet shape', () => {
    const m = load(FULL);
    const p = m.policies[0];
    assert.equal(p.id, 'restricted-exchange');
    assert.equal(p.defaultPosture, true);
    assert.deepEqual(p.governs, ['evaluation-report']);
    assert.equal(p.rules.length, 3);
    assert.deepEqual(p.rules[0], {
      id: 'read-under-agreement',
      kind: 'permission',
      action: 'read',
      artifact: 'evaluation-report',
      constraints: [
        'ocl{agreement.state = #active}',
        'ocl{requester.accredited = true}',
      ],
    });
    // A rule with no artifact covers every governed class.
    assert.equal(p.rules[1].artifact, '');
    assert.deepEqual(p.sourceRefs, [
      { doc: 'urn:example:bfs:2026', clause: '6.2' },
    ]);
  });

  it('is a dump/load/dump fixed point', () => {
    const first = dump(load(FULL));
    const second = dump(load(first));
    assert.equal(first, second);
    assert.match(first, /kind permission/);
    assert.match(first, /constraint "ocl\{agreement\.state = #active\}"/);
  });

  it('rejects an unknown rule kind (fail-closed vocabulary)', () => {
    assert.throws(
      () => load('policy p { rule r { kind permision action read } }'),
      /unknown rule kind "permision"/,
    );
  });

  it('rejects a non-boolean default_posture (fail-closed)', () => {
    assert.throws(
      () => load('policy p { default_posture yes }'),
      /default_posture is true \| false/,
    );
  });
});

// ── the check legs (C107) ────────────────────────────────────────────

function check(model: string) {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-policy-'));
  mkdirSync(join(dir, 'model'));
  writeFileSync(
    join(dir, 'package.primmel'),
    'package {\n  id corpus-policy-case\n}\n',
  );
  writeFileSync(join(dir, 'model', 'policy.prl'), model);
  return checkPackage(dir).filter(i => i.check === 'C107');
}

const DATASPACE = `
dataspace bfs-exchange {
  artifact_class evaluation-report { element /art/evaluation-report }
  artifact_class registry-extract
  policies { restricted-exchange }
  trust_anchor a { trust_ref o }
  ref derives-from "urn:example:bfs:2026#clause-5.1"
}
artifact_definition /art/evaluation-report { name "Evaluation report" }
`;

describe('policy: the checker (C107)', () => {
  it('a sound policy checks clean', () => {
    const issues = check(
      DATASPACE +
        `
policy restricted-exchange {
  default_posture true
  governs { evaluation-report }
  rule read-under-agreement { kind permission action read artifact evaluation-report }
  rule log-every-access { kind obligation action log }
}`,
    );
    assert.deepEqual(issues, []);
  });

  it('a rule-less policy is an error', () => {
    const issues = check(
      DATASPACE + 'policy empty { governs { evaluation-report } }',
    );
    assert.equal(issues.length, 1);
    assert.match(issues[0].message, /at least one rule/);
  });

  it('a rule without its action is an error', () => {
    const issues = check(
      DATASPACE +
        'policy p { governs { evaluation-report } rule r { kind permission } }',
    );
    assert.equal(issues.length, 1);
    assert.match(issues[0].message, /no action/);
  });

  it('a rule artifact outside the governs register is an error', () => {
    const issues = check(
      DATASPACE +
        'policy p { governs { evaluation-report } rule r { kind permission action read artifact registry-extract } }',
    );
    assert.equal(issues.length, 1);
    assert.match(issues[0].message, /governs register/);
  });

  it('a governs entry that names no declared artifact class is an error', () => {
    const issues = check(
      DATASPACE +
        'policy p { governs { ghost-class } rule r { kind permission action read } }',
    );
    assert.equal(issues.length, 1);
    assert.match(issues[0].message, /ghost-class/);
  });

  it('two default-posture policies over one class are an error', () => {
    const issues = check(
      DATASPACE +
        `
policy p1 { default_posture true governs { evaluation-report } rule r { kind permission action read } }
policy p2 { default_posture true governs { evaluation-report } rule r { kind prohibition action retain } }`,
    );
    assert.equal(issues.length, 1);
    assert.match(issues[0].message, /default-posture/);
    assert.match(issues[0].message, /p1, p2/);
  });

  it('a non-default policy coexists with the standing default', () => {
    const issues = check(
      DATASPACE +
        `
policy p1 { default_posture true governs { evaluation-report } rule r { kind permission action read } }
policy p2 { default_posture false governs { evaluation-report } rule r { kind prohibition action retain } }`,
    );
    assert.deepEqual(issues, []);
  });
});

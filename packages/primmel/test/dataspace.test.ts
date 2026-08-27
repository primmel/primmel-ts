// ─────────────────────────────────────────────────────────────────────
// The `dataspace` construct + the `trust_ref` form (Primmel v3.1,
// TODO.primmel/10; MN 114 clause 19.1/19.3). Covers the parse (every
// facet shape, the optional sub-class blocks, the governance fold), the
// round-trip fixpoint, the trust_ref resolution contract (the checker
// verifies shape and NEVER resolves — an unknown organization is not a
// finding), and the linter rules
//   C104 dataspace-references-resolve
//   C105 dataspace-trust-anchor-shape
//   C106 dataspace-governance-provenance
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const FULL = `
dataspace bfs-exchange {
  name "Bean freshness exchange"
  description "The scheme-operated dataspace for freshness-evaluation evidence."

  participant_class certification-body {
    label "Certification body"
    description "A body operating a freshness certification program."
  }
  participant_class test-laboratory {
    label "Test laboratory"
  }

  artifact_class evaluation-report {
    label "Evaluation report"
    description "The laboratory's evaluation report on a lot."
    element /art/evaluation-report
    policy restricted-exchange
  }
  artifact_class registry-extract

  policies { public-access restricted-exchange }
  default_policy restricted-exchange

  trust_anchor scheme-registry {
    trust_ref bfs-scheme-op key bfs-2026-root
    role registry
    description "The scheme operator's participant registry and root key."
  }
  trust_anchor reading-room {
    trust_ref bfs-scheme-op
  }

  compatible_with { allied-scheme-exchange }

  ref derives-from "urn:example:bfs:2026#clause-5.1"
  corresponds dpp "dataspace:bfs" {
    projection dsp-catalog { endpoint "https://catalog.example/bfs" }
  }
}

dataspace allied-scheme-exchange {
  ref derives-from "urn:example:allied:2025#clause-3"
}

policy public-access {
  name "Public access"
  default_posture false
  governs { evaluation-report }
  rule read-any {
    kind permission
    action read
  }
}

policy restricted-exchange {
  name "Restricted exchange"
  default_posture true
  governs { evaluation-report }
  rule read-under-agreement {
    kind permission
    action read
    artifact evaluation-report
    constraint "ocl{agreement.state = #active}"
  }
  rule retain-nothing { kind prohibition action retain }
  rule log-every-access { kind obligation action log }
  ref derives-from "urn:example:bfs:2026#clause-6.2"
}

artifact_definition /art/evaluation-report {
  name "Evaluation report"
}
`;

describe('dataspace: parse', () => {
  it('parses every facet shape', () => {
    const m = load(FULL);
    assert.equal(m.dataspaces.length, 2);
    const d = m.dataspaces[0];
    assert.equal(d.id, 'bfs-exchange');
    assert.equal(d.name, 'Bean freshness exchange');
    assert.equal(d.participantClasses.length, 2);
    assert.equal(d.participantClasses[0].label, 'Certification body');
    // The bare sub-class declaration: no block, empty facets.
    assert.deepEqual(d.artifactClasses[1], {
      id: 'registry-extract',
      label: '',
      description: '',
      element: '',
      policy: '',
    });
    assert.equal(d.artifactClasses[0].element, '/art/evaluation-report');
    assert.equal(d.artifactClasses[0].policy, 'restricted-exchange');
    assert.deepEqual(d.policies, ['public-access', 'restricted-exchange']);
    assert.equal(d.defaultPolicy, 'restricted-exchange');
    // The trust anchors: org-only and org+key forms.
    assert.deepEqual(d.trustAnchors[0].trustRef, {
      org: 'bfs-scheme-op',
      kid: 'bfs-2026-root',
    });
    assert.deepEqual(d.trustAnchors[1].trustRef, {
      org: 'bfs-scheme-op',
      kid: '',
    });
    assert.equal(d.trustAnchors[0].role, 'registry');
    assert.deepEqual(d.compatibleWith, ['allied-scheme-exchange']);
    // The governance citation folds onto the provenance channel.
    assert.deepEqual(d.sourceRefs, [
      { doc: 'urn:example:bfs:2026', clause: '5.1' },
    ]);
    // The correspondence annotation records, with its projection payload.
    assert.equal(d.correspondences?.length, 1);
    assert.equal(d.correspondences?.[0].scheme, 'dpp');
    assert.equal(
      d.correspondences?.[0].projections[0].entries[0].value,
      'https://catalog.example/bfs',
    );
  });

  it('is a dump/load/dump fixed point', () => {
    const first = dump(load(FULL));
    const second = dump(load(first));
    assert.equal(first, second);
    // The canonical form carries the constructs back.
    assert.match(first, /dataspace bfs-exchange \{/);
    assert.match(first, /trust_ref bfs-scheme-op key bfs-2026-root/);
    assert.match(first, /ref derives-from "urn:example:bfs:2026#clause-5.1"/);
  });
});

// ── the check legs ──────────────────────────────────────────────────

/** Write a one-file package to a temp dir and check it. */
function check(model: string, policies = '') {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-dataspace-'));
  mkdirSync(join(dir, 'model'));
  writeFileSync(
    join(dir, 'package.primmel'),
    'package {\n  id corpus-dataspace-case\n}\n',
  );
  writeFileSync(join(dir, 'model', 'dataspace.prl'), model + policies);
  return checkPackage(dir);
}

const POLICIES = `
policy restricted-exchange {
  default_posture true
  governs { evaluation-report }
  rule read-under-agreement { kind permission action read artifact evaluation-report }
}
policy public-access {
  governs { evaluation-report }
  rule read-any { kind permission action read }
}
`;

const SOUND_DATASPACE = `
dataspace bfs-exchange {
  artifact_class evaluation-report { element /art/evaluation-report }
  policies { public-access restricted-exchange }
  default_policy restricted-exchange
  trust_anchor scheme-registry { trust_ref bfs-scheme-op }
  ref derives-from "urn:example:bfs:2026#clause-5.1"
}
artifact_definition /art/evaluation-report {
  name "Evaluation report"
}
`;

describe('dataspace: the checker (C104–C106)', () => {
  it('a sound dataspace checks clean of the family', () => {
    const issues = check(SOUND_DATASPACE, POLICIES).filter(i =>
      ['C104', 'C105', 'C106'].includes(i.check),
    );
    assert.deepEqual(issues, []);
  });

  it('the trust plane is never resolved: an unknown org is not a finding', () => {
    // The trust_ref names an organization NO package declares — opaque
    // addressing, resolved by the consumer at runtime. The package must
    // check clean of C105 (and the family): the resolution contract of
    // MN 114 clause 19.3, pinned.
    const issues = check(SOUND_DATASPACE, POLICIES).filter(
      i => i.severity === 'error' && ['C104', 'C105'].includes(i.check),
    );
    assert.deepEqual(issues, []);
  });

  it('C104: a dangling policies entry is an error', () => {
    const issues = check(
      `dataspace d { policies { ghost-policy } trust_anchor a { trust_ref o } ref derives-from "urn:example:x#clause-1" }`,
      POLICIES,
    ).filter(i => i.check === 'C104');
    assert.equal(issues.length, 1);
    assert.match(issues[0].message, /ghost-policy/);
  });

  it('C104: the default policy must be declared and registered', () => {
    const undeclared = check(
      `dataspace d { default_policy ghost } ref_placeholder`,
      POLICIES,
    ).filter(i => i.check === 'C104');
    assert.ok(undeclared.length >= 1);
    const unregistered = check(
      `dataspace d { policies { public-access } default_policy restricted-exchange }`,
      POLICIES,
    ).filter(i => i.check === 'C104');
    assert.equal(unregistered.length, 1);
    assert.match(unregistered[0].message, /policies register/);
  });

  it('C104: a per-class policy override must resolve and register', () => {
    const issues = check(
      `dataspace d {
         artifact_class report { policy ghost }
       }`,
      POLICIES,
    ).filter(i => i.check === 'C104');
    assert.ok(issues.length >= 1);
    assert.match(issues[0].message, /ghost/);
  });

  it('C104: an artifact class element must resolve', () => {
    const issues = check(
      `dataspace d { artifact_class report { element /art/ghost } }`,
      POLICIES,
    ).filter(i => i.check === 'C104');
    assert.equal(issues.length, 1);
    assert.match(issues[0].message, /\/art\/ghost/);
  });

  it('C104: compatible_with resolves and never self-references', () => {
    const unknown = check(
      `dataspace d { compatible_with { nowhere } }`,
      POLICIES,
    ).filter(i => i.check === 'C104');
    assert.equal(unknown.length, 1);
    const self = check(
      `dataspace d { compatible_with { d } }`,
      POLICIES,
    ).filter(i => i.check === 'C104');
    assert.equal(self.length, 1);
    assert.match(self[0].message, /itself/);
  });

  it('C105: a trust anchor without its trust_ref is an error', () => {
    const issues = check(
      `dataspace d { trust_anchor registry { role registry } }`,
      POLICIES,
    ).filter(i => i.check === 'C105');
    assert.equal(issues.length, 1);
    assert.match(issues[0].message, /registry/);
  });

  it('C106: a dataspace without governance provenance warns', () => {
    const issues = check(
      `dataspace d { trust_anchor a { trust_ref o } }`,
      POLICIES,
    ).filter(i => i.check === 'C106');
    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, 'warning');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Twin interface primitives (Primmel v3, TODO.roadmap/32 — doctrine
// ch. 14 §14.4/§14.12): endpoint declarations (IS), serve bindings with
// freshness windows (HAS), the connector-profile registry, the linter
// rules
//   C60 serve-targets-resolve
//   C61 payload-schema-quantity
//   C62 access-scope-covers-serves
//   C63 freshness-required-on-live-bindings
//   C64 endpoint-profile-resolves
// the freshness-window parser, and the lc500_api fixture (doctrine
// §14.4/§14.9) validated end-to-end: parse, lint-clean, round-trip.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump, loadPackageWithIssues } from '../src/ser-des/index';
import { checkPackage } from '../src/check';
import { parseFreshnessWindow } from '../src/time';
import { BUILTIN_CONNECTOR_PROFILES } from '../src/types/Twin';

const FIXTURE_DIR = join(__dirname, 'fixtures', 'live-twin-lc500');

const PACKAGE = `
quantity_register si {
  kind mass { dimensions { M 1 } si_unit kg }
  unit kg { symbol "kg" kind mass factor 1 }
  kind dimensionless { si_unit "1" }
  unit dimensionless { label "dimensionless" kind dimensionless }
}

attribute_definition d_min {
  quantity_kind mass
  unit kg
  scope sample
}

attribute_definition indication {
  quantity_kind mass
  unit kg
  scope sample
}

state_machine lc_operational {
  kind operational
  initial off
  states { off ready fault }
  transition off -> ready action power_on
}

behavior self_test {
  kind procedural
}

subject LoadCellModel {
  is {
    endpoint lc500_api {
      operation get_indication {
        kind query
        serves indication
        payload { quantity_kind mass unit kg timestamp true }
      }
      operation watch_state {
        kind subscribe
        serves state, environmental_context
        payload { quantity_kind state unit dimensionless timestamp true }
      }
      operation run_self_test {
        kind invoke
        does self_test
        payload { quantity_kind diagnostic_report unit dimensionless timestamp true }
      }
      access {
        public { get_indication }
        registered { watch_state }
        authority { run_self_test }
      }
      profile rest_json
    }
  }
  has {
    state lc_operational
    serve sample.test_context.d_min via get_indication { fresh_within 5s }
    serve sample.state via watch_state { fresh_within 1s }
  }
  does {
    behavior self_test
  }
}
`;

describe('endpoint / serve — parse (TODO.roadmap/32)', () => {
  it('parses the endpoint block with operations, access, profile', () => {
    const m = load(PACKAGE);
    const s = m.subjects.find(x => x.id === 'LoadCellModel')!;
    assert.equal(s.is.endpoints.length, 1);
    const e = s.is.endpoints[0];
    assert.equal(e.id, 'lc500_api');
    assert.equal(e.profile, 'rest_json');
    assert.deepEqual(e.access, {
      public: ['get_indication'],
      registered: ['watch_state'],
      authority: ['run_self_test'],
    });
    assert.equal(e.operations.length, 3);
    const [query, subscribe, invoke] = e.operations;
    assert.deepEqual(query, {
      name: 'get_indication',
      kind: 'query',
      serves: ['indication'],
      does: [],
      payload: { quantityKind: 'mass', unit: 'kg', timestamp: true },
    });
    assert.deepEqual(subscribe, {
      name: 'watch_state',
      kind: 'subscribe',
      serves: ['state', 'environmental_context'],
      does: [],
      payload: {
        quantityKind: 'state',
        unit: 'dimensionless',
        timestamp: true,
      },
    });
    assert.deepEqual(invoke, {
      name: 'run_self_test',
      kind: 'invoke',
      serves: [],
      does: ['self_test'],
      payload: {
        quantityKind: 'diagnostic_report',
        unit: 'dimensionless',
        timestamp: true,
      },
    });
  });

  it('parses serve bindings with and without a freshness block', () => {
    const m = load(PACKAGE);
    const s = m.subjects[0];
    assert.deepEqual(s.has.serves, [
      {
        aspect: 'sample.test_context.d_min',
        via: 'get_indication',
        freshWithin: '5s',
      },
      { aspect: 'sample.state', via: 'watch_state', freshWithin: '1s' },
    ]);
    const bare = load(
      `subject S { has { serve sample.state via watch_state } }`,
    );
    assert.deepEqual(bare.subjects[0].has.serves, [
      { aspect: 'sample.state', via: 'watch_state', freshWithin: '' },
    ]);
  });

  it('parses the block form of an operation serves/does stream identically', () => {
    const bare = load(`subject S {
  is {
    endpoint api {
      operation a { kind query serves x, y payload { quantity_kind mass unit kg timestamp true } }
      operation b { kind invoke does p q payload { quantity_kind report unit dimensionless timestamp true } }
      access { public { a } authority { b } }
      profile mqtt
    }
  }
}`);
    const blocked = load(`subject S {
  is {
    endpoint api {
      operation a { kind query serves { x y } payload { quantity_kind mass unit kg timestamp true } }
      operation b { kind invoke does { p q } payload { quantity_kind report unit dimensionless timestamp true } }
      access { public { a } authority { b } }
      profile mqtt
    }
  }
}`);
    assert.deepEqual(
      blocked.subjects[0].is.endpoints,
      bare.subjects[0].is.endpoints,
    );
    assert.deepEqual(bare.subjects[0].is.endpoints[0].operations[0].serves, [
      'x',
      'y',
    ]);
    assert.deepEqual(bare.subjects[0].is.endpoints[0].operations[1].does, [
      'p',
      'q',
    ]);
  });

  it('round-trips the whole package losslessly (fixpoint)', () => {
    const m1 = load(PACKAGE);
    const dumped = dump(m1);
    const m2 = load(dumped);
    assert.deepEqual(m2.subjects, m1.subjects);
    assert.equal(dump(m2), dumped);
  });

  it('extends merges endpoints and serves as lists — parent entries first', () => {
    const m = load(`
subject Base {
  is {
    endpoint base_api {
      operation a { kind query serves x payload { quantity_kind mass unit kg timestamp true } }
      access { public { a } }
      profile rest_json
    }
  }
  has { serve sample.parameters.x via a { fresh_within 5s } }
}
subject Child {
  extends Base
  is {
    endpoint child_api {
      operation b { kind query serves y payload { quantity_kind mass unit kg timestamp true } }
      access { public { b } }
      profile mqtt
    }
  }
  has { serve sample.parameters.y via b { fresh_within 1min } }
}
`);
    const child = m.subjects.find(x => x.id === 'Child')!;
    assert.deepEqual(
      child.is.endpoints.map(e => e.id),
      ['base_api', 'child_api'],
    );
    assert.deepEqual(
      child.has.serves.map(b => b.via),
      ['a', 'b'],
    );
  });

  it('records misplaced aspects for the linter (C6) and stays total', () => {
    const m = load(`subject S {
  has {
    endpoint api { operation a { kind query payload { quantity_kind mass unit kg timestamp true } } access { public { a } } profile rest_json }
  }
  is {
    serve sample.state via watch_state { fresh_within 1s }
  }
}`);
    const s = m.subjects[0];
    assert.deepEqual(s.misplacedAspects, [
      { family: 'has', aspect: 'endpoint' },
      { family: 'is', aspect: 'serve' },
    ]);
    // Misplaced content is captured, not parsed into the slots.
    assert.equal(s.is.endpoints.length, 0);
    assert.equal(s.has.serves.length, 0);
  });
});

describe('connector_profile — the OCP registry', () => {
  it('parses and round-trips a declared profile', () => {
    const src = `connector_profile bacnet {
  protocol "BACnet/IP"
  description "Building-automation profile added by a package (OCP)."
}
`;
    const m1 = load(src);
    assert.equal(m1.connectorProfiles.length, 1);
    assert.deepEqual(m1.connectorProfiles[0], {
      id: 'bacnet',
      protocol: 'BACnet/IP',
      description: 'Building-automation profile added by a package (OCP).',
      referenceIds: [],
    });
    const dumped = dump(m1);
    const m2 = load(dumped);
    assert.deepEqual(m2.connectorProfiles, m1.connectorProfiles);
    assert.equal(dump(m2), dumped);
  });

  it('the four standard profiles are kernel built-ins', () => {
    assert.deepEqual(Object.keys(BUILTIN_CONNECTOR_PROFILES).sort(), [
      'file_drop',
      'mqtt',
      'opc_ua',
      'rest_json',
    ]);
  });
});

describe('parseFreshnessWindow', () => {
  it('parses the shorthand forms (ms | s | min | h | d)', () => {
    assert.equal(parseFreshnessWindow('500ms'), 500);
    assert.equal(parseFreshnessWindow('5s'), 5000);
    assert.equal(parseFreshnessWindow('1min'), 60_000);
    assert.equal(parseFreshnessWindow('1h'), 3_600_000);
    assert.equal(parseFreshnessWindow('2d'), 2 * 86_400_000);
    assert.equal(parseFreshnessWindow('1.5h'), 5_400_000);
  });

  it('parses ISO 8601 durations with fixed-length components', () => {
    assert.equal(parseFreshnessWindow('PT5S'), 5000);
    assert.equal(parseFreshnessWindow('PT1M'), 60_000);
    assert.equal(parseFreshnessWindow('PT1H30M'), 5_400_000);
    assert.equal(parseFreshnessWindow('P1D'), 86_400_000);
    assert.equal(parseFreshnessWindow('P1W'), 7 * 86_400_000);
  });

  it('rejects calendar-relative, absent, zero, and malformed windows', () => {
    assert.equal(parseFreshnessWindow('P1Y'), null);
    assert.equal(parseFreshnessWindow('P1M'), null);
    assert.equal(parseFreshnessWindow(''), null);
    assert.equal(parseFreshnessWindow('PT0S'), null);
    assert.equal(parseFreshnessWindow('soon'), null);
    assert.equal(parseFreshnessWindow('5'), null);
  });
});

// ── linter fixtures ──────────────────────────────────────────────────

/** Write a one-file fixture package and return its directory. */
function makeTmpPackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-twin-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'twin.prl'), body);
  return dir;
}

/** The smallest supporting cast for a lint-clean twin package. */
const SUPPORT = `
quantity_register si {
  kind mass { dimensions { M 1 } si_unit kg }
  unit kg { symbol "kg" kind mass factor 1 }
  kind dimensionless { si_unit "1" }
  unit dimensionless { label "dimensionless" kind dimensionless }
}
attribute_definition d_min {
  quantity_kind mass
  unit kg
  scope sample
}
attribute_definition indication {
  quantity_kind mass
  unit kg
  scope sample
}
state_machine lc_operational {
  kind operational
  initial off
  states { off ready fault }
  transition off -> ready action power_on
}
behavior self_test {
  kind procedural
}
`;

const CLEAN_SUBJECT = `
subject LoadCellModel {
  is {
    endpoint lc500_api {
      operation get_indication {
        kind query
        serves indication
        payload { quantity_kind mass unit kg timestamp true }
      }
      operation watch_state {
        kind subscribe
        serves state, environmental_context
        payload { quantity_kind state unit dimensionless timestamp true }
      }
      operation run_self_test {
        kind invoke
        does self_test
        payload { quantity_kind diagnostic_report unit dimensionless timestamp true }
      }
      access {
        public { get_indication }
        registered { watch_state }
        authority { run_self_test }
      }
      profile rest_json
    }
  }
  has {
    state lc_operational
    serve sample.test_context.d_min via get_indication { fresh_within 5s }
    serve sample.state via watch_state { fresh_within 1s }
  }
  does {
    behavior self_test
  }
}
`;

const TWIN_RULES = ['C60', 'C61', 'C62', 'C63', 'C64'];

function twinIssues(dir: string) {
  return checkPackage(dir).filter(i => TWIN_RULES.includes(i.check));
}

describe('twin lint rules (C60–C64)', () => {
  it('stays silent on a clean twin declaration', () => {
    const issues = twinIssues(makeTmpPackage(SUPPORT + CLEAN_SUBJECT));
    assert.deepEqual(
      issues,
      [],
      `expected no twin issues, got: ${issues.map(e => `[${e.check}] ${e.message}`).join('\n')}`,
    );
  });

  it('C60 fires when the serve aspect does not resolve', () => {
    const c60 = twinIssues(
      makeTmpPackage(
        SUPPORT +
          CLEAN_SUBJECT.replace(
            'serve sample.test_context.d_min via get_indication',
            'serve sample.test_context.no_such_attr via get_indication',
          ),
      ),
    ).filter(i => i.check === 'C60');
    assert.equal(c60.length, 1);
    assert.ok(c60[0].message.includes('"sample.test_context.no_such_attr"'));
    assert.ok(c60[0].message.includes('(serve-targets-resolve)'));
  });

  it('C60 fires when the via operation is undeclared or ambiguous', () => {
    const undeclared = twinIssues(
      makeTmpPackage(
        SUPPORT + CLEAN_SUBJECT.replace('via get_indication', 'via ghost_op'),
      ),
    ).filter(i => i.check === 'C60');
    assert.ok(undeclared.some(i => i.message.includes('"ghost_op"')));

    const ambiguous = twinIssues(
      makeTmpPackage(
        SUPPORT +
          CLEAN_SUBJECT.replace(
            'profile rest_json',
            `profile rest_json
    }
    endpoint second_api {
      operation get_indication {
        kind query
        serves indication
        payload { quantity_kind mass unit kg timestamp true }
      }
      access { public { get_indication } }
      profile mqtt`,
          ),
      ),
    ).filter(i => i.check === 'C60');
    assert.ok(ambiguous.some(i => i.message.includes('ambiguous')));
  });

  it('C60 rejects a serve binding targeting an invoke operation', () => {
    const c60 = twinIssues(
      makeTmpPackage(
        SUPPORT +
          CLEAN_SUBJECT.replace('via get_indication', 'via run_self_test'),
      ),
    ).filter(i => i.check === 'C60');
    assert.ok(c60.some(i => i.message.includes('invoke')));
  });

  it('C60 fires on unit / quantity-kind mismatch between aspect and payload', () => {
    const unitMismatch = twinIssues(
      makeTmpPackage(
        SUPPORT +
          CLEAN_SUBJECT.replace(
            'operation get_indication {\n        kind query\n        serves indication\n        payload { quantity_kind mass unit kg timestamp true }',
            'operation get_indication {\n        kind query\n        serves indication\n        payload { quantity_kind mass unit g timestamp true }',
          ),
      ),
    ).filter(i => i.check === 'C60');
    assert.ok(unitMismatch.some(i => i.message.includes('unit coherence')));

    const kindMismatch = twinIssues(
      makeTmpPackage(
        SUPPORT +
          CLEAN_SUBJECT.replace(
            'operation get_indication {\n        kind query\n        serves indication\n        payload { quantity_kind mass unit kg timestamp true }',
            'operation get_indication {\n        kind query\n        serves indication\n        payload { quantity_kind time unit s timestamp true }',
          ),
      ),
    ).filter(i => i.check === 'C60');
    assert.ok(kindMismatch.some(i => i.message.includes('quantity kind')));
  });

  it('C60 fires when an operation serves/does target does not resolve', () => {
    const c60 = twinIssues(
      makeTmpPackage(
        SUPPORT +
          CLEAN_SUBJECT.replace(
            'serves indication',
            'serves phantom_aspect',
          ).replace('does self_test', 'does phantom_process'),
      ),
    ).filter(i => i.check === 'C60');
    assert.ok(c60.some(i => i.message.includes('serves "phantom_aspect"')));
    assert.ok(c60.some(i => i.message.includes('does "phantom_process"')));
  });

  it('C60 resolves state through the package machines for partial (twin-only) anatomy', () => {
    // A twin-interface subject block carries endpoint/serve without
    // re-stating has.state — the state channel binds at runtime (task 33),
    // so the package's operational machine is the resolution basis.
    const partial = `state_machine lc_operational {
  kind operational
  initial off
  states { off ready fault }
  transition off -> ready action power_on
}
subject LoadCellModel {
  is {
    endpoint lc500_api {
      operation watch_state {
        kind subscribe
        serves state
        payload { quantity_kind state unit dimensionless timestamp true }
      }
      access { registered { watch_state } }
      profile rest_json
    }
  }
  has {
    serve sample.state via watch_state { fresh_within 1s }
  }
}
`;
    assert.deepEqual(twinIssues(makeTmpPackage(partial)), []);

    // No subject binding AND no operational machine anywhere: state
    // resolves to nothing.
    const noMachine = partial
      .replace('kind operational', 'kind lifecycle')
      .replace('serve sample.state', 'serve sample.state')
      .replace('serves state', 'serves state');
    const c60 = twinIssues(makeTmpPackage(noMachine)).filter(
      i => i.check === 'C60',
    );
    assert.ok(c60.some(i => i.message.includes('"state"')));
    assert.ok(c60.some(i => i.message.includes('"sample.state"')));
  });

  it('C61 fires on unknown kind, missing payload, missing unit/kind, no timestamp', () => {
    const badKind = twinIssues(
      makeTmpPackage(
        SUPPORT + CLEAN_SUBJECT.replace('kind query', 'kind querry'),
      ),
    ).filter(i => i.check === 'C61');
    assert.ok(badKind.some(i => i.message.includes('"querry"')));

    const noPayload = twinIssues(
      makeTmpPackage(
        SUPPORT +
          CLEAN_SUBJECT.replace(
            '        payload { quantity_kind mass unit kg timestamp true }\n',
            '',
          ),
      ),
    ).filter(i => i.check === 'C61');
    assert.ok(noPayload.some(i => i.message.includes('no payload schema')));

    const noUnit = twinIssues(
      makeTmpPackage(
        SUPPORT +
          CLEAN_SUBJECT.replace(
            'payload { quantity_kind mass unit kg timestamp true }',
            'payload { quantity_kind mass timestamp true }',
          ),
      ),
    ).filter(i => i.check === 'C61');
    assert.ok(noUnit.some(i => i.message.includes('no unit')));

    const noTimestamp = twinIssues(
      makeTmpPackage(
        SUPPORT +
          CLEAN_SUBJECT.replace(
            'payload { quantity_kind mass unit kg timestamp true }',
            'payload { quantity_kind mass unit kg timestamp false }',
          ),
      ),
    ).filter(i => i.check === 'C61');
    assert.ok(noTimestamp.some(i => i.message.includes('timestamp')));
  });

  it('C62 fires on uncovered, double-covered, unknown-scope, and unknown-operation access', () => {
    const uncovered = twinIssues(
      makeTmpPackage(
        SUPPORT +
          CLEAN_SUBJECT.replace('        authority { run_self_test }\n', ''),
      ),
    ).filter(i => i.check === 'C62');
    assert.ok(
      uncovered.some(i =>
        i.message.includes('run_self_test has no access scope'),
      ),
    );

    const doubleCovered = twinIssues(
      makeTmpPackage(
        SUPPORT +
          CLEAN_SUBJECT.replace(
            '        authority { run_self_test }',
            '        authority { run_self_test get_indication }',
          ),
      ),
    ).filter(i => i.check === 'C62');
    assert.ok(doubleCovered.some(i => i.message.includes('2 access scopes')));

    const unknownScope = twinIssues(
      makeTmpPackage(
        SUPPORT +
          CLEAN_SUBJECT.replace(
            'public { get_indication }',
            'world { get_indication }',
          ),
      ),
    ).filter(i => i.check === 'C62');
    assert.ok(unknownScope.some(i => i.message.includes('"world"')));

    const unknownOp = twinIssues(
      makeTmpPackage(
        SUPPORT +
          CLEAN_SUBJECT.replace(
            'public { get_indication }',
            'public { ghost }',
          ),
      ),
    ).filter(i => i.check === 'C62');
    assert.ok(unknownOp.some(i => i.message.includes('"ghost"')));
  });

  it('C63 fires on a missing or unparseable freshness window', () => {
    const missing = twinIssues(
      makeTmpPackage(
        SUPPORT +
          CLEAN_SUBJECT.replace(
            'serve sample.state via watch_state { fresh_within 1s }',
            'serve sample.state via watch_state',
          ),
      ),
    ).filter(i => i.check === 'C63');
    assert.equal(missing.length, 1);
    assert.ok(missing[0].message.includes('no fresh_within'));
    assert.ok(
      missing[0].message.includes('(freshness-required-on-live-bindings)'),
    );

    const unparseable = twinIssues(
      makeTmpPackage(
        SUPPORT +
          CLEAN_SUBJECT.replace('{ fresh_within 5s }', '{ fresh_within soon }'),
      ),
    ).filter(i => i.check === 'C63');
    assert.ok(unparseable.some(i => i.message.includes('"soon"')));
  });

  it('C64 fires on a missing or unknown profile; a declared profile resolves', () => {
    const missing = twinIssues(
      makeTmpPackage(
        SUPPORT + CLEAN_SUBJECT.replace('      profile rest_json\n', ''),
      ),
    ).filter(i => i.check === 'C64');
    assert.ok(missing.some(i => i.message.includes('no connector profile')));

    const unknown = twinIssues(
      makeTmpPackage(
        SUPPORT +
          CLEAN_SUBJECT.replace('profile rest_json', 'profile carrier_pigeon'),
      ),
    ).filter(i => i.check === 'C64');
    assert.ok(unknown.some(i => i.message.includes('"carrier_pigeon"')));

    const declared = twinIssues(
      makeTmpPackage(
        SUPPORT +
          `connector_profile carrier_pigeon {
  protocol "avian"
  description "RFC 1149."
}
` +
          CLEAN_SUBJECT.replace('profile rest_json', 'profile carrier_pigeon'),
      ),
    );
    assert.deepEqual(declared, []);
  });
});

// ── the lc500_api fixture (doctrine ch. 14 §14.4/§14.9) ─────────────

describe('lc500_api fixture (doctrine ch. 14) — end-to-end', () => {
  it('parses with zero load issues', () => {
    const { issues } = loadPackageWithIssues(FIXTURE_DIR);
    assert.deepEqual(issues, []);
  });

  it('is lint-clean (zero errors; zero twin-family issues)', () => {
    const issues = checkPackage(FIXTURE_DIR);
    const errors = issues.filter(i => i.severity === 'error');
    assert.deepEqual(
      errors,
      [],
      `expected a lint-clean fixture, got: ${errors.map(e => `[${e.check}] ${e.message}`).join('\n')}`,
    );
    assert.deepEqual(twinIssues(FIXTURE_DIR), []);
  });

  it('declares the §14.4 endpoint and serve bindings', () => {
    const { standard } = loadPackageWithIssues(FIXTURE_DIR);
    const s = standard.subjects.find(
      (x: { id: string }) => x.id === 'LoadCellModel',
    )!;
    const e = s.is.endpoints[0];
    assert.equal(e.id, 'lc500_api');
    assert.deepEqual(
      e.operations.map((o: { name: string }) => o.name),
      ['get_indication', 'watch_state', 'run_self_test'],
    );
    assert.equal(e.profile, 'rest_json');
    assert.deepEqual(
      s.has.serves.map((b: { aspect: string }) => b.aspect),
      ['sample.test_context.d_min', 'sample.state'],
    );
  });

  it('round-trips (load → dump → load → deepEqual; stable second dump)', () => {
    const src = readFileSync(join(FIXTURE_DIR, 'model', 'lc500.prl'), 'utf8');
    const m1 = load(src);
    const dumped = dump(m1);
    const m2 = load(dumped);
    assert.deepEqual(m2.subjects, m1.subjects);
    assert.deepEqual(m2.connectorProfiles, m1.connectorProfiles);
    assert.deepEqual(m2.attributeDefinitions, m1.attributeDefinitions);
    assert.deepEqual(m2.stateMachines, m1.stateMachines);
    assert.equal(dump(m2), dumped);
  });
});

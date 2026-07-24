// ─────────────────────────────────────────────────────────────────────
// The `monitor` construct (Primmel v3, TODO.roadmap/34 — doctrine
// ch. 14 §14.5, grammar sketch §14.11): continuous compliance. Covers
// the parse (all field shapes, incl. the sketch's spellings), the
// round-trip fixpoint, the linter rules
//   C65 monitor-subject-resolves
//   C66 monitor-trigger-wellformed
//   C67 monitor-evaluate-resolves
//   C68 monitor-fail-escalation (the §14.12 warning)
//   C69 monitor-escalation-resolves
//   C70 monitor-emit-sinks
// and the live-twin-lc500 fixture's monitor (doctrine §14.9/§14.11)
// validated end-to-end: parse, lint-clean, round-trip.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump, loadPackageWithIssues } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const FIXTURE_DIR = join(__dirname, 'fixtures', 'live-twin-lc500');

// The LC-500 support declarations (the twin fixture's vocabulary) plus a
// role for the notify legs and a requirement/promise for the C67 refs.
const SUPPORT = `
quantity_register si {
  kind mass { dimensions { M 1 } si_unit kg }
  unit kg { symbol "kg" kind mass factor 1 }
  kind dimensionless { si_unit "1" }
  unit dimensionless { label "dimensionless" kind dimensionless }
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

role market_surveillance {
  label "market surveillance authority"
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
      access {
        public { get_indication }
        registered { watch_state }
      }
      profile rest_json
    }
    promises {
      eer_within {
        target indication_hold
        statement "The indication holds within MPE across the rated range."
      }
    }
  }
  has {
    state lc_operational
    attributes { indication : mass test_dependent }
    characteristics { indication_hold c_ind = ocl{self.indication} }
    serve sample.test_context.indication via get_indication { fresh_within 5s }
    serve sample.state via watch_state { fresh_within 1s }
  }
  does {
    behavior self_test
  }
}

requirement /req/metrological/measuring-range-min {
  name "measuring-range-min"
  statement "The measuring range minimum holds."
}
`;

const CLEAN_MONITOR = `
monitor fleet_watch {
  over { LoadCellModel }
  triggers { every 1h on signal artifact_arrived on change state }
  evaluate { requirements applicable_to(this.classification) promises all }
  emit { evidence -> workspace verdicts -> verdict_log }
  escalate { on fail { flag_certificate open_service_case } on invalid { open_service_case } }
}
`;

function makeTmpPackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-monitor-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'monitor.prl'), body);
  return dir;
}

const MONITOR_RULES = ['C65', 'C66', 'C67', 'C68', 'C69', 'C70'];

function monitorIssues(dir: string) {
  return checkPackage(dir).filter(i => MONITOR_RULES.includes(i.check));
}

describe('monitor — parse (TODO.roadmap/34)', () => {
  it('parses the full monitor block', () => {
    const m = load(SUPPORT + CLEAN_MONITOR);
    assert.equal(m.monitors.length, 1);
    const mon = m.monitors[0];
    assert.equal(mon.id, 'fleet_watch');
    assert.deepEqual(mon.over, ['LoadCellModel']);
    assert.deepEqual(mon.triggers, [
      { kind: 'timer', every: '1h', signal: '', aspect: '' },
      { kind: 'signal', every: '', signal: 'artifact_arrived', aspect: '' },
      { kind: 'change', every: '', signal: '', aspect: 'state' },
    ]);
    assert.deepEqual(mon.evaluate, {
      requirements: {
        kind: 'applicable_to',
        expression: 'this.classification',
        refs: [],
      },
      promises: { kind: 'all', expression: '', refs: [] },
    });
    assert.deepEqual(mon.emit, [
      { stream: 'evidence', target: 'workspace' },
      { stream: 'verdicts', target: 'verdict_log' },
    ]);
    assert.deepEqual(mon.escalate, [
      {
        outcome: 'fail',
        actions: [
          { action: 'flag_certificate', role: '' },
          { action: 'open_service_case', role: '' },
        ],
      },
      {
        outcome: 'invalid',
        actions: [{ action: 'open_service_case', role: '' }],
      },
    ]);
  });

  it('parses the bare over form, an explicit refs selector, and notify roles', () => {
    const m = load(
      SUPPORT +
        `
monitor explicit_watch {
  over LoadCellModel
  triggers { every 30min }
  evaluate { requirements { /req/metrological/measuring-range-min } promises { eer_within } }
  emit { evidence -> workspace verdicts -> verdict_log }
  escalate { on fail { notify market_surveillance flag_certificate } }
  reference { ref-1 ref-2 }
}
`,
    );
    const mon = m.monitors[0];
    assert.deepEqual(mon.over, ['LoadCellModel']);
    assert.deepEqual(mon.evaluate.requirements, {
      kind: 'refs',
      expression: '',
      refs: ['/req/metrological/measuring-range-min'],
    });
    assert.deepEqual(mon.evaluate.promises, {
      kind: 'refs',
      expression: '',
      refs: ['eer_within'],
    });
    assert.deepEqual(mon.escalate[0].actions, [
      { action: 'notify', role: 'market_surveillance' },
      { action: 'flag_certificate', role: '' },
    ]);
    assert.deepEqual(mon.referenceIds, ['ref-1', 'ref-2']);
  });

  it('parses the §14.11 sketch spelling (semicolons + colon escalate) identically', () => {
    const sketch = `
monitor fleet_watch {
  over { LoadCellModel }
  triggers { every 1h ; on signal artifact_arrived ; on change state }
  evaluate { requirements applicable_to(this.classification) ; promises all }
  emit { evidence -> workspace ; verdicts -> verdict_log }
  escalate { on fail: flag_certificate ; on invalid: open_service_case }
}
`;
    const canonical = `
monitor fleet_watch {
  over { LoadCellModel }
  triggers { every 1h on signal artifact_arrived on change state }
  evaluate { requirements applicable_to(this.classification) promises all }
  emit { evidence -> workspace verdicts -> verdict_log }
  escalate { on fail { flag_certificate } on invalid { open_service_case } }
}
`;
    const a = load(SUPPORT + sketch).monitors[0];
    const b = load(SUPPORT + canonical).monitors[0];
    assert.deepEqual(a, b);
  });

  it('round-trips the whole package losslessly (fixpoint)', () => {
    const m1 = load(SUPPORT + CLEAN_MONITOR);
    const dumped = dump(m1);
    const m2 = load(dumped);
    assert.deepEqual(m2.monitors, m1.monitors);
    assert.equal(dump(m2), dumped);
  });

  it('stays total on a malformed monitor (the linter judges, not the parser)', () => {
    const m = load('monitor broken {\n  triggers { on change }\n}\n');
    assert.equal(m.monitors.length, 1);
    assert.equal(m.monitors[0].triggers[0].kind, 'change');
    assert.equal(m.monitors[0].triggers[0].aspect, '');
  });
});

describe('monitor lint rules (C65–C70)', () => {
  it('stays silent on a clean monitor declaration', () => {
    const issues = monitorIssues(makeTmpPackage(SUPPORT + CLEAN_MONITOR));
    assert.deepEqual(
      issues,
      [],
      `expected no monitor issues, got: ${issues.map(e => `[${e.check}] ${e.message}`).join('\n')}`,
    );
  });

  it('C65 fires on an empty or unresolvable subject set', () => {
    const empty = monitorIssues(
      makeTmpPackage(
        SUPPORT + CLEAN_MONITOR.replace('over { LoadCellModel }\n  ', ''),
      ),
    ).filter(i => i.check === 'C65');
    assert.ok(empty.some(i => i.message.includes('no subject set')));

    const ghost = monitorIssues(
      makeTmpPackage(
        SUPPORT + CLEAN_MONITOR.replace('LoadCellModel }', 'GhostModel }'),
      ),
    ).filter(i => i.check === 'C65');
    assert.ok(ghost.some(i => i.message.includes('"GhostModel"')));
  });

  it('C66 fires on no triggers, a bad window, an unnamed signal/change, an unknown kind', () => {
    const none = monitorIssues(
      makeTmpPackage(
        SUPPORT + CLEAN_MONITOR.replace(/triggers \{[^}]*\}/, 'triggers { }'),
      ),
    ).filter(i => i.check === 'C66');
    assert.ok(none.some(i => i.message.includes('no triggers')));

    const badWindow = monitorIssues(
      makeTmpPackage(
        SUPPORT + CLEAN_MONITOR.replace('every 1h', 'every fortnight'),
      ),
    ).filter(i => i.check === 'C66');
    assert.ok(badWindow.some(i => i.message.includes('"fortnight"')));

    const badAspect = monitorIssues(
      makeTmpPackage(
        SUPPORT +
          CLEAN_MONITOR.replace('on change state', 'on change phantom_aspect'),
      ),
    ).filter(i => i.check === 'C66');
    assert.ok(badAspect.some(i => i.message.includes('"phantom_aspect"')));

    const unknown = monitorIssues(
      makeTmpPackage(
        SUPPORT + CLEAN_MONITOR.replace('every 1h', 'on vibration spike'),
      ),
    ).filter(i => i.check === 'C66');
    assert.ok(unknown.some(i => i.message.includes('"vibration"')));
  });

  it('C67 fires on unresolvable explicit refs and unknown selector kinds', () => {
    const ghostReq = monitorIssues(
      makeTmpPackage(
        SUPPORT +
          CLEAN_MONITOR.replace(
            'requirements applicable_to(this.classification)',
            'requirements { /req/ghost }',
          ),
      ),
    ).filter(i => i.check === 'C67');
    assert.ok(ghostReq.some(i => i.message.includes('"/req/ghost"')));

    const ghostPromise = monitorIssues(
      makeTmpPackage(
        SUPPORT +
          CLEAN_MONITOR.replace('promises all', 'promises { ghost_promise }'),
      ),
    ).filter(i => i.check === 'C67');
    assert.ok(ghostPromise.some(i => i.message.includes('"ghost_promise"')));

    const badKind = monitorIssues(
      makeTmpPackage(
        SUPPORT + CLEAN_MONITOR.replace('promises all', 'promises some'),
      ),
    ).filter(i => i.check === 'C67');
    assert.ok(badKind.some(i => i.message.includes('"some"')));

    const noSelector = monitorIssues(
      makeTmpPackage(SUPPORT + CLEAN_MONITOR.replace(' promises all', '')),
    ).filter(i => i.check === 'C67');
    assert.ok(noSelector.some(i => i.message.includes('no promises selector')));
  });

  it('C68 warns (not errors) when no escalation path binds fail — §14.12 verbatim', () => {
    const issues = monitorIssues(
      makeTmpPackage(
        SUPPORT +
          CLEAN_MONITOR.replace(
            'escalate { on fail { flag_certificate open_service_case } on invalid { open_service_case } }',
            'escalate { on invalid { open_service_case } }',
          ),
      ),
    );
    const c68 = issues.filter(i => i.check === 'C68');
    assert.equal(c68.length, 1);
    assert.equal(c68[0].severity, 'warning');
    assert.ok(c68[0].message.includes('no escalation path for fail'));
  });

  it('C69 fires on unknown outcomes/actions, a role-less or ghost-role notify, a misplaced role', () => {
    const badOutcome = monitorIssues(
      makeTmpPackage(SUPPORT + CLEAN_MONITOR.replace('on fail', 'on exploded')),
    ).filter(i => i.check === 'C69');
    assert.ok(badOutcome.some(i => i.message.includes('"exploded"')));

    const badAction = monitorIssues(
      makeTmpPackage(
        SUPPORT + CLEAN_MONITOR.replace('flag_certificate', 'send_pigeon'),
      ),
    ).filter(i => i.check === 'C69');
    assert.ok(badAction.some(i => i.message.includes('"send_pigeon"')));

    const noRole = monitorIssues(
      makeTmpPackage(
        SUPPORT +
          CLEAN_MONITOR.replace(
            'on fail { flag_certificate open_service_case }',
            'on fail { notify }',
          ),
      ),
    ).filter(i => i.check === 'C69');
    assert.ok(noRole.some(i => i.message.includes('notify names no role')));

    const ghostRole = monitorIssues(
      makeTmpPackage(
        SUPPORT +
          CLEAN_MONITOR.replace(
            'on fail { flag_certificate',
            'on fail { notify ghost_role flag_certificate',
          ),
      ),
    ).filter(i => i.check === 'C69');
    assert.ok(ghostRole.some(i => i.message.includes('"ghost_role"')));

    const emptyActions = monitorIssues(
      makeTmpPackage(
        SUPPORT +
          CLEAN_MONITOR.replace(
            'on invalid { open_service_case }',
            'on invalid { }',
          ),
      ),
    ).filter(i => i.check === 'C69');
    assert.ok(emptyActions.some(i => i.message.includes('names no actions')));
  });

  it('C70 fires on a missing/duplicated stream, an unnamed sink, an unknown stream', () => {
    const noVerdicts = monitorIssues(
      makeTmpPackage(
        SUPPORT + CLEAN_MONITOR.replace(' verdicts -> verdict_log', ''),
      ),
    ).filter(i => i.check === 'C70');
    assert.ok(noVerdicts.some(i => i.message.includes('no verdicts sink')));

    const duplicated = monitorIssues(
      makeTmpPackage(
        SUPPORT +
          CLEAN_MONITOR.replace(
            'verdicts -> verdict_log',
            'verdicts -> verdict_log verdicts -> second_log',
          ),
      ),
    ).filter(i => i.check === 'C70');
    assert.ok(duplicated.some(i => i.message.includes('2 times')));

    const unknown = monitorIssues(
      makeTmpPackage(
        SUPPORT +
          CLEAN_MONITOR.replace(
            'evidence -> workspace',
            'telemetry -> workspace',
          ),
      ),
    ).filter(i => i.check === 'C70');
    assert.ok(unknown.some(i => i.message.includes('"telemetry"')));
  });
});

describe('lc500 fleet_watch fixture (doctrine §14.9/§14.11) — end-to-end', () => {
  it('parses with zero load issues', () => {
    const { issues } = loadPackageWithIssues(FIXTURE_DIR);
    assert.deepEqual(issues, []);
  });

  it('is lint-clean (zero errors; zero monitor-family issues)', () => {
    const issues = checkPackage(FIXTURE_DIR);
    const errors = issues.filter(i => i.severity === 'error');
    assert.deepEqual(
      errors,
      [],
      `expected a lint-clean fixture, got: ${errors.map(e => `[${e.check}] ${e.message}`).join('\n')}`,
    );
    assert.deepEqual(monitorIssues(FIXTURE_DIR), []);
  });

  it('declares the §14.11 fleet_watch monitor', () => {
    const { standard } = loadPackageWithIssues(FIXTURE_DIR);
    const mon = standard.monitors.find(
      (x: { id: string }) => x.id === 'fleet_watch',
    )!;
    assert.deepEqual(mon.over, ['LoadCellModel']);
    assert.deepEqual(
      mon.triggers.map((t: { kind: string }) => t.kind),
      ['timer', 'signal', 'change'],
    );
    assert.equal(mon.evaluate.requirements.kind, 'applicable_to');
    assert.equal(mon.evaluate.promises.kind, 'all');
    assert.deepEqual(
      mon.emit.map((s: { stream: string }) => s.stream),
      ['evidence', 'verdicts'],
    );
    assert.ok(
      mon.escalate.some((r: { outcome: string }) => r.outcome === 'fail'),
    );
  });

  it('round-trips (load → dump → load → deepEqual; stable second dump)', () => {
    const src = readFileSync(join(FIXTURE_DIR, 'model', 'lc500.prl'), 'utf8');
    const m1 = load(src);
    const dumped = dump(m1);
    const m2 = load(dumped);
    assert.deepEqual(m2.monitors, m1.monitors);
    assert.equal(dump(m2), dumped);
  });
});

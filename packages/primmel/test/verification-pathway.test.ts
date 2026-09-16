// ─────────────────────────────────────────────────────────────────────
// verification_pathway construct (smart TODO.roadmap/40 batch 3) — the
// metrological-control pathways beyond type evaluation: the full facet
// surface, the parse-enforced vocabularies (kind, trigger kind, limits
// mode), the codec fixpoint, and C138 (the tests/covers resolutions
// per-register gated, the trigger action against the lifecycle
// machines' transition actions gated, event iff kind signal, the
// window's ≥1-of years/months).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const PATHWAY = `
verification_pathway initial-verification {
  kind initial
  label "Initial verification"
  description "Initial verification establishes conformity of the speed meter to the approved type."
  visual_inspection "Before testing, the speed meter is visually inspected."
  tests { /conf/field/stationary-field-test /conf/field/moving-field-test }
  assessment {
    covers { /req/metrological/mpe-stationary /req/technical/sealing-inscriptions }
    description "Assessment of conformity to the approved type."
  }
  limits {
    mode same-as-type-evaluation
    description "The MPEs apply unchanged."
    source { doc "urn:oiml:pub:r:91-1:2025" clause "8.2.3" }
  }
  marking {
    mark verification-mark { mark "verification mark" location "visible spot on the speed meter (7.14)" clause "8.2.4" }
    securing { "sealing of adjustment means (7.13 a)" "securing of installation parameters (8.2.4)" }
  }
  validity {
    window { years 1 }
    trigger validity-elapsed {
      kind timer
      action validity_elapsed
      description "The validity window elapsed — a subsequent verification is due."
    }
    trigger tyre-change {
      kind signal
      event tyre-change
      action invalidating_signal_received
      applicability { mode_of_use: [moving] }
      description "After changing a tyre the verification might no longer be valid."
      source { doc "urn:oiml:pub:r:91-1:2025" clause "6.15.3 Note 2" }
    }
  }
  source { doc "urn:oiml:pub:r:91-1:2025" clause "8.2" }
}
`;

const REGISTERS = `
requirement /req/metrological/mpe-stationary {
  name "MPE stationary"
  statement "The error shall not exceed the MPE."
}
requirement /req/technical/sealing-inscriptions {
  name "Sealing"
  statement "Sealing shall be provided."
}
conformance_test /conf/field/stationary-field-test {
  name "Stationary field test"
}
conformance_test /conf/field/moving-field-test {
  name "Moving field test"
}
state_machine sample_verification {
  initial VALID
  states { VALID ELAPSED INVALIDATED }
  transition VALID -> ELAPSED action validity_elapsed {
  }
  transition VALID -> INVALIDATED action invalidating_signal_received {
  }
}
`;

function makePackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-vpath-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'package.prl'), body);
  return dir;
}

describe('verification_pathway construct (smart TODO.roadmap/40 batch 3)', () => {
  it('parses the full facet surface', () => {
    const m = load(PATHWAY);
    assert.equal(m.verificationPathways.length, 1);
    const p = m.verificationPathways[0]!;
    assert.equal(p.id, 'initial-verification');
    assert.equal(p.kind, 'initial');
    assert.equal(p.label, 'Initial verification');
    assert.match(p.description, /conformity of the speed meter/);
    assert.match(p.visualInspection, /visually inspected/);
    assert.deepEqual(p.tests, [
      '/conf/field/stationary-field-test',
      '/conf/field/moving-field-test',
    ]);
    assert.deepEqual(p.assessment?.covers, [
      '/req/metrological/mpe-stationary',
      '/req/technical/sealing-inscriptions',
    ]);
    assert.equal(p.limits?.mode, 'same-as-type-evaluation');
    assert.equal(p.limits?.source?.clause, '8.2.3');
    assert.equal(p.marking?.marks.length, 1);
    assert.equal(p.marking?.marks[0]!.mark, 'verification mark');
    assert.equal(p.marking?.securing.length, 2);
    assert.equal(p.validity?.window?.years, 1);
    assert.equal(p.validity?.window?.months, 0);
    assert.equal(p.validity?.triggers.length, 2);
    const sig = p.validity!.triggers[1]!;
    assert.equal(sig.kind, 'signal');
    assert.equal(sig.event, 'tyre-change');
    assert.equal(sig.action, 'invalidating_signal_received');
    assert.deepEqual(
      sig.applicability.map(a => [a.dimension, a.values]),
      [['mode_of_use', ['moving']]],
    );
    assert.equal(sig.source?.clause, '6.15.3 Note 2');
    assert.equal(p.source?.doc, 'urn:oiml:pub:r:91-1:2025');
  });

  it('round-trips byte-clean (the codec fixpoint)', () => {
    const out = dump(load(PATHWAY));
    assert.ok(out.includes('verification_pathway initial-verification {\n'));
    assert.ok(out.includes('    window { years 1 }\n'));
    assert.ok(
      out.includes(
        '    mark verification-mark { mark "verification mark" location "visible spot on the speed meter (7.14)" clause "8.2.4" }\n',
      ),
    );
    assert.ok(out.includes('      applicability { mode_of_use: [moving] }\n'));
    assert.equal(dump(load(out)), out);
  });

  it('rejects an unknown kind at parse (the fail-closed precedent)', () => {
    assert.throws(
      () => load('verification_pathway x { kind renewal }'),
      /Unknown kind "renewal"/,
    );
  });

  it('rejects an unknown trigger kind at parse', () => {
    assert.throws(
      () =>
        load(
          'verification_pathway x { validity { trigger t { kind calendar } } }',
        ),
      /Unknown trigger kind "calendar"/,
    );
  });

  it('rejects an unknown limits mode at parse', () => {
    assert.throws(
      () => load('verification_pathway x { limits { mode relaxed } }'),
      /Unknown limits mode "relaxed"/,
    );
  });

  it('C138: a coherent pathway is clean', () => {
    const issues = checkPackage(makePackage(REGISTERS + PATHWAY)).filter(
      i => i.check === 'C138',
    );
    assert.deepEqual(issues, []);
  });

  it('C138: dangling tests and covers entries are flagged (per-register gated)', () => {
    const body = `
${REGISTERS}
verification_pathway p {
  kind initial
  tests { /conf/field/stationary-field-test /conf/bogus }
  assessment { covers { /req/metrological/mpe-stationary /req/bogus } }
}
`;
    const issues = checkPackage(makePackage(body)).filter(
      i => i.check === 'C138',
    );
    assert.equal(issues.length, 2);
    assert.match(
      issues[0]!.message,
      /tests entry "\/conf\/bogus" is not a declared conformance_test/,
    );
    assert.match(
      issues[1]!.message,
      /covers entry "\/req\/bogus" is not a declared requirement/,
    );
  });

  it('C138 gates per register — no tests/requirements registers, no legs', () => {
    const issues = checkPackage(makePackage(PATHWAY)).filter(
      i => i.check === 'C138',
    );
    // Only the ungated legs can fire here — none do (the pathway is
    // well-formed); the resolutions stay silent without the registers.
    assert.deepEqual(issues, []);
  });

  it('C138: the trigger action resolves against lifecycle transition actions (gated)', () => {
    const bad = checkPackage(
      makePackage(
        REGISTERS +
          'verification_pathway p { kind subsequent validity { window { years 1 } trigger t { kind timer action bogus_action } } }',
      ),
    ).filter(i => i.check === 'C138');
    assert.equal(bad.length, 1);
    assert.match(
      bad[0]!.message,
      /action "bogus_action" is not a transition action/,
    );
  });

  it('C138: event is required iff kind signal', () => {
    const missing = checkPackage(
      makePackage(
        'verification_pathway p { kind initial validity { window { years 1 } trigger t { kind signal action a } } }',
      ),
    ).filter(i => i.check === 'C138');
    assert.equal(missing.length, 1);
    assert.match(missing[0]!.message, /kind signal requires the event facet/);
    const spurious = checkPackage(
      makePackage(
        'verification_pathway p { kind initial validity { window { years 1 } trigger t { kind timer event e action a } } }',
      ),
    ).filter(i => i.check === 'C138');
    assert.equal(spurious.length, 1);
    assert.match(spurious[0]!.message, /kind timer carries no event facet/);
  });

  it('C138: the validity window carries ≥ 1 of years/months', () => {
    const issues = checkPackage(
      makePackage(
        'verification_pathway p { kind initial validity { window { } trigger t { kind timer action a } } }',
      ),
    ).filter(i => i.check === 'C138');
    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /carries neither years nor months/);
  });
});

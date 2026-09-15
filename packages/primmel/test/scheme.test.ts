// ─────────────────────────────────────────────────────────────────────
// The scheme-architecture constructs (smart TODO.roadmap/40; the
// packages-as-SSOT epic) — scheme_definition + scheme_lifecycle
// (B 18:2025 3.37/3.38, §5.4, clause 15).
//
// Fixtures:
//   DEFINITIONS — Scheme B (self-declaration) and Scheme A (peer
//                 evaluation on an accreditation/peer-assessment basis).
//   LIFECYCLE   — the per-category machine: automatic Scheme-B entry,
//                 the timer-driven and CIML-decided transitions, and the
//                 deferrable two-year trigger.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index';

const DEFINITIONS = `
scheme_definition scheme_b {
  label "Scheme B"
  term "3.38"
  clause "5.4.2"
  definition "Introductory level of the OIML-CS where a self-declaration is used as the basis for demonstrating compliance."
  demonstration {
    method self_declaration
    clause "5.4.2.1"
    note "Self-declaration with additional supporting evidence (§5.4.2.1); the Scheme B application and approval process for IAs is specified in PD-03, for TLs in PD-04 (§5.4.1.1)."
  }
  source { doc "urn:oiml:pub:b:18:2025" clause "3.38" }
}
scheme_definition scheme_a {
  label "Scheme A"
  term "3.37"
  clause "5.4.3"
  definition "Advanced level of the OIML-CS where accreditation or peer assessment is used as the basis for demonstrating compliance."
  demonstration {
    method peer_evaluation
    clause "5.4.3.1"
    basis { accreditation peer_assessment }
    note "Compliance demonstrated by peer evaluation on the basis of an accreditation assessment or a peer assessment (§5.4.3.1)."
  }
  source { doc "urn:oiml:pub:b:18:2025" clause "3.37" }
}
`;

const LIFECYCLE = `
scheme_lifecycle category_scheme {
  applies_to instrument_category
  initial SCHEME_B
  entry {
    action category_included
    automatic true
    clause "15.1"
    conditions_ref auto_inclusion
    description "A category of measuring instrument covered by a new or existing OIML Recommendation is automatically included in the OIML-CS in Scheme B when the conditions of §4.2 are met (§15.1); the initial placement in Scheme B is §4.3."
  }
  transition SCHEME_B -> SCHEME_A action transition_period_elapsed {
    clause "15.2"
    description "Two years after inclusion in the OIML-CS, the category automatically transitions to Scheme A (§15.2) — the timer-driven transition."
  }
  transition SCHEME_B -> SCHEME_A action transition_advanced {
    clause "15.2"
    decided_by ciml
    on_proposal_of management_committee
    description "The Management Committee may propose to the CIML that a category transitions to Scheme A in a time period of less than two years (§15.2, second sentence; CIML decides, §9 e)."
  }
  transition SCHEME_A -> SCHEME_B action moved_to_scheme_b {
    clause "15.7"
    decided_by ciml
    on_proposal_of management_committee
    description "It may be proposed by the Management Committee and decided by the CIML to move a category of measuring instrument from Scheme A back to Scheme B (§15.7; §9 e)."
  }
  trigger two-year-transition {
    kind timer
    action transition_period_elapsed
    window { years 2 }
    clause "15.2"
    deferrable true
    deferral_note "The Management Committee may propose to the CIML that a category does not automatically transition after two years (§15.3); a granted deferral extends this timer's window per the CIML decision (§9 e iii)."
    description "The two-year Scheme-B window opened by the category's inclusion: when it elapses, transition_period_elapsed fires and the category moves to Scheme A automatically (§15.2)."
  }
  source { doc "urn:oiml:pub:b:18:2025" clause "15" }
}
`;

describe('scheme_definition construct (smart TODO.roadmap/40)', () => {
  it('parses the definitions with their demonstration facets', () => {
    const m = load(DEFINITIONS);
    assert.equal(m.schemeDefinitions.length, 2);
    const b = m.schemeDefinitions.find(s => s.id === 'scheme_b')!;
    assert.equal(b.term, '3.38');
    assert.equal(b.demonstration?.method, 'self_declaration');
    assert.deepEqual(b.demonstration?.basis, []);
    assert.ok(b.demonstration?.note.includes('PD-03'));
    const a = m.schemeDefinitions.find(s => s.id === 'scheme_a')!;
    assert.equal(a.demonstration?.method, 'peer_evaluation');
    assert.deepEqual(a.demonstration?.basis, [
      'accreditation',
      'peer_assessment',
    ]);
    assert.equal(a.source.clause, '3.37');
  });

  it('round-trips losslessly (fixpoint)', () => {
    const m1 = load(DEFINITIONS);
    const dumped = dump(m1);
    assert.ok(dumped.includes('scheme_definition scheme_a {'));
    assert.ok(dumped.includes('basis { accreditation peer_assessment }'));
    const m2 = load(dumped);
    assert.deepEqual(m2.schemeDefinitions, m1.schemeDefinitions);
    assert.equal(dump(m2), dumped);
  });
});

describe('scheme_lifecycle construct (smart TODO.roadmap/40)', () => {
  it('parses the entry, the transitions with their organ facets, and the timer trigger', () => {
    const m = load(LIFECYCLE);
    assert.equal(m.schemeLifecycles.length, 1);
    const l = m.schemeLifecycles[0]!;
    assert.equal(l.id, 'category_scheme');
    assert.equal(l.applies_to, 'instrument_category');
    assert.equal(l.initial, 'SCHEME_B');
    assert.equal(l.entry?.action, 'category_included');
    assert.equal(l.entry?.automatic, true);
    assert.equal(l.entry?.conditions_ref, 'auto_inclusion');

    assert.equal(l.transitions.length, 3);
    const timerDriven = l.transitions.find(
      t => t.action === 'transition_period_elapsed',
    )!;
    assert.equal(timerDriven.from, 'SCHEME_B');
    assert.equal(timerDriven.to, 'SCHEME_A');
    assert.equal(timerDriven.clause, '15.2');
    assert.equal(timerDriven.decided_by, '');
    const advanced = l.transitions.find(
      t => t.action === 'transition_advanced',
    )!;
    assert.equal(advanced.decided_by, 'ciml');
    assert.equal(advanced.on_proposal_of, 'management_committee');
    const back = l.transitions.find(t => t.action === 'moved_to_scheme_b')!;
    assert.equal(back.from, 'SCHEME_A');
    assert.equal(back.to, 'SCHEME_B');

    assert.equal(l.triggers.length, 1);
    const trig = l.triggers[0]!;
    assert.equal(trig.id, 'two-year-transition');
    assert.equal(trig.kind, 'timer');
    assert.equal(trig.action, 'transition_period_elapsed');
    assert.equal(trig.windowYears, 2);
    assert.equal(trig.windowMonths, 0);
    assert.equal(trig.deferrable, true);
    assert.ok(trig.deferral_note.includes('§15.3'));
    assert.equal(l.source.clause, '15');
  });

  it('round-trips losslessly (fixpoint)', () => {
    const m1 = load(LIFECYCLE);
    const dumped = dump(m1);
    assert.ok(
      dumped.includes(
        'transition SCHEME_B -> SCHEME_A action transition_period_elapsed {',
      ),
    );
    assert.ok(dumped.includes('window { years 2 }'));
    assert.ok(dumped.includes('trigger two-year-transition {'));
    const m2 = load(dumped);
    assert.deepEqual(m2.schemeLifecycles, m1.schemeLifecycles);
    assert.equal(dump(m2), dumped);
  });
});

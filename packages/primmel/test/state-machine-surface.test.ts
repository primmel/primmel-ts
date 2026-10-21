// ─────────────────────────────────────────────────────────────────────
// The state-machine surface survives the projection (primmel-ts#178):
// the v3.4 spellings — bare `state <name>` declarations and the named
// `transition <name> { from … to … }` block (the twin-cert corpus
// machine is the repro) — parse into real states and real endpoints,
// and the dumper replays each machine's authored spelling so the round
// trip is a fixpoint. The legacy arrow form is untouched.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index';

const TWIN_CERT = `
state_machine twin_probe_states {
  kind operational
  initial admitted
  state admitted
  state dwell
  state judged
  transition begin_dwell { from admitted to dwell }
  transition judge { from dwell to judged }
}
`;

describe('the v3.4 state-machine surface (primmel-ts#178)', () => {
  it('bare state declarations land in the states list', () => {
    const m = load(TWIN_CERT);
    const sm = m.stateMachines.find(s => s.entityName === 'twin_probe_states')!;
    assert.deepEqual(
      sm.states.map(s => s.name),
      ['admitted', 'dwell', 'judged'],
    );
    assert.equal(sm.kind, 'operational');
    assert.equal(sm.initialState, 'admitted');
  });

  it('named transitions carry real endpoints, not body strings', () => {
    const m = load(TWIN_CERT);
    const sm = m.stateMachines.find(s => s.entityName === 'twin_probe_states')!;
    assert.deepEqual(
      sm.transitions.map(t => [t.name, t.from, t.to]),
      [
        ['begin_dwell', 'admitted', 'dwell'],
        ['judge', 'dwell', 'judged'],
      ],
    );
  });

  it('the named block parses action, guard, cascade, and from lists', () => {
    const m = load(`
state_machine App {
  initial DRAFT
  state DRAFT
  state REVIEW
  state DONE
  transition submit {
    from { DRAFT }
    to REVIEW
    action ia_issues
    guard "ocl{self.is_complete}"
    cascade AuditEvent {
      action record
      with { entity_type: "applications" }
    }
  }
}
`);
    const sm = m.stateMachines.find(s => s.entityName === 'App')!;
    assert.equal(sm.transitions.length, 1);
    const t = sm.transitions[0];
    assert.equal(t.name, 'submit');
    assert.equal(t.from, 'DRAFT');
    assert.equal(t.to, 'REVIEW');
    assert.equal(t.actionName, 'ia_issues');
    assert.equal(t.guard, 'ocl{self.is_complete}');
    assert.equal(t.cascades.length, 1);
    assert.equal(t.cascades[0].targetEntity, 'AuditEvent');
    assert.equal(t.cascades[0].action, 'record');
  });

  it('a multi-source from list fans out under one name', () => {
    const m = load(`
state_machine M {
  initial A
  state A
  state B
  state Z
  transition stop { from { A B } to Z }
}
`);
    const sm = m.stateMachines.find(s => s.entityName === 'M')!;
    assert.deepEqual(
      sm.transitions.map(t => [t.name, t.from, t.to]),
      [
        ['stop', 'A', 'Z'],
        ['stop', 'B', 'Z'],
      ],
    );
  });

  it('the twin-cert machine round-trips byte-identically', () => {
    const d1 = dump(load(TWIN_CERT));
    const bodyOf = (x: string) =>
      x.slice(x.indexOf('state_machine'), x.lastIndexOf('}') + 1);
    assert.equal(bodyOf(d1), bodyOf(TWIN_CERT));
    assert.equal(dump(load(d1)), d1);
  });

  it('a guarded named transition round-trips as a block', () => {
    const src = `
state_machine App {
  initial DRAFT
  state DRAFT
  state REVIEW
  transition submit {
    from DRAFT
    to REVIEW
    action ia_issues
    guard "ocl{self.is_complete}"
  }
}
`;
    const d1 = dump(load(src));
    assert.match(
      d1,
      /transition submit \{\n {4}from DRAFT\n {4}to REVIEW\n {4}action ia_issues\n {4}guard "ocl\{self\.is_complete\}"\n {2}\}\n/,
    );
    assert.equal(dump(load(d1)), d1);
  });

  it('the legacy list-and-arrow machine is untouched', () => {
    const src = `
state_machine M {
  initial A
  states { A B }
  transition A -> B action go
}
`;
    const d1 = dump(load(src));
    // the arrow spelling and the states list replay as authored (the
    // trailing empty block is the pre-existing dumper shape here)
    assert.match(
      d1,
      / {2}states \{\n {4}A\n {4}B\n {2}\}\n {2}transition A -> B action go/,
    );
    assert.equal(dump(load(d1)), d1);
    const sm = load(src).stateMachines[0];
    assert.equal(sm.statesDeclared, undefined);
    assert.equal(sm.transitions[0].name, undefined);
  });
});

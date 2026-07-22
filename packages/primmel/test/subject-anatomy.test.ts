// ─────────────────────────────────────────────────────────────────────
// Subject anatomy grammar (Primmel v3, TODO.roadmap/01) — parse +
// round-trip for the `subject` construct (is / has / does families).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index';

const PACKAGE = `
behavior measure {
  kind measurement
  stimulus force
  response "Indication of the applied load."
}

behavior creep {
  kind temporal
  stimulus force
  response "Change in load cell output with time under constant load."
}

subject LoadCell {
  extends MeasuringInstrumentModel
  is {
    metadata { name "Load cell" source "urn:oiml:pub:r:60-1:2021#clause-3.1.3" }
    provenance { manufacturer ACME }
    design_parameters {
      e_max : mass by design
      p_lc : dimensionless by design
    }
    designed_conditions { reference ref-conds rated rated-conds }
    promises { "holds class C over the rated range" }
    structure { }
    artifacts { }
  }
  has {
    attributes { d_min : mass test_dependent }
    dimensions { accuracy_class in {A,B,C,D} }
    state OperationalStates
    characteristics {
      creep c_c = ocl{self.indication.delta / self.time.delta}
    }
    environmental_context { "logged 23.4 degC during run 7" }
    artifact_instances { }
  }
  does {
    behavior measure
    behavior creep
  }
}
`;

describe('v3 subject anatomy (is/has/does)', () => {
  it('parses all three aspect families + extends', () => {
    const m = load(PACKAGE);
    const s = m.subjects.find(x => x.id === 'LoadCell')!;
    assert.ok(s);
    assert.equal(s.extends, 'MeasuringInstrumentModel');

    // IS — identity/design
    assert.deepEqual(s.is.metadata, {
      name: 'Load cell',
      source: 'urn:oiml:pub:r:60-1:2021#clause-3.1.3',
    });
    assert.deepEqual(s.is.provenance, { manufacturer: 'ACME' });
    assert.deepEqual(s.is.designParameters, {
      e_max: 'mass by design',
      p_lc: 'dimensionless by design',
    });
    assert.deepEqual(s.is.designedConditions, {
      reference: 'ref-conds',
      rated: 'rated-conds',
    });
    assert.deepEqual(s.is.promises, [
      {
        id: '',
        target: '',
        level: null,
        conditions: '',
        statement: 'holds class C over the rated range',
        verifiedBy: [],
        source: null,
      },
    ]);
    assert.deepEqual(s.is.structure, []);
    assert.deepEqual(s.is.artifacts, []);

    // HAS — exhibition
    assert.deepEqual(s.has.attributes, { d_min: 'mass test_dependent' });
    assert.deepEqual(s.has.dimensions, {
      accuracy_class: ['A', 'B', 'C', 'D'],
    });
    assert.equal(s.has.state, 'OperationalStates');
    assert.deepEqual(s.has.characteristics, {
      creep: {
        symbol: 'c_c',
        derivation: 'ocl{self.indication.delta / self.time.delta}',
      },
    });
    assert.deepEqual(s.has.environmentalContext, [
      'logged 23.4 degC during run 7',
    ]);
    assert.deepEqual(s.has.artifactInstances, []);

    // DOES — process refs
    assert.deepEqual(s.does.behaviors, ['measure', 'creep']);
    assert.deepEqual(s.misplacedAspects, []);
  });

  it('parses a subject with empty/absent families', () => {
    const m = load(`subject Bare {
  does { behavior b }
}
`);
    const s = m.subjects.find(x => x.id === 'Bare')!;
    assert.equal(s.extends, '');
    assert.deepEqual(s.is.designParameters, {});
    assert.deepEqual(s.has.characteristics, {});
    assert.deepEqual(s.does.behaviors, ['b']);
  });

  it('parses characteristics with quoted or symbol-less derivations', () => {
    const m = load(`subject S {
  has {
    characteristics {
      repeatability e_r = "dispersion of OUT under repeated identical IN"
      drift = ocl{self.out.t1 - self.out.t0}
    }
  }
}
`);
    const s = m.subjects[0];
    assert.deepEqual(s.has.characteristics.repeatability, {
      symbol: 'e_r',
      derivation: 'dispersion of OUT under repeated identical IN',
    });
    assert.deepEqual(s.has.characteristics.drift, {
      symbol: '',
      derivation: 'ocl{self.out.t1 - self.out.t0}',
    });
  });

  it('records wrong-family and undeclared aspects for the linter (C6)', () => {
    const m = load(`subject S {
  is {
    attributes { d_min : mass test_dependent }
    bogus_aspect { x }
  }
  does {
    attributes { d_min }
  }
}
`);
    const s = m.subjects[0];
    assert.deepEqual(s.misplacedAspects, [
      { family: 'is', aspect: 'attributes' },
      { family: 'is', aspect: 'bogus_aspect' },
      { family: 'does', aspect: 'attributes' },
    ]);
    // Misplaced content is captured, not parsed into the home family.
    assert.deepEqual(s.has.attributes, {});
  });

  it('round-trips the subject package losslessly (fixpoint)', () => {
    const m1 = load(PACKAGE);
    const dumped = dump(m1);
    const m2 = load(dumped);
    assert.deepEqual(m2.subjects, m1.subjects);
    assert.deepEqual(m2.behaviors, m1.behaviors);
    assert.equal(dump(m2), dumped);
  });

  it('round-trips v2 subject-chain constructs alongside v3 subjects', () => {
    const mixed = `
instrument LoadCell {
  extends MeasuringInstrumentModel
  definition "Measuring transducer."
}
subject LoadCellV3 {
  extends LoadCell
  is { metadata { name "Load cell" } }
  does { behavior measure }
}
`;
    const m1 = load(mixed);
    assert.equal(m1.instruments.length, 1);
    assert.equal(m1.subjects.length, 1);
    assert.equal(m1.subjects[0].extends, 'LoadCell');
    const dumped = dump(m1);
    const m2 = load(dumped);
    assert.deepEqual(m2.subjects, m1.subjects);
    assert.deepEqual(m2.instruments, m1.instruments);
    assert.equal(dump(m2), dumped);
  });
});

describe('v3 subject extends resolution (aspect-block merge)', () => {
  it('two-level merge: maps by key (child wins), lists append (parent first), scalars override', () => {
    const m = load(`
subject Base {
  is {
    metadata { name "Base" origin "base-doc" }
    design_parameters { e_max : mass by design p_lc : dimensionless }
    promises { "base promise" }
  }
  has {
    attributes { d_min : mass test_dependent }
    dimensions { accuracy_class in {A,B,C,D} }
    state BaseStates
    characteristics { creep c_c = ocl{self.a} }
    environmental_context { "base ctx" }
  }
  does { behavior measure }
}

subject Child {
  extends Base
  is {
    metadata { name "Child" }
    design_parameters { e_max : mass revised }
    promises { "child promise" }
  }
  has {
    attributes { e : mass }
    dimensions { accuracy_class in {C,D} }
    state ChildStates
    characteristics { drift d = ocl{self.b} }
    environmental_context { "child ctx" }
  }
  does { behavior creep }
}
`);
    const base = m.subjects.find(x => x.id === 'Base')!;
    const child = m.subjects.find(x => x.id === 'Child')!;

    // Maps merge by key; the child wins on conflicting keys.
    assert.deepEqual(child.is.metadata, { name: 'Child', origin: 'base-doc' });
    assert.deepEqual(child.is.designParameters, {
      e_max: 'mass revised',
      p_lc: 'dimensionless',
    });
    assert.deepEqual(child.has.attributes, {
      d_min: 'mass test_dependent',
      e: 'mass',
    });
    assert.deepEqual(child.has.dimensions, { accuracy_class: ['C', 'D'] });
    assert.deepEqual(child.has.characteristics, {
      creep: { symbol: 'c_c', derivation: 'ocl{self.a}' },
      drift: { symbol: 'd', derivation: 'ocl{self.b}' },
    });

    // Lists append — parent entries first, then the child's.
    assert.deepEqual(
      child.is.promises.map(p => p.statement),
      ['base promise', 'child promise'],
    );
    assert.deepEqual(child.has.environmentalContext, ['base ctx', 'child ctx']);
    assert.deepEqual(child.does.behaviors, ['measure', 'creep']);

    // Scalars override — the child's non-empty value wins.
    assert.equal(child.has.state, 'ChildStates');

    // The extends link is consumed by the merge (self-contained result).
    assert.equal(child.extends, '');

    // The parent itself is untouched by the child's merge.
    assert.deepEqual(base.is.metadata, { name: 'Base', origin: 'base-doc' });
    assert.deepEqual(
      base.is.promises.map(p => p.statement),
      ['base promise'],
    );
    assert.equal(base.has.state, 'BaseStates');
  });

  it('scalar override falls through to the parent when the child is empty', () => {
    const m = load(`
subject Base {
  has { state BaseStates }
}
subject Child {
  extends Base
  is { metadata { name "Child" } }
}
`);
    const child = m.subjects.find(x => x.id === 'Child')!;
    assert.equal(child.has.state, 'BaseStates');
  });

  it('three-level chain: merges recursively, parent entries first', () => {
    const m = load(`
subject A {
  is { metadata { a "1" } promises { "p-a" } }
  has { state AStates attributes { x : 1 } }
}
subject B {
  extends A
  is { metadata { b "2" } promises { "p-b" } }
}
subject C {
  extends B
  is { metadata { c "3" } promises { "p-c" } }
  has { attributes { y : 2 } }
}
`);
    const b = m.subjects.find(x => x.id === 'B')!;
    const c = m.subjects.find(x => x.id === 'C')!;

    // Intermediate subject merged with its own parent.
    assert.deepEqual(b.is.metadata, { a: '1', b: '2' });
    assert.deepEqual(
      b.is.promises.map(p => p.statement),
      ['p-a', 'p-b'],
    );
    assert.equal(b.extends, '');

    // Grandchild sees the whole chain; scalar state falls through two levels.
    assert.deepEqual(c.is.metadata, { a: '1', b: '2', c: '3' });
    assert.deepEqual(
      c.is.promises.map(p => p.statement),
      ['p-a', 'p-b', 'p-c'],
    );
    assert.deepEqual(c.has.attributes, { x: '1', y: '2' });
    assert.equal(c.has.state, 'AStates');
    assert.equal(c.extends, '');
  });

  it('missing parent: the subject is left unmerged (lint C9 reports it)', () => {
    const m = load(`
subject Orphan {
  extends Ghost
  is { metadata { name "Orphan" } promises { "own" } }
}
`);
    const s = m.subjects.find(x => x.id === 'Orphan')!;
    assert.equal(s.extends, 'Ghost');
    assert.deepEqual(s.is.metadata, { name: 'Orphan' });
    assert.deepEqual(
      s.is.promises.map(p => p.statement),
      ['own'],
    );
  });

  it('cycle: the cyclic link breaks (visited set); resolution terminates', () => {
    const m = load(`
subject X {
  extends Y
  is { metadata { x "1" } promises { "p-x" } }
}
subject Y {
  extends X
  is { metadata { y "2" } promises { "p-y" } }
}
`);
    const x = m.subjects.find(s => s.id === 'X')!;
    const y = m.subjects.find(s => s.id === 'Y')!;
    // Each subject merges the other's RAW content exactly once — the
    // back-link (Y→X while resolving X, and vice versa) is treated like
    // a missing parent, so nothing duplicates or recurses forever.
    assert.deepEqual(x.is.metadata, { y: '2', x: '1' });
    assert.deepEqual(
      x.is.promises.map(p => p.statement),
      ['p-y', 'p-x'],
    );
    assert.deepEqual(y.is.metadata, { x: '1', y: '2' });
    assert.deepEqual(
      y.is.promises.map(p => p.statement),
      ['p-x', 'p-y'],
    );
  });
});

describe('v3 subject parser edge cases', () => {
  it('parses a fused trailing = on the symbol token (creep c_c= ocl{…})', () => {
    const m = load(`subject S {
  has {
    characteristics {
      creep c_c= ocl{self.a - self.b}
      drift= ocl{self.x}
    }
  }
}
`);
    const s = m.subjects[0];
    // Exactly the two declared entries — no phantom entries from the
    // derivation tokens.
    assert.deepEqual(s.has.characteristics, {
      creep: { symbol: 'c_c', derivation: 'ocl{self.a - self.b}' },
      drift: { symbol: '', derivation: 'ocl{self.x}' },
    });
  });

  it('records a misplaced scalar aspect once, without a phantom value entry', () => {
    const m = load(`subject S {
  is {
    state Foo
    behavior measure
  }
}
`);
    const s = m.subjects[0];
    assert.deepEqual(s.misplacedAspects, [
      { family: 'is', aspect: 'state' },
      { family: 'is', aspect: 'behavior' },
    ]);
  });

  it('round-trips qualifiers containing quotes (value-map escaping)', () => {
    const src =
      'subject S {\n' +
      '  is { design_parameters { note : "he said \\"hi\\"" spare : plain } }\n' +
      '}\n';
    const m1 = load(src);
    assert.deepEqual(m1.subjects[0].is.designParameters, {
      note: 'he said "hi"',
      spare: 'plain',
    });
    const dumped = dump(m1);
    const m2 = load(dumped);
    assert.deepEqual(m2.subjects, m1.subjects);
    assert.equal(dump(m2), dumped);
  });
});

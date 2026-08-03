import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index.js';

// The legacy (MMEL v2) vocabulary the language carries (TODO.editor/21):
// the `view` alias of view_profile, the EXAMPLE/COMMENTARY note types,
// and the v2 comment forms (username/message/feedback/bare resolved).

const TEXT = `root Root

version "v1.0.0-dev1"

metadata {
  title "T"
  schema "MMEL 0.1"
  namespace "N"
}

role r1 { name "R1" }

process P1 {
  name "P one"
  actor r1
}

note Note1 {
  type EXAMPLE
  message "an example note"
}

note Note2 {
  type COMMENTARY
  message "a commentary note"
}

view MainView {
}

comment comment1 {
  username "Ronald"
  message "There is a problem"
  timestamp "1/28/2022"
}

comment comment3 {
  username "Jeffrey"
  message "Solved!"
  timestamp "1/28/2022"
}

comment comment2 {
  username "Wa"
  message "There is another problem"
  timestamp "1/28/2022"
  feedback {
    comment3
  }
  resolved
}

canvas Root {
  elements {
    P1 { x 0 y 0 }
  }
  process_flow {
  }
}`;

describe('the legacy vocabulary', () => {
  it('the `view` alias parses into viewProfiles and dumps as view_profile', () => {
    const ast = load(TEXT, { strict: true });
    assert.equal(ast.viewProfiles.length, 1);
    assert.equal(ast.viewProfiles[0].id, 'MainView');
    const out = dump(ast);
    assert.ok(out.includes('view_profile MainView'));
    assert.ok(!out.includes('\nview MainView'));
  });

  it('the EXAMPLE and COMMENTARY note types parse and re-emit verbatim', () => {
    const ast = load(TEXT, { strict: true });
    assert.equal(ast.notes.length, 2);
    assert.equal(ast.notes[0].type, 'EXAMPLE');
    assert.equal(ast.notes[1].type, 'COMMENTARY');
    const out = dump(ast);
    assert.ok(out.includes('type EXAMPLE'));
    assert.ok(out.includes('type COMMENTARY'));
  });

  it('the v2 comment forms map to the v3 shape (username/message/feedback/bare resolved)', () => {
    const ast = load(TEXT, { strict: true });
    assert.equal(ast.comments.length, 3);
    const c1 = ast.comments.find(c => c.id === 'comment1');
    const c2 = ast.comments.find(c => c.id === 'comment2');
    const c3 = ast.comments.find(c => c.id === 'comment3');
    assert.ok(c1 && c2 && c3, 'the three comments parse');
    assert.equal(c1.author, 'Ronald');
    assert.equal(c1.text, 'There is a problem');
    // The bare legacy `resolved` flag.
    assert.equal(c2.resolved, true);
    // The feedback inversion: comment3 responds to comment2.
    assert.equal(c3.replyTo, 'comment2');
    assert.equal(c1.replyTo, null);
  });

  it('the whole document round-trips byte-stable', () => {
    const ast = load(TEXT, { strict: true });
    const once = dump(ast);
    const twice = dump(load(once, { strict: true }));
    assert.equal(twice, once);
  });
});

describe('metadata string escaping', () => {
  it('quoted metadata unescapes on parse and stays byte-stable (the drift bug)', () => {
    const text = `root Root

metadata {
  title "A \\"quoted\\" title"
  schema "Primmel 0.1"
  namespace "N"
}

role r1 { name "R1" }

canvas Root {
  elements {
  }
  process_flow {
  }
}`;
    const ast = load(text, { strict: true });
    assert.equal(ast.meta.title, 'A "quoted" title');
    const once = dump(ast);
    const twice = dump(load(once, { strict: true }));
    assert.equal(twice, once);
  });
});

// ─────────────────────────────────────────────────────────────────────
// The second checker's front end: the shape-tree model's invariants.
// The corpus agreement is the checker2 leg's job; these specs pin the
// MODEL — the forms the shape tree actually delivers (structured
// bodies, raw-text bodies, block values, greedy value runs).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { documentConstructs, resolveParsanolTs } from '../src/front-end.ts';
import { check } from '../src/rules.ts';
import { readExpression } from '../src/expressions.ts';
import type { ParsedPackage } from '../src/front-end.ts';

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');
const parsanol = resolveParsanolTs(REPO_ROOT);

async function runtime(): Promise<{ parseShape(src: string): unknown } | null> {
  if (
    !parsanol ||
    !existsSync(join(REPO_ROOT, 'grammar', 'artifacts', 'primmel.json'))
  ) {
    return null;
  }
  const { PargRuntime } = (await import(
    join(parsanol, 'dist', 'runtime.js')
  )) as {
    PargRuntime: {
      fromFile(path: string): { parseShape(src: string): unknown };
    };
  };
  return PargRuntime.fromFile(
    join(REPO_ROOT, 'grammar', 'artifacts', 'primmel.json'),
  );
}

const rt = await runtime();

function constructs(src: string) {
  return documentConstructs(rt!.parseShape(src));
}

describe('the shape-tree model', () => {
  it('reads a structured body: nested constructs and lines', () => {
    const cs = constructs(
      'form F {\n  name "N"\n  field x { bind model.parameters.a }\n}\n',
    );
    assert.equal(cs.length, 1);
    assert.equal(cs[0]!.keyword, 'form');
    assert.equal(cs[0]!.ident, 'F');
    const names = cs[0]!.items.filter(
      i => i.kind === 'line' && i.key === 'name',
    );
    assert.deepEqual(names[0]!.tokens, ['N']);
  });

  it('reads a raw-text body (a block whose items produced no captures)', () => {
    const cs = constructs('class A {\n  store { records }\n  id: string\n}\n');
    const stores = cs[0]!.items.filter(i => i.construct?.keyword === 'store');
    assert.deepEqual(
      stores[0]!.construct!.items.flatMap(i => i.tokens),
      ['records'],
    );
  });

  it('reads block values riding a greedy value run', () => {
    const cs = constructs(
      'process p {\n  does {\n    flow { begin -> done }\n  }\n}\n',
    );
    const does = cs[0]!.items[0]!.construct!;
    const flow = does.items[0]!.construct!;
    assert.equal(flow.keyword, 'flow');
    const edge = flow.items[0]!;
    assert.equal(edge.key, 'begin');
    assert.deepEqual(edge.tokens, ['->', 'done']);
  });
});

describe('the second checker rules', () => {
  it('a form binding an undeclared attribute fires C1', () => {
    const pkg: ParsedPackage = {
      constructs: constructs(
        'form F {\n  field x { bind model.parameters.ghost }\n}\n',
      ),
    };
    assert.deepEqual(
      check(pkg).map(i => i.rule),
      ['C1'],
    );
  });

  it('two declarations of one (keyword, id) fire C96 once', () => {
    const pkg: ParsedPackage = {
      constructs: constructs(
        'role r {\n  name "a"\n}\n\nrole r {\n  name "b"\n}\n',
      ),
    };
    assert.deepEqual(
      check(pkg).map(i => i.rule),
      ['C96'],
    );
  });
});

describe('the second expression reader: the register-18 completions', () => {
  const kindless = (): undefined => undefined;
  const ids = (src: string) => readExpression(src, kindless);

  it('parses collect as a navigation and binds its lambda', () => {
    const r = ids(
      'measurements -> collect(m | m.indicated_speed - m.reference_speed)',
    );
    assert.deepEqual(r.names, ['measurements']);
    assert.deepEqual(r.calls, []);
  });

  it('parses the conditional and reports only its free names', () => {
    const r = ids('if mat >= 50 then overload_passed else true endif');
    assert.deepEqual(r.names.sort(), ['mat', 'overload_passed']);
    assert.ok(!r.names.includes('true'));
  });

  it('parses boolean literals as kindless leaves', () => {
    assert.deepEqual(ids('true').names, []);
    assert.deepEqual(ids('false').names, []);
  });

  it('parses the nested conditional the corpus limits use', () => {
    const r = ids(
      'abs(e_rel) <= (if family.classification.accuracy_class = 1 then (if t_water <= 30 then 1 else 2 endif) else 0 endif) and abs(e_rel_lower) <= 3',
    );
    // the reader is declaration-blind: the family path rides the rules'
    // CONTEXT_ROOTS filter, so it surfaces here and resolves there
    assert.deepEqual(r.names.sort(), [
      'e_rel',
      'e_rel_lower',
      'family.classification.accuracy_class',
      't_water',
    ]);
  });
});

describe('C178 legacy-carrier-deprecated (the register grows)', () => {
  it('a v3.4 package counting its legacy ocl strings fires C178', () => {
    const pkg: ParsedPackage = {
      constructs: constructs(
        'package {\n id t\n language v3.4\n}\n\nrequirement /req/x {\n name "X"\n limit {\n  expression "ocl{e <= m}"\n }\n}\n',
      ),
    };
    assert.deepEqual(
      check(pkg)
        .filter(i => i.rule === 'C178')
        .map(i => i.rule),
      ['C178'],
    );
  });

  it('a block carrier under the same declaration stays silent', () => {
    const pkg: ParsedPackage = {
      constructs: constructs(
        'package {\n id t\n language v3.4\n}\n\nrequirement /req/x {\n name "X"\n limit {\n  expression {\n   e <= m\n  }\n }\n}\n',
      ),
    };
    assert.deepEqual(
      check(pkg)
        .filter(i => i.rule === 'C178')
        .map(i => i.rule),
      [],
    );
  });

  it('inert below the armed revision', () => {
    const pkg: ParsedPackage = {
      constructs: constructs(
        'package {\n id t\n language v3.3\n}\n\nrequirement /req/x {\n name "X"\n limit {\n  expression "ocl{e <= m}"\n }\n}\n',
      ),
    };
    assert.deepEqual(
      check(pkg)
        .filter(i => i.rule === 'C178')
        .map(i => i.rule),
      [],
    );
  });
});

describe('the edition/composition family grows (the register reaches 65)', () => {
  it('C170: two editions without the mapping artifact fire', () => {
    const pkg: ParsedPackage = {
      constructs: constructs('package {\n id t\n editions { 2020 2019 }\n}\n'),
    };
    assert.deepEqual(
      check(pkg)
        .filter(i => i.rule === 'C170')
        .map(i => i.rule),
      ['C170'],
    );
  });

  it('C78: a backwards validity window fires; a good one stays silent', () => {
    const bad: ParsedPackage = {
      constructs: constructs(
        'package {\n id t\n validity { from 2020-01-01 to 2019-01-01 }\n}\n',
      ),
    };
    assert.deepEqual(
      check(bad)
        .filter(i => i.rule === 'C78')
        .map(i => i.rule),
      ['C78'],
    );
    const good: ParsedPackage = {
      constructs: constructs(
        'package {\n id t\n validity { from 2019-01-01 to 2020-01-01 }\n}\n',
      ),
    };
    assert.deepEqual(
      check(good)
        .filter(i => i.rule === 'C78')
        .map(i => i.rule),
      [],
    );
  });

  it('C85: a baseUrn without a scheme fires; C79 a self-supersede fires', () => {
    const bad: ParsedPackage = {
      constructs: constructs(
        'package {\n id t\n baseUrn "no scheme here"\n supersedes { urn:x:self }\n}\n',
      ),
    };
    const rules = check(bad).map(i => i.rule);
    assert.ok(rules.includes('C85'));
    const self: ParsedPackage = {
      constructs: constructs(
        'package {\n id t\n baseUrn "urn:example:t"\n supersedes { urn:example:t }\n}\n',
      ),
    };
    assert.deepEqual(
      check(self)
        .filter(i => i.rule === 'C79')
        .map(i => i.rule),
      ['C79'],
    );
  });

  it('C51: an unrecorded conformance test warns; result_forms stays silent', () => {
    const bare: ParsedPackage = {
      constructs: constructs('conformance_test /conf/x {\n name "X"\n}\n'),
    };
    assert.deepEqual(
      check(bare)
        .filter(i => i.rule === 'C51')
        .map(i => i.rule),
      ['C51'],
    );
    const recorded: ParsedPackage = {
      constructs: constructs(
        'conformance_test /conf/x {\n name "X"\n result_forms { x-record }\n}\n',
      ),
    };
    assert.deepEqual(
      check(recorded)
        .filter(i => i.rule === 'C51')
        .map(i => i.rule),
      [],
    );
  });
});

describe('the composition family (C31/C52/C79-graph/C81)', () => {
  it('C31: an unsatisfiable requires fires; a provided one stays silent', () => {
    const bad: ParsedPackage = {
      constructs: constructs(
        'package {\n id t\n requires { ghost-package }\n}\n',
      ),
    };
    assert.deepEqual(
      check(bad).filter(i => i.rule === 'C31').map(i => i.rule),
      ['C31'],
    );
    const ok: ParsedPackage = {
      constructs: constructs(
        'package {\n id t\n requires { t-thing }\n provides { t-thing }\n}\n',
      ),
    };
    assert.deepEqual(
      check(ok).filter(i => i.rule === 'C31').map(i => i.rule),
      [],
    );
  });

  it('C52: a process-binding form with no judgment warns', () => {
    const pkg: ParsedPackage = {
      constructs: constructs(
        'form F {\n name "F"\n conformance_process /conf/x\n field a : number { measurement_method direct }\n}\n',
      ),
    };
    assert.deepEqual(
      check(pkg).filter(i => i.rule === 'C52').map(i => i.rule),
      ['C52'],
    );
  });

  it('C81: a product reference mapping an unknown package fires', () => {
    const pkg: ParsedPackage = {
      constructs: constructs(
        'package {\n id t\n kind product_reference\n maps_to { ghost-rec }\n}\n',
      ),
    };
    assert.deepEqual(
      check(pkg).filter(i => i.rule === 'C81').map(i => i.rule),
      ['C81'],
    );
  });
});

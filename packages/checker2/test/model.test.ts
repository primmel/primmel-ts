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
import type { ParsedPackage, ShippedDocument } from '../src/front-end.ts';

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
      check(bad)
        .filter(i => i.rule === 'C31')
        .map(i => i.rule),
      ['C31'],
    );
    const ok: ParsedPackage = {
      constructs: constructs(
        'package {\n id t\n requires { t-thing }\n provides { t-thing }\n}\n',
      ),
    };
    assert.deepEqual(
      check(ok)
        .filter(i => i.rule === 'C31')
        .map(i => i.rule),
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
      check(pkg)
        .filter(i => i.rule === 'C52')
        .map(i => i.rule),
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
      check(pkg)
        .filter(i => i.rule === 'C81')
        .map(i => i.rule),
      ['C81'],
    );
  });
});

describe('the run plane (C180/C181)', () => {
  it('an unknown store fires C180; the agreement leg stays silent', () => {
    const pkg: ParsedPackage = {
      constructs: constructs(
        'conformance_test /conf/x {\n name "X"\n result_forms { probe }\n run {\n  performed_by laboratory\n  store ghost\n }\n}\n',
      ),
    };
    assert.deepEqual(
      check(pkg)
        .filter(i => i.rule === 'C180')
        .map(i => i.rule),
      ['C180'],
    );
  });

  it('a store/form data-class mismatch fires C181', () => {
    const pkg: ParsedPackage = {
      constructs: constructs(
        'class Other#data {\n a: string { modality SHALL }\n}\nform probe {\n data_class Other#data\n}\ndata_registry recs {\n data_class Probe#data\n}\nconformance_test /conf/x {\n name "X"\n result_forms { probe }\n run {\n  performed_by laboratory\n  store recs\n }\n}\n',
      ),
    };
    assert.deepEqual(
      check(pkg)
        .filter(i => i.rule === 'C181')
        .map(i => i.rule),
      ['C181'],
    );
  });
});

describe('the run plane (the applied-input contract)', () => {
  it('C180: a measured variable as a run input fires; declared stays silent', () => {
    const base =
      'conformance_test /conf/x {\n name "X"\n variables {\n  variable applied_load { type number unit "kg" source SOURCE }\n }\n run {\n  performed_by laboratory\n  inputs { applied_load }\n }\n}\n';
    const bad: ParsedPackage = {
      constructs: constructs(base.replace('SOURCE', 'measured')),
    };
    assert.deepEqual(
      check(bad)
        .filter(i => i.rule === 'C180')
        .map(i => i.rule),
      ['C180'],
    );
    const ok: ParsedPackage = {
      constructs: constructs(base.replace('SOURCE', 'declared')),
    };
    assert.deepEqual(
      check(ok)
        .filter(i => i.rule === 'C180')
        .map(i => i.rule),
      [],
    );
  });
});

describe('the corpus trio (C157/C176/C173 — the register reaches 73)', () => {
  it('C157: a data_class naming no declared class fires; the pairing stays silent', () => {
    const bad: ParsedPackage = {
      constructs: constructs(
        'data_registry samples {\n title "Samples"\n data_class Missing#data\n}\n',
      ),
    };
    assert.deepEqual(
      check(bad)
        .filter(i => i.rule === 'C157')
        .map(i => i.rule),
      ['C157'],
    );
    const ok: ParsedPackage = {
      constructs: constructs(
        'class Probe#data {\n meter_id: string\n}\ndata_registry samples {\n title "Samples"\n data_class Probe#data\n}\n',
      ),
    };
    assert.deepEqual(
      check(ok)
        .filter(i => i.rule === 'C157')
        .map(i => i.rule),
      [],
    );
  });

  it('C176: a declared language that is not a generation fires; v3.4 stays silent', () => {
    const bad: ParsedPackage = {
      constructs: constructs('package {\n id p\n language tomorrow\n}\n'),
    };
    assert.deepEqual(
      check(bad)
        .filter(i => i.rule === 'C176')
        .map(i => i.rule),
      ['C176'],
    );
    const ok: ParsedPackage = {
      constructs: constructs('package {\n id p\n language v3.4\n}\n'),
    };
    assert.deepEqual(
      check(ok)
        .filter(i => i.rule === 'C176')
        .map(i => i.rule),
      [],
    );
  });

  it('C173: a completion naming an undeclared io fires; the declared completion stays silent', () => {
    const base =
      'process scale {\n name "Scaling"\n step scale {\n  inputs { filtered_counts e_lim }\n  outputs { indication overload_flag }\n  completion "overload_flag = COUNTS > e_lim"\n }\n}\n';
    const bad: ParsedPackage = {
      constructs: constructs(base.replace('COUNTS', 'ghost_counts')),
    };
    assert.deepEqual(
      check(bad)
        .filter(i => i.rule === 'C173')
        .map(i => i.rule),
      ['C173'],
    );
    const ok: ParsedPackage = {
      constructs: constructs(base.replace('COUNTS', 'filtered_counts')),
    };
    assert.deepEqual(
      check(ok)
        .filter(i => i.rule === 'C173')
        .map(i => i.rule),
      [],
    );
  });
});

describe('the variable↔subform type link (C182 — the register reaches 74)', () => {
  const REC =
    'form error-run {\n name "One pairing row"\n field reference : number { unit "kg" }\n field served : number { unit "kg" }\n}\nconformance_test /conf/creep {\n name "Creep"\n type Testing\n variables {\n  variable pair_error {\n   type number\n   unit "kg"\n   source measured\n   series {\n    axis time { unit "s" role time }\n    cell { symbol pair_error unit "kg" }\n    record error-run\n   }\n   derivation "ocl{pair_error -> forAll(m | m.served - m.reference)}"\n  }\n }\n}\n';
  it('C182: a lambda member naming no record field fires; declared members stay silent', () => {
    const bad: ParsedPackage = {
      constructs: constructs(REC.replace('m.reference', 'm.ghost')),
    };
    assert.deepEqual(
      check(bad)
        .filter(i => i.rule === 'C182')
        .map(i => i.rule),
      ['C182'],
    );
    const ok: ParsedPackage = { constructs: constructs(REC) };
    assert.deepEqual(
      check(ok)
        .filter(i => i.rule === 'C182')
        .map(i => i.rule),
      [],
    );
    const noForm: ParsedPackage = {
      constructs: constructs(
        REC.replace('record error-run', 'record ghost-run'),
      ),
    };
    assert.deepEqual(
      check(noForm)
        .filter(i => i.rule === 'C182')
        .map(i => i.rule),
      ['C182'],
    );
  });
});

describe('the manifest-input increment (C169 + C56 — the register reaches 76)', () => {
  const SHIPPED = {
    urn: 'urn:oiml:pub:r:129-1:2020',
    fragments: new Set([
      'clause-4.1.7',
      'clause-4.2.1',
      'clause-4.2.1/table-2',
    ]),
    addresses: new Set(['clause-4.1.7/s1']),
    sentences: [],
  };

  it('C169: exact, subtree, and enclosure landings stay silent', () => {
    const pkg: ParsedPackage = {
      constructs: constructs(
        'requirement /req/r {\n name "R"\n source { doc "urn:oiml:pub:r:129-1:2020" clause "4.1.7" }\n ref derives-from "urn:oiml:pub:r:129-1:2020#clause-4.2.1/table-2"\n ref cites "urn:oiml:pub:r:129-1:2020#clause-4.2.1"\n}\n',
      ),
      documents: [SHIPPED],
    };
    assert.deepEqual(
      check(pkg)
        .filter(i => i.rule === 'C169')
        .map(i => i.rule),
      [],
    );
  });

  it('C169: a clause-qualified landing nowhere is air; a bare subpart is a warning', () => {
    const air: ParsedPackage = {
      constructs: constructs(
        'requirement /req/r {\n name "R"\n ref derives-from "urn:oiml:pub:r:129-1:2020#clause-9.9"\n}\n',
      ),
      documents: [SHIPPED],
    };
    assert.deepEqual(
      check(air)
        .filter(i => i.rule === 'C169')
        .map(i => i.rule),
      ['C169'],
    );
    const subpart: ParsedPackage = {
      constructs: constructs(
        'requirement /req/r {\n name "R"\n ref cites "urn:oiml:pub:r:129-1:2020#table-7"\n}\n',
      ),
      documents: [SHIPPED],
    };
    const found = check(subpart).filter(i => i.rule === 'C169');
    assert.equal(found.length, 1);
    assert.equal(found[0]!.severity, 'warning');
  });

  it('C169: a binding citing a non-shipped document stays out of scope', () => {
    const pkg: ParsedPackage = {
      constructs: constructs(
        'requirement /req/r {\n name "R"\n ref derives-from "urn:oiml:pub:r:60-1:2021#clause-5.3.2"\n}\n',
      ),
      documents: [SHIPPED],
    };
    assert.deepEqual(
      check(pkg)
        .filter(i => i.rule === 'C169')
        .map(i => i.rule),
      [],
    );
  });

  it('C56: an entry missing reason or audit_ref fires; the well-formed entry stays silent', () => {
    const bad: ParsedPackage = {
      constructs: constructs('data_registry x { data_class Y#data }\n'),
      allowlist: {
        entries: [
          {
            rule: 'C142',
            match: 'dangling*',
            reason: 'the register wave holds these.',
            auditRef: '',
          },
          {
            rule: 'C142',
            match: 'other*',
            reason: '',
            auditRef: 'TODO.wave',
          },
        ],
        budgets: [],
        directives: [],
      },
    };
    const found = check(bad).filter(i => i.rule === 'C56');
    assert.equal(found.length, 2);
    assert.ok(found.some(i => /audit_ref/.test(i.message)));
    assert.ok(found.some(i => /no reason/.test(i.message)));
    const ok: ParsedPackage = {
      constructs: constructs('data_registry x { data_class Y#data }\n'),
      allowlist: {
        entries: [
          {
            rule: 'C142',
            match: 'dangling*',
            reason: 'the register wave holds these.',
            auditRef: 'TODO.wave',
          },
        ],
        budgets: [],
        directives: [],
      },
    };
    assert.deepEqual(
      check(ok)
        .filter(i => i.rule === 'C56')
        .map(i => i.rule),
      [],
    );
  });

  it('C56: a negative budget fires', () => {
    const pkg: ParsedPackage = {
      constructs: [],
      allowlist: {
        entries: [],
        budgets: [{ key: 'coverage_budget', raw: '-3' }],
        directives: [],
      },
    };
    assert.deepEqual(
      check(pkg)
        .filter(i => i.rule === 'C56')
        .map(i => i.rule),
      ['C56'],
    );
  });
});

describe('the process flow family (C16/C58/C12/C13 — the register reaches 80)', () => {
  const BASE =
    'activity_archetype verification { description "V" }\nprocess scale {\n name "Scaling"\n activity_kind verification\n signature {\n  inputs { raw }\n  outputs { indication }\n }\n registers { e_lim : number filtered : number }\n does {\n  step a {\n   inputs { raw e_lim }\n   outputs { filtered }\n  }\n  step b {\n   inputs { filtered e_lim }\n   outputs { indication }\n  }\n }\n}\n';

  it('C16: a duplicate step id fires; unique ids stay silent', () => {
    const dup = BASE.replace(
      'step b {',
      'step a {\n  outputs { x }\n }\n step b {',
    );
    assert.deepEqual(
      check({ constructs: constructs(dup) }).filter(i => i.rule === 'C16'),
      [
        {
          rule: 'C16',
          severity: 'error',
          message:
            'process scale: duplicate step id "a" in the does body (process-step-ids-unique)',
        },
      ],
    );
    assert.deepEqual(
      check({ constructs: constructs(BASE) }).filter(i => i.rule === 'C16'),
      [],
    );
  });

  it('C58: an unknown activity kind fires; the register-gate keeps archetype-less trees silent', () => {
    const bad = BASE.replace('verification', 'ghosting');
    assert.deepEqual(
      check({ constructs: constructs(bad) })
        .filter(i => i.rule === 'C58')
        .map(i => i.rule),
      ['C58'],
    );
    const ungated = 'process p {\n name "P"\n activity_kind anything\n}\n';
    assert.deepEqual(
      check({ constructs: constructs(ungated) }).filter(i => i.rule === 'C58'),
      [],
    );
  });

  it('C12: a step io naming no register or parameter fires; gateway self-gates too', () => {
    const bad = BASE.replace(
      'inputs { filtered e_lim }',
      'inputs { ghost e_lim }',
    );
    assert.deepEqual(
      check({ constructs: constructs(bad) })
        .filter(i => i.rule === 'C12')
        .map(i => i.rule),
      ['C12'],
    );
    const gated = BASE.replace(
      'step b {',
      'gateway g {\n  condition "self.overload -> true"\n  to done\n }\n step b {',
    );
    assert.equal(
      check({ constructs: constructs(gated) }).filter(i => i.rule === 'C12')
        .length,
      1,
    );
  });

  it('C13: an unwritten OUT fires an error; an unread IN warns', () => {
    const unwritten = BASE.replace(
      'outputs { indication }\n  }',
      'outputs { other }\n  }',
    );
    const found = check({ constructs: constructs(unwritten) }).filter(
      i => i.rule === 'C13',
    );
    assert.equal(found.length, 1);
    assert.equal(found[0]!.severity, 'error');
    const unread = BASE.replace(
      'step a {\n   inputs { raw e_lim }',
      'step a {\n   inputs { e_lim }',
    );
    const warned = check({ constructs: constructs(unread) }).filter(
      i => i.rule === 'C13',
    );
    assert.equal(warned.length, 1);
    assert.equal(warned[0]!.severity, 'warning');
  });
});

describe('the state family (C37/C40/C38 — the register reaches 82)', () => {
  const BASE =
    'state_machine run_states {\n kind operational\n initial idle\n state idle\n state done\n transition finish { from idle to done action measured }\n}\nprocess scale {\n name "Scaling"\n state run_states\n does {\n  step weigh {\n   fires measured\n   inputs { raw }\n   outputs { out }\n  }\n }\n}\n';

  it('C37: a fires naming no transition action fires; the declared action stays silent', () => {
    const bad: ParsedPackage = {
      constructs: constructs(BASE.replace('fires measured', 'fires ghost')),
    };
    assert.deepEqual(
      check(bad)
        .filter(i => i.rule === 'C37')
        .map(i => i.rule),
      ['C37'],
    );
    assert.deepEqual(
      check({ constructs: constructs(BASE) }).filter(i => i.rule === 'C37'),
      [],
    );
    const unbound: ParsedPackage = {
      constructs: constructs(BASE.replace(' state run_states\n', '')),
    };
    assert.deepEqual(
      check(unbound)
        .filter(i => i.rule === 'C37')
        .map(i => i.rule),
      ['C37'],
    );
    const noMachine: ParsedPackage = {
      constructs: constructs(
        BASE.replace('state_machine run_states {', 'state_machine other {'),
      ),
    };
    assert.deepEqual(
      check(noMachine)
        .filter(i => i.rule === 'C37')
        .map(i => i.rule),
      ['C37'],
    );
  });

  it('C40: a subject HAS state binds a declared operational machine; lifecycle is C38; unknown is C40', () => {
    const base =
      'state_machine run_states {\n kind operational\n initial idle\n state idle\n}\nstate_machine workflow {\n kind lifecycle\n initial open\n state open\n}\n';
    const ok: ParsedPackage = {
      constructs: constructs(
        base + 'subject S {\n is {\n  state run_states\n }\n}\n',
      ),
    };
    assert.deepEqual(
      check(ok)
        .filter(i => i.rule === 'C40' || i.rule === 'C38')
        .map(i => i.rule),
      [],
    );
    const lifecycle: ParsedPackage = {
      constructs: constructs(
        base + 'subject S {\n is {\n  state workflow\n }\n}\n',
      ),
    };
    assert.deepEqual(
      check(lifecycle)
        .filter(i => i.rule === 'C38')
        .map(i => i.rule),
      ['C38'],
    );
    const unknown: ParsedPackage = {
      constructs: constructs(
        base + 'subject S {\n is {\n  state ghost\n }\n}\n',
      ),
    };
    assert.deepEqual(
      check(unknown)
        .filter(i => i.rule === 'C40')
        .map(i => i.rule),
      ['C40'],
    );
  });
});

describe('the quantities family (C32/C33/C34 — the register reaches 86)', () => {
  const BASE = `quantity_register masses {
 kind mass { si_unit kg }
 unit kg { symbol "kg" kind mass factor 1 }
}
attribute_definition e_max {
 name "Max capacity"
 quantity_kind mass
 unit kg
}
instance I1 {
 has {
  attributes { e_max : 2.2 kg }
 }
}
`;

  it('C32: a bare number on a declared physical quantity fires', () => {
    const bare: ParsedPackage = {
      constructs: constructs(BASE.replace('e_max : 2.2 kg', 'e_max : 2.2')),
    };
    const found = check(bare).filter(i => i.rule === 'C32');
    assert.equal(found.length, 1);
    assert.equal(found[0]!.severity, 'error');
    assert.deepEqual(
      check({ constructs: constructs(BASE) }).filter(i => i.rule === 'C32'),
      [],
    );
  });

  it('C33: the register plane — unknown kind + cross-register redefinition', () => {
    const ghostKind: ParsedPackage = {
      constructs: constructs(
        BASE.replace('kind mass factor 1', 'kind ghost factor 1'),
      ),
    };
    assert.deepEqual(
      check(ghostKind)
        .filter(i => i.rule === 'C33')
        .map(i => i.rule),
      ['C33'],
    );
    const redef = BASE.replace(
      'attribute_definition e_max {',
      `quantity_register masses2 {
 kind mass { si_unit g }
 unit kg { symbol "kg" kind mass factor 0.001 }
}
attribute_definition e_max {`,
    );
    assert.deepEqual(
      check({ constructs: constructs(redef) })
        .filter(i => i.rule === 'C33')
        .map(i => i.rule),
      ['C33'],
    );
  });

  it('C33: instance and symbol legs — unmapped unit + kind disagreement', () => {
    const unmapped: ParsedPackage = {
      constructs: constructs(BASE.replace('e_max : 2.2 kg', 'e_max : 2.2 t')),
    };
    const warned = check(unmapped).filter(i => i.rule === 'C33');
    assert.equal(warned.length, 1);
    assert.equal(warned[0]!.severity, 'warning');
    const withLength = BASE.replace(
      'unit kg { symbol "kg" kind mass factor 1 }',
      `unit kg { symbol "kg" kind mass factor 1 }
 unit m { symbol "m" kind length factor 1 }`,
    ).replace(
      'kind mass { si_unit kg }',
      'kind mass { si_unit kg }\n kind length { si_unit m }',
    );
    const mismatch: ParsedPackage = {
      constructs: constructs(
        withLength.replace('e_max : 2.2 kg', 'e_max : 2.2 m'),
      ),
    };
    const bad = check(mismatch).filter(
      i => i.rule === 'C33' && i.severity === 'error',
    );
    assert.equal(bad.length, 1);
    const sym = `quantity_register masses {
 kind mass { si_unit kg }
 unit kg { symbol "kg" kind mass factor 1 }
 kind length { si_unit m }
 unit m { symbol "m" kind length factor 1 }
}
symbol S {
 unit kg
 quantity_kind length
}
`;
    assert.equal(
      check({ constructs: constructs(sym) }).filter(i => i.rule === 'C33')
        .length,
      1,
    );
  });

  it('C34: designed and exhibited sides are kind-coherent', () => {
    const reg =
      'quantity_register masses {\n kind mass { si_unit kg }\n kind length { si_unit m }\n unit kg { symbol "kg" kind mass factor 1 }\n unit m { symbol "m" kind length factor 1 }\n}\n';
    const ok = `dual d {
 attribute e_max
 designed { value 2.2 unit kg tolerance 0.5 }
 exhibited { value 2200 unit g uncertainty 0.01 }
}
`;
    assert.deepEqual(
      check({ constructs: constructs(reg + ok) })
        .filter(i => i.rule === 'C34')
        .map(i => i.rule),
      [],
    );
    const bad = ok.replace(
      'exhibited { value 2200 unit g uncertainty 0.01 }',
      'exhibited { value 2.2 unit m uncertainty 0.01 }',
    );
    const found = check({ constructs: constructs(reg + bad) }).filter(
      i => i.rule === 'C34',
    );
    assert.equal(found.length, 1);
    assert.equal(found[0]!.severity, 'error');
  });
});
describe('the twins family (C60-C70/C99-C102)', () => {
  const BASE = `subject LC {
 is {
  endpoint api {
   operation get_indication {
    kind query
    serves indication, sample.test_context.indication
    payload { quantity_kind mass unit kg timestamp true }
   }
   operation trigger_self_test {
    kind invoke
    does self_test
    payload { quantity_kind state unit dimensionless timestamp true }
   }
   access {
    public { get_indication }
    registered { trigger_self_test }
   }
   profile rest_json
  }
  promises {
   eer_within {
    target indication
    statement "The indication holds."
   }
  }
 }
 has {
  state lc_operational
  attributes { indication : mass test_dependent }
  serve sample.test_context.indication via get_indication { fresh_within 5s }
 }
}
behavior self_test { kind procedural }
state_machine lc_operational {
 kind operational
 initial off
 state off
}
attribute_definition indication {
 quantity_kind mass
 unit kg
}
requirement /req/x { name "X" statement "X holds." }
role inspector { label "Inspector" }
connector_profile grpc {
 protocol "gRPC"
 description "Protobuf channels"
}
`;
  const twins = (src: string, rules: string[]) =>
    check({ constructs: constructs(src) })
      .filter(i => rules.includes(i.rule))
      .map(i => `${i.rule}:${i.severity}`);

  it('C60: serve + operation target legs; invoke-as-serve and incoherent payload fire', () => {
    const rules = ['C60'];
    assert.deepEqual(twins(BASE, rules), []);
    const ghostAspect = BASE.replace(
      'serves indication, sample.test_context.indication',
      'serves ghost_aspect',
    );
    assert.equal(twins(ghostAspect, rules).length, 1);
    const ghostServe = BASE.replace(
      'serve sample.test_context.indication via get_indication',
      'serve ghost.key via get_indication',
    );
    assert.equal(twins(ghostServe, rules).length, 1);
    const ghostOp = BASE.replace(
      'via get_indication { fresh_within 5s }',
      'via missing_op { fresh_within 5s }',
    );
    assert.equal(twins(ghostOp, rules).length, 1);
    const invokeServe = BASE.replace(
      'via get_indication { fresh_within 5s }',
      'via trigger_self_test { fresh_within 5s }',
    );
    assert.equal(twins(invokeServe, rules).length, 3);
    const incoherent = BASE.replace(
      'payload { quantity_kind mass unit kg timestamp true }',
      'payload { quantity_kind length unit m timestamp true }',
    );
    assert.equal(twins(incoherent, rules).length, 2);
  });

  it('C61: operation kind + payload schema legs', () => {
    const rules = ['C61'];
    assert.deepEqual(twins(BASE, rules), []);
    const badKind = BASE.replace('kind query', 'kind watch');
    assert.deepEqual(twins(badKind, rules), ['C61:error']);
    const noPayload = BASE.replace(
      `    serves indication, sample.test_context.indication
    payload { quantity_kind mass unit kg timestamp true }`,
      '    serves indication, sample.test_context.indication',
    );
    assert.equal(twins(noPayload, rules).length, 1);
    const noTimestamp = BASE.replace('timestamp true', 'timestamp false');
    assert.equal(twins(noTimestamp, rules).length, 1);
  });

  it('C62: scope vocabulary + exactly-one coverage', () => {
    const rules = ['C62'];
    assert.deepEqual(twins(BASE, rules), []);
    const badScope = BASE.replace(
      'registered { trigger_self_test }',
      'admin { trigger_self_test }',
    );
    assert.deepEqual(twins(badScope, rules), ['C62:error']);
    const uncovered = BASE.replace('    public { get_indication }\n', '');
    assert.equal(twins(uncovered, rules).length, 1);
    const doubleCover = BASE.replace(
      'registered { trigger_self_test }',
      'registered { trigger_self_test get_indication }',
    );
    assert.equal(twins(doubleCover, rules).length, 1);
  });

  it('C63: freshness required and parseable on live bindings', () => {
    const rules = ['C63'];
    assert.deepEqual(twins(BASE, rules), []);
    const noFresh = BASE.replace(' { fresh_within 5s }', '');
    assert.deepEqual(twins(noFresh, rules), ['C63:error']);
    const badFresh = BASE.replace('fresh_within 5s', 'fresh_within soon');
    assert.deepEqual(twins(badFresh, rules), ['C63:error']);
  });

  it('C64: endpoint profile required and registered', () => {
    const rules = ['C64'];
    assert.deepEqual(twins(BASE, rules), []);
    const noProfile = BASE.replace('\n   profile rest_json', '');
    assert.deepEqual(twins(noProfile, rules), ['C64:error']);
    const ghostProfile = BASE.replace(
      'profile rest_json',
      'profile carrier_pigeon',
    );
    assert.deepEqual(twins(ghostProfile, rules), ['C64:error']);
  });

  it('C65/C66: monitor subject set + trigger clock', () => {
    const rules = ['C65', 'C66'];
    assert.deepEqual(twins(BASE, rules), []);
    const mon = `monitor m1 {
 over { LC }
 triggers { every 1h on change indication }
 evaluate { requirements all promises all }
 emit { evidence -> workspace verdicts -> verdict_log }
 escalate { on fail { flag_certificate } }
}
`;
    assert.deepEqual(twins(BASE + mon, rules), []);
    const noOver = mon.replace(' over { LC }\n', '');
    assert.deepEqual(
      twins(BASE + noOver, rules).map(x => x.split(':')[0]),
      ['C65'],
    );
    const ghostOver = mon.replace('over { LC }', 'over { GhostModel }');
    assert.deepEqual(
      twins(BASE + ghostOver, rules).map(x => x.split(':')[0]),
      ['C65'],
    );
    const noTriggers = mon.replace(
      ' triggers { every 1h on change indication }\n',
      '',
    );
    assert.deepEqual(
      twins(BASE + noTriggers, rules).map(x => x.split(':')[0]),
      ['C66'],
    );
    const badWindow = mon.replace('every 1h', 'every sometimes');
    assert.deepEqual(
      twins(BASE + badWindow, rules).map(x => x.split(':')[0]),
      ['C66'],
    );
  });

  it('C67/C68/C69/C70: evaluate refs, fail escalation, sinks', () => {
    const rules = ['C67', 'C68', 'C69', 'C70'];
    assert.deepEqual(twins(BASE, rules), []);
    const ghostRef = `monitor m1 {
 over { LC }
 triggers { every 1h }
 evaluate { requirements { /req/ghost } promises { eer_within } }
 emit { evidence -> workspace verdicts -> verdict_log }
 escalate { on fail { flag_certificate } on invalid { notify nosuchrole } }
}
`;
    const found = twins(BASE + ghostRef, rules);
    assert.deepEqual(found.filter(x => x.startsWith('C67')).length, 1);
    const noFail = ghostRef.replace(' on fail { flag_certificate }', '');
    assert.deepEqual(
      twins(BASE + noFail, rules).filter(x => x.startsWith('C68')),
      ['C68:warning'],
    );
    const badRole = ghostRef.replace('notify nosuchrole', 'notify nosuchrole');
    assert.equal(
      twins(BASE + badRole, rules).filter(x => x.startsWith('C69')).length >= 1,
      true,
    );
    const noVerdicts = ghostRef.replace(' verdicts -> verdict_log', '');
    assert.equal(
      twins(BASE + noVerdicts, rules).filter(x => x.startsWith('C70')).length,
      1,
    );
  });

  it('C99: the probe-channel provenance legs', () => {
    const rules = ['C99'];
    const t = (src: string) => twins(src, rules);
    const base = `conformance_test /conf/t {
 variable reading {
  source measured
  provenance { channel reference_instrument ref eq-1 observed_at ts }
 }
 variable ts { }
}
`;
    assert.deepEqual(t(base), []);
    const badChannel = base.replace(
      'channel reference_instrument',
      'channel telepathy',
    );
    assert.equal(t(badChannel).length, 1);
    const noRef = base.replace(' ref eq-1', '');
    assert.equal(t(noRef).length, 1);
    const ghostObserved = base.replace('observed_at ts', 'observed_at ghost');
    assert.equal(t(ghostObserved).length, 1);
    const attestation = base.replace(
      'channel reference_instrument ref eq-1',
      'channel observer_attestation ref off-1',
    );
    assert.equal(t(attestation).length, 1);
    const attestationOk = base.replace(
      'channel reference_instrument ref eq-1',
      'channel observer_attestation ref off-1 limitation "twin equals display"',
    );
    assert.deepEqual(t(attestationOk), []);
  });

  it('C100/C101/C102: the composition facet', () => {
    const rules = ['C100', 'C101', 'C102'];
    const t = (src: string) => twins(src, rules);
    const base = `subject Gauge { }
subject Rig {
 is {
  composed_of rig_comp {
   component gauge { product pkg-rig/Gauge endpoint gauge_api }
   decomposition {
    sample.test_context.indication -> composite rule any_fault_else_analyzer
    state -> gauge
   }
  }
 }
 has {
  serve sample.test_context.indication via g_api { fresh_within 5s }
  serve state via g_api { fresh_within 1s }
  attributes { indication : mass test_dependent }
 }
 endpoint g_api {
  operation get_i {
   kind query
   serves indication
   payload { quantity_kind mass unit kg timestamp true }
  }
  access { public { get_i } }
  profile rest_json
 }
}
`;
    // The decomposition covers both serves; the composite rule is known.
    const residual = t(base).filter(x => !x.startsWith('C60'));
    assert.deepEqual(residual, [], JSON.stringify(residual));
    const ghostComponent = base.replace(
      'state -> gauge',
      'state -> ghost_comp',
    );
    assert.equal(t(ghostComponent).filter(x => x.startsWith('C100')).length, 1);
    const badRule = base.replace(
      'rule any_fault_else_analyzer',
      'rule coin_flip',
    );
    assert.equal(t(badRule).filter(x => x.startsWith('C102')).length, 1);
    const uncovered = base.replace('    state -> gauge\n', '');
    assert.equal(t(uncovered).filter(x => x.startsWith('C101')).length, 1);
  });
});
describe('the text-coverage family (C71/C72/C73)', () => {
  const URN = 'urn:oiml:pub:r:60-1:2021';
  const DOC = {
    urn: URN,
    fragments: new Set(['clause-1', 'clause-2']),
    addresses: new Set(['clause-1/s1', 'clause-1/s2', 'clause-2/s1']),
    sentences: [
      {
        address: 'clause-1/s1',
        fragment: 'clause-1',
        modality: 'normative',
        kind: 'requirement',
        text: 'The instrument shall indicate the measured value.',
      },
      {
        address: 'clause-1/s2',
        fragment: 'clause-1',
        modality: 'informative',
        kind: 'note',
        text: 'A note.',
      },
      {
        address: 'clause-2/s1',
        fragment: 'clause-2',
        modality: 'normative',
        kind: 'requirement',
        text: 'The maximum permissible error shall hold.',
      },
    ],
  } as ShippedDocument;
  const pkgWith = (over: object) =>
    check({
      constructs: constructs('term t { name "T" definition "D" }'),
      documents: [DOC],
      ...over,
    } as never)
      .filter(i => ['C71', 'C72', 'C73'].includes(i.rule))
      .map(i => `${i.rule}:${i.severity}`);

  it('C71: an unbound, unallowed normative sentence warns; bound and informative stay silent', () => {
    // term t cites clause-1 → its normative sentence is bound via the
    // fragment; clause-2/s1 is uncovered.
    const bound = `term t {
 name "T"
 definition "D"
 ref derives-from "${URN}#clause-1"
}
`;
    assert.deepEqual(
      check({ constructs: constructs(bound), documents: [DOC] } as never)
        .filter(i => i.rule === 'C71')
        .map(i => i.rule),
      ['C71'],
    );
  });

  it('C73: malformed manifests and coverage payloads are errors', () => {
    const bad = {
      ...DOC,
      malformed:
        'sources-prd/x.sentences.json: not a prd_sentences 0.1.0 manifest — regenerate the package (text-coverage-config)',
    };
    assert.deepEqual(
      pkgWith({ documents: [bad] }).filter(x => x.startsWith('C73')),
      ['C73:error'],
    );
    assert.deepEqual(
      pkgWith({
        coverage: {
          parseError:
            'sources-prd/coverage.json: prd_coverage must be "0.1.0" — regenerate the package (text-coverage-config)',
        },
      }).filter(x => x.startsWith('C73')),
      ['C73:error'],
    );
  });

  it('C73: stale, dead, and unreasoned allowances are errors; a live allowance discharges', () => {
    const cov = {
      config: {
        prd_coverage: '0.1.0',
        allowances: [{ address: `${URN}#clause-2`, reason: 'editorial remit' }],
      },
    };
    // clause-2/s1 is uncovered and allowed → its C71 goes away; the
    // allowance is live (clause-2/s1 not bound). clause-1/s1 stays
    // uncovered by no allowance — its C71 remains.
    assert.deepEqual(pkgWith({ coverage: cov }), ['C71:warning']);
    // No reason → C73.
    const noReason = {
      config: {
        prd_coverage: '0.1.0',
        allowances: [{ address: `${URN}#clause-2` }],
      },
    };
    assert.deepEqual(
      pkgWith({ coverage: noReason }).filter(x => x.startsWith('C73')),
      ['C73:error'],
    );
    // Ghost fragment → matches no sentence.
    const ghost = {
      config: {
        prd_coverage: '0.1.0',
        allowances: [{ address: `${URN}#clause-9`, reason: 'x' }],
      },
    };
    assert.equal(
      pkgWith({ coverage: ghost }).filter(x => x.startsWith('C73')).length >= 1,
      true,
    );
    // Dead allowance: binding clause-2 makes the allowance discharge nothing.
    const bound = `term t {
 name "T"
 definition "D"
 ref derives-from "${URN}#clause-2"
}
`;
    const dead = check({
      constructs: constructs(bound),
      documents: [DOC],
      coverage: cov,
    } as never)
      .filter(i => i.rule === 'C73')
      .map(i => i.message);
    assert.equal(dead.length, 1);
    assert.match(dead[0]!, /discharges nothing/);
  });

  it('C73: adjudication hygiene — sorted, reasoned, and currently flagged', () => {
    const dup = `requirement /req/a {
 name "A"
 statement "The maximum permissible error of the instrument shall hold under reference conditions."
 ref derives-from "${URN}#clause-1"
}
requirement /req/b {
 name "B"
 statement "The maximum permissible error of the instrument shall hold under reference conditions."
 ref derives-from "${URN}#clause-2"
}
`;
    const adjudicated = {
      config: {
        prd_coverage: '0.1.0',
        duplicate_adjudications: [
          {
            elements: ['/req/a', '/req/b'],
            verdict: 'distinct',
            reason: 'different scope conditions',
          },
        ],
      },
    };
    const found = check({
      constructs: constructs(dup),
      documents: [DOC],
      coverage: adjudicated,
    } as never).filter(i => ['C71', 'C73'].includes(i.rule));
    // The pair is flagged and adjudicated; clause-1/s1 and clause-2/s1
    // are bound by the refs. Only the informative s2 stays silent.
    assert.deepEqual(found, [], JSON.stringify(found));
    const unsorted = {
      config: {
        prd_coverage: '0.1.0',
        duplicate_adjudications: [
          {
            elements: ['/req/b', '/req/a'],
            verdict: 'distinct',
            reason: 'x',
          },
        ],
      },
    };
    assert.equal(
      check({
        constructs: constructs(dup),
        documents: [DOC],
        coverage: unsorted,
      } as never).filter(i => i.rule === 'C73').length,
      1,
    );
    const stalePair = {
      config: {
        prd_coverage: '0.1.0',
        duplicate_adjudications: [
          {
            elements: ['/req/a', '/req/ghost'],
            verdict: 'distinct',
            reason: 'x',
          },
        ],
      },
    };
    assert.equal(
      check({
        constructs: constructs(dup),
        documents: [DOC],
        coverage: stalePair,
      } as never).filter(i => i.rule === 'C73').length,
      1,
    );
  });

  it('C72: the text_coverage_budget — exceeded errors, slack warns', () => {
    const base = {
      documents: [DOC],
      allowlist: {
        entries: [],
        budgets: [{ key: 'text_coverage_budget', raw: '0' }],
        directives: [],
      },
    };
    assert.deepEqual(
      check({
        constructs: constructs('term t { name "T" definition "D" }'),
        ...base,
      } as never)
        .filter(i => i.rule === 'C72')
        .map(i => `${i.rule}:${i.severity}`),
      ['C72:error'],
    );
    const slack = {
      ...base,
      allowlist: {
        entries: [],
        budgets: [{ key: 'text_coverage_budget', raw: '5' }],
        directives: [],
      },
    };
    assert.deepEqual(
      check({
        constructs: constructs('term t { name "T" definition "D" }'),
        ...slack,
      } as never)
        .filter(i => i.rule === 'C72')
        .map(i => `${i.rule}:${i.severity}`),
      ['C72:warning'],
    );
  });
});
describe('C41 precondition-on-violation', () => {
  it('an invalid disposition stays silent; anything else warns', () => {
    const BASE = `process scale {
 name "Scaling"
 precondition warm {
  check { self.state = #ready }
  on_violation invalid
 }
}
`;
    assert.deepEqual(
      check({ constructs: constructs(BASE) })
        .filter(i => i.rule === 'C41')
        .map(i => i.rule),
      [],
    );
    const fail = BASE.replace('on_violation invalid', 'on_violation fail');
    assert.deepEqual(
      check({ constructs: constructs(fail) })
        .filter(i => i.rule === 'C41')
        .map(i => `${i.rule}:${i.severity}`),
      ['C41:warning'],
    );
    const odd = BASE.replace('on_violation invalid', 'on_violation explode');
    const test = `conformance_test /conf/t {
 precondition p1 {
  check { self.x > 0 }
  on_violation warn_and_continue
 }
}
`;
    assert.deepEqual(
      check({ constructs: constructs(BASE + test) })
        .filter(i => i.rule === 'C41')
        .map(i => i.rule),
      ['C41'],
    );
    assert.match(
      check({ constructs: constructs(odd) }).filter(i => i.rule === 'C41')[0]!
        .message,
      /explode/,
    );
  });
});
describe('C39 state gates + the C41 fail distinction', () => {
  const BASE = `state_machine run_states {
 kind operational
 initial idle
 state idle
 state done
 transition finish { from idle to done action measured }
}
process scale {
 name "Scaling"
 state run_states
 precondition warm {
  check { self.state = #idle }
  on_violation fail
 }
 does {
  step weigh { fires measured }
 }
}
`;
  it('C39: a gate on an undeclared state fires; declared states stay silent', () => {
    assert.deepEqual(
      check({ constructs: constructs(BASE) })
        .filter(i => i.rule === 'C39')
        .map(i => i.rule),
      [],
    );
    const ghost = BASE.replace('#idle', '#ghost');
    assert.deepEqual(
      check({ constructs: constructs(ghost) })
        .filter(i => i.rule === 'C39')
        .map(i => i.rule),
      ['C39'],
    );
    const unbound = BASE.replace(' state run_states\n', '');
    assert.deepEqual(
      check({ constructs: constructs(unbound) })
        .filter(i => i.rule === 'C39')
        .map(i => i.rule),
      ['C39'],
    );
    const noMachine = BASE.replace(
      'state_machine run_states {',
      'state_machine other {',
    );
    assert.deepEqual(
      check({ constructs: constructs(noMachine) })
        .filter(i => i.rule === 'C39')
        .map(i => i.rule),
      ['C39'],
    );
  });

  it('C41: a state gate declared fail names the doctrine; a non-gate fail stays unknown', () => {
    const doctrine = check({ constructs: constructs(BASE) })
      .filter(i => i.rule === 'C41')
      .map(i => i.message);
    assert.equal(doctrine.length, 1);
    assert.match(doctrine[0]!, /VOIDS the run/);
    const nonGate = BASE.replace(
      'check { self.state = #idle }',
      'check { self.overload -> true }',
    );
    assert.deepEqual(
      check({ constructs: constructs(nonGate) })
        .filter(i => i.rule === 'C41')
        .map(i => i.message)
        .map(m => /only known outcome/.test(m)),
      [true],
    );
  });
});
describe('C95 the cascade routing contract', () => {
  const BASE = `state_machine TestRequest {
 initial DRAFT
 states { DRAFT ISSUED IN_PROGRESS }
 transition DRAFT -> ISSUED action ia_issues {
  cascade TestRequest {
   set { status: "ISSUED" }
  }
 }
 transition ISSUED -> IN_PROGRESS action lab_starts {
  cascade TestAssignment {
   via start
   set { status: "IN_PROGRESS" }
  }
 }
}
state_machine TestAssignment {
 initial CREATED
 states { CREATED IN_PROGRESS }
 transition CREATED -> IN_PROGRESS action start { }
}
`;
  const c95 = (src: string) =>
    check({ constructs: constructs(src) })
      .filter(i => i.rule === 'C95')
      .map(i => i.message);

  it('the clean model stays silent; leg 1 fires on a via-less status write', () => {
    assert.deepEqual(c95(BASE), []);
    const vialess = BASE.replace('   via start\n', '');
    const found = c95(vialess);
    assert.equal(found.length, 1);
    assert.match(found[0]!, /declares no via/);
  });

  it('leg 5: via is forbidden on a self-step, a record-create, and a payload-only step', () => {
    const selfStep = BASE.replace(
      `transition ISSUED -> IN_PROGRESS action lab_starts {
  cascade TestAssignment {
   via start
   set { status: "IN_PROGRESS" }
  }
 }`,
      `transition ISSUED -> IN_PROGRESS action lab_starts {
  cascade TestRequest {
   via start
   set { status: "IN_PROGRESS" }
  }
 }`,
    );
    assert.equal(
      c95(selfStep).filter(m => /forbidden everywhere else/.test(m)).length,
      1,
    );
    const createStep = BASE.replace(
      `  cascade TestAssignment {
   via start`,
      `  cascade TestAssignment {
   create { id: "x" }
   via start`,
    );
    assert.equal(c95(createStep).filter(m => /create step/.test(m)).length, 1);
    const payloadOnly = BASE.replace(
      `   via start
   set { status: "IN_PROGRESS" }`,
      `   via start
   set { note: "hi" }`,
    );
    assert.equal(
      c95(payloadOnly).filter(m => /writes no status/.test(m)).length,
      1,
    );
  });

  it('legs 2-4: the via must resolve, land on the written status, and be unguarded', () => {
    const ghostVia = BASE.replace('via start', 'via ghost_action');
    assert.equal(
      c95(ghostVia).filter(m => /resolves to no transition/.test(m)).length,
      1,
    );
    const wrongLanding = BASE.replace(
      'set { status: "IN_PROGRESS" }',
      'set { status: "COMPLETED" }',
    );
    assert.equal(
      c95(wrongLanding).filter(m => /land on the written status/.test(m))
        .length,
      1,
    );
    const guarded = BASE.replace(
      `transition CREATED -> IN_PROGRESS action start { }`,
      `transition CREATED -> IN_PROGRESS action start { guard "x > 0" }`,
    );
    assert.equal(
      c95(guarded).filter(m => /must be unguarded/.test(m)).length,
      1,
    );
  });
});
describe('the quantities extensions (C35/C36/C149/C152/C167)', () => {
  const t = (src: string, rules: string[]) =>
    check({ constructs: constructs(src) })
      .filter(i => rules.includes(i.rule))
      .map(i => i.rule);

  it('C35: time-typed attribute values and timer periods are ISO 8601', () => {
    const rules = ['C35'];
    const base = `attribute_definition review_date {
 value_type date
}
instance I1 {
 has {
  attributes { review_date : 2026-03-01 }
 }
}
`;
    assert.deepEqual(t(base, rules), []);
    const bad = base.replace('2026-03-01', '2026-13-40');
    assert.deepEqual(t(bad, rules), ['C35']);
    const timer = `process cool {
 does {
  step wait_cool {
   kind timer_event
   period PT1H
  }
 }
}
`;
    assert.deepEqual(t(timer, rules), []);
    const badTimer = timer.replace('period PT1H', 'period 1hour');
    assert.deepEqual(t(badTimer, rules), ['C35']);
  });

  it('C36: map<K, V> type expressions are well-formed', () => {
    const rules = ['C36'];
    assert.deepEqual(
      t(
        'attribute_definition m {\n value_type "map<string, integer>"\n}\n',
        rules,
      ),
      [],
    );
    assert.deepEqual(
      t(
        'attribute_definition m {\n value_type "map<weird, map<>>"\n}\n',
        rules,
      ),
      ['C36'],
    );
    assert.deepEqual(
      t(
        'class X#data {\n counts: map<string, integer> { modality SHALL }\n}\n',
        rules,
      ),
      [],
    );
  });

  it('C149: a derivation references only the declared universe', () => {
    const rules = ['C149'];
    const base = `attribute_definition e_max { }
attribute_definition y {
 derived "ocl{e_max + mpe}"
}
table mpe { }
`;
    assert.deepEqual(t(base, rules), []);
    const ghost = base.replace('e_max + mpe', 'e_max + ghost_thing');
    assert.deepEqual(t(ghost, rules), ['C149']);
  });

  it('C152: dimension payload values are typed by their payload_class fields', () => {
    const rules = ['C152'];
    const base = `class ClimaticClass#data {
 designation: string { modality SHALL }
}
instrument LoadCell {
 dimension accuracy_class {
  payload_class ClimaticClass#data
  values {
   A { payload { designation: "A" } }
  }
 }
}
`;
    assert.deepEqual(t(base, rules), []);
    const ghostField = base.replace('designation: "A"', 'ghost: "A"');
    assert.deepEqual(t(ghostField, rules), ['C152']);
    const emptyPayload = base.replace(
      'A { payload { designation: "A" } }',
      'A { }',
    );
    assert.deepEqual(t(emptyPayload, rules), ['C152']);
    const ghostClass = base.replace(
      'payload_class ClimaticClass#data',
      'payload_class GhostClass',
    );
    assert.deepEqual(t(ghostClass, rules), ['C152']);
  });

  it('C167: datum units and quantity kinds are qualified references', () => {
    const rules = ['C167'];
    assert.deepEqual(
      t('datum d {\n unit si:joule\n quantity_kind unitsdb:heat\n}\n', rules),
      [],
    );
    assert.deepEqual(t('datum d {\n unit bareunit\n}\n', rules), ['C167']);
  });
});
describe('Batch A — the shapes/vocabulary family (13 rules)', () => {
  const t = (src: string, rules: string[]) =>
    check({ constructs: constructs(src) })
      .filter(i => rules.includes(i.rule))
      .map(i => `${i.rule}:${i.severity}`);

  it('C154: the deprecation inventory is data — inert while empty', () => {
    assert.deepEqual(t('table t { }\n', ['C154']), []);
  });

  it('C90/C91: the invariant shape and enforcement grammar', () => {
    const rules = ['C90', 'C91'];
    const base = `invariant inv_mpe {
 name "MPE holds"
 statement "The MPE holds across the range."
 severity error
 enforcement { kernel:C5 }
}
`;
    assert.deepEqual(t(base, rules), []);
    const aspirational = `invariant inv_mpe {
 name "MPE holds"
 statement "The MPE holds."
 severity error
 enforcement aspirational
}
`;
    assert.deepEqual(t(aspirational, rules), []);
    const mixed = base.replace(
      'enforcement { kernel:C5 }',
      'enforcement { kernel:C5 aspirational }',
    );
    assert.deepEqual(t(mixed, rules), ['C91:error']);
    const empty = base.replace(' enforcement { kernel:C5 }\n', '');
    assert.deepEqual(
      t(empty, rules).filter(x => x.startsWith('C90')).length,
      1,
    );
    const noSeverity = base.replace(' severity error\n', '');
    assert.deepEqual(
      t(noSeverity, rules).filter(x => x.startsWith('C90')).length,
      1,
    );
    const badClaim = base.replace('kernel:C5', 'kernel:five');
    assert.deepEqual(t(badClaim, rules), ['C91:error']);
    const markerInList = base.replace('kernel:C5', 'aspirational');
    assert.deepEqual(t(markerInList, rules), ['C91:error']);
  });

  it('C92/C93: the test sequence shape and per-edge integrity', () => {
    const rules = ['C92', 'C93'];
    const base = `test_sequence flow {
 name "Flow"
 description "The order."
 step 1 { test /conf/a role baseline }
 step 2 { phase warmup depends_on 1 }
}
`;
    assert.deepEqual(t(base, rules), []);
    const noSteps = base.replace(/ step .*\n/g, '');
    assert.deepEqual(t(noSteps, rules), ['C92:error']);
    const dup = base.replace(
      'step 2 { phase warmup depends_on 1 }',
      'step 1 { phase warmup }',
    );
    assert.equal(t(dup, rules).filter(x => x.startsWith('C92')).length, 1);
    const neither = base.replace(
      'step 2 { phase warmup depends_on 1 }',
      'step 2 { depends_on 1 }',
    );
    assert.equal(t(neither, rules).filter(x => x.startsWith('C92')).length, 1);
    const both = base.replace(
      'step 2 { phase warmup depends_on 1 }',
      'step 2 { test /conf/b phase warmup }',
    );
    assert.equal(t(both, rules).filter(x => x.startsWith('C92')).length, 1);
    const badRole = base.replace('role baseline', 'role guest');
    assert.equal(t(badRole, rules).filter(x => x.startsWith('C92')).length, 1);
    const selfDep = base.replace(
      'step 1 { test /conf/a role baseline }',
      'step 1 { test /conf/a role baseline depends_on 1 }',
    );
    assert.deepEqual(
      t(selfDep, rules).filter(x => x.startsWith('C93')),
      ['C93:error'],
    );
    const forward = base.replace('depends_on 1 }', 'depends_on 2 }');
    assert.deepEqual(
      t(forward, rules).filter(x => x.startsWith('C93')),
      ['C93:error'],
    );
    const ghostDep = base.replace('depends_on 1 }', 'depends_on 9 }');
    assert.deepEqual(
      t(ghostDep, rules).filter(x => x.startsWith('C93')),
      ['C93:error'],
    );
  });

  it('C147/C148: the executable test programs', () => {
    const rules = ['C147', 'C148'];
    const base = `conformance_test /conf/mpe {
 preparation {
  step 1 { action "Warm" hold 30min verify { read indication tolerance /req/x } }
 }
 stimulus {
  point 1 { drive ladApply args { load: "10 t" } hold PT5M fresh_within 5s acceptance /req/mpe }
 }
}
`;
    assert.deepEqual(t(base, rules), []);
    const noDrive = base.replace(
      /point 1 \{.*\}/,
      'point 1 { hold PT5M fresh_within 5s acceptance /req/mpe }',
    );
    assert.equal(t(noDrive, rules).filter(x => x.startsWith('C147')).length, 1);
    const noAcceptance = base.replace('acceptance /req/mpe', 'judged /req/mpe');
    assert.equal(
      t(noAcceptance, rules).filter(x => x.startsWith('C147')).length,
      1,
    );
    const noVerifyRead = base.replace(
      'verify { read indication tolerance /req/x }',
      'verify { tolerance /req/x }',
    );
    assert.deepEqual(t(noVerifyRead, rules), ['C147:error']);
    const neitherAD = base.replace('action "Warm" hold 30min', 'hold 30min');
    assert.equal(
      t(neitherAD, rules).filter(x => x.startsWith('C147')).length,
      1,
    );
    const badHold = base.replace('hold 30min', 'hold soon');
    assert.deepEqual(
      t(badHold, rules).filter(x => x.startsWith('C148')),
      ['C148:error'],
    );
    const noFresh = base.replace(' fresh_within 5s', '');
    assert.deepEqual(
      t(noFresh, rules).filter(x => x.startsWith('C148')),
      ['C148:error'],
    );
    const badFresh = base.replace('fresh_within 5s', 'fresh_within soon');
    assert.deepEqual(
      t(badFresh, rules).filter(x => x.startsWith('C148')),
      ['C148:error'],
    );
  });
  it('C94: the formulas-used trace shape', () => {
    const rules = ['C94'];
    const base = `formulas_used /conf/mpe {
 name "MPE"
 description "The envelope."
 formulas { mpe_envelope relative_error }
}
`;
    assert.deepEqual(t(base, rules), []);
    const badId = base.replace('mpe_envelope', 'MpeEnvelope');
    assert.deepEqual(t(badId, rules), ['C94:error']);
    const noFormulas = base.replace(
      'formulas { mpe_envelope relative_error }',
      'formulas { }',
    );
    assert.deepEqual(
      t(noFormulas, rules).filter(x => x.startsWith('C94')).length,
      1,
    );
    const noDesc = base.replace(' description "The envelope."\n', '');
    assert.deepEqual(
      t(noDesc, rules).filter(x => x.startsWith('C94')).length,
      1,
    );
  });

  it('C89: the spelling codes', () => {
    const rules = ['C89'];
    assert.deepEqual(
      t('package { id p default_spelling eng-Latn }', rules),
      [],
    );
    assert.deepEqual(t('package { id p default_spelling ara }', rules), [
      'C89:error',
    ]);
    assert.deepEqual(
      t(
        'package { id p spellings { eng-Latn fra-Latn } default_spelling deu-Latn }',
        rules,
      ),
      ['C89:error'],
    );
  });

  it('C158/C161: the datum prose quarantine and render surface', () => {
    const rules = ['C158', 'C161'];
    assert.deepEqual(
      t(
        'datum d {\n label "D"\n description "Heat per mass."\n render asciimath "c = Q/(m*T)"\n}\n',
        rules,
      ),
      [],
    );
    assert.deepEqual(
      t('datum d {\n description "See clause-4 for the limit."\n}\n', rules),
      ['C158:error'],
    );
    assert.deepEqual(
      t('datum d {\n description "Unfinished TODO.roadmap/99."\n}\n', rules),
      ['C158:warning'],
    );
    assert.deepEqual(t('datum d {\n render markdown "c"\n}\n', rules), [
      'C161:error',
    ]);
  });

  it('C159: a mapping namespace names a declared namespace block', () => {
    const rules = ['C159'];
    assert.deepEqual(
      t(
        'namespace lml {\n uri "urn:x"\n}\nmapping xml Ceramic {\n namespace lml\n}\n',
        rules,
      ),
      [],
    );
    assert.deepEqual(
      t('mapping xml Ceramic {\n namespace ghost_ns\n}\n', rules),
      ['C159:error'],
    );
  });

  it('C84: the when-guard is a predicate', () => {
    const rules = ['C84'];
    const base = `requirement /req/g {
 limit load_limit {
  args { l <- symbol:load }
  when { l <= 100 }
  expression { l }
 }
}
`;
    assert.deepEqual(t(base, rules), []);
    const arithmetic = base.replace('when { l <= 100 }', 'when { l + 100 }');
    assert.deepEqual(t(arithmetic, rules), ['C84:error']);
    const negated = base.replace('when { l <= 100 }', 'when { not l > 100 }');
    assert.deepEqual(t(negated, rules), []);
  });
});
describe('Batch C — the coverage plane + the allowlist applied (C5/C51-C55/C57)', () => {
  const t = (over: object, rules: string[], src = 'table t { }') =>
    check({ constructs: constructs(src), ...over } as never)
      .filter(i => rules.includes(i.rule))
      .map(i => `${i.rule}:${i.severity}`);

  it('C5: an untargeted requirement warns; targets, provisions, and non-test verification cover', () => {
    const req = 'requirement /req/a {\n name "A"\n statement "A holds."\n}\n';
    assert.deepEqual(
      check({ constructs: constructs(req) } as never)
        .filter(i => i.rule === 'C5')
        .map(i => `${i.rule}:${i.severity}`),
      ['C5:warning'],
    );
    const targeted =
      req + 'conformance_test /conf/t {\n targets { /req/a }\n}\n';
    assert.deepEqual(
      check({ constructs: constructs(targeted) } as never)
        .filter(i => i.rule === 'C5')
        .map(i => i.rule),
      [],
    );
    const verified = req.replace(
      'statement "A holds."',
      'verification examination',
    );
    assert.deepEqual(
      check({ constructs: constructs(verified) } as never)
        .filter(i => i.rule === 'C5')
        .map(i => i.rule),
      [],
    );
    const viaClass =
      'requirement_class /req/c {\n members { /req/a }\n}\n' +
      'conformance_test /conf/t {\n targets { /req/c }\n}\n' +
      req;
    assert.deepEqual(
      check({ constructs: constructs(viaClass) } as never)
        .filter(i => i.rule === 'C5')
        .map(i => i.rule),
      [],
    );
    const noTargets = 'conformance_test /conf/t {\n name "T"\n}\n';
    assert.deepEqual(
      check({ constructs: constructs(noTargets) } as never)
        .filter(i => i.rule === 'C5')
        .map(i => `${i.rule}:${i.severity}`),
      ['C5:warning'],
    );
  });

  it('C53/C54: the uses anchoring', () => {
    const rules = ['C53', 'C54'];
    const base = `symbol ind { unit kg quantity_kind mass }
table mpe_tiers {
 profile_defs {
  wide { }
 }
}
calculation calc_x {
 name "calc_x"
 profile mpe_tiers.wide
 expression { 1 + 1 }
}
requirement /req/a {
 name "A"
 limit mpe {
  uses { load observable:ind formula:calc_x table:mpe_tiers profile:mpe_tiers.wide }
 }
}
`;
    assert.deepEqual(t({ constructs: constructs(base) }, rules) as never, []);
    const ghostSym = base.replace('observable:ind', 'observable:ghost');
    assert.deepEqual(
      check({ constructs: constructs(ghostSym) } as never)
        .filter(i => rules.includes(i.rule))
        .map(i => i.rule),
      ['C53'],
    );
    const ghostTable = base.replace('table:mpe_tiers', 'table:ghost_t');
    assert.deepEqual(
      check({ constructs: constructs(ghostTable) } as never)
        .filter(i => rules.includes(i.rule))
        .map(i => i.rule),
      ['C54'],
    );
    const ghostProfile = base.replace(
      'profile:mpe_tiers.wide',
      'profile:mpe_tiers.narrow',
    );
    assert.deepEqual(
      check({ constructs: constructs(ghostProfile) } as never)
        .filter(i => rules.includes(i.rule))
        .map(i => i.rule),
      ['C54'],
    );
    const ghostBare = base.replace(
      'uses { load observable:ind',
      'uses { load ghost_input observable:ind',
    );
    assert.deepEqual(
      check({ constructs: constructs(ghostBare) } as never)
        .filter(i => rules.includes(i.rule))
        .map(i => i.rule),
      ['C53'],
    );
    const ghostCalcProfile = base.replace(
      'profile mpe_tiers.wide',
      'profile mpe_tiers.narrow',
    );
    assert.deepEqual(
      check({ constructs: constructs(ghostCalcProfile) } as never)
        .filter(i => rules.includes(i.rule))
        .map(i => i.rule),
      ['C54'],
    );
  });

  it('C51/C52: the audit links', () => {
    const rules = ['C51', 'C52'];
    const base = `conformance_test /conf/t {
 targets { /req/a }
 result_forms { form_evidence }
}
form form_evidence {
 conformance_process /conf/t
 pass_fail true
}
requirement /req/a {
 name "A"
 statement "A holds."
}
`;
    assert.deepEqual(t({ constructs: constructs(base) }, rules) as never, []);
    // No form declares the test AND it names no result forms → the run
    // happens and nothing records it.
    const noEvidence = `conformance_test /conf/t {
 targets { /req/a }
}
requirement /req/a {
 name "A"
 statement "A holds."
}
`;
    assert.deepEqual(
      check({ constructs: constructs(noEvidence) } as never)
        .filter(i => rules.includes(i.rule))
        .map(i => `${i.rule}:${i.severity}`),
      ['C51:warning'],
    );
    // A child inherits the parent's evidence links: the parent keeps
    // result_forms, the child carries none.
    const inherits = base.replace(
      'requirement /req/a {',
      'conformance_test /conf/child {\n inherits_from /conf/t\n}\nrequirement /req/a {',
    );
    assert.deepEqual(
      check({ constructs: constructs(inherits) } as never)
        .filter(i => rules.includes(i.rule))
        .map(i => i.rule),
      [],
    );
    const noJudgment = base.replace('pass_fail true', 'title "Evidence"');
    assert.deepEqual(
      check({ constructs: constructs(noJudgment) } as never)
        .filter(i => rules.includes(i.rule))
        .map(i => `${i.rule}:${i.severity}`),
      ['C52:warning'],
    );
  });

  it('C57: a KNOWN entry marks its issue; an active entry matching nothing goes stale', () => {
    const req =
      'requirement /req/ghost_target {\n name "G"\n statement "G holds."\n}\n';
    // The C5 warning is KNOWN'd by a matching entry — no C57, and the
    // budget sees it as known.
    const withKnown = {
      allowlist: {
        entries: [
          {
            rule: 'C5',
            match: 'requirement /req/ghost_target:*',
            reason: 'tracked',
            auditRef: 'x',
          },
        ],
        budgets: [],
        directives: [],
      },
    };
    assert.deepEqual(t(withKnown, ['C57'], req), []);
    // An entry for an ACTIVE rule matching nothing → C57 stale error.
    const stale = {
      allowlist: {
        entries: [
          {
            rule: 'C5',
            match: 'requirement /req/nonexistent:*',
            reason: 'old debt',
            auditRef: 'x',
          },
        ],
        budgets: [],
        directives: [],
      },
    };
    assert.deepEqual(t(stale, ['C57'], req), ['C57:error']);
    // A dormant rule's entry never goes stale.
    const dormant = {
      allowlist: {
        entries: [
          {
            rule: 'C27',
            match: '*',
            reason: 'kernel-side',
            auditRef: 'x',
          },
        ],
        budgets: [],
        directives: [],
      },
      mirroredRules: new Set(['C5', 'C57']),
    };
    assert.deepEqual(t(dormant, ['C57'], req), []);
  });

  it('C55: the coverage budget caps the C51/C52 warnings', () => {
    const rules = ['C51', 'C52', 'C55'];
    const src = `conformance_test /conf/t {
 targets { /req/a }
}
requirement /req/a {
 name "A"
 statement "A holds."
}
`;
    const over = {
      allowlist: {
        entries: [],
        budgets: [{ key: 'coverage_budget', raw: '0' }],
        directives: [],
      },
    };
    const found = t(over, rules, src);
    assert.deepEqual(
      found.filter(x => x.startsWith('C51')),
      ['C51:warning'],
    );
    assert.deepEqual(
      found.filter(x => x.startsWith('C55')),
      ['C55:error'],
    );
    const slack = {
      allowlist: {
        entries: [],
        budgets: [{ key: 'coverage_budget', raw: '5' }],
        directives: [],
      },
    };
    assert.deepEqual(
      t(slack, rules, src).filter(x => x.startsWith('C55')),
      ['C55:warning'],
    );
  });
});
describe('Batch B — the resolution family (C3/C6-C9/C18/C20/C42-C44/C48-C50/C97/C98/C103/C156/C168)', () => {
  const t = (src: string, rules: string[]) =>
    check({ constructs: constructs(src) })
      .filter(i => rules.includes(i.rule))
      .map(i => `${i.rule}:${i.severity}`);

  it('C3: test_subject and applicability dimensions resolve', () => {
    const rules = ['C3'];
    const base = `dimension colors {
 values { red blue }
}
conformance_test /conf/t {
 test_subject { colors: red component: front }
}
requirement /req/x {
 applicability { colors: [red, blue] }
}
`;
    assert.deepEqual(t(base, rules), []);
    const ghostDim = base
      .replace('ghost_x', 'ghost_x')
      .replace('colors: red', 'ghost_dim: 1');
    assert.deepEqual(
      t(ghostDim, rules).filter(x => x.startsWith('C3')).length,
      1,
    );
    const ghostValue = base.replace('colors: red', 'colors: pink');
    assert.equal(
      t(ghostValue, rules).filter(x => x.startsWith('C3')).length,
      1,
    );
    const ghostApplicability = base.replace('[red, blue]', '[red, pink]');
    assert.equal(
      t(ghostApplicability, rules).filter(x => x.startsWith('C3')).length,
      1,
    );
    const valuesOf = `dimension colors { values { red } }\ndimension ref_dim { values_of colors }\nconformance_test /conf/t { test_subject { ref_dim: red } }\n`;
    assert.deepEqual(t(valuesOf, rules), []);
  });

  it('C6-C9: the subject anatomy', () => {
    const rules = ['C6', 'C7', 'C8', 'C9'];
    const base = `behavior creep { kind temporal }
subject LC {
 extends LC
 is {
  design_parameters { rated_output 2mV/V }
 }
 has {
  characteristics { error_hold e = ocl{self.rated_output} }
 }
 does { behavior creep }
}
`;
    assert.deepEqual(t(base, rules), []);
    const ghostAspect = base.replace(
      ' design_parameters { rated_output 2mV/V }',
      ' ghost_plane { x }',
    );
    assert.deepEqual(
      t(ghostAspect, rules).filter(x => x.startsWith('C6')).length,
      1,
    );
    const wrongFamily = base.replace(
      'characteristics { error_hold',
      'endpoint ep_x\n  characteristics { error_hold',
    );
    assert.equal(
      t(wrongFamily, rules).filter(x => x.startsWith('C6')).length,
      1,
    );
    const noDeriv = base.replace(
      'error_hold e = ocl{self.rated_output}',
      'error_hold without_one',
    );
    assert.deepEqual(
      t(noDeriv, rules).filter(x => x.startsWith('C7')),
      ['C7:error'],
    );
    const ghostDo = base.replace(
      'does { behavior creep }',
      'does { behavior ghost_do }',
    );
    assert.deepEqual(
      t(ghostDo, rules).filter(x => x.startsWith('C8')),
      ['C8:error'],
    );
    const ghostExtends = base.replace('extends LC', 'extends GhostParent');
    assert.deepEqual(
      t(ghostExtends, rules).filter(x => x.startsWith('C9')),
      ['C9:warning'],
    );
  });

  it('C18/C20: the instance pins', () => {
    const rules = ['C18', 'C20'];
    const base = `subject S { }\ninstance I1 {\n of S\n definition_versions { S : 2026 }\n}\n`;
    assert.deepEqual(t(base, rules), []);
    const noPin = base.replace(' definition_versions { S : 2026 }\n', '');
    assert.deepEqual(t(noPin, rules), ['C18:error']);
    const ghostOf = base.replace('of S', 'of GhostSubject');
    assert.deepEqual(t(ghostOf, rules), ['C20:error']);
  });

  it('C42-C44: the promises', () => {
    const rules = ['C42', 'C43', 'C44'];
    const base = `behavior creep { kind temporal }
requirement /req/x {
 name "X"
 limit mpe {
  uses { error_hold }
 }
}
subject LC {
 is {
  promises {
   char_p {
    target error_hold
    statement "holds"
   }
   behavior_p {
    target creep
    statement "runs"
   }
   ghost_p {
    target no_such_thing
    statement "claims"
   }
  }
 }
 has {
  characteristics { error_hold e = ocl{self.x} }
 }
}
`;
    // ghost_p targets nothing (C42); behavior_p carries no verification
    // linkage and no requirement/test binds it (C43).
    assert.deepEqual(t(base, rules), ['C43:warning', 'C42:error']);
    const bare = `subject LC {
 is {
  design_parameters { rated_output 2mV/V }
  promises {
   restates {
    target rated_output
    level { value 2 unit t }
   }
  }
 }
}
`;
    assert.deepEqual(t(bare, rules), ['C44:error']);
    const conditioned = bare.replace(
      'level { value 2 unit t }',
      'level { value 2 unit t }\n    conditions "self.rated_output > 0"',
    );
    assert.deepEqual(t(conditioned, rules), []);
    const unverifiable = `subject LC {
 is {
  promises {
   orphan_p {
    statement "nothing binds this"
   }
  }
 }
}
`;
    assert.deepEqual(t(unverifiable, rules), ['C43:warning']);
  });

  it('C48-C50: the characteristics', () => {
    const rules = ['C48', 'C49', 'C50'];
    const base = `behavior creep { kind temporal }
symbol m3 { unit kg }
subject LC {
 is {
  design_parameters { rated 1 }
 }
 has {
  characteristics { error_hold e = ocl{self.rated + m3} behavior creep }
 }
}
verdict plain { unit kg }
`;
    assert.deepEqual(t(base, rules), []);
    const ghostBehavior = base.replace(
      'behavior creep }',
      'behavior ghost_b }',
    );
    assert.deepEqual(
      t(ghostBehavior, rules).filter(x => x.startsWith('C49')),
      ['C49:error'],
    );
    const ghostSelf = base.replace('self.rated', 'self.ghost_param');
    assert.deepEqual(
      t(ghostSelf, rules).filter(x => x.startsWith('C50')).length,
      1,
    );
    const ghostBare = base.replace('+ m3', '+ ghost_io');
    assert.deepEqual(
      t(ghostBare, rules).filter(x => x.startsWith('C50')).length,
      1,
    );
    const shadow = base + `verdict shadowed {\n unit kg\n derive "ocl{1}"\n}\n`;
    assert.deepEqual(
      t(shadow, rules).filter(x => x.startsWith('C48')).length,
      1,
    );
  });

  it('C97/C98/C103/C156/C168: the registries and refs', () => {
    const rules = ['C97', 'C98', 'C103', 'C156', 'C168'];
    assert.deepEqual(
      t('class A#data { }\nclass B#data {\n extends A#data\n}\n', rules).filter(
        x => x.startsWith('C156'),
      ),
      [],
    );
    assert.deepEqual(
      t('class B#data {\n extends GhostClass\n}\n', rules).filter(x =>
        x.startsWith('C156'),
      ),
      ['C156:warning'],
    );
    assert.deepEqual(
      t(
        'process p1 { }\nconformance_test /conf/t {\n method_ref p1\n}\n',
        rules,
      ).filter(x => x.startsWith('C168')),
      [],
    );
    assert.deepEqual(
      t(
        'conformance_test /conf/t {\n method_ref ghost_proc\n}\n',
        rules,
      ).filter(x => x.startsWith('C168')),
      ['C168:error'],
    );
    assert.deepEqual(
      t(
        'predicates {\n derives-from { }\n}\nrequirement /req/x {\n refs {\n  ref { predicate derives-from }\n }\n}\n',
        rules,
      ).filter(x => x.startsWith('C103')),
      [],
    );
    assert.deepEqual(
      t(
        'predicates {\n derives-from { }\n}\nrequirement /req/x {\n refs {\n  ref { predicate ghost_pred }\n }\n}\n',
        rules,
      ).filter(x => x.startsWith('C103')),
      ['C103:error'],
    );
    const program = `package {\n id prog\n kind certification_program\n scheme_type type_5\n maps_to { rec-x }\n}\n`;
    assert.deepEqual(
      check({ constructs: constructs(program), siblings: [] } as never)
        .filter(i => rules.includes(i.rule))
        .map(i => i.rule),
      ['C97'],
    );
  });
});
describe('Batch D wave 1 — passports, attestations, dataspace, mappings', () => {
  const t = (src: string, rules: string[]) =>
    check({ constructs: constructs(src) })
      .filter(i => rules.includes(i.rule))
      .map(i => `${i.rule}:${i.severity}`);

  it('C86-C88: the passport projection', () => {
    const rules = ['C86', 'C87', 'C88'];
    const base = `subject LC {
 is {
  structure { frame }
  design_parameters { rated_output 2mV/V }
  artifacts { calibration_certificate }
  promises {
   eer_within { target x statement "holds" }
  }
 }
 has {
  characteristics { error_hold e = ocl{self.rated_output} }
  serve sample.test_context.indication via api { fresh_within 5s }
 }
}
passport p1 {
 upi { pattern "urn:epc:idsgln" level model }
 entry identity.LC public
 entry composition.rated_output public
 entry composition.error_hold restricted
 entry promises_as_verified.eer_within public
 entry artifacts.calibration_certificate public
 entry sustainability.materials public
}
`;
    assert.deepEqual(t(base, rules), []);
    const ghostClass = base.replace(
      'entry identity.LC public',
      'entry ghost_class.LC public',
    );
    assert.deepEqual(
      t(ghostClass, rules).filter(x => x.startsWith('C86')).length,
      1,
    );
    const ghostRef = base.replace(
      'composition.rated_output public',
      'composition.ghost_param public',
    );
    assert.deepEqual(
      t(ghostRef, rules).filter(x => x.startsWith('C86')).length,
      1,
    );
    const leak = base.replace(
      'composition.error_hold restricted',
      'composition.error_hold restricted\n entry composition.error_hold public',
    );
    assert.deepEqual(t(leak, rules).filter(x => x.startsWith('C87')).length, 1);
    const noPattern = base.replace(
      ' upi { pattern "urn:epc:idsgln" level model }',
      '',
    );
    assert.deepEqual(
      t(noPattern, rules).filter(x => x.startsWith('C88')).length,
      2,
    );
    const badLevel = base.replace('level model', 'level galaxy');
    assert.deepEqual(
      t(badLevel, rules).filter(x => x.startsWith('C88')).length,
      1,
    );
  });

  it('C150/C151: the attestations', () => {
    const rules = ['C150', 'C151'];
    const base = `promise_set LoadCell {
 promises {
  eer_within { target x statement "holds" }
  mandatory_p { target y statement "must" obligation mandatory }
 }
}
instance I1 {
 of LoadCell
}
verdict /conf/v { unit kg }
attestation att1 {
 subject I1
 promises LoadCell
 basis { kind self_declaration id doc-1 }
 claims {
  claim eer_within { declared "doc-1" validated_by /conf/v }
  claim mandatory_p { declared "doc-2" validated_by /conf/v }
 }
}
`;
    assert.deepEqual(t(base, rules), []);
    const ghostSubject = base.replace('subject I1', 'subject GhostSubject');
    assert.equal(
      t(ghostSubject, rules).filter(x => x.startsWith('C150')).length,
      1,
    );
    const ghostClaim = base.replace(
      'claim mandatory_p { declared "doc-2" validated_by /conf/v }',
      'claim ghost_promise { declared "doc-2" validated_by /conf/v }',
    );
    assert.deepEqual(
      t(ghostClaim, rules).filter(x => x.startsWith('C150')).length,
      1,
    );
    const noDeclared = base.replace(
      'declared "doc-1" validated_by /conf/v',
      'validated_by /conf/v',
    );
    assert.deepEqual(
      t(noDeclared, rules).filter(x => x.startsWith('C151')).length,
      1,
    );
    const uncarried = base.replace(
      '  claim mandatory_p { declared "doc-2" validated_by /conf/v }',
      '',
    );
    assert.deepEqual(
      t(uncarried, rules).filter(x => x.startsWith('C151')).length,
      1,
    );
  });

  it('C106/C162/C164: the spec planes', () => {
    const rules = ['C106', 'C162', 'C164'];
    assert.deepEqual(
      t('dataspace ds1 {\n ref derives-from "urn:x#clause-1"\n}\n', rules),
      [],
    );
    assert.deepEqual(
      t('dataspace ds1 { }\n', rules).filter(x => x.startsWith('C106')),
      ['C106:warning'],
    );
    assert.deepEqual(
      t('namespace lml { }\nmetadata { namespace lml }\n', rules).filter(x =>
        x.startsWith('C162'),
      ),
      [],
    );
    assert.deepEqual(
      t('namespace lml { }\nmetadata { namespace ghost }\n', rules).filter(x =>
        x.startsWith('C162'),
      ),
      ['C162:error'],
    );
    assert.deepEqual(
      t('class Ceramic#data { }\nmapping xml Ceramic { }\n', rules).filter(x =>
        x.startsWith('C164'),
      ),
      [],
    );
    assert.deepEqual(
      t('class Known#data { }\nmapping xml GhostClass { }\n', rules).filter(x =>
        x.startsWith('C164'),
      ),
      ['C164:error'],
    );
  });
});
describe('Batch D wave 2 — the typed boundaries (C74/C75/C76)', () => {
  const t = (src: string, rules: string[]) =>
    check({ constructs: constructs(src) })
      .filter(i => rules.includes(i.rule))
      .map(i => `${i.rule}:${i.severity}`);

  const BASE = `quantity_register q {
 kind mass { si_unit kg }
 unit kg { symbol "kg" kind mass factor 1 }
 kind length { si_unit m }
 unit m { symbol "m" kind length factor 1 }
 kind time { si_unit s }
}
process callee {
 signature {
  in { applied_load : mass duration : time }
  out { indication_series : mass }
 }
}
process caller {
 signature {
  in { test_load : mass soak : time }
  out { raw : mass }
 }
 registers { raw : mass }
 does {
  start_event s
  action run {
   executor machine
   read { test_load soak }
   calls callee {
    with {
     in { applied_load : test_load duration : soak }
     out { indication_series : raw }
    }
   }
   write { raw }
  }
  end_event e
  flow { s -> run -> e }
 }
}
`;

  it('the clean model stays silent', () => {
    assert.deepEqual(t(BASE, ['C74', 'C75', 'C76']), []);
  });

  it('C74: one name, one type', () => {
    const conflict = BASE.replace(
      'registers { raw : mass }',
      'registers { raw : mass test_load : time }',
    );
    assert.deepEqual(t(conflict, ['C74']).length, 1);
    const untyped = BASE.replace(
      'in { test_load : mass soak : time }',
      'in { test_load soak }',
    );
    assert.deepEqual(t(untyped, ['C74']), []);
  });

  it('C75: the dataflow must-analysis and the dead-write warning', () => {
    const uncovered = BASE.replace(
      'in { applied_load : test_load duration : soak }',
      'in { applied_load : test_load duration : raw }',
    );
    assert.equal(
      t(uncovered, ['C75']).filter(x => x === 'C75:error').length,
      1,
    );
    const dead = BASE.replace(
      'registers { raw : mass }',
      'registers { raw : mass log : time }',
    ).replace('   write { raw }', '   write { raw log }');
    assert.deepEqual(t(dead, ['C75']), ['C75:warning']);
    const captured = dead.replace(
      'action run {',
      'action run {\n   capture true',
    );
    assert.deepEqual(t(captured, ['C75']), []);
  });

  it('C76: the calls bindings bind completely and kind-compatibly', () => {
    const unbound = BASE.replace(
      'in { applied_load : test_load duration : soak }',
      'in { applied_load : test_load }',
    );
    assert.equal(t(unbound, ['C76']).length, 1);
    const ghostParam = BASE.replace(
      'in { applied_load : test_load duration : soak }',
      'in { ghost : test_load duration : soak }',
    );
    // applied_load unbound AND the ghost binding — two findings.
    assert.equal(t(ghostParam, ['C76']).length, 2);
    const kindMismatch = BASE.replace(
      'in { applied_load : test_load duration : soak }',
      'in { applied_load : test_load duration : raw }',
    );
    assert.equal(t(kindMismatch, ['C76']).length, 1);
    const ghostCallee = BASE.replace('calls callee {', 'calls ghost_proc {');
    assert.equal(t(ghostCallee, ['C76']).length, 1);
  });
});

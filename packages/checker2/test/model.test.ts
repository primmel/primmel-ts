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

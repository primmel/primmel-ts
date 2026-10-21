// ─────────────────────────────────────────────────────────────────────
// The expression language (register 18): the lexer/parser/AST unit
// tests, the args-bound limit form (parse + canonical dump fixpoint),
// and the C171/C172 AST legs (the scope the args bind; the class law's
// containment scope).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  canonicalizeExpression,
  freeIdentifiers,
  parseExpression,
  renderExpression,
} from '../src/expressions';
import { loadPackage } from '../src/ser-des/package';
import { dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

describe('the expression parser', () => {
  it('ranks implies below or below and', () => {
    const ast = parseExpression('a implies b or c and d');
    assert.equal(ast.type, 'binop');
    if (ast.type === 'binop') {
      assert.equal(ast.op, 'implies');
      assert.deepEqual(ast.left, { type: 'name', path: ['a'] });
      assert.equal(ast.right.type, 'binop');
      if (ast.right.type === 'binop') {
        assert.equal(ast.right.op, 'or');
        assert.equal(ast.right.left.type, 'name');
      }
    }
  });

  it('ranks comparison above additive above multiplicative', () => {
    const ast = parseExpression('a + b * 2 <= c - 1');
    assert.equal(ast.type, 'binop');
    if (ast.type === 'binop') {
      assert.equal(ast.op, '<=');
      const left = renderExpression(ast.left);
      assert.equal(left, 'a + b * 2');
    }
  });

  it('parses calls, unary minus, not, and parentheses', () => {
    const src = 'abs(-e) <= max(m, (d * n) / 2) and not flag';
    const ast = parseExpression(src);
    const ids = freeIdentifiers(ast);
    assert.deepEqual(ids.calls.sort(), ['abs', 'max']);
    assert.deepEqual(ids.names.sort(), ['d', 'e', 'flag', 'm', 'n']);
  });

  it('joins dotted paths whole', () => {
    const ast = parseExpression('self.scale_interval >= 1');
    const ids = freeIdentifiers(ast);
    assert.deepEqual(ids.names, ['self.scale_interval']);
  });

  it('renders canonically and reparses to the same AST', () => {
    for (const src of [
      'a implies b or c and d',
      'abs(-e) <= max(m, (d * n) / 2)',
      'not (a or b) xor c',
      'f(x, y + 1, g(z)) >= 0.5',
    ]) {
      const once = parseExpression(src);
      const twice = parseExpression(renderExpression(once));
      assert.deepEqual(twice, once);
    }
  });

  it('errors on trailing tokens, unbalanced parens, bad characters', () => {
    assert.throws(() => parseExpression('a b'), /trailing tokens/);
    assert.throws(
      () => parseExpression('(a + b'),
      /unexpected end|closing parenthesis/,
    );
    assert.throws(() => parseExpression('a # b'), /unexpected character/);
  });
});

describe('the args-bound limit form', () => {
  const make = (body: string): string => {
    const dir = mkdtempSync(join(tmpdir(), 'primmel-expr-'));
    writeFileSync(
      join(dir, 'package.primmel'),
      'package {\n id pkg\n language v3.3\n}',
    );
    mkdirSync(join(dir, 'specification'), { recursive: true });
    writeFileSync(join(dir, 'specification', 'r.prl'), body);
    return dir;
  };

  const LIMIT = `requirement /req/mpe {
 name "MPE"
 statement "S"
 limit {
  args {
   e <- symbol:e_vehicle
   mpe_class <- table:vehicle_mpe.mpe_initial
   d <- attribute:scale_interval
  }
  expression {
   abs(e) <= max(mpe_class, 1 * d)
  }
 }
}
symbol e_vehicle { label "e" }
table vehicle_mpe {
 columns { vehicle_mass_class: string mpe_initial: number }
 data { "0.2" 0.10 }
}
attribute_definition scale_interval { name "d" }
`;

  it('parses the args and the canonical body; dumps to a fixpoint', () => {
    const dir = make(LIMIT);
    const m = loadPackage(dir);
    const r = m.requirements[0];
    assert.equal(r.limit?.argsBound, true);
    assert.deepEqual(r.limit?.args, [
      { name: 'e', source: 'symbol:e_vehicle' },
      { name: 'mpe_class', source: 'table:vehicle_mpe.mpe_initial' },
      { name: 'd', source: 'attribute:scale_interval' },
    ]);
    assert.equal(r.limit?.expression, 'abs(e) <= max(mpe_class, 1 * d)');
    const dir2 = make(dump(m));
    const m2 = loadPackage(dir2);
    assert.deepEqual(m2.requirements[0].limit, r.limit);
    rmSync(dir, { recursive: true, force: true });
    rmSync(dir2, { recursive: true, force: true });
  });

  it('errors at load on a malformed body', () => {
    const dir = make(
      'requirement /req/x {\n name "X"\n statement "S"\n limit {\n  args { e <- symbol:e }\n  expression {\n   abs(e) <=\n  }\n }\n}\n',
    );
    assert.throws(() => loadPackage(dir), /expression: unexpected end/);
    rmSync(dir, { recursive: true, force: true });
  });

  it('errors at load on a binding without <-', () => {
    const dir = make(
      'requirement /req/x {\n name "X"\n statement "S"\n limit {\n  args { e symbol:e }\n  expression {\n   e >= 0\n  }\n }\n}\n',
    );
    assert.throws(() => loadPackage(dir), /expected "<-" after "e"/);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('C171/C172 on the AST', () => {
  const make = (body: string): string => {
    const dir = mkdtempSync(join(tmpdir(), 'primmel-exprchk-'));
    writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
    mkdirSync(join(dir, 'specification'), { recursive: true });
    writeFileSync(join(dir, 'specification', 'r.prl'), body);
    return dir;
  };
  const ids = (dir: string, rule: string): string[] =>
    checkPackage(dir)
      .filter(i => i.check === rule)
      .map(i => i.message);

  it('names the air an unbound identifier is', () => {
    const dir = make(
      'requirement /req/x {\n name "X"\n statement "S"\n limit {\n  args { e <- symbol:e }\n  expression {\n   e <= ghost_limit\n  }\n }\n}\nsymbol e { label "e" }\n',
    );
    const msgs = ids(dir, 'C171');
    assert.ok(
      msgs.some(
        m => m.includes('"ghost_limit"') && m.includes('args { ghost_limit'),
      ),
    );
    rmSync(dir, { recursive: true, force: true });
  });

  it('requires args when a bare identifier would be ambient', () => {
    // a body over pure literals and dispatch-context paths binds
    // nothing and is legal; a bare identifier is ambient air
    const pure = make(
      'requirement /req/x {\n name "X"\n statement "S"\n limit {\n  expression {\n   1 <= 2\n  }\n }\n}\n',
    );
    assert.equal(ids(pure, 'C171').length, 0);
    rmSync(pure, { recursive: true, force: true });
    const air = make(
      'requirement /req/x {\n name "X"\n statement "S"\n limit {\n  expression {\n   ghost_limit <= 2\n  }\n }\n}\n',
    );
    const msgs = ids(air, 'C171');
    assert.ok(msgs.some(m => m.includes('declares no arguments')));
    assert.ok(msgs.some(m => m.includes('"ghost_limit"')));
    rmSync(air, { recursive: true, force: true });
  });

  it('holds the calls to the function vocabulary', () => {
    const dir = make(
      'requirement /req/x {\n name "X"\n statement "S"\n limit {\n  args { e <- symbol:e }\n  expression {\n   median(e, e) >= 0\n  }\n }\n}\nsymbol e { label "e" }\n',
    );
    const msgs = ids(dir, 'C171');
    assert.ok(msgs.some(m => m.includes('"median(…)"')));
    rmSync(dir, { recursive: true, force: true });
  });

  it('rejects an arg bound to an undeclared table', () => {
    const dir = make(
      'requirement /req/x {\n name "X"\n statement "S"\n limit {\n  args { e <- table:no_such_table.mpe }\n  expression {\n   e >= 0\n  }\n }\n}\n',
    );
    const msgs = ids(dir, 'C171');
    assert.ok(
      msgs.some(
        m => m.includes('no_such_table') && m.includes('no declared table'),
      ),
    );
    rmSync(dir, { recursive: true, force: true });
  });

  it('scopes the class law to the containment', () => {
    const ok = make(
      'requirement_class /req/c {\n name "C"\n limit {\n  expression {\n   mpe_mass or d_floor\n  }\n }\n requirement mpe_mass {\n  name "M"\n  statement "S"\n }\n requirement d_floor {\n  name "D"\n  statement "S"\n }\n}\n',
    );
    assert.deepEqual(ids(ok, 'C172'), []);
    rmSync(ok, { recursive: true, force: true });

    const air = make(
      'requirement_class /req/c {\n name "C"\n limit {\n  expression {\n   mpe_mass or d_floor or ghost_regime\n  }\n }\n requirement mpe_mass {\n  name "M"\n  statement "S"\n }\n requirement d_floor {\n  name "D"\n  statement "S"\n }\n}\n',
    );
    const msgs = ids(air, 'C172');
    assert.ok(
      msgs.some(
        m =>
          m.includes('"ghost_regime"') &&
          m.includes('composes the containment'),
      ),
    );
    rmSync(air, { recursive: true, force: true });
  });
});

describe('the inline carriers: derive, derivation, check', () => {
  const make = (body: string): string => {
    const dir = mkdtempSync(join(tmpdir(), 'primmel-carrier-'));
    writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
    mkdirSync(join(dir, 'specification'), { recursive: true });
    writeFileSync(join(dir, 'specification', 'r.prl'), body);
    return dir;
  };

  it('parses the verdict derive block and fixes the dump', () => {
    const body = `verdict delta {
 quantity { kind mass unit "kg" }
 derive {
  abs(served - reference)
 }
 inputs { served reference }
}
`;
    const dir = make(body);
    const m = loadPackage(dir);
    const v = m.verdicts[0] as unknown as Record<string, unknown>;
    assert.equal(v.deriveBound, true);
    assert.equal(v.derive, 'abs(served - reference)');
    const dir2 = make(dump(m));
    const m2 = loadPackage(dir2);
    const v2 = m2.verdicts[0] as unknown as Record<string, unknown>;
    assert.deepEqual(v2.derive, v.derive);
    assert.equal(v2.deriveBound, true);
    rmSync(dir, { recursive: true, force: true });
    rmSync(dir2, { recursive: true, force: true });
  });

  it('names the input, never "ocl", on a legacy derive with air', () => {
    const dir = make(
      'verdict delta {\n derive "ocl{abs(served - ghost)}"\n inputs { served }\n}\n',
    );
    const msgs = checkPackage(dir)
      .filter(i => i.check === 'C171')
      .map(i => i.message);
    assert.ok(msgs.some(m => m.includes('"ghost"')));
    assert.ok(!msgs.some(m => m.includes('"ocl"')));
    rmSync(dir, { recursive: true, force: true });
  });

  it('resolves a derivation calling a declared calculation', () => {
    const body = `conformance test /conf/t {
 method inspection
 variables {
  variable load { type number source declared description "L" }
  variable allow { type number source computed
   derivation {
    lookupMPE(load)
   }
   description "A"
  }
 }
}
calculation lookupMPE {
 name "lookupMPE"
 inputs {
  load : number { description "the load" }
 }
 output : number { name "mpe" }
 expression "ocl{1.0 * load}"
}
`;
    const dir = make(body);
    const msgs = checkPackage(dir)
      .filter(i => i.check === 'C171')
      .map(i => i.message);
    assert.deepEqual(msgs, []);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('C177 kind coherence', () => {
  const make = (body: string): string => {
    const dir = mkdtempSync(join(tmpdir(), 'primmel-kind-'));
    writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
    mkdirSync(join(dir, 'specification'), { recursive: true });
    writeFileSync(join(dir, 'specification', 'r.prl'), body);
    return dir;
  };
  const kinds = (dir: string): string[] =>
    checkPackage(dir)
      .filter(i => i.check === 'C177')
      .map(i => i.message);

  it('errors when a comparison mixes declared kinds', () => {
    const dir = make(
      'requirement /req/x {\n name "X"\n statement "S"\n limit {\n  args {\n   m <- symbol:the_mass\n   l <- symbol:the_length\n  }\n  expression {\n   m <= l\n  }\n }\n}\nsymbol the_mass { label "m" quantity_kind mass }\nsymbol the_length { label "l" quantity_kind length }\n',
    );
    const msgs = kinds(dir);
    assert.ok(msgs.some(m => m.includes('"mass"') && m.includes('"length"')));
    rmSync(dir, { recursive: true, force: true });
  });

  it('never conflicts on kindless or unknown operands', () => {
    const dir = make(
      'requirement /req/x {\n name "X"\n statement "S"\n limit {\n  args {\n   m <- symbol:the_mass\n   n <- observable:n\n  }\n  expression {\n   m <= n and m <= 5\n  }\n }\n}\nsymbol the_mass { label "m" quantity_kind mass }\n',
    );
    assert.deepEqual(kinds(dir), []);
    rmSync(dir, { recursive: true, force: true });
  });

  it('keeps the kind through arithmetic and picks it up from attributes', () => {
    const dir = make(
      'requirement /req/x {\n name "X"\n statement "S"\n limit {\n  args {\n   m <- symbol:the_mass\n   cap <- attribute:the_capacity\n  }\n  expression {\n   m <= 0.5 * cap\n  }\n }\n}\nsymbol the_mass { label "m" quantity_kind mass }\nattribute_definition the_capacity { name "cap" quantity_kind mass }\n',
    );
    assert.deepEqual(kinds(dir), []);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('the series aggregations (W4)', () => {
  const make = (body: string): string => {
    const dir = mkdtempSync(join(tmpdir(), 'primmel-series-'));
    writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
    mkdirSync(join(dir, 'specification'), { recursive: true });
    writeFileSync(join(dir, 'specification', 'r.prl'), body);
    return dir;
  };

  it('resolves the aggregation vocabulary and the series index access', () => {
    const body = `requirement /req/x {
 name "X"
 statement "S"
 limit {
  args {
   readings <- observable:dwell_samples
  }
  expression {
   stddev_of(readings) / sqrt(count_of(readings)) <= 1
  }
 }
}
`;
    const dir = make(body);
    const msgs = checkPackage(dir)
      .filter(i => i.check === 'C171')
      .map(i => i.message);
    assert.deepEqual(msgs, []);
    rmSync(dir, { recursive: true, force: true });
  });

  it('keeps unknown aggregations as air', () => {
    const dir = make(
      'requirement /req/x {\n name "X"\n statement "S"\n limit {\n  args { r <- observable:readings }\n  expression {\n   median_of(r) >= 0\n  }\n }\n}\n',
    );
    const msgs = checkPackage(dir)
      .filter(i => i.check === 'C171')
      .map(i => i.message);
    assert.ok(msgs.some(m => m.includes('"median_of(…)"')));
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('C178 legacy-carrier-deprecated (W6)', () => {
  const make = (manifest: string, body: string): string => {
    const dir = mkdtempSync(join(tmpdir(), 'primmel-dep-'));
    writeFileSync(join(dir, 'package.primmel'), manifest);
    mkdirSync(join(dir, 'specification'), { recursive: true });
    writeFileSync(join(dir, 'specification', 'r.prl'), body);
    return dir;
  };
  const LEGACY =
    'requirement /req/r {\n name "R"\n statement "S"\n limit {\n  expression "ocl{1 <= 2}"\n }\n}\n';
  const ids = (dir: string): string[] =>
    checkPackage(dir)
      .filter(i => i.check === 'C178')
      .map(i => i.message);

  it('warns once the package declares the deprecation generation', () => {
    const dir = make('package {\n id test\n language v3.4\n}', LEGACY);
    const msgs = ids(dir);
    assert.equal(msgs.length, 1);
    assert.ok(msgs[0].includes('deprecated'));
    rmSync(dir, { recursive: true, force: true });
  });

  it('is inert on the current generation', () => {
    const dir = make('package {\n id test\n language v3.3\n}', LEGACY);
    assert.deepEqual(ids(dir), []);
    rmSync(dir, { recursive: true, force: true });
  });

  it('does not count the inline carriers', () => {
    const dir = make(
      'package {\n id test\n language v3.4\n}',
      'requirement /req/r {\n name "R"\n statement "S"\n limit {\n  expression {\n   1 <= 2\n  }\n }\n}\n',
    );
    assert.deepEqual(ids(dir), []);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('the collection navigation (register 24)', () => {
  it('parses, binds the lambda parameter, and renders canonically', () => {
    const src = "fees -> forAll(f | f.status = 'MARKED_PAID')";
    const ast = parseExpression(src);
    assert.equal(ast.type, 'nav');
    if (ast.type === 'nav') {
      assert.equal(ast.source, 'fees');
      assert.equal(ast.op, 'forAll');
      assert.equal(ast['var'], 'f');
    }
    const ids = freeIdentifiers(ast);
    assert.deepEqual(ids.names, ['fees']);
    assert.deepEqual(ids.calls, []);
    const canonical = renderExpression(ast);
    const twice = parseExpression(canonical);
    assert.deepEqual(twice, ast);
  });

  it('keeps the or-chain and the string literals', () => {
    const src =
      "samples -> forAll(s | s.status = 'RETURNED' or s.status = 'RETAINED')";
    const ast = parseExpression(src);
    const ids = freeIdentifiers(ast);
    assert.deepEqual(ids.names, ['samples']);
    const canonical = renderExpression(ast);
    assert.ok(
      canonical.includes("s.status = 'RETURNED' or s.status = 'RETAINED'"),
    );
    assert.deepEqual(parseExpression(canonical), ast);
  });

  it('reports an unbound collection as air through the checker', () => {
    const mk = (body: string): string => {
      const dir = mkdtempSync(join(tmpdir(), 'primmel-nav-'));
      writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
      mkdirSync(join(dir, 'model'), { recursive: true });
      writeFileSync(join(dir, 'model', 'r.prl'), body);
      return dir;
    };
    const ok = mk(
      'constraint done {\n stereotype inv\n name "D"\n args {\n  fees <- observable:fees\n }\n check {\n  fees -> forAll(f | f.status = \'MARKED_PAID\')\n }\n violation_meaning "An unpaid fee stands."\n}\n',
    );
    const msgs = checkPackage(ok)
      .filter(i => i.check === 'C171')
      .map(i => i.message);
    assert.deepEqual(msgs, []);
    rmSync(ok, { recursive: true, force: true });

    const air = mk(
      'constraint done {\n stereotype inv\n name "D"\n check {\n  fees -> forAll(f | f.status = \'MARKED_PAID\')\n }\n violation_meaning "An unpaid fee stands."\n}\n',
    );
    const airMsgs = checkPackage(air)
      .filter(i => i.check === 'C171')
      .map(i => i.message);
    assert.ok(airMsgs.some(m => m.includes('"fees"')));
    rmSync(air, { recursive: true, force: true });
  });
});

describe('the projection iterator (register 24)', () => {
  it('parses collect as a navigation and binds its lambda', () => {
    const src =
      'measurements -> collect(m | m.indicated_speed - m.reference_speed)';
    const ast = parseExpression(src);
    assert.equal(ast.type, 'nav');
    if (ast.type === 'nav') {
      assert.equal(ast.source, 'measurements');
      assert.equal(ast.op, 'collect');
      assert.equal(ast['var'], 'm');
    }
    const ids = freeIdentifiers(ast);
    assert.deepEqual(ids.names, ['measurements']);
    const canonical = renderExpression(ast);
    assert.deepEqual(parseExpression(canonical), ast);
  });
});

describe('the conditional expression (register 18)', () => {
  it('parses if-then-else-endif and renders canonically', () => {
    const src = 'if t_water <= 30 then 1 else 2 endif';
    const ast = parseExpression(src);
    assert.equal(ast.type, 'ifelse');
    if (ast.type === 'ifelse') {
      assert.equal(ast.cond.type, 'binop');
      assert.equal(ast.then.type, 'num');
      assert.equal(ast.else.type, 'num');
    }
    const ids = freeIdentifiers(ast);
    assert.deepEqual(ids.names, ['t_water']);
    const canonical = renderExpression(ast);
    assert.equal(canonical, 'if t_water <= 30 then 1 else 2 endif');
    assert.deepEqual(parseExpression(canonical), ast);
  });

  it('delimits without parentheses — a branch may be a full expression', () => {
    const src =
      'if family.classification.accuracy_class = 1 then (if t_water <= 30 then 1 else 2 endif) else 0 endif';
    const ast = parseExpression(src);
    assert.equal(ast.type, 'ifelse');
    const canonical = renderExpression(ast);
    assert.deepEqual(parseExpression(canonical), ast);
  });
});

describe('the boolean literals (register 18)', () => {
  it('parses true and false as leaves that bind nothing', () => {
    for (const [src, value] of [
      ['true', true],
      ['false', false],
    ] as const) {
      const ast = parseExpression(src);
      assert.equal(ast.type, 'bool');
      if (ast.type === 'bool') {
        assert.equal(ast.value, value);
      }
      const ids = freeIdentifiers(ast);
      assert.deepEqual(ids.names, []);
      assert.deepEqual(parseExpression(renderExpression(ast)), ast);
    }
  });

  it('accepts the conditional gate shape in a limit with args', () => {
    const src =
      'if model.attributes.mat >= 50 then overload_passed else true endif';
    const ast = parseExpression(src);
    const ids = freeIdentifiers(ast);
    // the reader is declaration-blind: the model path rides the
    // checker's CONTEXT_ROOTS filter, so it surfaces here
    assert.deepEqual(ids.names.sort(), [
      'model.attributes.mat',
      'overload_passed',
    ]);
    assert.deepEqual(parseExpression(renderExpression(ast)), ast);
  });
});

describe('the named-multiple limits with when-guards (register 18)', () => {
  const SRC = `requirement /req/metrological/mpe-ranges {
  name "MPE ranges"
  limit "mpe-low-range" {
    args { e <- observable:e mu <- table:vehicle_mpe.mpe_low }
    when {
      e <= 5000
    }
    expression {
      abs(e) <= mu
    }
  }
  limit "mpe-high-range" {
    args { e <- observable:e mu <- table:vehicle_mpe.mpe_high }
    when {
      e > 5000
    }
    expression {
      abs(e) <= mu
    }
  }
}
`;
  it('parses the named list with guards and dump-fixpoints', () => {
    const dir = mkdtempSync(join(tmpdir(), 'primmel-when-'));
    writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
    mkdirSync(join(dir, 'model'), { recursive: true });
    writeFileSync(join(dir, 'model', 'r.prl'), SRC);
    const m = loadPackage(dir);
    const r = m.requirements.find(
      x => x.id === '/req/metrological/mpe-ranges',
    )!;
    assert.equal(r.limit, null);
    assert.equal((r.limits ?? []).length, 2);
    assert.equal(r.limits![0]?.name, 'mpe-low-range');
    assert.equal(r.limits![0]?.when, 'e <= 5000');
    assert.equal(r.limits![1]?.when, 'e > 5000');
    const d1 = dump(m);
    writeFileSync(join(dir, 'model', 'r.prl'), d1);
    const m2 = loadPackage(dir);
    assert.equal(dump(m2), d1);
    rmSync(dir, { recursive: true, force: true });
  });

  it('the guard resolves against the limit args; an unbound name is air', () => {
    const dir = mkdtempSync(join(tmpdir(), 'primmel-when2-'));
    writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
    mkdirSync(join(dir, 'model'), { recursive: true });
    writeFileSync(
      join(dir, 'model', 'r.prl'),
      SRC.replace('e <= 5000', 'e <= ghost_limit'),
    );
    const msgs = checkPackage(dir)
      .filter(i => i.check === 'C171')
      .map(i => i.message);
    assert.ok(
      msgs.some(m => m.includes('when-guard') && m.includes('ghost_limit')),
    );
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('the canonicalizer keeps precedence-critical parens (the r144 measuring-range guard)', () => {
  const LEG = (c: string) =>
    `(not model.classification.measurand_components -> exists(c | c = '${c}') or (model.parameters.${c}_range_min >= 10 and model.parameters.${c}_range_max <= 20000))`;
  const GUARD = `${LEG('co')}\n  and ${LEG('no')}`;

  it('the block body canonicalizes to a conjunction of legs, never a flat disjunction', () => {
    const canon = canonicalizeExpression(GUARD);
    const ast = parseExpression(canon);
    assert.equal(ast.type, 'binop');
    assert.equal((ast as { op: string }).op, 'and');
    assert.match(canon, /^\(not .* or .* and .*\) and \(not /);
  });

  it('the canonical form is a fixpoint and an inner and under or keeps its parens', () => {
    const canon = canonicalizeExpression(GUARD);
    assert.equal(canonicalizeExpression(canon), canon);
    // `a or (b and c)` — the and rides the or's right, tighter than or:
    // bare is faithful. The inverse — or under and — must wrap.
    const flat = canonicalizeExpression('x >= 1 or y >= 2 and z <= 3');
    assert.equal(parseExpression(flat).type, 'binop');
    assert.equal((parseExpression(flat) as { op: string }).op, 'or');
    const mixed = canonicalizeExpression('(a >= 1 or b >= 2) and c <= 3');
    assert.match(mixed, /^\(.* or .*\) and /);
  });
});

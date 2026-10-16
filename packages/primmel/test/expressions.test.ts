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
    assert.throws(() => parseExpression('(a + b'), /unexpected end|closing parenthesis/);
    assert.throws(() => parseExpression('a # b'), /unexpected character/);
  });
});

describe('the args-bound limit form', () => {
  const make = (body: string): string => {
    const dir = mkdtempSync(join(tmpdir(), 'primmel-expr-'));
    writeFileSync(join(dir, 'package.primmel'), 'package {\n id pkg\n language v3.3\n}');
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
      msgs.some(m => m.includes('"ghost_limit"') && m.includes('args { ghost_limit')),
    );
    rmSync(dir, { recursive: true, force: true });
  });

  it('requires args on a requirement inline limit', () => {
    const dir = make(
      'requirement /req/x {\n name "X"\n statement "S"\n limit {\n  expression {\n   1 <= 2\n  }\n }\n}\n',
    );
    const msgs = ids(dir, 'C171');
    assert.ok(msgs.some(m => m.includes('declares no arguments')));
    rmSync(dir, { recursive: true, force: true });
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
      msgs.some(m => m.includes('no_such_table') && m.includes('no declared table')),
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
        m => m.includes('"ghost_regime"') && m.includes('composes the containment'),
      ),
    );
    rmSync(air, { recursive: true, force: true });
  });
});

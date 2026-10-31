// ─────────────────────────────────────────────────────────────────────
// C194 collection-element-resolves (CRITIQUE-3 #4): an arg bound to
// `collection<T>` gives the navigation's lambda parameter T's shape —
// the member accesses rooted at the parameter resolve against the
// class's attributes; an unknown member is air. A bare `collection`
// stays untyped; the parameterized form is opt-in.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkPackage } from '../src/check';

function pkg(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'prl-c194-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id probe }');
  mkdirSync(join(dir, 'specification'), { recursive: true });
  writeFileSync(join(dir, 'specification', 'c.prl'), body);
  return dir;
}

const ids = (dir: string, rule: string): string[] =>
  checkPackage(dir)
    .filter(i => i.check === rule)
    .map(i => i.message);

describe('C194 collection-element-resolves', () => {
  const cls =
    'class DailyRecord#helper {\n  indication: number { modality SHALL }\n  day: integer { modality SHALL }\n}\n';

  it('a declared element type checks its lambda members', () => {
    const dir = pkg(
      cls +
        'symbol readings { label "r" type collection<DailyRecord> }\n' +
        'requirement /req/x {\n name "X"\n statement { S }\n limit {\n  args { r <- symbol:readings ref <- symbol:readings }\n  expression {\n   r -> exists(m | m.indication >= 0)\n  }\n }\n}\n',
    );
    assert.deepEqual(ids(dir, 'C194'), []);
  });

  it('an unknown member is air — the class declares none', () => {
    const dir = pkg(
      cls +
        'symbol readings { label "r" type collection<DailyRecord> }\n' +
        'requirement /req/x {\n name "X"\n statement { S }\n limit {\n  args { r <- symbol:readings }\n  expression {\n   r -> exists(m | m.indictaion >= 0)\n  }\n }\n}\n',
    );
    const msgs = ids(dir, 'C194');
    assert.ok(
      msgs.some(
        m =>
          m.includes('"indictaion"') &&
          m.includes('collection-element-resolves'),
      ),
      `the typo is named: ${msgs.join('\n')}`,
    );
  });

  it('an element type naming no class is air', () => {
    const dir = pkg(
      'symbol readings { label "r" type collection<NoSuchRow> }\n' +
        'requirement /req/x {\n name "X"\n statement { S }\n limit {\n  args { r <- symbol:readings }\n  expression {\n   r -> exists(m | 1 >= 0)\n  }\n }\n}\n',
    );
    const msgs = ids(dir, 'C194');
    assert.ok(
      msgs.some(m => m.includes('"NoSuchRow"')),
      `the unknown class is named: ${msgs.join('\n')}`,
    );
  });

  it('a bare collection stays untyped — no leg fires', () => {
    const dir = pkg(
      'symbol readings { label "r" type collection }\n' +
        'requirement /req/x {\n name "X"\n statement { S }\n limit {\n  args { r <- symbol:readings }\n  expression {\n   r -> exists(m | 1 >= 0)\n  }\n }\n}\n',
    );
    assert.deepEqual(ids(dir, 'C194'), []);
  });
});

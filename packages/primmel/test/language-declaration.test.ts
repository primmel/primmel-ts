import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPackage } from '../src/ser-des/package';

const make = (manifest: string, body: string): string => {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-lang-'));
  writeFileSync(join(dir, 'package.primmel'), manifest);
  mkdirSync(join(dir, 'specification'), { recursive: true });
  writeFileSync(join(dir, 'specification', 'r.prl'), body);
  return dir;
};

const REQ = 'requirement /req/r {\n name "R"\n statement "S"\n}\n';

describe('the declared language generation', () => {
  it('parses strict: an unknown keyword errors when the language is declared', () => {
    const dir = make(
      'package {\n id pkg\n language v3.3\n}',
      REQ + '\ntotally_fake_construct X {\n}\n',
    );
    assert.throws(
      () => loadPackage(dir),
      /Unknown keyword "totally_fake_construct"/,
    );
  });

  it('stays lenient when the language is not declared', () => {
    const dir = make('package {\n id pkg\n}', REQ + '\ntotally_fake_construct X {\n}\n');
    const m = loadPackage(dir);
    assert.ok(m);
  });

  it('parses clean when everything is known', () => {
    const dir = make('package {\n id pkg\n language v3.3\n}', REQ);
    const m = loadPackage(dir);
    assert.ok(m);
  });
});

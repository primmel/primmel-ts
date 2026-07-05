import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { preprocessIncludes } from '../src/ser-des/includes';

describe('preprocessIncludes', () => {
  let tmp: string;

  before(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'primmel-includes-'));
    await mkdir(join(tmp, 'sub'), { recursive: true });
    await writeFile(
      join(tmp, 'root.mmel'),
      'root r1\ninclude "sub/child.mmel"\n'
    );
    await writeFile(
      join(tmp, 'sub', 'child.mmel'),
      'role child { name "Child" }\ninclude "grandchild.mmel"\n'
    );
    await writeFile(
      join(tmp, 'sub', 'grandchild.mmel'),
      'role grand { name "Grand" }\n'
    );
    await writeFile(join(tmp, 'cycle-a.mmel'), 'include "cycle-b.mmel"\n');
    await writeFile(join(tmp, 'cycle-b.mmel'), 'include "cycle-a.mmel"\n');
  });

  after(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('inlines a single include relative to the including file', async () => {
    const out = preprocessIncludes(join(tmp, 'sub', 'child.mmel'));
    assert.match(out, /role child/);
    assert.match(out, /role grand/);
  });

  it('includes transitively from the root', () => {
    const out = preprocessIncludes(join(tmp, 'root.mmel'));
    assert.match(out, /root r1/);
    assert.match(out, /role child/);
    assert.match(out, /role grand/);
  });

  it('auto-appends .mmel extension when missing', () => {
    const out = preprocessIncludes(join(tmp, 'root.mmel'));
    assert.match(out, /role grand/);
  });

  it('rejects cycles with a chain message', () => {
    assert.throws(
      () => preprocessIncludes(join(tmp, 'cycle-a.mmel')),
      /Include cycle detected/
    );
  });

  it('throws on missing file', () => {
    assert.throws(
      () => preprocessIncludes(join(tmp, 'nope.mmel')),
      /Include file not found/
    );
  });

  it('returns the file content verbatim when no includes are present', async () => {
    await writeFile(join(tmp, 'plain.mmel'), 'just text\nno includes\n');
    const out = preprocessIncludes(join(tmp, 'plain.mmel'));
    assert.equal(out, 'just text\nno includes\n');
  });
});

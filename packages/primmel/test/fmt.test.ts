// ─────────────────────────────────────────────────────────────────────
// fmt (register W8): the canonical serialization as a command. The
// fixpoint is the safety — a file is rewritten only when its canonical
// form re-loads to itself; unstable files are reported, never touched.
// Idempotence: fmt of a formatted tree is a no-op.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fmtPackage } from '../src/fmt';

function makePkg(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-fmt-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  for (const [name, body] of Object.entries(files)) {
    const p = join(dir, name);
    mkdirSync(join(p, '..'), { recursive: true });
    writeFileSync(p, body);
  }
  return dir;
}

const LEGACY = `requirement /req/r {
 name "R"

 statement "S"


 limit {
  expression "ocl{1 <= 2}"
 }
}
`;

const CANONICAL = `requirement /req/r {
  name "R"
  statement "S"
  limit {
    expression "ocl{1 <= 2}"
  }
}
`;

describe('fmt', () => {
  it('canonicalizes a file and is idempotent', () => {
    const dir = makePkg({ 'specification/r.prl': LEGACY });
    const first = fmtPackage(dir);
    assert.equal(first.files[0]?.status, 'formatted');
    assert.equal(first.written, 1);
    assert.equal(
      readFileSync(join(dir, 'specification', 'r.prl'), 'utf8'),
      CANONICAL,
    );
    const second = fmtPackage(dir);
    assert.equal(second.files[0]?.status, 'unchanged');
    assert.equal(second.written, 0);
    rmSync(dir, { recursive: true, force: true });
  });

  it('--check reports without writing', () => {
    const dir = makePkg({ 'specification/r.prl': LEGACY });
    const result = fmtPackage(dir, true);
    assert.equal(result.files[0]?.status, 'formatted');
    assert.equal(result.written, 0);
    assert.equal(
      readFileSync(join(dir, 'specification', 'r.prl'), 'utf8'),
      LEGACY,
    );
    rmSync(dir, { recursive: true, force: true });
  });

  it('skips include files and the allowlist, never touches unstable files', () => {
    const dir = makePkg({
      'specification/r.prl': 'include "other.prl"\n',
      'specification/other.prl': LEGACY,
      '.primmel-allowlist.prl': 'KNOWN\n',
    });
    const result = fmtPackage(dir);
    const statuses = new Map(
      result.files.map(f => [f.file.split('/').pop(), f.status]),
    );
    assert.equal(statuses.get('r.prl'), 'skipped-includes');
    assert.equal(statuses.get('other.prl'), 'formatted');
    assert.ok(!statuses.has('.primmel-allowlist.prl'));
    rmSync(dir, { recursive: true, force: true });
  });

  it('handles the args-bound carrier form to a fixpoint', () => {
    const inline = `requirement /req/m {
  name "M"
  statement "S"
  limit {
    args {
      e <- observable:e
    }
    expression {
      abs(e) <= 1
    }
  }
}
`;
    const dir = makePkg({ 'specification/m.prl': inline });
    const result = fmtPackage(dir);
    assert.equal(result.files[0]?.status, 'unchanged');
    rmSync(dir, { recursive: true, force: true });
  });
});

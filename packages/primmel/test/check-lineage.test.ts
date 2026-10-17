// C170 edition-lineage-declared: >1 edition ⇒ edition-mapping.json
// naming both states. C168's calls leg: a process step's `calls <p>`
// resolves like a method_ref (bare in-package; scoped via the locator).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { checkPackage } from '../src/check';

const make = (files: Record<string, string>): string => {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-lin-'));
  writeFileSync(
    join(dir, 'package.primmel'),
    'package { id pkg\n version "2020"\n editions { 2020 2010 } }',
  );
  for (const [rel, body] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
  return dir;
};

const issues = (files: Record<string, string>, rule: string): string[] => {
  const dir = make(files);
  try {
    return checkPackage(dir)
      .filter(i => i.check === rule)
      .map(i => i.message);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const MAPPING = JSON.stringify({
  kind: 'primmel-edition-mapping/1',
  from: { edition: 2010, model_state: null },
  to: { edition: 2020, model_state: { git_commit: 'abc' } },
  lineage: ['2020', '2010'],
});

describe('C170 edition-lineage-declared', () => {
  it('demands the mapping when the manifest declares two editions', () => {
    const msgs = issues(
      { 'specification/r.prl': 'requirement /req/r { name "R" }\n' },
      'C170',
    );
    assert.equal(msgs.length, 1);
    assert.match(msgs[0], /edition-mapping\.json/);
  });

  it('accepts a mapping whose editions cover the manifest span', () => {
    const msgs = issues(
      {
        'edition-mapping.json': MAPPING,
        'specification/r.prl': 'requirement /req/r { name "R" }\n',
      },
      'C170',
    );
    assert.deepEqual(msgs, []);
  });

  it('rejects a mapping naming an undeclared edition', () => {
    const msgs = issues(
      {
        'edition-mapping.json': MAPPING.replace('2010', '1999'),
        'specification/r.prl': 'requirement /req/r { name "R" }\n',
      },
      'C170',
    );
    assert.equal(msgs.length, 1);
    assert.match(msgs[0], /from edition 1999/);
  });
});

describe('C168 the calls leg', () => {
  it('resolves a raw-plane call edge to a declared process', () => {
    const msgs = issues(
      {
        'model/p.prl':
          'process caller {\n name "Caller"\n step go { calls target_proc }\n}\nprocess target_proc { name "T" }\n',
      },
      'C168',
    );
    assert.deepEqual(msgs, []);
  });

  it('rejects a raw-plane call edge naming nothing', () => {
    const msgs = issues(
      {
        'model/p.prl':
          'process caller {\n name "Caller"\n step go { calls no_such_proc }\n}\n',
      },
      'C168',
    );
    assert.equal(msgs.length, 1);
    assert.match(msgs[0], /method-ref-resolves/);
  });
});

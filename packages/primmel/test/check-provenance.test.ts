// C169 provenance-clause-resolves: a provenance binding citing a shipped
// document lands on a real fragment — exact, subtree, or enclosure.
// A clause-qualified miss is air (error); a bare subpart citation is
// unverifiable debt (warning).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkPackage } from '../src/check';

const PRD = {
  'sources-prd/pkg.sentences.json': JSON.stringify({
    prd_sentences: '0.1.0',
    document: { urn: 'urn:x:doc:1', short: 'X' },
    sentences: [
      { address: 'clause-3/s1', fragment: 'clause-3', kind: 'content', fragment_normative: true, modality: 'normative', text: 'The instrument shall bear markings.' },
      { address: 'clause-3.1/s1', fragment: 'clause-3.1', kind: 'content', fragment_normative: true, modality: 'normative', text: 'The markings shall be legible.' },
    ],
  }),
};

const issues = (files: Record<string, string>) => {
  const { mkdtempSync, mkdirSync, rmSync, writeFileSync } = require('node:fs');
  const { tmpdir } = require('node:os');
  const { dirname, join } = require('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'primmel-c169-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id pkg }');
  for (const [rel, body] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
  try {
    return checkPackage(dir).filter(i => i.check === 'C169');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

describe('C169 provenance-clause-resolves', () => {
  const req = (ref: string) =>
    `requirement /req/r { name "R"\n statement "S"\n ref derives-from "${ref}"\n}\n`;

  it('accepts an exact, subtree, and enclosure landing', () => {
    const msgs = issues({
      ...PRD,
      'specification/r.prl':
        req('urn:x:doc:1#clause-3') +
        req('urn:x:doc:1#clause-3.1') +
        req('urn:x:doc:1#clause-3/table-1'),
    });
    assert.deepEqual(msgs.filter(i => i.severity === 'error'), []);
  });

  it('rejects a clause-qualified citation that lands nowhere', () => {
    const msgs = issues({
      ...PRD,
      'specification/r.prl': req('urn:x:doc:1#clause-9.9.9'),
    });
    assert.equal(msgs.filter(i => i.severity === 'error').length, 1);
  });

  it('warns on a bare subpart citation the harvest cannot verify', () => {
    const msgs = issues({
      ...PRD,
      'specification/r.prl': req('urn:x:doc:1#table-4'),
    });
    assert.equal(msgs.filter(i => i.severity === 'warning').length, 1);
    assert.equal(msgs.filter(i => i.severity === 'error').length, 0);
  });
});

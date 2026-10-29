// ─────────────────────────────────────────────────────────────────────
// Workspace locators (TODO.lang-spec/15, PROPOSAL-model-separation §2a):
// the named resolution endpoints (.primmel/locators.prl — the workspace's
// own file, never package content), the `<locator>::<id>` qualified
// import, the credential-reference discipline (C188), and the closure
// report's three states (closed / interface-closed / unresolved — data,
// never errors).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkPackage } from '../src/check';
import { closureReport } from '../src/ser-des/package';
import {
  LOCATOR_FILE,
  isCredentialReference,
  parseLocators,
} from '../src/ser-des/locators';

function makeWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-locators-'));
  mkdirSync(join(dir, '.primmel'), { recursive: true });
  return dir;
}

function makePackage(
  ws: string,
  id: string,
  body: string,
  uses: string,
): string {
  const dir = join(ws, id);
  mkdirSync(join(dir, 'model'), { recursive: true });
  writeFileSync(join(dir, 'package.primmel'), `package { id ${id} ${uses} }`);
  writeFileSync(join(dir, 'model', 'm.prl'), body);
  return dir;
}

const LOCATORS_OK = `locator acme-local {
  scheme local
  path "./\${id}"
}

locator ribose-registry {
  scheme registry
  registry "https://models.ribose.com/v1"
  auth env:RIBOSE_MODELS_TOKEN
}
`;

describe('the locators file (TODO.lang-spec/15)', () => {
  it('parses the schemes and facets', () => {
    const parsed = parseLocators(LOCATORS_OK);
    assert.equal(parsed.locators.length, 2);
    const local = parsed.locators.find(l => l.name === 'acme-local')!;
    assert.equal(local.scheme, 'local');
    assert.equal(local.path, './${id}');
    const registry = parsed.locators.find(l => l.name === 'ribose-registry')!;
    assert.equal(registry.scheme, 'registry');
    assert.equal(registry.auth, 'env:RIBOSE_MODELS_TOKEN');
    assert.deepEqual(parsed.issues, []);
  });

  it('reports malformed declarations and duplicate names as issues', () => {
    const parsed = parseLocators(`locator dup {
  scheme local
}
locator dup {
  scheme registry
}
locator no-facet {
  scheme registry
}
`);
    const codes = parsed.issues.map(i => i.code);
    assert.ok(codes.includes('locator-shape'));
  });

  it('credentials are references only (env:/vault: prefixes)', () => {
    assert.ok(isCredentialReference('env:TOKEN'));
    assert.ok(isCredentialReference('vault:prod/models'));
    assert.ok(!isCredentialReference('hunter2'));
    assert.ok(!isCredentialReference(''));
  });
});

describe('C187/C188 — the checker legs', () => {
  it('a qualified import naming a declared locator checks clean', () => {
    const ws = makeWorkspace();
    try {
      writeFileSync(join(ws, LOCATOR_FILE), LOCATORS_OK);
      makePackage(ws, 'dep-a', 'instrument A { definition { A. } }', '');
      const dir = makePackage(
        ws,
        'top',
        'instrument I { definition { I. } }',
        'uses { acme-local::dep-a }',
      );
      const issues = checkPackage(dir).filter(i =>
        ['C187', 'C188'].includes(i.check),
      );
      assert.deepEqual(issues, []);
    } finally {
      rmSync(ws, { recursive: true, force: true });
    }
  });

  it('a qualified import naming no declared endpoint is C187', () => {
    const ws = makeWorkspace();
    try {
      writeFileSync(join(ws, LOCATOR_FILE), LOCATORS_OK);
      const dir = makePackage(
        ws,
        'top',
        'instrument I { definition { I. } }',
        'uses { ghost-locator::dep-a }',
      );
      const issues = checkPackage(dir).filter(i => i.check === 'C187');
      assert.ok(
        issues.length >= 1 &&
          issues.some(i =>
            i.message.includes(
              'the workspace declares no locator endpoint "ghost-locator"',
            ),
          ),
        `expected the undeclared-endpoint leg, got: ${issues.map(i => i.message).join('\n')}`,
      );
    } finally {
      rmSync(ws, { recursive: true, force: true });
    }
  });

  it('an inline credential in a locator is C188', () => {
    const ws = makeWorkspace();
    try {
      writeFileSync(
        join(ws, LOCATOR_FILE),
        `locator leaky {
  scheme registry
  registry "https://models.example.com/v1"
  auth "super-secret-token"
}
`,
      );
      const dir = makePackage(
        ws,
        'top',
        'instrument I { definition { I. } }',
        'uses { leaky::dep-a }',
      );
      const issues = checkPackage(dir).filter(i => i.check === 'C188');
      assert.ok(
        issues.some(i => i.message.includes('references only')),
        `expected the credential leg, got: ${issues.map(i => i.message).join('\n')}`,
      );
    } finally {
      rmSync(ws, { recursive: true, force: true });
    }
  });
});

describe('the closure report — the license boundary (data, never errors)', () => {
  it('classifies closed / interface-closed / unresolved', () => {
    const ws = makeWorkspace();
    try {
      writeFileSync(join(ws, LOCATOR_FILE), LOCATORS_OK);
      // A mergeable sibling: closed.
      const depA = makePackage(
        ws,
        'dep-a',
        'instrument A { definition { A. } }',
        '',
      );
      // A product_reference sibling: interface-closed.
      const depB = makePackage(
        ws,
        'dep-b',
        'instrument B { definition { B. } }',
        'kind product_reference',
      );
      // The root composes dep-a (bare) and dep-b through the locator;
      // dep-c names a local endpoint whose path does not exist: unresolved.
      const top = makePackage(
        ws,
        'top',
        'instrument T { definition { T. } }',
        'uses { acme-local::dep-a acme-local::dep-b acme-local::dep-c dep-d }',
      );
      void depA;
      void depB;
      const rep = closureReport(top);
      const byId = new Map(rep.dependencies.map(d => [d.id, d]));
      assert.equal(byId.get('dep-a')!.state, 'closed');
      assert.equal(byId.get('dep-b')!.state, 'interface-closed');
      assert.equal(byId.get('dep-c')!.state, 'unresolved');
      // §2a: the bare import is the declared unresolved state.
      assert.equal(byId.get('dep-d')!.state, 'unresolved');
      assert.equal(byId.get('dep-b')!.locator, 'acme-local');
      assert.ok(rep.workspace!.endsWith(LOCATOR_FILE));
    } finally {
      rmSync(ws, { recursive: true, force: true });
    }
  });
});

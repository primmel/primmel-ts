import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index.js';

// The view_profile ser-des fixpoint (issue #79): the dump emitted the
// roles/visible list facets UNBRACED — one token per entry — while the
// pairwise parse walk reads exactly one value token per keyword. The
// second entry re-entered the walk as a keyword, auto-skipped the next
// facet as its "value", and the trailing `against qms-ref` died
// value-less: the kernel's own parser rejected its own serializer's
// output with "Expecting value for qms-ref" (the ims-demo QmsLeadership
// signature in oimlsmart/primmel-packages). The grammar's spellable
// form is the braced list block; the dump now emits it.

const HEADER = `metadata {
  title ""
  schema ""
  edition ""
  author ""
  namespace ""
}

`;

const IMS_DEMO_SHAPE = `view_profile QmsLeadership {
  description "The QMS leadership lens: only the policy-and-objectives and internal-audit voices are audible."
  roles [qms-manager]
  visible { PolicyAndObjectives InternalAudit }
  against qms-ref
}
`;

describe('view_profile ser-des', () => {
  it('a view read against a bare layer reference round-trips (the #79 signature)', () => {
    const ast = load(HEADER + IMS_DEMO_SHAPE, { strict: true });
    const vp = ast.viewProfiles[0];
    assert.deepEqual(vp.roles, ['qms-manager']);
    assert.deepEqual(vp.visibleElements, [
      'PolicyAndObjectives',
      'InternalAudit',
    ]);
    assert.equal(vp.against, 'qms-ref');

    const once = dump(ast);
    // The exact failure: the reload must not die value-less.
    const reloaded = load(once, { strict: true });
    assert.deepEqual(reloaded.viewProfiles[0], vp);
    assert.equal(dump(reloaded), once, 'the serializer fixpoint holds');
  });

  it('the list facets emit the canonical braced spelling', () => {
    const once = dump(load(HEADER + IMS_DEMO_SHAPE, { strict: true }));
    assert.ok(once.includes('  roles { qms-manager }\n'));
    assert.ok(
      once.includes('  visible { PolicyAndObjectives InternalAudit }\n'),
    );
    assert.ok(once.includes('  against qms-ref\n'));
  });

  it('the canonical braced document is byte-stable', () => {
    const canonical =
      HEADER +
      `view_profile QmsLeadership {
  description "The QMS leadership lens: only the policy-and-objectives and internal-audit voices are audible."
  roles { qms-manager }
  visible { PolicyAndObjectives InternalAudit }
  against qms-ref
}
`;
    const once = dump(load(canonical, { strict: true }));
    assert.equal(once, canonical);
  });

  it('a bare single entry parses whole — never char-stripped (the VL-1 quirk)', () => {
    const text =
      HEADER + 'view_profile Lens { roles qms-manager visible OpA }\n';
    const vp = load(text, { strict: true }).viewProfiles[0];
    // tokenizePackage's unconditional unwrapBlock would parse these as
    // "ms-manage" / "p".
    assert.deepEqual(vp.roles, ['qms-manager']);
    assert.deepEqual(vp.visibleElements, ['OpA']);
  });

  it('whitespace-carrying entries re-quote on dump and unquote on parse', () => {
    const text =
      HEADER +
      'view_profile Lens { visible { OpA "Internal Audit" } against StdS }\n';
    const ast = load(text, { strict: true });
    assert.deepEqual(ast.viewProfiles[0].visibleElements, [
      'OpA',
      'Internal Audit',
    ]);
    const once = dump(ast);
    assert.ok(once.includes('  visible { OpA "Internal Audit" }\n'));
    assert.equal(dump(load(once, { strict: true })), once);
  });

  it('a description carrying a quote escapes on dump and unescapes on parse', () => {
    const text =
      HEADER +
      'view_profile Lens { description "the \\"policy\\" voice" against StdS }\n';
    const ast = load(text, { strict: true });
    assert.equal(ast.viewProfiles[0].description, 'the "policy" voice');
    const once = dump(ast);
    assert.ok(once.includes('  description "the \\"policy\\" voice"\n'));
    assert.equal(dump(load(once, { strict: true })), once);
  });

  it('an empty view_profile emits no value-less facets', () => {
    const text = HEADER + 'view_profile Empty {\n}\n';
    const once = dump(load(text, { strict: true }));
    assert.equal(once, text);
    assert.equal(dump(load(once, { strict: true })), once);
  });
});

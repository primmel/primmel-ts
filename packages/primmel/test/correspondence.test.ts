// ─────────────────────────────────────────────────────────────────────
// The `corresponds` facet (Primmel v3.1, TODO.primmel/10; MN 114 clause
// 19.4): the generalized per-node correspondence declaration — the CDD
// IRDI pattern (`irdi` on attribute definitions) generalized to every
// node kind, plus the projection-steering declarations the expression
// codecs consume. Maps-to, never is-defined-by.
//
// Covers the parse across node kinds (attribute definition, term,
// requirement, form field, package manifest), the projection block, the
// lenient skip discipline on unrecorded constructs, the round-trip
// fixpoint, and the linter rule
//   C108 correspondence-shape
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

describe('corresponds: parse across node kinds', () => {
  it('records on an attribute definition, alongside the legacy irdi', () => {
    const m = load(`
attribute_definition e_max {
  name "Maximum capacity"
  irdi "0172-a/123"
  corresponds iec-cdd "0172-a/123"
  corresponds dpp "attr:eMax" {
    projection dpp-attribute { path "identity.eMax" }
    projection vc-claim { claim "maxCapacity" }
  }
}
`);
    const a = m.attributeDefinitions[0];
    assert.equal(a.irdi, '0172-a/123');
    assert.equal(a.correspondences?.length, 2);
    assert.equal(a.correspondences?.[0].scheme, 'iec-cdd');
    assert.equal(a.correspondences?.[0].concept, '0172-a/123');
    const dpp = a.correspondences?.[1];
    assert.equal(dpp?.projections.length, 2);
    assert.deepEqual(dpp?.projections[0], {
      codec: 'dpp-attribute',
      entries: [{ key: 'path', value: 'identity.eMax' }],
    });
    assert.deepEqual(dpp?.projections[1], {
      codec: 'vc-claim',
      entries: [{ key: 'claim', value: 'maxCapacity' }],
    });
  });

  it('records on terms, requirements, form fields, and the manifest', () => {
    const m = load(`
package {
  id corr-smoke
  corresponds iec-cdd "0112/2///61987#ABA900"
}
term load-cell {
  label "load cell"
  corresponds iec-cdd "0112/2///61987#ABA901"
}
requirement /req/metrological/mpe {
  statement "The error shall not exceed the mpe."
  corresponds vc-claims "claim:mpeConformity"
}
form test-report {
  name "Test report"
  field indication : number {
    label "Indication"
    corresponds dpp "attr:indication" { projection dpp-attribute { path "reading.indication" } }
  }
}
`);
    assert.equal(m.packageManifest?.correspondences?.[0].scheme, 'iec-cdd');
    assert.equal(
      m.terms[0].correspondences?.[0].concept,
      '0112/2///61987#ABA901',
    );
    assert.equal(m.requirements[0].correspondences?.[0].scheme, 'vc-claims');
    const fld = m.forms[0].fields[0];
    assert.equal(fld.correspondences?.length, 1);
    assert.equal(
      fld.correspondences?.[0].projections[0].entries[0].value,
      'reading.indication',
    );
  });

  it('tolerates the facet on an unrecorded construct (the skip discipline)', () => {
    // A construct that does not record corresponds (here: role) must
    // still parse the facet away cleanly — scheme + concept + the
    // optional block, never a desync (MN 114 §9.5's multi-token skip).
    const m = load(
      'role approver { corresponds iec-cdd "x" { projection cdd { k v } } name "Approver" }',
    );
    assert.equal(m.roles[0].name, 'Approver');
  });

  it('is a dump/load/dump fixed point', () => {
    const src = `
attribute_definition e_max {
  name "Maximum capacity"
  corresponds dpp "attr:eMax" {
    projection dpp-attribute { path "identity.eMax" }
  }
}
`;
    const first = dump(load(src));
    const second = dump(load(first));
    assert.equal(first, second);
    assert.match(
      first,
      /corresponds dpp "attr:eMax" \{\n {4}projection dpp-attribute \{ path identity\.eMax \}\n {2}\}/,
    );
  });
});

// ── the check legs (C108) ────────────────────────────────────────────

function check(model: string) {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-corr-'));
  mkdirSync(join(dir, 'model'));
  writeFileSync(
    join(dir, 'package.primmel'),
    'package {\n  id corpus-correspondence-case\n}\n',
  );
  writeFileSync(join(dir, 'model', 'm.prl'), model);
  return checkPackage(dir).filter(i => i.check === 'C108');
}

describe('corresponds: the checker (C108)', () => {
  it('one correspondence per scheme checks clean', () => {
    const issues = check(`
attribute_definition e_max {
  irdi "0172-a/123"
  corresponds iec-cdd "0172-a/123"
  corresponds dpp "attr:eMax"
}
`);
    assert.deepEqual(issues, []);
  });

  it('two entries on one scheme are an error', () => {
    const issues = check(`
attribute_definition e_max {
  corresponds iec-cdd "0172-a/123"
  corresponds iec-cdd "0172-a/999"
}
`);
    assert.equal(issues.filter(i => i.severity === 'error').length, 1);
    assert.match(issues[0].message, /iec-cdd/);
  });

  it('an empty concept is an error', () => {
    const issues = check('attribute_definition e_max { corresponds dpp "" }');
    assert.equal(issues.filter(i => i.severity === 'error').length, 1);
  });

  it('an irdi disagreeing with corresponds iec-cdd warns', () => {
    const issues = check(`
attribute_definition e_max {
  irdi "0172-a/123"
  corresponds iec-cdd "0172-a/999"
}
`);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, 'warning');
    assert.match(issues[0].message, /disagrees/);
  });
});

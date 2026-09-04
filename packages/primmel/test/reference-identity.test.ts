// ─────────────────────────────────────────────────────────────────────
// The structured reference identity (Primmel v3.2, TODO.primmel/11;
// MN 114 clause 14.7 — primmel/spec#18 ask 3). The reference construct's
// facet set grows from display strings to a resolvable identity: org,
// edition, and urn join document/clause/title. Covers the parse, the
// round-trip fixpoint, and the linter rule
//   C112 reference-identity
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index';
import { checkReferences } from '../src/check';

describe('structured reference: parse', () => {
  it('parses the full v3.2 facet set', () => {
    const m = load(`
      reference iso-iec-17025-7.2 {
        org "ISO/IEC"
        document "ISO/IEC 17025"
        edition "2017"
        clause "7.2"
        title "General requirements for the competence of testing and calibration laboratories"
        urn "urn:iso:std:iso-iec:17025:ed-3"
      }
    `);
    const r = m.references[0];
    assert.equal(r.id, 'iso-iec-17025-7.2');
    assert.equal(r.org, 'ISO/IEC');
    assert.equal(r.document, 'ISO/IEC 17025');
    assert.equal(r.edition, '2017');
    assert.equal(r.clause, '7.2');
    assert.equal(
      r.title,
      'General requirements for the competence of testing and calibration laboratories',
    );
    assert.equal(r.urn, 'urn:iso:std:iso-iec:17025:ed-3');
  });

  it('the v2 facet set still parses with the new facets absent', () => {
    const m = load(`
      reference r60 {
        document "OIML R 60"
        clause "5.3.2"
      }
    `);
    const r = m.references[0];
    assert.equal(r.document, 'OIML R 60');
    assert.equal(r.org, undefined);
    assert.equal(r.edition, undefined);
    assert.equal(r.urn, undefined);
  });
});

describe('structured reference: serialization', () => {
  it('round-trips the full facet set to a fixed point', () => {
    const src = `reference iso-iec-17025-7.2 {
  document "ISO/IEC 17025"
  clause "7.2"
  title "General requirements for the competence of testing and calibration laboratories"
  org "ISO/IEC"
  edition "2017"
  urn "urn:iso:std:iso-iec:17025:ed-3"
}
`;
    const first = dump(load(src));
    assert.equal(dump(load(first)), first);
    assert.match(
      first,
      /reference iso-iec-17025-7\.2 \{\n {2}document "ISO\/IEC 17025"\n {2}clause "7\.2"\n {2}title "General requirements[^"]*"\n {2}org "ISO\/IEC"\n {2}edition "2017"\n {2}urn "urn:iso:std:iso-iec:17025:ed-3"\n\}/,
    );
  });

  it('omits the absent facets', () => {
    const first = dump(
      load(`reference r60 {
  document "OIML R 60"
  clause "5.3.2"
}
`),
    );
    assert.equal(dump(load(first)), first);
    assert.match(
      first,
      /reference r60 \{\n {2}document "OIML R 60"\n {2}clause "5\.3\.2"\n\}/,
    );
    const block = first.slice(first.indexOf('reference r60'));
    assert.ok(!block.includes('urn '), 'no urn line');
    assert.ok(!block.includes('org '), 'no org line');
    assert.ok(!block.includes('edition '), 'no edition line');
  });
});

describe('C112 reference-identity', () => {
  it('a malformed urn is an error', () => {
    const m = load(`
      reference bad {
        document "X"
        urn "urn:bad urn"
      }
    `);
    const issues = checkReferences(m);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].check, 'C112');
    assert.equal(issues[0].severity, 'error');
    assert.match(
      issues[0].message,
      /urn "urn:bad urn" is not a well-formed IRI/,
    );
  });

  it('neither urn nor the org+document pair is a warning', () => {
    const m = load(`
      reference weak {
        clause "5.3.2"
        title "Some clause"
      }
    `);
    const issues = checkReferences(m);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, 'warning');
    assert.match(
      issues[0].message,
      /carries neither urn nor the org-and-document pair/,
    );
  });

  it('a well-formed urn alone is the identity — clean', () => {
    const m = load(`
      reference strong {
        document "OIML R 60"
        urn "urn:oiml:pub:r:60-1:2021"
      }
    `);
    assert.deepEqual(checkReferences(m), []);
  });

  it('the org+document quadruple without a urn is the identity — clean', () => {
    const m = load(`
      reference structured {
        org "ISO/IEC"
        document "ISO/IEC 17025"
        edition "2017"
        clause "7.2"
      }
    `);
    assert.deepEqual(checkReferences(m), []);
  });

  it('document without org and no urn warns (document is only half the pair)', () => {
    const m = load(`
      reference half {
        document "OIML R 60"
      }
    `);
    const issues = checkReferences(m);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, 'warning');
  });
});

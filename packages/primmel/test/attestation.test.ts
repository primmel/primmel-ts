// ─────────────────────────────────────────────────────────────────────
// The `attestation` construct (the typed kernel, clause 19): parse,
// round-trip, and the C150/C151 checker rules.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dump, load } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const SOURCE = `
promise_set LoadCell {
  promise accuracy_class {
    target accuracy_class
    statement "The type holds its declared accuracy class."
    certificate { dimension accuracy_class type string label "Accuracy class" obligation mandatory }
  }
  promise e_max {
    target e_max
    statement "Maximum capacity per model."
    certificate { attribute e_max type string label "E_max values" obligation mandatory }
  }
  promise cable_length {
    target cable_length
    statement "Integral cable length."
    certificate { attribute cable_length type quantity label "Cable length" obligation optional }
  }
}

instance ssm-ssb7 {
  of LoadCell
  level model
  definition_versions { LoadCell : "2021" }
  has { attributes { } dimensions { } }
}

verdict mpe {
  derive "ocl{0}"
}

attestation r60-certificate-claim {
  subject    ssm-ssb7
  promises   LoadCell
  basis      test_report "NMi-3826124-01"
  authority  issuing_authority "NMi Certin B.V."
  statement  "This Certificate attests the conformity of the above identified Type."
  limits     { scope   "the metrological and technical characteristics of the type"
               legal    "does not bestow any form of legal international approval" }
  claims {
    accuracy_class {
      declared     app-flintec-2025-0314.characteristics
      validated_by mpe
    }
    e_max {
      declared     app-flintec-2025-0314.characteristics
      validated_by mpe
    }
  }
}
`;

function makePackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-attest-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'package.prl'), body);
  return dir;
}

describe('attestation construct (the typed kernel, clause 19)', () => {
  it('parses the facets', () => {
    const m = load(SOURCE);
    assert.equal(m.attestations.length, 1);
    const a = m.attestations[0]!;
    assert.equal(a.subject, 'ssm-ssb7');
    assert.equal(a.promises, 'LoadCell');
    assert.deepEqual(a.basis, [{ kind: 'test_report', id: 'NMi-3826124-01' }]);
    assert.equal(a.authority.role, 'issuing_authority');
    assert.equal(a.authority.name, 'NMi Certin B.V.');
    assert.match(a.statement, /attests the conformity/);
    assert.deepEqual(
      a.limits.map(l => l.label),
      ['scope', 'legal'],
    );
    assert.equal(a.claims.length, 2);
    assert.equal(
      a.claims[0]!.declared,
      'app-flintec-2025-0314.characteristics',
    );
    assert.equal(a.claims[0]!.validatedBy, 'mpe');
  });

  it('round-trips byte-stably', () => {
    const once = dump(load(SOURCE));
    const twice = dump(load(once));
    assert.equal(once, twice);
    assert.match(once, /attestation r60-certificate-claim \{/);
    assert.match(once, /validated_by mpe/);
  });

  it('a well-formed attestation with full lineage is clean', () => {
    const issues = checkPackage(makePackage(SOURCE)).filter(
      i => i.check === 'C150' || i.check === 'C151',
    );
    assert.deepEqual(issues, []);
  });

  it('C150: an unresolvable subject and promise set are named', () => {
    const issues = checkPackage(
      makePackage('attestation a { subject nope promises nothing }'),
    ).filter(i => i.check === 'C150');
    assert.match(
      issues.map(i => i.message).join('\n'),
      /subject "nope" is not a declared instance/,
    );
    assert.match(
      issues.map(i => i.message).join('\n'),
      /promises "nothing" does not resolve/,
    );
  });

  it('C151: a mandatory promise without a claim is reported', () => {
    const issues = checkPackage(
      makePackage(
        SOURCE +
          '\nattestation partial { subject ssm-ssb7 promises LoadCell claims { cable_length { declared d validated_by mpe } } }',
      ),
    ).filter(i => i.check === 'C151');
    const messages = issues.map(i => i.message).join('\n');
    assert.match(messages, /mandatory promise "accuracy_class"/);
    assert.match(messages, /mandatory promise "e_max"/);
    assert.doesNotMatch(messages, /"cable_length"/);
  });
});

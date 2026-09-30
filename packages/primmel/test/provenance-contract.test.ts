// ─────────────────────────────────────────────────────────────────────
// The typed kernel's per-entry provenance and the artifact
// contract-derivation facet: parse, round-trip, C153.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dump, load } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

function makePackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-provenance-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'package.prl'), body);
  return dir;
}

const INSTANCE = `
instrument LoadCell {
  definition "Load cell."
}

instance ssm-ssb7 {
  of LoadCell
  level model
  definition_versions { LoadCell : "2021" }
  has {
    attributes {
      e_max : { value 30 unit t provenance { source "OIML certificate NMi-3826124-01, page 1" page 1 entry_wording "Max capacity" read_at 2026-09-29T10:00:00Z declaration app-flintec-2025-0314.characteristics verdict mpe } }
      n_lc : 4000
    }
    dimensions { }
  }
}
`;

describe('per-entry provenance (the typed kernel, clause 10)', () => {
  it('parses the provenance facets on a value entry', () => {
    const m = load(INSTANCE);
    const inst = m.instances[0]!;
    const eMax = inst.has.attributes['e_max']!;
    assert.equal(eMax.value, 30);
    assert.equal(eMax.unit, 't');
    assert.equal(
      eMax.provenance?.source,
      'OIML certificate NMi-3826124-01, page 1',
    );
    assert.equal(eMax.provenance?.page, '1');
    assert.equal(eMax.provenance?.entryWording, 'Max capacity');
    assert.equal(eMax.provenance?.readAt, '2026-09-29T10:00:00Z');
    assert.equal(
      eMax.provenance?.declaration,
      'app-flintec-2025-0314.characteristics',
    );
    assert.equal(eMax.provenance?.verdict, 'mpe');
    // The unprovenanced sibling stays compact.
    assert.equal(inst.has.attributes['n_lc']!.value, 4000);
    assert.equal(inst.has.attributes['n_lc']!.provenance, undefined);
  });

  it('round-trips byte-stably with provenance carried', () => {
    const once = dump(load(INSTANCE));
    assert.equal(once, dump(load(once)));
    assert.match(once, /provenance \{ source "OIML certificate/);
    assert.match(once, /declaration app-flintec-2025-0314\.characteristics/);
    assert.match(once, /n_lc : 4000/);
  });
});

const CONTRACT = `
promise_set LoadCell {
  promise e_max {
    target e_max
    statement "Maximum capacity per model."
    certificate { attribute e_max type string label "E_max values" obligation mandatory }
  }
}

artifact_definition certificate-document {
  name "OIML certificate"
  contract_from LoadCell
  produced_when per_measurement
  retention "the register's lifetime"
}
`;

describe('artifact contract_from (C153, the typed kernel, clause 10)', () => {
  it('parses and round-trips the derivation facet', () => {
    const m = load(CONTRACT);
    assert.equal(m.artifactDefinitions[0]!.contractFrom, 'LoadCell');
    const once = dump(load(CONTRACT));
    assert.equal(once, dump(load(once)));
    assert.match(once, /contract_from LoadCell/);
  });

  it('a resolving, non-restating derivation is clean', () => {
    const issues = checkPackage(makePackage(CONTRACT)).filter(
      i => i.check === 'C153',
    );
    assert.deepEqual(issues, []);
  });

  it('an unresolvable reference and a restating definition are both named', () => {
    const issues = checkPackage(
      makePackage(
        CONTRACT +
          '\nartifact_definition bad1 { contract_from nowhere produced_when per_measurement }' +
          '\nartifact_definition bad2 { contract_from LoadCell content_contract { fields { x : string } } produced_when per_measurement }',
      ),
    ).filter(i => i.check === 'C153');
    const messages = issues.map(i => i.message).join('\n');
    assert.match(messages, /contract_from "nowhere" does not resolve/);
    assert.match(messages, /declares both contract_from and inline/);
  });
});

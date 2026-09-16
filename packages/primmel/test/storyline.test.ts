// ─────────────────────────────────────────────────────────────────────
// The demo_world + storyline constructs (smart TODO.roadmap/40 batch 4;
// the packages-as-SSOT epic) — the sample-data demo seeds as native
// constructs: the demo_world's file-level metadata and OPEN
// participants registry (the grammar never enumerates section names),
// the storyline's name/id_prefix/party/subject/record facets with the
// record-value sub-grammar (the quantity.ts dumpScalarToken
// conventions: numbers bare, quoted strings quoted, { … } lists), and
// the C129 storyline-shape linter rule.
//
// Fixtures:
//   WORLD      — a demo_world with two participants sections.
//   STORES     — the entity classes whose stores the records name.
//   FLOW       — the r60 EX1 carrier shape: party, subject, and the
//                five workflow records with their cross-references.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const WORLD = `
demo_world r60_demo {
  standard oiml-r60
  description "The R 60 demonstration world."
  participants {
    organizations {
      lab_example {
        name "Example Test Laboratory"
        country "EX"
      }
      ia_example {
        name "Example Issuing Authority"
        country "EX"
      }
    }
    operated_schemes {
      scheme_example {
        scheme_category A
        utilizer util_example
      }
    }
  }
}
`;

const STORES = `
class Application#data {
  store { applications }
  id: string [1..1] { modality SHALL }
}
class Certificate#data {
  store { certificates }
  id: string [1..1] { modality SHALL }
}
class EvaluationReport#data {
  store { evaluationReports }
  id: string [1..1] { modality SHALL }
}
`;

const FLOW = `
storyline ex1_acme_lc500 {
  name "EX1/Example TL — ACME LC-500i"
  id_prefix sample-ex1
  party { laboratory lab_example authority ia_example }
  subject {
    manufacturer mfr-acme {
      company "ACME Weighing"
      city "Example City"
    }
    family fam-acme-lc500 {
      family_designation "LC-500i series"
    }
    model mod-acme-lc500-i {
      model_designation "LC-500i"
      max_capacity 500
    }
    sample smp-ex1-1 {
      serial_number "EX1-001"
      test_dates { 2026-03-04 2026-03-05 }
    }
  }
  record applications app-ex1 {
    status SUBMITTED
    submitted_date 2026-03-04
  }
  record evaluationReports eval-ex1 {
    outcome PASSED
  }
  record certificates cert-ex1 {
    evaluationReports eval-ex1
    issued_date 2026-04-01
  }
  note "The EX1 provenance comment, native at last."
}
`;

function makePackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-storyline-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'package.prl'), body);
  return dir;
}

describe('demo_world construct (smart TODO.roadmap/40 batch 4)', () => {
  it('parses the metadata and the OPEN participants sections', () => {
    const m = load(WORLD);
    const w = m.demoWorlds[0]!;
    assert.equal(w.id, 'r60_demo');
    assert.equal(w.standard, 'oiml-r60');
    assert.equal(w.description, 'The R 60 demonstration world.');
    assert.deepEqual(
      w.participants.map(s => s.id),
      ['organizations', 'operated_schemes'],
    );
    const orgs = w.participants[0]!;
    assert.deepEqual(
      orgs.entries.map(e => e.id),
      ['lab_example', 'ia_example'],
    );
    assert.equal(orgs.entries[0]!.fields.name, 'Example Test Laboratory');
    assert.equal(orgs.entries[0]!.fields.country, 'EX');
  });

  it('round-trips the world losslessly (fixpoint)', () => {
    const once = dump(load(WORLD));
    const twice = dump(load(once));
    assert.equal(twice, once);
    assert.deepEqual(load(once).demoWorlds, load(WORLD).demoWorlds);
  });
});

describe('storyline construct (smart TODO.roadmap/40 batch 4)', () => {
  it('parses the flow with its records and the record-value sub-grammar', () => {
    const m = load(FLOW);
    const s = m.storylines[0]!;
    assert.equal(s.id, 'ex1_acme_lc500');
    assert.equal(s.name, 'EX1/Example TL — ACME LC-500i');
    assert.equal(s.idPrefix, 'sample-ex1');
    assert.deepEqual(s.party, {
      laboratory: 'lab_example',
      authority: 'ia_example',
    });
    assert.deepEqual(
      s.subject.map(e => [e.kind, e.id]),
      [
        ['manufacturer', 'mfr-acme'],
        ['family', 'fam-acme-lc500'],
        ['model', 'mod-acme-lc500-i'],
        ['sample', 'smp-ex1-1'],
      ],
    );
    // The record-value sub-grammar: numbers coerce, quoted strings stay
    // strings, dates stay bare strings, { … } lists hold scalars.
    const model = s.subject[2]!;
    assert.equal(model.fields.max_capacity, 500);
    const sample = s.subject[3]!;
    assert.equal(sample.fields.serial_number, 'EX1-001');
    assert.deepEqual(sample.fields.test_dates, ['2026-03-04', '2026-03-05']);
    assert.deepEqual(
      s.records.map(r => [r.store, r.id]),
      [
        ['applications', 'app-ex1'],
        ['evaluationReports', 'eval-ex1'],
        ['certificates', 'cert-ex1'],
      ],
    );
    assert.equal(s.records[0]!.fields.status, 'SUBMITTED');
    assert.equal(s.records[0]!.fields.submitted_date, '2026-03-04');
    assert.deepEqual(s.notes, ['The EX1 provenance comment, native at last.']);
  });

  it('rejects a record facet missing its id or block', () => {
    assert.throws(
      () =>
        load(`
storyline broken {
  record application {
    status SUBMITTED
  }
}
`),
      /record application is missing its id and block|record application application is missing/,
    );
  });

  it('round-trips the flow losslessly (fixpoint)', () => {
    const once = dump(load(FLOW));
    const twice = dump(load(once));
    assert.equal(twice, once);
    assert.deepEqual(load(once).storylines, load(FLOW).storylines);
  });
});

describe('C129 storyline-shape', () => {
  function c129Issues(body: string) {
    return checkPackage(makePackage(body)).filter(i => i.check === 'C129');
  }

  it('accepts a coherent flow (all registers in scope)', () => {
    assert.deepEqual(c129Issues(WORLD + STORES + FLOW), []);
  });

  it('flags a malformed id_prefix (the register-free shape leg)', () => {
    const issues = c129Issues(
      FLOW.replace('id_prefix sample-ex1', 'id_prefix "Sample EX1!"'),
    );
    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /id_prefix/);
    assert.match(issues[0]!.message, /storyline-shape/);
  });

  it('flags a party reference no participant seed declares (gated)', () => {
    const issues = c129Issues(
      WORLD + FLOW.replace('laboratory lab_example', 'laboratory lab_ghost'),
    );
    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /lab_ghost/);
  });

  it('stays silent on party edges when no demo_world is in scope', () => {
    assert.deepEqual(
      c129Issues(
        FLOW.replace('laboratory lab_example', 'laboratory lab_ghost'),
      ),
      [],
    );
  });

  it('flags a record store no entity class declares (gated)', () => {
    const issues = c129Issues(
      STORES +
        FLOW.replace(
          'record applications app-ex1',
          'record ghostStore app-ex1',
        ),
    );
    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /ghostStore/);
  });

  it('stays silent on store edges when no entity stores are in scope', () => {
    assert.deepEqual(
      c129Issues(
        FLOW.replace(
          'record applications app-ex1',
          'record ghostStore app-ex1',
        ),
      ),
      [],
    );
  });

  it('flags a record cross-reference naming no sibling record (ungated)', () => {
    const issues = c129Issues(
      FLOW.replace(
        'evaluationReports eval-ex1\n    issued_date',
        'evaluationReports eval-typo\n    issued_date',
      ),
    );
    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /eval-typo/);
    assert.match(issues[0]!.message, /not a sibling evaluationReports record/);
  });
});

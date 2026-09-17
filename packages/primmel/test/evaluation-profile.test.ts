// ─────────────────────────────────────────────────────────────────────
// evaluation_profile construct (smart TODO.roadmap/40 batch 3) — the
// named dimension-value presets: the open-keyed dimensions map, the
// codec fixpoint (dimensions before description), and C135 (the key
// resolution per-register gated; the value membership leg against the
// dimension's declared value set — an open dimension accepts any
// value).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const DIMENSIONS_REGISTER = `
dimension accuracy_class {
  cardinality single
  values {
    A { label "Class A" }
    B { label "Class B" }
  }
}
dimension technology {
  cardinality single
  values {
    digital { label "Digital" }
    analogue-passive { label "Analogue passive" }
  }
}
dimension humidity_class {
  cardinality single
}
`;

const PROFILES = `
evaluation_profile class-a-digital-nh {
  dimensions { accuracy_class A technology digital humidity_class NH }
  description "Class A digital, no humidity test"
}
evaluation_profile class-b-digital-ch {
  dimensions { accuracy_class B technology digital humidity_class CH }
  description "Class B digital with cyclic humidity"
}
`;

function makePackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-evalprof-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'package.prl'), body);
  return dir;
}

describe('evaluation_profile construct (smart TODO.roadmap/40 batch 3)', () => {
  it('parses the register entries', () => {
    const m = load(PROFILES);
    assert.equal(m.evaluationProfiles.length, 2);
    const p = m.evaluationProfiles[0]!;
    assert.equal(p.id, 'class-a-digital-nh');
    assert.deepEqual(p.dimensions, {
      accuracy_class: 'A',
      technology: 'digital',
      humidity_class: 'NH',
    });
    assert.equal(p.description, 'Class A digital, no humidity test');
    assert.equal(
      m.evaluationProfiles[1]!.description,
      'Class B digital with cyclic humidity',
    );
  });

  it('round-trips byte-clean (the codec fixpoint; dimensions before description)', () => {
    const out = dump(load(PROFILES));
    assert.ok(
      out.includes(
        'evaluation_profile class-a-digital-nh {\n  dimensions { accuracy_class A technology digital humidity_class NH }\n  description "Class A digital, no humidity test"\n}\n',
      ),
    );
    assert.equal(dump(load(out)), out);
  });

  it('C135: a coherent register is clean (the open dimension accepts any value)', () => {
    // humidity_class declares no value set — NH/CH pass unchecked.
    const issues = checkPackage(
      makePackage(DIMENSIONS_REGISTER + PROFILES),
    ).filter(i => i.check === 'C135');
    assert.deepEqual(issues, []);
  });

  it('C135: a key naming no declared dimension is flagged (gated)', () => {
    const body = `
${DIMENSIONS_REGISTER}
evaluation_profile p {
  dimensions { accuracy_class A bogus_axis x }
}
`;
    const issues = checkPackage(makePackage(body)).filter(
      i => i.check === 'C135',
    );
    assert.equal(issues.length, 1);
    assert.match(
      issues[0]!.message,
      /dimensions key "bogus_axis" is not a declared classification dimension/,
    );
  });

  it('C135 gates on the dimension register — no dimensions, no leg', () => {
    const issues = checkPackage(makePackage(PROFILES)).filter(
      i => i.check === 'C135',
    );
    assert.deepEqual(issues, []);
  });

  it('C135: a value outside the dimension’s declared set is flagged', () => {
    const body = `
${DIMENSIONS_REGISTER}
evaluation_profile p {
  dimensions { accuracy_class X technology digital }
  description "Bad class"
}
`;
    const issues = checkPackage(makePackage(body)).filter(
      i => i.check === 'C135',
    );
    assert.equal(issues.length, 1);
    assert.match(
      issues[0]!.message,
      /dimensions entry "accuracy_class" names value "X", which the dimension does not declare/,
    );
  });

  // ── Set-cardinality presets (smart TODO.roadmap/40 wave 3.3 family D ──
  // — r144's measurand_components selects several channels at once): the
  // value list rides a balanced `{ … }` token.
  const SET_DIMENSION = `
dimension measurand_components {
  cardinality set
  values {
    co { label "CO" }
    no { label "NO" }
    no2 { label "NO2" }
  }
}
dimension measuring_principle {
  cardinality single
}
`;

  const LIST_PROFILE = `
evaluation_profile extractive-co-nox-ndir-cld {
  dimensions { measurand_components { co no } measuring_principle combined }
  description "Extractive CEMS: NDIR for CO + chemiluminescence for NOx"
}
`;

  it('parses a set-cardinality preset (the value list)', () => {
    const m = load(LIST_PROFILE);
    const p = m.evaluationProfiles[0]!;
    assert.deepEqual(p.dimensions, {
      measurand_components: ['co', 'no'],
      measuring_principle: 'combined',
    });
  });

  it('round-trips the value list byte-clean', () => {
    const out = dump(load(LIST_PROFILE));
    assert.ok(
      out.includes(
        'dimensions { measurand_components { co no } measuring_principle combined }',
      ),
    );
    assert.equal(dump(load(out)), out);
  });

  it('C135: every list entry resolves against the dimension’s value set', () => {
    const issues = checkPackage(
      makePackage(SET_DIMENSION + LIST_PROFILE),
    ).filter(i => i.check === 'C135');
    assert.deepEqual(issues, []);
    const bad = checkPackage(
      makePackage(
        SET_DIMENSION +
          `
evaluation_profile p {
  dimensions { measurand_components { co h2o } }
}
`,
      ),
    ).filter(i => i.check === 'C135');
    assert.equal(bad.length, 1);
    assert.match(
      bad[0]!.message,
      /dimensions entry "measurand_components" names value "h2o", which the dimension does not declare/,
    );
  });
});

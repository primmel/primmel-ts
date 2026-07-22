// ─────────────────────────────────────────────────────────────────────
// ISO/IEC 17065 role segregation (TODO.roadmap/39b) — the process
// `segregation { constraint … }` facet and the C59
// segregation-members-resolve linter rule.
//
// Fixtures:
//   SEGREGATED        — the clause-7 chain: an evaluation process, a
//                       review process disjoint from it (7.5.1) with the
//                       4.2.10 consultancy bar, and a complaints process
//                       disjoint from the reserved case_personnel set
//                       (7.13.5) with the fixed P2Y bar (7.13.6).
//   UNKNOWN_MEMBER    — a pair member that is no declared process (and
//                       not the reserved token).
//   SELF_DISJOINT     — a process declared disjoint from itself.
//   WRONG_OWNER       — a constraint declared on a process that is not a
//                       member of its own pair.
//   ONE_MEMBER        — a disjoint constraint with a single pair member.
//   BAD_KIND          — an undeclared segregation kind.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const EVALUATION = `
process evaluation {
  name "Evaluation (ISO/IEC 17065 §7.4)"
  activity_kind { selection determination }
}
`;

const SEGREGATED = `
process evaluation {
  name "Evaluation (ISO/IEC 17065 §7.4)"
  activity_kind { selection determination }
}
process review {
  name "Review (ISO/IEC 17065 §7.5)"
  activity_kind { review }
  segregation {
    constraint review_not_evaluation {
      kind case_personnel_disjoint
      clause "7.5.1"
      pair { review evaluation }
      statement "The review shall be carried out by person(s) who have not been involved in the evaluation process."
    }
    constraint review_consultancy_bar {
      kind consultancy_bar
      clause "4.2.10"
      barred { consultancy }
      statement "Within a period specified by the certification body, personnel shall not be used to review a product for which they have provided consultancy."
    }
  }
}
process complaints {
  name "Complaints and appeals (ISO/IEC 17065 §7.13)"
  activity_kind { complaint appeal }
  segregation {
    constraint complaint_resolution_not_case {
      kind case_personnel_disjoint
      clause "7.13.5"
      pair { complaints case_personnel }
      statement "The decision resolving the complaint or appeal shall be made by, or reviewed and approved by, person(s) not involved in the certification activities related to the complaint or appeal."
    }
    constraint complaint_two_year_bar {
      kind consultancy_bar
      clause "7.13.6"
      period P2Y
      barred { consultancy employment }
      statement "Personnel who have provided consultancy for a client, or been employed by a client, shall not be used to review or approve the resolution of a complaint or appeal for that client within two years following the end of the consultancy or employment."
    }
  }
}
`;

const UNKNOWN_MEMBER = `
process review {
  name "Review"
  segregation {
    constraint review_not_evaluation {
      kind case_personnel_disjoint
      clause "7.5.1"
      pair { review divination }
      statement "Seeded violation."
    }
  }
}
`;

const SELF_DISJOINT = `
process review {
  name "Review"
  segregation {
    constraint self_disjoint {
      kind case_personnel_disjoint
      clause "7.5.1"
      pair { review review }
      statement "Seeded violation."
    }
  }
}
`;

const WRONG_OWNER = `
process evaluation {
  name "Evaluation"
}
process decision {
  name "Decision"
}
process review {
  name "Review"
  segregation {
    constraint misplaced {
      kind case_personnel_disjoint
      clause "7.6.2"
      pair { decision evaluation }
      statement "Seeded violation — declared on review, constrains decision."
    }
  }
}
`;

const ONE_MEMBER = `
process review {
  name "Review"
  segregation {
    constraint lonely {
      kind case_personnel_disjoint
      clause "7.5.1"
      pair { review }
      statement "Seeded violation."
    }
  }
}
`;

const BAD_KIND = `
process review {
  name "Review"
  segregation {
    constraint wrong_kind {
      kind role_disjoint
      clause "7.5.1"
      pair { review evaluation }
      statement "Seeded violation."
    }
  }
}
`;

function makePackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-segr-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'package.prl'), body);
  return dir;
}

describe('process segregation facet (TODO.roadmap/39b)', () => {
  it('parses disjoint pairs, bars, periods, and the reserved case_personnel member', () => {
    const m = load(SEGREGATED);
    const review = m.processes.find(p => p.id === 'review')!;
    assert.equal(review.segregation.length, 2);
    const disjoint = review.segregation.find(
      s => s.id === 'review_not_evaluation',
    )!;
    assert.equal(disjoint.kind, 'case_personnel_disjoint');
    assert.equal(disjoint.clause, '7.5.1');
    assert.deepEqual(disjoint.pair, ['review', 'evaluation']);
    assert.equal(disjoint.period, '');
    assert.deepEqual(disjoint.barred, []);
    assert.ok(disjoint.statement.startsWith('The review shall be carried out'));
    const bar = review.segregation.find(
      s => s.id === 'review_consultancy_bar',
    )!;
    assert.equal(bar.kind, 'consultancy_bar');
    assert.equal(bar.clause, '4.2.10');
    assert.deepEqual(bar.pair, []);
    assert.equal(bar.period, '');
    assert.deepEqual(bar.barred, ['consultancy']);
    const complaints = m.processes.find(p => p.id === 'complaints')!;
    const notCase = complaints.segregation.find(
      s => s.id === 'complaint_resolution_not_case',
    )!;
    assert.deepEqual(notCase.pair, ['complaints', 'case_personnel']);
    const twoYear = complaints.segregation.find(
      s => s.id === 'complaint_two_year_bar',
    )!;
    assert.equal(twoYear.period, 'P2Y');
    assert.deepEqual(twoYear.barred, ['consultancy', 'employment']);
    // Untagged processes keep the empty facet.
    assert.deepEqual(
      m.processes.find(p => p.id === 'evaluation')!.segregation,
      [],
    );
  });

  it('round-trips the segregation block losslessly (fixpoint)', () => {
    const m1 = load(SEGREGATED);
    const dumped = dump(m1);
    assert.ok(dumped.includes('segregation {'));
    assert.ok(dumped.includes('constraint review_not_evaluation {'));
    assert.ok(dumped.includes('pair { review evaluation }'));
    assert.ok(dumped.includes('period P2Y'));
    assert.ok(dumped.includes('barred { consultancy employment }'));
    const m2 = load(dumped);
    assert.deepEqual(m2.processes, m1.processes);
    assert.equal(dump(m2), dumped);
  });
});

describe('C59 segregation-members-resolve', () => {
  it('accepts well-formed segregation constraints (incl. the reserved case_personnel member)', () => {
    const issues = checkPackage(makePackage(SEGREGATED)).filter(
      i => i.check === 'C59',
    );
    assert.deepEqual(issues, []);
  });

  it('flags a pair member that is no declared process (seeded violation)', () => {
    const issues = checkPackage(
      makePackage(EVALUATION + UNKNOWN_MEMBER),
    ).filter(i => i.check === 'C59');
    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, 'error');
    assert.ok(issues[0].message.includes('review'));
    assert.ok(issues[0].message.includes('"divination"'));
  });

  it('flags a self-disjoint pair (seeded violation)', () => {
    const issues = checkPackage(makePackage(SELF_DISJOINT)).filter(
      i => i.check === 'C59',
    );
    assert.equal(issues.length, 1);
    assert.ok(issues[0].message.includes('disjoint from itself'));
  });

  it('flags a constraint owned by a process outside its own pair (seeded violation)', () => {
    const issues = checkPackage(makePackage(WRONG_OWNER)).filter(
      i => i.check === 'C59',
    );
    assert.equal(issues.length, 1);
    assert.ok(issues[0].message.includes('misplaced'));
    assert.ok(issues[0].message.includes('"review"'));
  });

  it('flags a disjoint constraint with the wrong member count (seeded violation)', () => {
    const issues = checkPackage(makePackage(ONE_MEMBER)).filter(
      i => i.check === 'C59',
    );
    assert.equal(issues.length, 1);
    assert.ok(issues[0].message.includes('exactly two'));
  });

  it('flags an undeclared kind (seeded violation)', () => {
    const issues = checkPackage(makePackage(BAD_KIND)).filter(
      i => i.check === 'C59',
    );
    assert.equal(issues.length, 1);
    assert.ok(issues[0].message.includes('"role_disjoint"'));
  });

  it('is silent for processes declaring no segregation constraints', () => {
    const issues = checkPackage(makePackage(EVALUATION)).filter(
      i => i.check === 'C59',
    );
    assert.deepEqual(issues, []);
  });
});

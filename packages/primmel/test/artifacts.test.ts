// ─────────────────────────────────────────────────────────────────────
// Artifacts (Primmel v3, TODO.roadmap/09 — gap audit G2): required output
// artifacts of the subject. artifact_definition (IS: content contract +
// produced-when) referenced from the subject's is.artifacts slot;
// artifact_instance (HAS/evidence) from has.artifact_instances.
// Round-trip losslessness + the linter rules
//   C45 artifact-def-contract
//   C46 artifact-instance-resolves
//   C47 artifact-evidence-separation (the MECE firewall)
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

const PACKAGE = `
artifact_definition enforcement-evidence-file {
  name "Enforcement evidence file"
  description "Electronic record the instrument produces per enforcement measurement."
  content_contract {
    fields {
      measured_speed : speed "Speed of the measured vehicle (7.3 d)"
      ego_speed : speed optional "Ego speed, moving measurements (7.3 k)"
      driving_direction : string
      measurement_timestamp : datetime
      site_parameters : structure
      alignment_parameters : structure
      instrument_identification : string
      image_evidence : media optional
    }
    structure "one record per enforcement measurement; images embedded"
    media {
      image_evidence { kinds { jpeg png } role "vehicle identification" }
    }
  }
  produced_when per_measurement
  retention "approx. three months (secure storage)"
  source { doc "urn:oiml:pub:r:91-1:2025" clause "6.6, 7.2.2, 7.3" }
}

artifact_definition diagnostic-log {
  name "Daily diagnostic log"
  content_contract {
    fields { log_timestamp : datetime fault_code : string optional }
  }
  produced_when per_interval P1D
}

artifact_definition fault-report {
  name "Fault report"
  content_contract {
    fields { fault_timestamp : datetime fault_code : string }
  }
  produced_when on_event fault-detected
}

artifact_instance evf-001 {
  of enforcement-evidence-file
  produced_at 2026-09-15T10:14:00Z
  by smp-r91-001
  content {
    measured_speed : 137 km/h
    ego_speed : 98.5 km/h
    driving_direction : "approaching"
    measurement_timestamp : 2026-09-15T10:14:00Z
    site_parameters : "A12, km 114.2, lane 2"
    alignment_parameters : "cosine 25 deg"
    instrument_identification : "SM-9000 SN 4815"
  }
  links { run-stationary-001 trp-r91-001 }
}

subject SpeedMeter {
  is {
    metadata { name "Speed meter" }
    artifacts { enforcement-evidence-file diagnostic-log fault-report }
  }
  has {
    artifact_instances { evf-001 }
  }
}
`;

describe('artifact_definition / artifact_instance (TODO.roadmap/09)', () => {
  it('parses a definition: contract fields, structure, media, produced_when, retention, source', () => {
    const m = load(PACKAGE);
    assert.equal(m.artifactDefinitions.length, 3);
    const d = m.artifactDefinitions[0];
    assert.equal(d.id, 'enforcement-evidence-file');
    assert.equal(d.name, 'Enforcement evidence file');
    assert.equal(
      d.description,
      'Electronic record the instrument produces per enforcement measurement.',
    );
    assert.deepEqual(
      d.contentContract.fields.map(f => [f.name, f.type, f.optional]),
      [
        ['measured_speed', 'speed', false],
        ['ego_speed', 'speed', true],
        ['driving_direction', 'string', false],
        ['measurement_timestamp', 'datetime', false],
        ['site_parameters', 'structure', false],
        ['alignment_parameters', 'structure', false],
        ['instrument_identification', 'string', false],
        ['image_evidence', 'media', true],
      ],
    );
    // Field descriptions (optional trailing quoted string).
    assert.equal(
      d.contentContract.fields[0].description,
      'Speed of the measured vehicle (7.3 d)',
    );
    assert.equal(
      d.contentContract.fields[1].description,
      'Ego speed, moving measurements (7.3 k)',
    );
    assert.equal(d.contentContract.fields[2].description, '');
    assert.equal(
      d.contentContract.structure,
      'one record per enforcement measurement; images embedded',
    );
    assert.deepEqual(d.contentContract.media, [
      {
        field: 'image_evidence',
        kinds: ['jpeg', 'png'],
        role: 'vehicle identification',
      },
    ]);
    assert.deepEqual(d.producedWhen, { kind: 'per_measurement' });
    assert.equal(d.retention, 'approx. three months (secure storage)');
    assert.deepEqual(d.source, {
      doc: 'urn:oiml:pub:r:91-1:2025',
      clause: '6.6, 7.2.2, 7.3',
    });
  });

  it('parses all three produced_when kinds', () => {
    const m = load(PACKAGE);
    assert.deepEqual(m.artifactDefinitions[0].producedWhen, {
      kind: 'per_measurement',
    });
    assert.deepEqual(m.artifactDefinitions[1].producedWhen, {
      kind: 'per_interval',
      interval: 'P1D',
    });
    assert.deepEqual(m.artifactDefinitions[2].producedWhen, {
      kind: 'on_event',
      event: 'fault-detected',
    });
  });

  it('parses an instance: of / produced_at / by / content / links', () => {
    const m = load(PACKAGE);
    assert.equal(m.artifactInstances.length, 1);
    const a = m.artifactInstances[0];
    assert.equal(a.id, 'evf-001');
    assert.equal(a.of, 'enforcement-evidence-file');
    assert.equal(a.producedAt, '2026-09-15T10:14:00Z');
    assert.equal(a.by, 'smp-r91-001');
    assert.deepEqual(a.content.measured_speed, { value: 137, unit: 'km/h' });
    assert.deepEqual(a.content.ego_speed, { value: 98.5, unit: 'km/h' });
    assert.deepEqual(a.content.driving_direction, { value: 'approaching' });
    assert.deepEqual(a.content.measurement_timestamp, {
      value: '2026-09-15T10:14:00Z',
    });
    assert.deepEqual(a.links, ['run-stationary-001', 'trp-r91-001']);
  });

  it('content accepts the QuantityValue block form (INV-1)', () => {
    const m = load(`artifact_instance evf-x {
  of enforcement-evidence-file
  by smp-1
  content {
    measured_speed : { value 137 unit km/h kind speed uncertainty 0.5 }
  }
  links { run-1 }
}
`);
    assert.deepEqual(m.artifactInstances[0].content.measured_speed, {
      value: 137,
      unit: 'km/h',
      quantityKind: 'speed',
      uncertainty: 0.5,
    });
  });

  it('subject slots reference definitions (is) and instances (has)', () => {
    const m = load(PACKAGE);
    const s = m.subjects.find(x => x.id === 'SpeedMeter')!;
    assert.deepEqual(s.is.artifacts, [
      'enforcement-evidence-file',
      'diagnostic-log',
      'fault-report',
    ]);
    assert.deepEqual(s.has.artifactInstances, ['evf-001']);
  });

  it('round-trips losslessly (parse → dump → parse fixed point)', () => {
    const m1 = load(PACKAGE);
    const dumped = dump(m1);
    const m2 = load(dumped);
    assert.deepEqual(m2.artifactDefinitions, m1.artifactDefinitions);
    assert.deepEqual(m2.artifactInstances, m1.artifactInstances);
    assert.deepEqual(m2.subjects, m1.subjects);
    assert.equal(dump(m2), dumped);
  });

  it('extends merges artifact slots as lists — parent entries first', () => {
    const m = load(`
artifact_definition base-file {
  name "Base"
  content_contract { fields { stamp : datetime } }
  produced_when per_measurement
}
artifact_instance base-001 {
  of base-file
  by smp-1
  content { stamp : 2026-01-01T00:00:00Z }
  links { run-1 }
}
artifact_definition child-file {
  name "Child"
  content_contract { fields { stamp : datetime } }
  produced_when per_measurement
}
subject Base {
  is { artifacts { base-file } }
  has { artifact_instances { base-001 } }
}
subject Child {
  extends Base
  is { artifacts { child-file } }
}
`);
    const child = m.subjects.find(x => x.id === 'Child')!;
    assert.deepEqual(child.is.artifacts, ['base-file', 'child-file']);
    assert.deepEqual(child.has.artifactInstances, ['base-001']);
  });
});

// ── linter fixtures ──────────────────────────────────────────────────

/** Write a one-file fixture package and return its directory. */
function makeTmpPackage(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-artifacts-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'artifacts.prl'), body);
  return dir;
}

const CLEAN = `
artifact_definition enforcement-evidence-file {
  name "Enforcement evidence file"
  content_contract {
    fields {
      measured_speed : speed
      measurement_timestamp : datetime
      image_evidence : media optional
    }
    media { image_evidence { kinds { jpeg } role "vehicle identification" } }
  }
  produced_when per_measurement
  retention "approx. three months"
  source { doc "urn:oiml:pub:r:91-1:2025" clause "7.3" }
}
artifact_definition diagnostic-log {
  name "Diagnostic log"
  content_contract { fields { log_timestamp : datetime } }
  produced_when per_interval P1D
}
artifact_definition fault-report {
  name "Fault report"
  content_contract { fields { fault_code : string } }
  produced_when on_event fault-detected
}
artifact_instance evf-001 {
  of enforcement-evidence-file
  produced_at 2026-09-15T10:14:00Z
  by smp-r91-001
  content {
    measured_speed : 137 km/h
    measurement_timestamp : 2026-09-15T10:14:00Z
  }
  links { run-stationary-001 }
}
subject SpeedMeter {
  is { artifacts { enforcement-evidence-file diagnostic-log fault-report } }
  has { artifact_instances { evf-001 } }
}
`;

function artifactIssues(dir: string) {
  return checkPackage(dir).filter(i => ['C45', 'C46', 'C47'].includes(i.check));
}

describe('artifact lint rules (C45/C46/C47)', () => {
  it('stays silent on a clean artifact model', () => {
    assert.deepEqual(
      artifactIssues(makeTmpPackage(CLEAN)),
      [],
      'expected no artifact issues on the clean fixture',
    );
  });

  it('C45 fires on a contract with no fields', () => {
    const dir = makeTmpPackage(`artifact_definition empty {
  name "Empty"
  content_contract { structure "opaque" }
  produced_when per_measurement
}
`);
    const c45 = artifactIssues(dir).filter(i => i.check === 'C45');
    assert.equal(c45.length, 1);
    assert.equal(c45[0].severity, 'error');
    assert.ok(c45[0].message.includes('declares no fields'));
    assert.ok(c45[0].message.includes('(artifact-def-contract)'));
  });

  it('C45 fires on untyped, duplicate, and media-dangling contract fields', () => {
    const dir = makeTmpPackage(`artifact_definition bad {
  name "Bad"
  content_contract {
    fields {
      measured_speed : speed
      measured_speed : speed
      untyped :
    }
    media { ghost { kinds { jpeg } role "nowhere" } }
  }
  produced_when per_measurement
}
`);
    const c45 = artifactIssues(dir).filter(i => i.check === 'C45');
    assert.equal(c45.length, 3);
    assert.ok(
      c45.some(i =>
        i.message.includes('duplicate contract field "measured_speed"'),
      ),
    );
    assert.ok(
      c45.some(i => i.message.includes('contract field "untyped" has no type')),
    );
    assert.ok(c45.some(i => i.message.includes('media entry refines "ghost"')));
  });

  it('C45 fires on malformed produced_when rules', () => {
    const dir = makeTmpPackage(`artifact_definition w1 {
  name "W1"
  content_contract { fields { stamp : datetime } }
  produced_when sometimes
}
artifact_definition w2 {
  name "W2"
  content_contract { fields { stamp : datetime } }
  produced_when per_interval weekly
}
artifact_definition w3 {
  name "W3"
  content_contract { fields { stamp : datetime } }
  produced_when on_event
}
`);
    const c45 = artifactIssues(dir).filter(i => i.check === 'C45');
    assert.equal(c45.length, 3);
    assert.ok(c45.some(i => i.message.includes('produced_when "sometimes"')));
    assert.ok(
      c45.some(i =>
        i.message.includes('per_interval "weekly" is not an ISO-8601 duration'),
      ),
    );
    assert.ok(c45.some(i => i.message.includes('on_event names no event')));
  });

  it('C46 fires on a dangling produces_artifacts id of a conformance test', () => {
    const dir =
      makeTmpPackage(`conformance_test /conf/examinations/evidence-file-examination {
  name "Evidence file examination"
  targets { /req/technical/evidence-file }
  produces_artifacts { ghost-definition }
}
requirement /req/technical/evidence-file {
  name "Evidence file"
}
`);
    const c46 = artifactIssues(dir).filter(i => i.check === 'C46');
    assert.equal(c46.length, 1);
    assert.equal(c46[0].severity, 'error');
    assert.ok(
      c46[0].message.includes(
        'produces_artifacts "ghost-definition" is not a declared artifact_definition',
      ),
    );
  });

  it('C46 fires on dangling subject slot entries', () => {
    const dir = makeTmpPackage(`subject S {
  is { artifacts { no-such-definition } }
  has { artifact_instances { no-such-instance } }
}
`);
    const c46 = artifactIssues(dir).filter(i => i.check === 'C46');
    assert.equal(c46.length, 2);
    assert.ok(
      c46.some(i =>
        i.message.includes('is.artifacts entry "no-such-definition"'),
      ),
    );
    assert.ok(
      c46.some(i =>
        i.message.includes('has.artifact_instances entry "no-such-instance"'),
      ),
    );
  });

  it('C46 fires when the instance `of` does not resolve', () => {
    const dir = makeTmpPackage(`artifact_instance evf-x {
  of ghost-definition
  by smp-1
  content { measured_speed : 137 km/h }
  links { run-1 }
}
`);
    const c46 = artifactIssues(dir).filter(i => i.check === 'C46');
    assert.equal(c46.length, 1);
    assert.equal(c46[0].severity, 'error');
    assert.ok(
      c46[0].message.includes(
        'of "ghost-definition" is not a declared artifact_definition',
      ),
    );
  });

  it('C46 fires on contract violations: undeclared content, missing required fields, no producer', () => {
    const dir = makeTmpPackage(`artifact_definition evf {
  name "EVF"
  content_contract {
    fields {
      measured_speed : speed
      measurement_timestamp : datetime
      image_evidence : media optional
    }
  }
  produced_when per_measurement
}
artifact_instance evf-x {
  of evf
  content {
    measured_speed : 137 km/h
    lab_temperature : 23 degC
  }
  links { run-1 }
}
`);
    const c46 = artifactIssues(dir).filter(i => i.check === 'C46');
    assert.equal(c46.length, 3);
    assert.ok(
      c46.some(i =>
        i.message.includes(
          'content field "lab_temperature" is not in the contract',
        ),
      ),
    );
    assert.ok(
      c46.some(i =>
        i.message.includes('required contract field "measurement_timestamp"'),
      ),
    );
    assert.ok(c46.some(i => i.message.includes('no producer (by)')));
  });

  it('C46 fires when a per_measurement instance links no run/report', () => {
    const dir = makeTmpPackage(`artifact_definition evf {
  name "EVF"
  content_contract { fields { measured_speed : speed } }
  produced_when per_measurement
}
artifact_instance evf-x {
  of evf
  by smp-1
  content { measured_speed : 137 km/h }
}
`);
    const c46 = artifactIssues(dir).filter(i => i.check === 'C46');
    assert.equal(c46.length, 1);
    assert.ok(
      c46[0].message.includes(
        'produced per_measurement but the instance links no run/report',
      ),
    );
    // on_event / per_interval definitions carry no such linking duty.
    const dir2 = makeTmpPackage(`artifact_definition flog {
  name "F"
  content_contract { fields { stamp : datetime } }
  produced_when on_event fault-detected
}
artifact_instance f-1 {
  of flog
  by smp-1
  content { stamp : 2026-01-01T00:00:00Z }
}
`);
    assert.deepEqual(artifactIssues(dir2), []);
  });

  it('C47 fires when a contract field doubles as a test variable (MECE)', () => {
    const dir = makeTmpPackage(`artifact_definition evf {
  name "EVF"
  content_contract { fields { measured_speed : speed } }
  produced_when per_measurement
}
conformance_test /conf/field-test {
  name "Field test"
  variables {
    variable measured_speed { type number unit "km/h" source measured }
  }
}
`);
    const c47 = artifactIssues(dir).filter(i => i.check === 'C47');
    assert.equal(c47.length, 1);
    assert.equal(c47[0].severity, 'error');
    assert.ok(
      c47[0].message.includes(
        'contract field "measured_speed" is also a variable of conformance test /conf/field-test',
      ),
    );
    assert.ok(c47[0].message.includes('output OF the instrument'));
    assert.ok(c47[0].message.includes('(artifact-evidence-separation)'));
  });

  it('C47 fires when a contract field doubles as a form field (MECE, vice versa)', () => {
    const dir = makeTmpPackage(`artifact_definition evf {
  name "EVF"
  content_contract { fields { image_evidence : media } }
  produced_when per_measurement
}
form evidence-form {
  name "Evidence form"
  field image_evidence { label "Image evidence" }
}
`);
    const c47 = artifactIssues(dir).filter(i => i.check === 'C47');
    assert.equal(c47.length, 1);
    assert.ok(
      c47[0].message.includes(
        'contract field "image_evidence" is also a field of form evidence-form',
      ),
    );
  });

  it('C47 stays silent when vocabularies are disjoint', () => {
    const dir = makeTmpPackage(`artifact_definition evf {
  name "EVF"
  content_contract { fields { measured_speed : speed } }
  produced_when per_measurement
}
conformance_test /conf/field-test {
  name "Field test"
  variables {
    variable indicated_speed { type number unit "km/h" source measured }
    variable reference_speed { type number unit "km/h" source measured }
  }
}
`);
    assert.deepEqual(
      artifactIssues(dir).filter(i => i.check === 'C47'),
      [],
    );
  });
});

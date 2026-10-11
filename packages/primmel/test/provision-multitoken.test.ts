import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index';

const MODEL = (body: string) => `root Root

version "v1"

metadata {
  title "T"
  schema "Primmel 0.1"
  namespace "n"
}

reference refISO {
  document "ISO/IEC 17025:2017"
  clause "7.5"
}

${body}
`;

describe('the provision free-form grammar (the multi-token values)', () => {
  it('a multi-token subject value parses where the pairwise walk aborted', () => {
    const std = load(
      MODEL(`provision prov1 {
  subject claims Sample#data
  modality shall
  condition "every sample carries its identifier"
  reference {
    refISO
  }
}
`),
      { strict: true },
    );
    const prov = std.provisions[0];
    assert.deepEqual(
      [...prov.subject.entries()],
      [['subject', 'claims Sample#data']],
    );
    assert.equal(prov.modality, 'shall');
    assert.equal(prov.condition, 'every sample carries its identifier');
    assert.equal((prov.ref ?? [])[0]?.id, 'refISO');
  });

  it('single-token values parse byte-identically to the old form', () => {
    const std = load(
      MODEL(`provision prov2 {
  subject Sample#data
  modality shall
  condition "c"
}
`),
      { strict: true },
    );
    assert.deepEqual(
      [...std.provisions[0].subject.entries()],
      [['subject', 'Sample#data']],
    );
  });

  it('the dump quotes multi-word values so its own output reparses', () => {
    const text = MODEL(`provision prov3 {
  subject claims Sample#data
  condition "c"
}
`);
    const std = load(text, { strict: true });
    const dumped = dump(std);
    assert.match(dumped, /subject "claims Sample#data"/);
    const re = load(dumped, { strict: true });
    assert.deepEqual(
      [...re.provisions[0].subject.entries()],
      [...std.provisions[0].subject.entries()],
    );
  });

  it('single-token subjects dump bare (byte-identical to the corpus)', () => {
    const std = load(
      MODEL(`provision prov4 {
  subject Sample#data
}
`),
      { strict: true },
    );
    assert.doesNotMatch(dump(std), /subject "/);
  });
});

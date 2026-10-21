// ─────────────────────────────────────────────────────────────────────
// The form field's scalar numeric range (kernel#90): min/max parse on
// the field body (numeric literal or the template spelling), dump round
// trips, and C184 field-range-order machine-checks the pair — each
// bound numeric-or-template, a numeric pair ordered min ≤ max. Nested
// fields judge with the same rule.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index';
import { checkFieldRange } from '../src/check';
import type Standard from '../src/types/Standard';

const FORM = (body: string) => `
form twin-1/ranges {
  name "The ranges"
  data_class ProbeRecord#data
  conformance_process /conf/twin-fidelity/probe-creep
  section "S"
  requirements { /req/twin-fidelity/creep-envelope }
${body}
}`;
const FIELD = (name: string, type: string, facets: string) =>
  `    field ${name} : ${type} {
      label "The ${name} field"
      required true
      measurement_method declared
${facets}
    }`;

describe('the field min/max facets (kernel#90)', () => {
  it('numeric and template bounds parse with their kinds', () => {
    const m: any = load(
      FORM(
        FIELD('load', 'number', '      min 0\n      max 50000') +
          '\n' +
          FIELD('temp', 'number', '      min "${{ t_min }}"'),
      ),
    );
    const [loadF, tempF] = m.forms[0].fields;
    assert.equal(loadF.min, 0);
    assert.equal(loadF.max, 50000);
    assert.equal(tempF.min, '${{ t_min }}');
    assert.equal(tempF.max, undefined);
  });

  it('the bounds dump and round-trip byte-stably', () => {
    const src = FORM(FIELD('load', 'number', '      min 0\n      max 50000'));
    const d1 = dump(load(src));
    assert.match(d1, /min 0 max 50000/);
    assert.equal(dump(load(d1)), d1);
  });

  it('C184 passes a well-formed range and flags a reversed one', () => {
    const good = load(
      FORM(FIELD('load', 'number', '      min 0\n      max 50000')),
    ) as unknown as Standard;
    assert.deepEqual(checkFieldRange(good), []);
    const bad = load(
      FORM(FIELD('load', 'number', '      min 50000\n      max 0')),
    ) as unknown as Standard;
    const issues = checkFieldRange(bad);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].check, 'C184');
    assert.match(issues[0].message, /min 50000 > max 0/);
  });

  it('C184 refuses a bound that is neither numeric nor a template', () => {
    const bad = load(
      FORM(FIELD('load', 'number', '      min wide')),
    ) as unknown as Standard;
    const issues = checkFieldRange(bad);
    assert.equal(issues.length, 1);
    assert.match(issues[0].message, /min "wide" is neither a numeric literal/);
  });

  it('C184 judges nested fields with the same rule', () => {
    const bad = load(
      FORM(
        '    field rig : object {\n' +
          '      label "The rig"\n' +
          '      required true\n' +
          '      fields {\n' +
          '        field humidity : number {\n' +
          '          label "The humidity field"\n' +
          '          required true\n' +
          '          min 100\n' +
          '          max 10\n' +
          '        }\n' +
          '      }\n' +
          '    }',
      ),
    ) as unknown as Standard;
    const issues = checkFieldRange(bad);
    assert.equal(issues.length, 1);
    assert.match(
      issues[0].message,
      /field rig\.humidity declares min 100 > max 10/,
    );
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index';

function roundTrip(src: string): string {
  return dump(load(src));
}

describe('round-trip: additional constructs', () => {
  it('preserves a data_registry with a data_class reference', () => {
    const src = `
      data_registry reg1 {
        title "Registry 1"
        data_class dc1
      }
      class dc1 {
        attr1: string { definition "An attr" }
      }
    `;
    const out = roundTrip(src);
    assert.match(out, /data_registry reg1 \{/);
    assert.match(out, /title "Registry 1"/);
    assert.match(out, /data_class dc1/);
    assert.match(out, /class dc1 \{/);
    assert.match(out, /attr1: string \{/);
  });

  it('resolves data_class reference inside data_registry', () => {
    const src = `
      data_registry reg1 {
        title "R1"
        data_class dc1
      }
      class dc1 { attr1: string { definition "x" } }
    `;
    const s = load(src);
    assert.equal(s.regs.length, 1);
    assert.notEqual(s.regs[0].data, null);
    assert.equal(s.regs[0].data!.id, 'dc1');
    assert.equal(s.regs[0].data!.attributes.length, 1);
  });

  it('preserves an enum value definition', () => {
    const src = `
      enum status {
        active { definition "Active status" }
        archived { definition "Archived" }
      }
    `;
    const out = roundTrip(src);
    assert.match(out, /active \{[\s\S]*definition "Active status"/);
    assert.match(out, /archived \{[\s\S]*definition "Archived"/);
  });

  it('preserves an approval with actor, approver, records, and references', () => {
    const src = `
      role author { name "Author" }
      role approver { name "Approver" }
      data_registry reg1 { title "R1" }
      reference ref1 { }
      approval a1 {
        name "A1"
        actor author
        approve_by approver
        modality shall
        approval_record { reg1 }
        reference { ref1 }
      }
    `;
    const out = roundTrip(src);
    assert.match(out, /approval a1 \{/);
    assert.match(out, /actor author/);
    assert.match(out, /approve_by approver/);
    assert.match(out, /approval_record \{/);
    assert.match(out, /reference \{/);
  });

  it('resolves approval.ref as Reference (not Registry)', () => {
    // Previously approval.ref was looked up against registers — wrong type.
    const src = `
      reference r1 { }
      approval a1 {
        name "A"
        modality shall
        reference { r1 }
      }
    `;
    const s = load(src);
    assert.equal(s.approvals.length, 1);
    assert.equal(s.approvals[0].ref.length, 1);
    assert.equal(s.approvals[0].ref[0].id, 'r1');
  });

  it('preserves a Primmel calculation', () => {
    const src = `
      calculation c1 {
        name "Sum"
        expression "a + b"
        inputs {
          a : number { unit "m" }
          b : number { unit "m" }
        }
        output : number { unit "m" }
      }
    `;
    const out = roundTrip(src);
    assert.match(out, /calculation c1 \{/);
    assert.match(out, /expression "a \+ b"/);
    assert.match(out, /inputs \{/);
    assert.match(out, /a : number \{/);
    assert.match(out, /output : number/);
  });

  it('preserves a state_machine definition', () => {
    const src = `
      state_machine sm1 {
        initial draft
        states { draft published }
        transition draft -> published action publish { }
      }
    `;
    const out = roundTrip(src);
    assert.match(out, /state_machine sm1 \{/);
    assert.match(out, /initial draft/);
    assert.match(out, /states \{/);
    assert.match(out, /transition draft -> published/);
    assert.match(out, /action publish/);
  });

  it('preserves a note with a reference', () => {
    const src = `
      reference r1 { }
      note n1 {
        type WARNING
        message "Be careful"
        reference { r1 }
      }
    `;
    const out = roundTrip(src);
    assert.match(out, /note n1 \{/);
    assert.match(out, /type WARNING/);
    assert.match(out, /message "Be careful"/);
    assert.match(out, /reference \{/);
  });

  it('rejects an invalid note type at parse time', () => {
    const src = `note n1 { type FATAL message "x" }`;
    assert.throws(() => load(src), /Unknown type FATAL/);
  });
});

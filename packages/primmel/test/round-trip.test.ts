import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index';

function roundTrip(src: string): string {
  return dump(load(src));
}

describe('round-trip', () => {
  it('preserves root + metadata block ordering', () => {
    const src = `
      root home

      metadata {
        schema "1"
        author "A"
        title "T"
        edition "1"
        namespace "ns"
        shortname "t"
      }

      canvas home {
        elements { }
        process_flow { }
        data { }
      }
    `;
    const out = roundTrip(src);
    assert.match(out, /^root home\b/);
    assert.match(out, /metadata \{/);
  });

  it('preserves a role definition', () => {
    const src = `role author { name "Author" }`;
    const out = roundTrip(src);
    assert.match(out, /role author \{/);
    assert.match(out, /name "Author"/);
  });

  it('preserves an enum definition', () => {
    const src = `
      enum status {
        active { definition "active" }
        archived { definition "archived" }
      }
    `;
    const out = roundTrip(src);
    assert.match(out, /enum status \{/);
    assert.match(out, /active \{/);
    assert.match(out, /archived \{/);
  });

  it('preserves a process with actor reference', () => {
    const src = `
      role author { name "Author" }
      process p {
        name "P"
        actor author
        modality shall
      }
    `;
    const out = roundTrip(src);
    assert.match(out, /process p \{/);
    assert.match(out, /actor author/);
    assert.match(out, /modality shall/);
  });

  it('preserves a subprocess with elements, edges, and data', () => {
    const src = `
      canvas s1 {
        elements {
          e1 { x 0 y 0 }
        }
        process_flow {
          edge1 { from e1 to e1 }
        }
        data {
        }
      }
    `;
    const out = roundTrip(src);
    assert.match(out, /canvas s1 \{/);
    assert.match(out, /elements \{/);
    assert.match(out, /process_flow \{/);
  });

  it('preserves a Primmel form definition', () => {
    const src = `
      form f1 {
        name "Form 1"
      }
    `;
    const out = roundTrip(src);
    assert.match(out, /form f1 \{/);
    assert.match(out, /name "Form 1"/);
  });

  it('preserves a Primmel symbol definition', () => {
    const src = `
      symbol temperature {
        name "Temperature"
        type number
        unit "K"
      }
    `;
    const out = roundTrip(src);
    assert.match(out, /symbol temperature \{/);
    assert.match(out, /unit "K"/);
  });

  it('drops unknown keywords without throwing (forward compat)', () => {
    const src = `
      future_keyword ignored { nothing }
      role author { name "Author" }
    `;
    const s = load(src);
    assert.equal(s.roles.length, 1);
    assert.equal(s.roles[0].id, 'author');
  });

  it('double round-trip is stable: dump(dump(load(src))) === dump(load(src))', () => {
    const src = `
      root home
      metadata {
        schema "1" author "A" title "T" edition "1" namespace "ns" shortname "t"
      }
      role author { name "Author" }
      enum status { active { definition "a" } }
    `;
    const once = roundTrip(src);
    const twice = roundTrip(once);
    assert.equal(once, twice);
  });
});

describe('required_when (the conditional-requiredness facet, v3)', () => {
  it('round-trips an inline ocl{…} condition on a form field', () => {
    const src = `form demo {
  name "Demo"
  field cable_length : number {
    label "Cable length"
    required_when ocl{cable_connection = '4-wire'}
  }
}
`;
    const out = roundTrip(src);
    // The dump normalizes to the quoted form (spaces inside ocl{…});
    // the VALUE round-trips — the quoted form parses back identically.
    assert.match(out, /required_when "ocl\{cable_connection = '4-wire'\}"/);
    assert.equal(roundTrip(out), out);
  });

  it('round-trips a quoted condition', () => {
    const src = `form demo {
  name "Demo"
  field input_impedance : number {
    label "Input impedance"
    required_when "model.classification.technology = 'strain-gauge'"
  }
}
`;
    const out = roundTrip(src);
    assert.match(out, /required_when/);
    assert.match(out, /strain-gauge/);
  });
});

describe('ref (the unified reference/relation construct, spec docs/primmel/18)', () => {
  it('round-trips refs on a form and its fields', () => {
    const src = `form demo {
  name "Demo"
  references { report-format { "urn:oiml:pub:r:60-3:2021#clause-4.7" } }
  ref test-procedure "urn:oiml:pub:r:60-2:2021#clause-2.3"
  field cable_length : number {
    label "Cable length"
    ref derives-from "urn:oiml:pub:r:60-1:2021#clause-3.4.2"
  }
}
`;
    const out = roundTrip(src);
    assert.match(out, /ref test-procedure "urn:oiml:pub:r:60-2:2021#clause-2.3"/);
    assert.match(out, /ref derives-from "urn:oiml:pub:r:60-1:2021#clause-3.4.2"/);
    assert.equal(roundTrip(out), out);
  });

  it('round-trips refs with notes on a requirement', () => {
    const src = `requirement /req/demo {
  name "Demo"
  statement "S"
  ref equivalent "urn:oiml:pub:r:76:2006#clause-T.2.2.2" { note "the shared definition" }
}
`;
    const out = roundTrip(src);
    assert.match(out, /ref equivalent "urn:oiml:pub:r:76:2006#clause-T.2.2.2"/);
    assert.match(out, /note "the shared definition"/);
    assert.equal(roundTrip(out), out);
  });

  it('round-trips a package-level ref (edition lineage)', async () => {
    // The package manifest parses through its own loader (not the document
    // round-trip) — parsePackage/dumpPackage byte-stable.
    const { parsePackage, dumpPackage } = await import('../src/ser-des/config/packageManifest');
    const src = `package {
  id demo
  kind product_reference
  title "Demo"
  version "1"
  editions { 1 }
  status current
  ref supersedes "urn:oiml:pub:r:60:2017"
}
`;
    const ctx: { packageManifest: unknown } = { packageManifest: null };
    parsePackage(src)(ctx as never);
    const out = dumpPackage(ctx.packageManifest as never);
    assert.match(out, /ref supersedes "urn:oiml:pub:r:60:2017"/);
  });
});

describe('predicate (the relation registry, spec docs/primmel/18)', () => {
  it('round-trips a predicate declaration', () => {
    const src = `predicate derives-from {
  kind citation
  description "The element is the model's interpretation of the target clause."
  subject_kinds { requirement conformance_test form field }
  target_kinds { document-anchor }
  resolution must-resolve
}
`;
    const out = roundTrip(src);
    assert.match(out, /predicate derives-from \{/);
    assert.match(out, /kind citation/);
    assert.match(out, /resolution must-resolve/);
    assert.equal(roundTrip(out), out);
  });

  it('rejects an unknown kind', () => {
    assert.throws(() => roundTrip('predicate x {\n  kind sideways\n}\n'), /citation\|semantic/);
  });
});

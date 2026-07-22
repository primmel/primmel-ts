// ─────────────────────────────────────────────────────────────────────
// Characteristics (TODO.roadmap/10) — the subject's quantitative interface,
// DEFINED in the primary model and referenced everywhere else (doctrine
// ch. 02 §2.7):
//   - has.characteristics block form: { symbol, derivation, behavior,
//     quantity_kind, unit, source } alongside the legacy inline
//     `name symbol = derivation` shorthand (round-trip lossless);
//   - verdict symbol/behavior fields (the specification-side transport of
//     the characteristic register);
//   - linter rules:
//       C48 characteristic-one-home
//       C49 characteristic-behavior-link
//       C50 characteristic-derivation-inputs
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, dump } from '../src/ser-des/index';
import { checkPackage } from '../src/check';

/** Write a one-file package to a temp dir and return the dir (checkPackage). */
function makeTmpPackage(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'primmel-characteristics-'));
  writeFileSync(join(dir, 'package.primmel'), 'package { id test }');
  mkdirSync(join(dir, 'model'));
  writeFileSync(join(dir, 'model', 'subject.prl'), content);
  return dir;
}

const PACKAGE = `
behavior creep {
  kind temporal
  stimulus force
  response "Change in load cell output with time under constant load."
}

behavior temp-effect-min-dead-load {
  kind influence-response
  stimulus temperature
  response "Change of the signal output under minimum dead load due to a change in ambient temperature."
}

subject LoadCell {
  is {
    design_parameters { e_max : mass by design }
  }
  has {
    attributes { indication : counts test_dependent }
    characteristics {
      creep {
        symbol "c_c"
        derivation ocl{abs(creep_reading - self.initial_reading)}
        behavior creep
        quantity_kind verification_interval
        unit "v"
        source { doc "urn:oiml:pub:r:60-1:2021" clause "5.5.1" }
      }
      mdlo_normalized {
        symbol "C_M"
        derivation ocl{abs(c_m * t_f / delta_t)}
        behavior temp-effect-min-dead-load
        quantity_kind dimensionless
        source { doc "urn:oiml:pub:r:60-3:2021" clause "2.1.4" }
      }
      drift = ocl{self.indication - self.initial_reading}
    }
  }
  does {
    behavior creep
    behavior temp-effect-min-dead-load
  }
}

symbol c_m { name "MDLO temperature change" }
symbol t_f { name "Temperature increment factor" }
symbol delta_t { name "Temperature step span" }
symbol creep_reading { name "Creep reading" }
`;

describe('has.characteristics block form (TODO.roadmap/10)', () => {
  it('parses the full register entry: symbol, derivation, behavior, quantity_kind, unit, source', () => {
    const m = load(PACKAGE);
    const s = m.subjects.find(x => x.id === 'LoadCell')!;
    assert.deepEqual(s.has.characteristics.creep, {
      symbol: 'c_c',
      derivation: 'ocl{abs(creep_reading - self.initial_reading)}',
      behavior: 'creep',
      quantityKind: 'verification_interval',
      unit: 'v',
      source: { doc: 'urn:oiml:pub:r:60-1:2021', clause: '5.5.1' },
    });
    assert.deepEqual(s.has.characteristics.mdlo_normalized, {
      symbol: 'C_M',
      derivation: 'ocl{abs(c_m * t_f / delta_t)}',
      behavior: 'temp-effect-min-dead-load',
      quantityKind: 'dimensionless',
      source: { doc: 'urn:oiml:pub:r:60-3:2021', clause: '2.1.4' },
    });
  });

  it('keeps the legacy inline form parsing (optional rich fields absent)', () => {
    const m = load(PACKAGE);
    const s = m.subjects.find(x => x.id === 'LoadCell')!;
    assert.deepEqual(s.has.characteristics.drift, {
      symbol: '',
      derivation: 'ocl{self.indication - self.initial_reading}',
    });
  });

  it('mixes block and inline entries in one block', () => {
    const m = load(`subject S {
  has {
    characteristics {
      error e_l = ocl{self.indication - self.reference}
      creep {
        symbol "c_c"
        derivation ocl{abs(creep_reading)}
        behavior creep
        quantity_kind verification_interval
      }
    }
  }
}
`);
    const s = m.subjects[0];
    assert.deepEqual(s.has.characteristics.error, {
      symbol: 'e_l',
      derivation: 'ocl{self.indication - self.reference}',
    });
    assert.equal(s.has.characteristics.creep.behavior, 'creep');
    assert.equal(s.has.characteristics.creep.unit, undefined);
  });

  it('round-trips losslessly: block entries dump as blocks, inline entries stay inline', () => {
    const m1 = load(PACKAGE);
    const text = dump(m1);
    const m2 = load(text);
    const s1 = m1.subjects.find(x => x.id === 'LoadCell')!;
    const s2 = m2.subjects.find(x => x.id === 'LoadCell')!;
    assert.deepEqual(s2.has.characteristics, s1.has.characteristics);
    // The dump really used the block form for rich entries…
    assert.match(text, /creep \{\n/);
    assert.match(text, /behavior creep\n/);
    assert.match(text, /quantity_kind dimensionless\n/);
    assert.match(
      text,
      /source \{ doc "urn:oiml:pub:r:60-3:2021" clause "2.1.4" \}/,
    );
    // …and the inline form for the shorthand entry.
    assert.match(
      text,
      /drift = ocl\{self\.indication - self\.initial_reading\}/,
    );
    // Fixed point: dumping the re-parse is byte-identical.
    assert.equal(dump(m2), text);
  });
});

describe('verdict symbol/behavior (TODO.roadmap/10)', () => {
  it('parses and dumps symbol + behavior on a verdict construct', () => {
    const m = load(`verdict mdlo_normalized {
  symbol "C_M"
  behavior temp-effect-min-dead-load
  quantity { kind dimensionless }
  derive "ocl{abs(c_m * t_f / delta_t * (d_max - d_min) / (n * v_min))}"
  inputs { c_m t_f delta_t d_max d_min n v_min }
  source { doc "urn:oiml:pub:r:60-3:2021" clause "2.1.4" }
}
`);
    const v = m.verdicts[0];
    assert.equal(v.symbol, 'C_M');
    assert.equal(v.behavior, 'temp-effect-min-dead-load');
    const text = dump(m);
    assert.match(text, /symbol "C_M"/);
    assert.match(text, /behavior temp-effect-min-dead-load\n/);
    const m2 = load(text);
    assert.deepEqual(m2.verdicts[0], m.verdicts[0]);
  });
});

describe('C48 characteristic-one-home', () => {
  it('fires when a verdict carries derive while subject characteristics exist', () => {
    const dir = makeTmpPackage(`subject S {
  has {
    characteristics { creep c_c = ocl{self.a} }
  }
}
verdict drift_error {
  quantity { kind ppm }
  derive "ocl{indication - cgm_certified_value}"
  inputs { indication cgm_certified_value }
}
`);
    const c48 = checkPackage(dir).filter(i => i.check === 'C48');
    assert.equal(c48.length, 1);
    assert.match(c48[0].message, /drift_error/);
    assert.match(c48[0].message, /characteristic-one-home/);
  });

  it('stays silent for a view-form verdict (no derive) and without subjects', () => {
    const viewOnly = makeTmpPackage(`subject S {
  has {
    characteristics { creep c_c = ocl{self.a} }
  }
}
verdict creep {
  quantity { kind v }
}
`);
    assert.deepEqual(
      checkPackage(viewOnly).filter(i => i.check === 'C48'),
      [],
    );
    const noSubjects = makeTmpPackage(`verdict drift_error {
  quantity { kind ppm }
  derive "ocl{indication - cgm_certified_value}"
  inputs { indication cgm_certified_value }
}
`);
    assert.deepEqual(
      checkPackage(noSubjects).filter(i => i.check === 'C48'),
      [],
    );
  });
});

describe('C49 characteristic-behavior-link', () => {
  it('fires when the behavior ref does not resolve', () => {
    const dir = makeTmpPackage(`subject S {
  has {
    characteristics {
      creep {
        symbol "c_c"
        derivation ocl{abs(creep_reading)}
        behavior creap
        quantity_kind verification_interval
      }
    }
  }
}
`);
    const c49 = checkPackage(dir).filter(i => i.check === 'C49');
    assert.equal(c49.length, 1);
    assert.match(c49[0].message, /creap/);
    assert.match(c49[0].message, /characteristic-behavior-link/);
  });

  it('stays silent when the behavior resolves (or none is declared)', () => {
    const resolving = makeTmpPackage(`behavior creep { kind temporal }
subject S {
  has {
    characteristics {
      creep {
        symbol "c_c"
        derivation ocl{abs(creep_reading)}
        behavior creep
        quantity_kind verification_interval
      }
      drift = ocl{self.indication - self.initial}
    }
    attributes { indication : counts test_dependent initial : counts test_dependent }
  }
}
`);
    assert.deepEqual(
      checkPackage(resolving).filter(i => i.check === 'C49'),
      [],
    );
  });
});

describe('C50 characteristic-derivation-inputs', () => {
  it('fires on an unresolved self.<p> read and an unresolved bare read', () => {
    const dir = makeTmpPackage(`subject S {
  has {
    characteristics {
      creep {
        symbol "c_c"
        derivation ocl{abs(creep_reading - self.initial_reading)}
        behavior creep
        quantity_kind verification_interval
      }
    }
  }
}
`);
    const c50 = checkPackage(dir).filter(i => i.check === 'C50');
    assert.equal(c50.length, 2);
    assert.ok(c50.some(i => /self\.initial_reading/.test(i.message)));
    assert.ok(c50.some(i => /"creep_reading"/.test(i.message)));
    assert.ok(
      c50.every(i => /characteristic-derivation-inputs/.test(i.message)),
    );
  });

  it('stays silent when reads resolve to subject parameters / behavior I/O symbols', () => {
    const dir = makeTmpPackage(`behavior creep { kind temporal }
symbol creep_reading { name "Creep reading" }
symbol initial_reading { name "Initial reading" }
subject S {
  is {
    design_parameters { e_max : mass by design }
  }
  has {
    attributes { indication : counts test_dependent }
    characteristics {
      creep {
        symbol "c_c"
        derivation ocl{abs(creep_reading - initial_reading)}
        behavior creep
        quantity_kind verification_interval
      }
      error e_l = ocl{self.indication - self.e_max}
    }
  }
}
`);
    assert.deepEqual(
      checkPackage(dir).filter(i => i.check === 'C50'),
      [],
    );
  });

  it('skips prose derivations and function names', () => {
    const dir = makeTmpPackage(`subject S {
  has {
    characteristics {
      repeatability e_r = "dispersion of OUT under repeated identical IN"
      worst w = ocl{max(abs(reading_a), abs(reading_b))}
    }
  }
}
symbol reading_a { name "A" }
symbol reading_b { name "B" }
`);
    assert.deepEqual(
      checkPackage(dir).filter(i => i.check === 'C50'),
      [],
    );
  });
});

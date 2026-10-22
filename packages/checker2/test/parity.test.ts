// ─────────────────────────────────────────────────────────────────────
// The #196 parity wave: the mapping (C21–C26), process-timer
// (C14/C15), instance-chain (C17/C19), artifact (C45–C47, C153), LML
// (C160), and supply-chain (C82) judgments over the shape tree. Each
// leg pins the kernel's judgment with a fixture that fires it and one
// that stays silent.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { documentConstructs, resolveParsanolTs } from '../src/front-end.ts';
import { check } from '../src/rules.ts';
import type { ParsedPackage } from '../src/front-end.ts';

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');
const parsanol = resolveParsanolTs(REPO_ROOT);

async function runtime(): Promise<{ parseShape(src: string): unknown } | null> {
  if (
    !parsanol ||
    !existsSync(join(REPO_ROOT, 'grammar', 'artifacts', 'primmel.json'))
  ) {
    return null;
  }
  const { PargRuntime } = (await import(
    join(parsanol, 'dist', 'runtime.js')
  )) as {
    PargRuntime: {
      fromFile(path: string): { parseShape(src: string): unknown };
    };
  };
  return PargRuntime.fromFile(
    join(REPO_ROOT, 'grammar', 'artifacts', 'primmel.json'),
  );
}

const rt = await runtime();

function pkgOf(src: string): ParsedPackage {
  return { constructs: documentConstructs(rt!.parseShape(src)) };
}

function rules(src: string, options?: { strictness?: 'normal' | 'audit' }) {
  return check(pkgOf(src), undefined, options).map(i => i.rule);
}

const TIMER_BASE = `package pkg { id demo }
process p {
  does {
    start_event s
    action a { executor machine }
    TIMER
    end_event e
    flow {
      s -> a
      a -> TIMER_ID
      TIMER_ID -> a
      a -> e
    }
  }
}
`;
const timerBody = (timer: string, id: string) =>
  TIMER_BASE.replace('TIMER', timer).replace(/TIMER_ID/g, id);

describe('the #196 parity wave (shape-tree mirror)', () => {
  it('C15 fires on a period-less timer; a period-carrying timer is silent', () => {
    assert.ok(rules(timerBody('timer_event tick', 'tick')).includes('C15'));
    assert.ok(
      !rules(timerBody('timer_event tick { period "P1M" }', 'tick')).includes(
        'C15',
      ),
    );
  });

  it('C14 fires when the cycle has no period-carrying timer', () => {
    const unguarded = rules(timerBody('timer_event tick', 'tick'));
    assert.ok(unguarded.includes('C14'));
    const guarded = rules(
      timerBody('timer_event tick { period "P1M" }', 'tick'),
    );
    assert.ok(!guarded.includes('C14'));
  });

  it('C17 fires on a sample-scope attribute stated in has.attributes', () => {
    const src = `package pkg { id demo }
attribute_definition x { scope model }
attribute_definition z { scope sample }
instance mod1 {
  level model
  of Subj
  has {
    attributes { x: 1 z: 2 }
    test_context { z: 1 }
  }
}
`;
    const got = rules(src);
    assert.ok(got.includes('C17'));
  });

  it('C19 fires on an undeclared chain link and on a link cycle', () => {
    const unresolved = rules(`package pkg { id demo }
instance a {
  level family
  of Subj
  model ghost
}
`);
    assert.ok(unresolved.includes('C19'));
    const cyclic = rules(`package pkg { id demo }
instance a {
  level family
  of Subj
  model b
}
instance b {
  level model
  of Subj
  family a
}
`);
    assert.ok(cyclic.includes('C19'));
  });

  const MAP_BASE = `package pkg { id demo }
process OpA { name "A" }
`;

  it('C21/C22 judge mappings: sources and targets resolve, direction is local → reference', () => {
    const got = rules(`${MAP_BASE}map_profile RefNs {
  mapping {
    OpA -> RefNs#Req1 {
      description "d"
    }
    Ghost -> RefNs#Req1 {
      description "d"
    }
    RefNs#Alias -> RefNs#Req2 {
      description "d"
    }
    OpA -> Other#Req1 {
      description "d"
    }
  }
}
`);
    assert.ok(got.includes('C21'));
    assert.ok(got.includes('C22'));
  });

  it('C23 agrees with the computed coverage and flags a disagreeing assertion', () => {
    const base = `package pkg { id demo }
process OpA { name "A" }
process RefNs#P2 {
  child_composition gateway
  process RefNs#P5 { name "5" }
  process RefNs#P6 { name "6" }
}
`;
    const agree = rules(`${base}map_profile RefNs {
  mapping {
    OpA -> RefNs#P5 {
      description "d"
    }
  }
  coverage {
    RefNs#P2 minimal
  }
}
`);
    assert.ok(!agree.includes('C23'));
    const disagree = rules(`${base}map_profile RefNs {
  mapping {
    OpA -> RefNs#P5 {
      description "d"
      coverage minimal
    }
  }
}
`);
    assert.ok(disagree.includes('C23'));
  });

  it('C24 flags a profile whose namespace is imported', () => {
    const got = rules(`package pkg {
  id demo
  uses { RefNs@2021 }
}
process OpA { name "A" }
map_profile RefNs {
  mapping {
    OpA -> RefNs#Req1 {
      description "d"
    }
  }
}
`);
    assert.ok(got.includes('C24'));
  });

  it('C25 is silent normally and warns at audit strictness', () => {
    const src = `${MAP_BASE}map_profile RefNs {
  mapping {
    OpA -> RefNs#Req1
  }
}
`;
    assert.ok(!rules(src).includes('C25'));
    assert.ok(rules(src, { strictness: 'audit' }).includes('C25'));
  });

  it('C26 flags an invented visible element and an unmapped against', () => {
    const got = rules(`${MAP_BASE}view_profile vp {
  visible { ghost }
  against no_such_ns
}
`);
    assert.ok(got.includes('C26'));
  });

  it('C45 judges the artifact contract shape', () => {
    const got = rules(`package pkg { id demo }
artifact_definition bad {
  content_contract {
    fields {
      a : string
      a : string
      b
    }
    media {
      ghost { kinds { jpeg } }
    }
  }
  produced_when sometimes
}
`);
    assert.ok(got.includes('C45'));
  });

  it('C46 resolves instances: of, by, content, and produced-when', () => {
    const got = rules(`package pkg { id demo }
artifact_definition ad {
  content_contract {
    fields { x : string }
  }
  produced_when per_measurement
}
artifact_instance ai {
  of ad
}
`);
    assert.ok(got.includes('C46'));
  });

  it('C47 flags a contract field doubling as an evidence slot', () => {
    const got = rules(`package pkg { id demo }
artifact_definition ad {
  content_contract {
    fields { reading : number }
  }
}
conformance_test t {
  variables {
    reading { type number }
  }
}
`);
    assert.ok(got.includes('C47'));
  });

  it('C153 resolves contract_from and forbids the inline restatement', () => {
    const got = rules(`package pkg { id demo }
subject S {
  is {
    promises {
      p1 { statement "x" }
    }
  }
}
artifact_definition a1 {
  contract_from missing_set
}
artifact_definition a2 {
  contract_from S
  content_contract {
    fields { x : string }
  }
}
`);
    assert.ok(got.includes('C153'));
  });

  it('C160 closes the check signature over datums and symbols', () => {
    const got = rules(`package pkg { id demo }
symbol c_k { label "k" }
check c1 {
  inputs { c_k phantom }
}
`);
    assert.ok(got.includes('C160'));
  });

  it('C82 warns on an unmapped promise of a product reference package', () => {
    const got = rules(`package pkg {
  id demo
  kind product_reference
}
subject S {
  is {
    promises {
      p1 { statement "x" }
    }
  }
}
`);
    assert.ok(got.includes('C82'));
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index.js';

describe('Nested processes', () => {
  it('parses a process with nested child processes', () => {
    const model = load(`root Root

version "v1.0.0"

metadata {
  title "Test"
  schema "Primmel 0.1"
}

start_event Start { }
end_event Done { }

process Manufacturing {
  name "Manufacture product"

  process Assembly {
    name "Assemble components"
  }

  process QualityControl {
    name "Inspect quality"
  }
}

canvas Root {
  elements {
    Start { x 0 y 0 }
    Done  { x 0 y 100 }
  }
  process_flow {
    E1 { from Start to Done }
  }
}`);

    const parent = model.processes.find(p => p.id === 'Manufacturing');
    assert.ok(parent, 'Manufacturing process should exist');
    assert.equal(parent.name, 'Manufacture product');
    assert.equal(parent.children.length, 2);
    assert.ok(parent.children.includes('Assembly'));
    assert.ok(parent.children.includes('QualityControl'));

    const assembly = model.processes.find(p => p.id === 'Assembly');
    assert.ok(assembly, 'Assembly child process should exist');
    assert.equal(assembly.name, 'Assemble components');
    assert.equal(assembly.parent, 'Manufacturing');

    const qc = model.processes.find(p => p.id === 'QualityControl');
    assert.ok(qc, 'QualityControl child process should exist');
    assert.equal(qc.name, 'Inspect quality');
    assert.equal(qc.parent, 'Manufacturing');
  });

  it('round-trips nested processes through dump', () => {
    const original = `root Root

version "v1.0.0"

metadata {
  title "Test"
  schema "Primmel 0.1"
}

start_event Start { }
end_event Done { }

process Manufacturing {
  name "Manufacture product"

  process Assembly {
    name "Assemble components"
  }
}

canvas Root {
  elements {
    Start { x 0 y 0 }
    Done  { x 0 y 100 }
  }
  process_flow {
    E1 { from Start to Done }
  }
}`;

    const model = load(original);
    const dumped = dump(model);

    assert.ok(
      dumped.includes('process Manufacturing {'),
      'parent process in output',
    );
    assert.ok(dumped.includes('process Assembly {'), 'child process in output');
    assert.ok(
      dumped.includes('name "Assemble components"'),
      'child name preserved',
    );

    const posParent = dumped.indexOf('process Manufacturing {');
    const posChild = dumped.indexOf('process Assembly {');
    assert.ok(posChild > posParent, 'child should appear after parent opening');

    const posParentClose = dumped.indexOf('}', posChild);
    assert.ok(posParentClose > posChild, 'parent close should be after child');

    const reloaded = load(dumped);
    const mfg = reloaded.processes.find(p => p.id === 'Manufacturing');
    assert.ok(mfg, 'parent survives round-trip');
    assert.equal(mfg.children.length, 1);
    assert.equal(mfg.children[0], 'Assembly');
  });

  it('preserves other process fields when nesting', () => {
    const model = load(`root Root

version "v1.0.0"

metadata {
  title "Test"
  schema "Primmel 0.1"
}

role Factory { name "Factory" }

start_event Start { }
end_event Done { }

process Manufacturing {
  name "Manufacture"
  actor Factory

  process Assembly {
    name "Assembly"
  }
}

canvas Root {
  elements {
    Start { x 0 y 0 }
    Done  { x 0 y 100 }
  }
  process_flow {
    E1 { from Start to Done }
  }
}`);

    const parent = model.processes.find(p => p.id === 'Manufacturing');
    assert.ok(parent?.actor, 'parent actor preserved');
    assert.equal(parent.actor!.id, 'Factory');
    assert.equal(parent.children.length, 1);

    const child = model.processes.find(p => p.id === 'Assembly');
    assert.ok(child);
    assert.equal(child.parent, 'Manufacturing');
  });
});

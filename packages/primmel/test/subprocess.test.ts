import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index';

describe('subprocess resolution', () => {
  it('populates Subprocess.childs from parsed components', () => {
    // Previously a parser bug: parseSubprocess filled _relations.childs but
    // never Subprocess.childs, so the dumper always saw empty arrays.
    const src = `
      subprocess s1 {
        elements {
          e1 { x 0 y 0 }
        }
        process_flow { }
        data { }
      }
    `;
    const s = load(src);
    assert.equal(s.pages.length, 1);
    const sub = s.pages[0];
    assert.equal(sub.id, 's1');
    assert.equal(sub.childs.length, 1);
    assert.equal(sub.childs[0].x, 0);
    assert.equal(sub.childs[0].y, 0);
  });

  it('resolves a component element reference to a real Node', () => {
    const src = `
      process p1 { name "P1" }
      subprocess s1 {
        elements {
          p1 { x 1 y 2 }
        }
        process_flow { }
        data { }
      }
    `;
    const s = load(src);
    const sub = s.pages[0];
    assert.notEqual(sub.childs[0].element, null);
    assert.equal(sub.childs[0].element!.id, 'p1');
  });

  it('leaves element null when the referenced node does not exist (lenient)', () => {
    const src = `
      subprocess s1 {
        elements {
          ghost { x 0 y 0 }
        }
        process_flow { }
        data { }
      }
    `;
    const s = load(src);
    const sub = s.pages[0];
    assert.equal(sub.childs[0].element, null);
  });

  it('resolves edge from/to to SubprocessComponents within the same subprocess', () => {
    const src = `
      process p1 { name "P1" }
      process p2 { name "P2" }
      subprocess s1 {
        elements {
          p1 { x 0 y 0 }
          p2 { x 1 y 1 }
        }
        process_flow {
          edge1 { from p1 to p2 description "step" }
        }
        data { }
      }
    `;
    const s = load(src);
    const sub = s.pages[0];
    assert.equal(sub.edges.length, 1);
    const edge = sub.edges[0];
    assert.equal(edge.id, 'edge1');
    assert.equal(edge.from?.element?.id, 'p1');
    assert.equal(edge.to?.element?.id, 'p2');
    assert.equal(edge.description, 'step');
  });

  it('leaves edge.from null when the referenced component does not exist', () => {
    const src = `
      process p1 { name "P1" }
      subprocess s1 {
        elements {
          p1 { x 0 y 0 }
        }
        process_flow {
          edge1 { from p1 to ghost }
        }
        data { }
      }
    `;
    const s = load(src);
    const edge = s.pages[0].edges[0];
    assert.equal(edge.from?.element?.id, 'p1');
    assert.equal(edge.to, null);
  });

  it('populates data components alongside elements', () => {
    const src = `
      subprocess s1 {
        elements { }
        process_flow { }
        data {
          d1 { x 5 y 6 }
        }
      }
    `;
    const s = load(src);
    const sub = s.pages[0];
    assert.equal(sub.data.length, 1);
    assert.equal(sub.data[0].x, 5);
    assert.equal(sub.data[0].y, 6);
  });

  it('round-trips element/data/edge content through dump', () => {
    const src = `
      process p1 { name "P1" }
      subprocess s1 {
        elements {
          p1 { x 3 y 4 }
        }
        process_flow {
          e1 { from p1 to p1 }
        }
        data {
          d1 { x 0 y 0 }
        }
      }
    `;
    const out = load(src);
    // The dumper writes element.id, so p1 must appear in the elements block.
    const dumped = dump(out);
    assert.match(dumped, /subprocess s1 \{/);
    assert.match(dumped, /elements \{[\s\S]*p1 \{/);
    assert.match(dumped, /x 3/);
    assert.match(dumped, /y 4/);
    assert.match(dumped, /data \{[\s\S]*d1 \{/);
  });
});

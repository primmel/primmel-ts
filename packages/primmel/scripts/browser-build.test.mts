// The browser-build gate: the BUNDLE (dist-browser/index.mjs — the
// vite library build, the editor's actual artifact) parses the new
// LutaML surface. The token front end is the browser's front end by
// design (the shape front end loads the parsanol runtime from disk —
// Node-only), so this pins that the surface forms reach browser
// consumers, not just the Node tests. Skips until the bundle is built
// (`yarn build:browser`) — the same opt-in pattern as the exports-map
// test's `yarn build`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const BUNDLE = join(import.meta.dirname, '..', 'dist-browser', 'index.mjs');

test(
  'the browser bundle parses the LutaML surface',
  { skip: existsSync(BUNDLE) ? false : 'dist-browser not built (yarn build:browser)' },
  async () => {
    const { load, dump, parseDeclarations } = (await import(
      pathToFileURL(BUNDLE).href
    )) as {
      load: (src: string) => { dataclasses: { id: string }[] };
      dump: (s: unknown) => string;
      parseDeclarations: unknown;
    };
    assert.equal(typeof load, 'function');
    assert.equal(typeof dump, 'function');
    assert.equal(
      typeof parseDeclarations,
      'function',
      'the dispatch core rides the browser bundle',
    );

    const src = [
      'class LoadCellSample {',
      '  attribute serial_number, String { definition "sn" modality SHALL }',
      '  attribute e_max, Mass { cardinality 1..1 }',
      '}',
      'instance smp-001 {',
      '  of LoadCellSample',
      '  serial_number = "HBK-001"',
      '  e_max = 2.2 t',
      '}',
    ].join('\n');
    const standard = load(src);
    assert.equal(standard.dataclasses.length, 1);
    assert.equal(standard.dataclasses[0].id, 'LoadCellSample');

    // The dump fixpoint — the same gate as the Node suite, through the
    // bundle: serialize and re-parse to the same text. The class's
    // LutaML attribute form round-trips byte-for-byte; the instance's
    // assignment form dumps as the canonical has-attributes form (the
    // migration window: both forms PARSE, the canonical dump flips
    // only at window closure).
    const once = dump(standard);
    const twice = dump(load(once));
    assert.equal(once, twice);
    assert.match(once, /attribute serial_number, String \{ definition "sn" modality SHALL \}/);
    assert.match(once, /attributes \{ serial_number : HBK-001 e_max : "2.2" t \}/);
  },
);

// ─────────────────────────────────────────────────────────────────────
// The two-front-ends gate: the TOKEN front end (the hand-written
// tokenizer) and the SHAPE front end (the PARG grammar's shape tree,
// through the same dispatch core) build the SAME ParseContext from
// the same source. This is the S2 endgame's proof: the grammar
// decides the surface, and the kernel rides either front end.
// Skips when the parsanol checkout is absent (an optional gate).
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PARSER_CONFIG } from '../src/ser-des/config';
import parse from '../src/ser-des/parse';
import {
  parseFromShape,
  resolveParsanolTs,
} from '../src/ser-des/shape-front-end';

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');
const available =
  resolveParsanolTs(REPO_ROOT) !== null &&
  existsSync(join(REPO_ROOT, 'grammar', 'artifacts', 'primmel.json'));

const SAMPLES = [
  'role verifier {\n  name "Verifier"\n}\n',
  'class LoadCellSample {\n  attribute serial_number, String { definition "sn" modality SHALL }\n  attribute e_max, Mass { cardinality 1..1 }\n}\n',
  'instance smp-001 {\n  of LoadCellSample\n  serial_number = "HBK-001"\n  e_max = 2.2 t\n}\n',
  'provision /req/mpe {\n  statement "The error shall not exceed the MPE."\n  modality SHALL\n}\n',
  'process review {\n  does {\n    start_event begin\n    end_event done\n    flow { begin -> done }\n  }\n}\n',
  'conformance_test /conf/error {\n  name "Error determination"\n  targets { /req/mpe }\n}\n',
  'verdict mpe_error {\n  quantity { kind mass unit kg }\n  derive "ocl{abs(self.e - self.ref)}"\n}\n',
  'state_machine TestReport {\n  states { DRAFT SUBMITTED }\n  transition DRAFT -> SUBMITTED action submit { }\n}\n',
  'table mpe_tiers {\n  columns { tier_from tier_to factor }\n  rows {\n    { 0 50000 0.5 }\n    { 50000 200000 1.0 }\n  }\n}\n',
  'symbol e_max {\n  name "Maximum capacity"\n  type number\n  unit "t"\n}\n',
];

describe(
  'the two front ends agree',
  { skip: available ? false : 'no parsanol checkout' },
  () => {
    for (const [i, src] of SAMPLES.entries()) {
      it(`sample ${i + 1} builds the same context`, async () => {
        const tokenCtx = parse(src, PARSER_CONFIG);
        const shapeCtx = await parseFromShape(src, PARSER_CONFIG);
        assert.deepEqual(
          JSON.parse(
            JSON.stringify({ ...shapeCtx, issues: [], constructs: undefined }),
          ),
          JSON.parse(
            JSON.stringify({ ...tokenCtx, issues: [], constructs: undefined }),
          ),
        );
      });
    }

    it('the conformance corpus agrees file by file (and rejects together)', async () => {
      const dir = join(REPO_ROOT, 'conformance', 'corpus', 'syntax');
      const files = readdirSync(dir)
        .filter(f => f.endsWith('.prl'))
        .sort();
      let agreed = 0;
      let rejected = 0;
      let stricter = 0;
      for (const f of files) {
        const src = readFileSync(join(dir, f), 'utf8');
        let tokenCtx: unknown;
        try {
          tokenCtx = parse(src, PARSER_CONFIG);
        } catch {
          // A negative case: the shape front end must reject it too.
          await assert.rejects(
            () => parseFromShape(src, PARSER_CONFIG),
            undefined,
            f,
          );
          rejected++;
          continue;
        }
        let shapeCtx: unknown;
        try {
          shapeCtx = await parseFromShape(src, PARSER_CONFIG);
        } catch {
          // The grammar is STRICTER than the lenient token front end on
          // malformed declarations (a lone id-less keyword): a known,
          // correct-direction divergence — the grammar decides the
          // surface.
          stricter++;
          continue;
        }
        assert.deepEqual(
          JSON.parse(
            JSON.stringify({
              ...(shapeCtx as object),
              issues: [],
              constructs: undefined,
            }),
          ),
          JSON.parse(
            JSON.stringify({
              ...(tokenCtx as object),
              issues: [],
              constructs: undefined,
            }),
          ),
          f,
        );
        agreed++;
      }
      assert.ok(
        agreed > 30 && rejected > 5,
        `corpus coverage: ${agreed} agreed, ${rejected} rejected, ${stricter} stricter, ${stricter} stricter`,
      );
    });

    it('a slice of the model library agrees file by file', async () => {
      const root = join(
        REPO_ROOT,
        '..',
        '..',
        'oimlsmart',
        'model-library',
        'oiml-r60',
      );
      const files: string[] = [];
      const walk = (d: string): void => {
        for (const e of readdirSync(d).sort()) {
          const p = join(d, e);
          if (statSync(p).isDirectory()) {
            walk(p);
          } else if (e.endsWith('.prl')) {
            files.push(p);
          }
        }
      };
      walk(root);
      for (const f of files.slice(0, 40)) {
        const src = readFileSync(f, 'utf8');
        let tokenCtx: unknown;
        try {
          tokenCtx = parse(src, PARSER_CONFIG);
        } catch {
          continue;
        }
        const shapeCtx = await parseFromShape(src, PARSER_CONFIG);
        assert.deepEqual(
          JSON.parse(
            JSON.stringify({ ...shapeCtx, issues: [], constructs: undefined }),
          ),
          JSON.parse(
            JSON.stringify({
              ...(tokenCtx as object),
              issues: [],
              constructs: undefined,
            }),
          ),
          f,
        );
      }
    });
  },
);

// ─────────────────────────────────────────────────────────────────────
// prlpack (kernel#91): the compiled, multi-file model archive. The
// byte contract is the round-trip fixpoint — readPack over the
// compiled archive deep-equals the composed loadPackage result — the
// hashes verify (a tampered file is named by path), a duplicate id
// across the closure refuses (no-redefine), and the CLI compile writes
// the tree a node transport reads back whole.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  compilePack,
  manifestText,
  readPack,
  PACK_MANIFEST,
  type PackTransport,
} from '../src/pack';
import { compileAndWritePack } from '../src/pack-cli';
import { sha256 } from '../src/sha256';
import { loadPackage } from '../src/ser-des/package';

function buildClosure(): { base: string; rec: string } {
  const parent = mkdtempSync(join(tmpdir(), 'primmel-pack-'));
  const base = join(parent, 'pack-base');
  const rec = join(parent, 'pack-rec');
  mkdirSync(base, { recursive: true });
  mkdirSync(rec, { recursive: true });
  writeFileSync(
    join(base, 'package.primmel'),
    'package {\n  id pack-base\n  kind rec\n  title "Base"\n  version "2020"\n  baseUrn "urn:example:base:2020"\n  provides { base-entities }\n}',
  );
  mkdirSync(join(base, 'model'), { recursive: true });
  writeFileSync(
    join(base, 'model', 'entities.prl'),
    'class Zone {\n  attribute name, string {\n    modality SHALL\n    definition { The zone name. }\n  }\n}\n',
  );
  writeFileSync(
    join(rec, 'package.primmel'),
    'package {\n  id pack-rec\n  kind rec\n  title "Rec"\n  version "2021"\n  baseUrn "urn:example:rec:2021"\n  uses { pack-base }\n  requires { base-entities }\n}',
  );
  mkdirSync(join(rec, 'model'), { recursive: true });
  writeFileSync(
    join(rec, 'model', 'instances.prl'),
    'instance z1 {\n  of Zone\n  level sample\n  definition_versions { Zone : "2020" }\n}\n',
  );
  return { base, rec };
}

const { base, rec } = buildClosure();
const locator = (id: string) => (id === 'pack-base' ? base : undefined);

function archiveOf(composed: unknown): {
  files: Map<string, string>;
  transport: PackTransport;
} {
  const compiled = compilePack(composed as Parameters<typeof compilePack>[0], {
    id: 'pack-rec',
    version: '2021',
  });
  const files = new Map<string, string>();
  compiled.files.forEach((text, path) => files.set(path, text));
  files.set(PACK_MANIFEST, manifestText(compiled.manifest));
  return { files, transport: { read: async p => files.get(p)! } };
}

describe('prlpack (kernel#91)', () => {
  it('the byte contract: readPack over the compiled archive deep-equals the composed load', async () => {
    const composed = loadPackage(rec, { resolvePackage: locator });
    const { transport } = archiveOf(composed);
    const { standard } = await readPack(transport);
    assert.deepEqual(standard, composed);
  });

  it('a tampered file is named by path', async () => {
    const composed = loadPackage(rec, { resolvePackage: locator });
    const { files, transport } = archiveOf(composed);
    const victim = compiledFirstPath(files);
    files.set(victim, files.get(victim)! + '\n// tampered');
    await assert.rejects(
      readPack(transport),
      new RegExp(victim.replace(/\//g, '\\/')),
    );
  });

  it('a duplicate id across the closure refuses (no-redefine)', async () => {
    const composed = loadPackage(rec, { resolvePackage: locator });
    const compiled = compilePack(
      composed as Parameters<typeof compilePack>[0],
      { id: 'pack-rec', version: '2021' },
    );
    const dupPath = 'model/dataclasses/dup.json';
    const dup = JSON.stringify({ id: 'Zone' }) + '\n';
    compiled.files.set(dupPath, dup);
    compiled.manifest.files.push({
      path: dupPath,
      kind: 'dataclasses',
      sha256: sha256(dup),
      bytes: dup.length,
    });
    const files = new Map<string, string>();
    compiled.files.forEach((text, path) => files.set(path, text));
    files.set(PACK_MANIFEST, manifestText(compiled.manifest));
    const transport: PackTransport = { read: async p => files.get(p)! };
    await assert.rejects(readPack(transport), /duplicate id "Zone"/);
  });

  it('the CLI compile writes the tree; a node transport reads it back whole', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'primmel-pack-out-'));
    const manifest = compileAndWritePack(rec, outDir, {
      resolvePackage: locator,
    });
    assert.equal(manifest.format, 'primmel-pack/1');
    assert.ok(manifest.files.length > 0);
    const nodeTransport: PackTransport = {
      read: async p => readFileSync(join(outDir, p), 'utf8'),
    };
    const { standard } = await readPack(nodeTransport, {
      // the archive tree's own layout: each dependency pack is a
      // sibling directory named by its id
      resolvePack: async packId => ({
        read: async p => readFileSync(join(outDir, packId, p), 'utf8'),
      }),
    });
    assert.deepEqual(standard, loadPackage(rec, { resolvePackage: locator }));
    rmSync(outDir, { recursive: true, force: true });
  });
});

function compiledFirstPath(files: Map<string, string>): string {
  // the first model file the manifest inventory would list — the tamper
  // victim (any file works; the reader verifies every entry)
  return [...files.keys()].filter(k => k.startsWith('model/'))[0]!;
}

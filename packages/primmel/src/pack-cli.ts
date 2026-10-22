/**
 * The pack COMPILER's node half (kernel#91): the filesystem transport —
 * load the package closure, compile the composed Standard into the
 * archive tree, write it. The Worker-safe reader lives in pack.ts; this
 * module is the CLI's (`primmel pack <dir> --out <dir>`), so node:fs is
 * its business.
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import type { ResolvePackage } from './ser-des/package';
import { loadPackageWithIssues } from './ser-des/package';
import { compilePack, manifestText, PACK_MANIFEST } from './pack';
import { sha256 } from './sha256';
import { sha256Bytes } from './sha256';

/** Compile the package at `dir` (its full uses closure composed) into
 *  the archive tree at `outDir`: `pack.primmel.json` + `model/**` +
 *  `doc/**` (the package's sources-prd bytes, when it ships them).
 *  Returns the manifest. */
export function compileAndWritePack(
  dir: string,
  outDir: string,
  opts: { resolvePackage?: ResolvePackage } = {},
): ReturnType<typeof compilePack>['manifest'] {
  // The closure FIRST: every uses dependency compiles to its own
  // sibling archive (outDir/<pack-id>/), the root's manifest pinning
  // each with { pack, at, sha256-of-its-manifest } — referenced, never
  // embedded (the --fat variant is the embedding follow-up).
  const loaded = loadPackageWithIssues(dir, {
    resolvePackage: opts.resolvePackage,
  });
  const providers = loaded.composition?.providers ?? [];
  const requires: Array<{ pack: string; at: string; sha256: string }> = [];
  for (const p of providers) {
    const dep = compileAndWritePack(p.dir, join(outDir, p.id), opts);
    requires.push({
      pack: dep.id,
      at: dep.version,
      sha256: sha256(manifestText(dep)),
    });
  }
  const standard = loaded.standard;
  // The identity rides the composed package manifest (the parsed one,
  // not the raw text).
  const pkg =
    (standard as unknown as { packageManifest?: Record<string, unknown> })
      .packageManifest ?? {};
  const compiled = compilePack(
    standard as unknown as Parameters<typeof compilePack>[0],
    {
      id: String(pkg.id ?? ''),
      version: String(pkg.version ?? ''),
      ...(pkg.kind !== undefined ? { kind: String(pkg.kind) } : {}),
      ...(pkg.edition !== undefined ? { edition: String(pkg.edition) } : {}),
      ...(pkg.baseUrn !== undefined ? { baseUrn: String(pkg.baseUrn) } : {}),
      requires,
    },
  );
  mkdirSync(outDir, { recursive: true });
  compiled.files.forEach((text, path) => {
    const full = join(outDir, path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, text);
  });
  writeFileSync(join(outDir, PACK_MANIFEST), manifestText(compiled.manifest));
  // The doc layer: the package's sources-prd bytes, hashed in the
  // manifest's inventory as kind 'doc'.
  const prd = join(dir, 'sources-prd');
  if (existsSync(prd)) {
    const docDir = join(outDir, 'doc', 'sources-prd');
    mkdirSync(docDir, { recursive: true });
    for (const f of readdirSync(prd)) {
      copyFileSync(join(prd, f), join(docDir, f));
      compiled.manifest.files.push({
        path: `doc/sources-prd/${f}`,
        kind: 'doc',
        sha256: sha256File(join(docDir, f)),
        bytes: statSize(join(docDir, f)),
      });
    }
    compiled.manifest.files.sort((a, b) => a.path.localeCompare(b.path));
    writeFileSync(join(outDir, PACK_MANIFEST), manifestText(compiled.manifest));
  }
  return compiled.manifest;
}

function sha256File(path: string): string {
  // The pack's own pure digest — the same implementation the compiler
  // and the reader share (node:crypto stays out of the pack modules).
  return sha256Bytes(readFileSync(path));
}

function statSize(path: string): number {
  return statSync(path).size;
}

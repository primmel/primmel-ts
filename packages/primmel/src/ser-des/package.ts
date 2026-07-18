// ─────────────────────────────────────────────────────────────────────
// Package loader (Primmel v2, gap G8).
//
// A Recommendation package is ONE directory:
//   <dir>/package.primmel     — manifest (the only required file)
//   <dir>/model/*.prl         — instrument/attributes/capabilities/behaviors/conditions
//   <dir>/entities/*.prl      — storable classes
//   <dir>/specification/**/*.prl — requirements/conformance/tables/symbols/calcs
//   <dir>/execution/**/*.prl  — forms/subforms/test-report
//   <dir>/evaluation/*.prl    — workflow/state-machines/processes/roles/etc.
//   <dir>/*.prl               — terminology/references/notes/etc. (root level)
//
// Merge semantics: files are preprocessed (includes resolved) and parsed
// TOGETHER (single token stream), so cross-file references resolve and
// duplicate IDs across files are detected by the parser's dupChecker.
// Deterministic order: manifest first, then files sorted by path.
// ─────────────────────────────────────────────────────────────────────

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import Standard from '../types/Standard';
import parse from './parse';
import resolveFromConfig from './resolve';
import { PARSER_CONFIG, RESOLVER_CONFIG } from './config';
import { preprocessIncludes } from './includes';
import { parsePackage } from './config/packageManifest';
import type { LoadOptions, LoadResult } from './index';
import type { PackageManifest } from '../types/Package';

const CONVENTION_DIRS = [
  'model',
  'entities',
  'specification',
  'execution',
  'evaluation',
];

function collectPrlFiles(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) {
    return out;
  }
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectPrlFiles(full));
    } else if (entry.endsWith('.prl') || entry.endsWith('.mmel')) {
      out.push(full);
    }
  }
  return out;
}

export interface PackageFile {
  path: string;
  role: 'manifest' | 'content';
}

/** Enumerate the files a package merge will load (manifest first, sorted rest). */
export function packageFiles(dir: string): PackageFile[] {
  const abs = resolve(dir);
  const files: PackageFile[] = [];
  const manifestPath = join(abs, 'package.primmel');
  if (existsSync(manifestPath)) {
    files.push({ path: manifestPath, role: 'manifest' });
  }
  const content: string[] = [];
  for (const sub of CONVENTION_DIRS) {
    content.push(...collectPrlFiles(join(abs, sub)));
  }
  // Root-level .prl files (terminology/references/notes/etc.), excluding the manifest.
  for (const entry of readdirSync(abs).sort()) {
    const full = join(abs, entry);
    if (
      statSync(full).isFile() &&
      (entry.endsWith('.prl') || entry.endsWith('.mmel')) &&
      entry !== 'package.primmel'
    ) {
      content.push(full);
    }
  }
  content.sort();
  for (const p of content) {
    files.push({ path: p, role: 'content' });
  }
  return files;
}

/**
 * Load a Recommendation package directory into one merged Standard.
 * The manifest is attached as `standard.packageManifest`.
 */
export function loadPackage(dir: string, options: LoadOptions = {}): Standard {
  return loadPackageInternal(dir, options).standard;
}

function loadPackageInternal(
  dir: string,
  options: LoadOptions = {},
): LoadResult {
  const files = packageFiles(dir);
  if (files.length === 0) {
    throw new Error(`loadPackage: no package files found in ${resolve(dir)}`);
  }

  let manifest: PackageManifest | null = null;
  const chunks: string[] = [];
  for (const f of files) {
    if (f.role === 'manifest') {
      const text = readFileSync(f.path, 'utf8');
      const ctx = { packageManifest: null as PackageManifest | null };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parsePackage(text)(ctx as any);
      manifest = ctx.packageManifest;
      if (!manifest || !manifest.id) {
        throw new Error(
          `loadPackage: ${f.path} is not a valid package manifest`,
        );
      }
    } else {
      chunks.push(preprocessIncludes(f.path));
    }
  }

  // Parse all content files as ONE token stream: cross-file refs resolve,
  // duplicate IDs across files are caught by the dupChecker.
  const ctx = parse(chunks.join('\n\n'), PARSER_CONFIG, options);
  if (manifest) {
    ctx.packageManifest = manifest;
  }
  const standard = resolveFromConfig(ctx, RESOLVER_CONFIG);
  return { standard, issues: ctx.issues };
}

/** Like loadPackage(), but also returns parse-time issues (e.g. duplicate
 *  IDs ACROSS package files — the merge parses all content as one stream). */
export function loadPackageWithIssues(
  dir: string,
  options: LoadOptions = {},
): LoadResult {
  return loadPackageInternal(dir, options);
}

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
//
// Provenance (opt-in): loadPackageWithProvenance() additionally reports,
// for every top-level construct, the source file it was parsed from (and
// the construct's file-local span), so tools can save package-aware
// instead of degenerating to a single-file dump. The merge itself is
// untouched: same joined stream, same parse, same resolution.
// ─────────────────────────────────────────────────────────────────────

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import Standard from '../types/Standard';
import parse from './parse';
import resolveFromConfig from './resolve';
import { PARSER_CONFIG, RESOLVER_CONFIG } from './config';
import { preprocessIncludes } from './includes';
import { parsePackage } from './config/packageManifest';
import type { Position } from './tokenize';
import type { LoadOptions, LoadResult } from './index';
import type { PackageManifest } from '../types/Package';
import type { ParsedConstruct, ParseContext } from './types';
import type { ValidationIssue } from '../validate';

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
  // Root-level .prl files (terminology/references/notes/etc.), excluding the
  // manifest and the linter's allowlist (.primmel-allowlist.prl — package
  // metadata for `primmel check`, not package content; check-allowlist.ts).
  for (const entry of readdirSync(abs).sort()) {
    const full = join(abs, entry);
    if (
      statSync(full).isFile() &&
      (entry.endsWith('.prl') || entry.endsWith('.mmel')) &&
      entry !== 'package.primmel' &&
      entry !== '.primmel-allowlist.prl'
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
 *
 * When `options.resolvePackage` is given and the manifest declares `uses`
 * (or the deprecated `extends`), the whole dependency closure is composed
 * (see composePackage); otherwise only this directory is loaded.
 */
export function loadPackage(
  dir: string,
  options: LoadPackageOptions = {},
): Standard {
  return loadPackageInternal(dir, options).standard;
}

// ─────────────────────────────────────────────────────────────────────
// Per-file provenance (opt-in): which file each top-level construct was
// parsed from. The merge still parses ONE joined token stream per
// package; the loader records each content file's range in that stream
// and maps the parser's construct spans (ParseOptions.withProvenance)
// back to file-local positions. File attribution is by the construct's
// leading keyword token. `include "..."` directives are inlined before
// tokenization, so a construct pulled in by an include attributes to the
// INCLUDING file (the unit the package merge reads).
// ─────────────────────────────────────────────────────────────────────

/** A source position inside a package content file. */
export interface ProvenancePosition {
  /** 1-based line. */
  line: number;
  /** 1-based column (UTF-16 code units). */
  col: number;
  /** 0-based character offset (UTF-16 code units). */
  offset: number;
}

/** Where one top-level construct came from. */
export interface ConstructSource {
  /** Absolute path of the file the construct was parsed from. */
  file: string;
  /** Id of the package that file belongs to. Absent only when the loaded
      directory carries no manifest. Under `uses` composition this names
      the DECLARING package, never the importer. */
  package?: string;
  /** File-local span of the declaration, keyword through payload. */
  span: { start: ProvenancePosition; end: ProvenancePosition };
}

/**
 * The per-file provenance of one package load: every top-level construct
 * the merge parsed, keyed by its Standard collection (the ParseContext
 * field names: `requirements`, `terms`, `instruments`, ...) and its id.
 * The id-less singletons key under their keyword with id ''
 * (`constructs.metadata['']`). A duplicate id records the declaration
 * that won the merge (the last one, matching parser overwrite semantics;
 * the duplicate itself is a parse issue, never silent here).
 */
export interface PackageProvenance {
  /** Absolute path of the root package's manifest, when one was loaded. */
  manifest?: string;
  constructs: Record<string, Record<string, ConstructSource>>;
}

export interface PackageLoadResult extends LoadResult {
  provenance: PackageProvenance;
}

/** A construct reference: the Standard collection + the construct id. */
export interface ConstructRef {
  field: string;
  id: string;
}

export interface SourceFileGroups<T extends ConstructRef> {
  /** Absolute file path to the refs parsed from that file, input order. */
  byFile: Map<string, T[]>;
  /** Refs with no provenance entry (constructs authored after the load);
      the caller assigns their file by the package's conventions. */
  unassigned: T[];
}

/**
 * The inverse of the load for a package-aware save: partition construct
 * references by their source file, one group per file to write back.
 * What a group becomes on disk (full-file re-serialization or a span
 * splice at the recorded range) is the caller's choice; the kernel only
 * attests where each construct came from.
 */
export function groupBySourceFile<T extends ConstructRef>(
  provenance: PackageProvenance,
  refs: readonly T[],
): SourceFileGroups<T> {
  const byFile = new Map<string, T[]>();
  const unassigned: T[] = [];
  for (const ref of refs) {
    const source = provenance.constructs[ref.field]?.[ref.id];
    if (!source) {
      unassigned.push(ref);
      continue;
    }
    const group = byFile.get(source.file);
    if (group) {
      group.push(ref);
    } else {
      byFile.set(source.file, [ref]);
    }
  }
  return { byFile, unassigned };
}

/**
 * Like loadPackageWithIssues(), but also reports the per-file provenance
 * of every top-level construct (PackageProvenance). The merged Standard,
 * the issues, and the composition info are byte-identical to a plain
 * loadPackage() of the same directory: provenance is an observation of
 * the merge, never a change to it.
 */
export function loadPackageWithProvenance(
  dir: string,
  options: LoadPackageOptions = {},
): PackageLoadResult {
  const result = loadPackageInternal(dir, options, true);
  if (!result.provenance) {
    // Unreachable: the internal load always builds provenance when asked.
    throw new Error('loadPackageWithProvenance: provenance not collected');
  }
  return { ...result, provenance: result.provenance };
}

/** One content file's preprocessed text plus its range in the joined
 *  stream the parser sees (start offset and 1-based start line). The
 *  join separator is '\n\n', so a chunk always starts at column 1. */
interface FileChunk {
  path: string;
  text: string;
  start: number;
  lineStart: number;
}

function countNewlines(text: string): number {
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charAt(i) === '\n') {
      n++;
    }
  }
  return n;
}

/** The content files of a package directory as join-ready chunks. */
function chunkify(files: PackageFile[]): FileChunk[] {
  const chunks: FileChunk[] = [];
  let offset = 0;
  let line = 1;
  for (const f of files) {
    if (f.role !== 'content') {
      continue;
    }
    const text = preprocessIncludes(f.path);
    chunks.push({ path: f.path, text, start: offset, lineStart: line });
    offset += text.length + 2;
    line += countNewlines(text) + 2;
  }
  return chunks;
}

function joinChunks(chunks: FileChunk[]): string {
  return chunks.map(c => c.text).join('\n\n');
}

/** Map the parser's joined-stream construct spans to per-file sources.
 *  Constructs arrive in source order and chunks are in join order, so a
 *  two-pointer walk attributes each construct in O(1) amortized. */
function mapConstructs(
  parsed: ParsedConstruct[],
  chunks: FileChunk[],
  packageId: string | undefined,
): Record<string, Record<string, ConstructSource>> {
  const out: Record<string, Record<string, ConstructSource>> = {};
  let ci = 0;
  for (const c of parsed) {
    while (ci + 1 < chunks.length && c.start.offset >= chunks[ci + 1].start) {
      ci++;
    }
    const chunk = chunks[ci];
    const local = (p: Position): ProvenancePosition => ({
      line: p.line - chunk.lineStart + 1,
      col: p.col,
      offset: p.offset - chunk.start,
    });
    const source: ConstructSource = {
      file: chunk.path,
      ...(packageId !== undefined ? { package: packageId } : {}),
      span: { start: local(c.start), end: local(c.end) },
    };
    (out[c.field] ??= {})[c.id] = source;
  }
  return out;
}

/** Read + parse the manifest of the package at `dir`. Throws when absent
 *  or id-less. */
export function readPackageManifest(path: string): PackageManifest {
  const manifestPath = join(resolve(path), 'package.primmel');
  if (!existsSync(manifestPath)) {
    throw new Error(
      `loadPackage: no package.primmel found in ${resolve(path)}`,
    );
  }
  const text = readFileSync(manifestPath, 'utf8');
  const ctx = { packageManifest: null as PackageManifest | null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parsePackage(text)(ctx as any);
  const manifest = ctx.packageManifest;
  if (!manifest || !manifest.id) {
    throw new Error(
      `loadPackage: ${manifestPath} is not a valid package manifest`,
    );
  }
  return manifest;
}

type InternalLoadResult = LoadResult & { provenance?: PackageProvenance };

function loadPackageInternal(
  dir: string,
  options: LoadPackageOptions = {},
  withProvenance = false,
): InternalLoadResult {
  const files = packageFiles(dir);
  if (files.length === 0) {
    throw new Error(`loadPackage: no package files found in ${resolve(dir)}`);
  }

  let manifest: PackageManifest | null = null;
  if (files.some(f => f.role === 'manifest')) {
    manifest = readPackageManifest(dir);
  }
  const chunks = chunkify(files);

  // `uses` composition (TODO.roadmap/05): with a package locator and a
  // manifest declaring imports, load the whole dependency closure and
  // merge it in topological order with no-redefine semantics.
  if (
    manifest &&
    options.resolvePackage &&
    effectiveUses(manifest).length > 0
  ) {
    return composePackage(dir, options, manifest, withProvenance);
  }

  // Parse all content files as ONE token stream: cross-file refs resolve,
  // duplicate IDs across files are caught by the dupChecker.
  const parseOptions = withProvenance
    ? { ...options, withProvenance: true }
    : options;
  const ctx = parse(joinChunks(chunks), PARSER_CONFIG, parseOptions);
  if (manifest) {
    ctx.packageManifest = manifest;
    const deprecated = extendsDeprecationIssue(manifest);
    if (deprecated) {
      ctx.issues.push(deprecated);
    }
  }
  const standard = resolveFromConfig(ctx, RESOLVER_CONFIG);
  const result: InternalLoadResult = { standard, issues: ctx.issues };
  if (withProvenance) {
    const manifestFile = files.find(f => f.role === 'manifest')?.path;
    result.provenance = {
      ...(manifestFile !== undefined ? { manifest: manifestFile } : {}),
      constructs: mapConstructs(ctx.constructs ?? [], chunks, manifest?.id),
    };
  }
  return result;
}

/** Like loadPackage(), but also returns parse-time issues (e.g. duplicate
 *  IDs ACROSS package files — the merge parses all content as one stream). */
export function loadPackageWithIssues(
  dir: string,
  options: LoadPackageOptions = {},
): LoadResult {
  return loadPackageInternal(dir, options);
}

// ─────────────────────────────────────────────────────────────────────
// `uses` composition (TODO.roadmap/05) — multi-package topological merge.
//
// A rec = core + N modules + its own overlay. The closure of the root
// manifest's `uses` list (with `extends` treated as a single deprecated
// entry) is resolved through the caller's locator, topologically ordered
// (DFS post-order, deterministic — uses are visited in declared order),
// and merged into ONE Standard:
//   - id-space references resolve ACROSS packages (the merged context is
//     resolved as a whole, exactly like a single-package load);
//   - an overlay may REFERENCE upstream ids but never REDEFINE them — a
//     second declaration of the same id in a downstream package is a load
//     error naming both packages (uses-no-redefine);
//   - cycles in the uses graph are load errors naming the cycle;
//   - post-merge, every `requires` entry must name a composed package id
//     or one of its `provides` entries (error), and every `provides`
//     entry must be required or waived by a downstream package (warning).
// ─────────────────────────────────────────────────────────────────────

/** Locates a package directory by package id (the `uses` resolver). */
export type ResolvePackage = (id: string) => string | undefined;

export interface LoadPackageOptions extends LoadOptions {
  /**
   * Package locator for `uses` composition. When provided and the root
   * manifest declares `uses`/`extends`, the dependency closure is
   * composed; without it the single directory loads as before.
   */
  resolvePackage?: ResolvePackage;
}

export interface CompositionInfo {
  /** Root package id (the one loadPackage was called with). */
  root: string;
  /** Package ids in merge order: dependencies first, root last. */
  order: string[];
}

export type CompositionRule =
  'uses-resolves' | 'uses-no-redefine' | 'uses-cycle' | 'requires-satisfied';

/** A composition failure — a hard load error. checkPackage reports these
 *  as linter issues C27–C29 and C31 instead of throwing. */
export class CompositionError extends Error {
  constructor(
    public readonly rule: CompositionRule,
    message: string,
  ) {
    super(message);
    this.name = 'CompositionError';
  }
}

/**
 * The effective import list: `uses` entries plus the deprecated single
 * `extends` (treated as one more uses entry), first occurrence wins.
 */
export function effectiveUses(manifest: PackageManifest): string[] {
  const out: string[] = [];
  for (const u of [
    ...(manifest.uses ?? []),
    ...(manifest.extends ? [manifest.extends] : []),
  ]) {
    if (!out.includes(u)) {
      out.push(u);
    }
  }
  return out;
}

function extendsDeprecationIssue(m: PackageManifest): ValidationIssue | null {
  if (!m.extends) {
    return null;
  }
  return {
    severity: 'warning',
    code: 'extends-deprecated',
    construct: 'package',
    id: m.id,
    message: `package "${m.id}": 'extends ${m.extends}' is deprecated — declare 'uses { ${m.extends} }' instead (extends is treated as a single-entry uses)`,
  };
}

/** The id-keyed ParseContext collections that merge across packages. */
const MERGE_FIELDS: (keyof ParseContext)[] = [
  'approvals',
  'roles',
  'processes',
  'pages',
  'gateways',
  'regs',
  'references',
  'provisions',
  'dataclasses',
  'events',
  'enums',
  'variables',
  'notes',
  'tables',
  'figures',
  'links',
  'mapProfiles',
  'viewProfiles',
  'terms',
  'forms',
  'subforms',
  'symbols',
  'calculations',
  'verdicts',
  'referenceMaterials',
  'testPointSets',
  'competenceKinds',
  'constraints',
  'discrepancyRecords',
  'stateMachines',
  'conformanceTests',
  'conformanceClasses',
  'requirements',
  'requirementClasses',
  'instruments',
  'attributeDefinitions',
  'capabilities',
  'behaviors',
  'conditionSets',
  'subjects',
  'instances',
  'quantityRegisters',
  'duals',
  // The architecture invariants (smart gap-close E9) merge like the
  // note collection they replace — doctrine declared in a foundation
  // package (oiml-smart-core) composes into every rec model.
  'invariants',
  // The required test orderings (smart gap-close E10) merge like the
  // invariants — today the sequences live in a rec package's
  // supplemental YAML; as model content they compose through `uses`
  // like every doctrine collection, with uses-no-redefine protection.
  'testSequences',
  // The per-test evaluation-formula traces (smart gap-close E11) merge
  // like the invariants/test sequences — today the traces live in a rec
  // package's supplemental YAML; as model content they compose through
  // `uses` like every doctrine collection, with uses-no-redefine
  // protection.
  'formulasUsed',
  'texts',
];

/** Parse one package's content files (manifest excluded) as a single
 *  stream, keeping each file's joined-stream range for provenance. */
function parsePackageContent(
  dir: string,
  options: LoadOptions,
): { ctx: ParseContext; chunks: FileChunk[] } {
  const chunks = chunkify(packageFiles(dir));
  const ctx = parse(joinChunks(chunks), PARSER_CONFIG, options);
  return { ctx, chunks };
}

function composePackage(
  rootDir: string,
  options: LoadPackageOptions,
  rootManifest: PackageManifest,
  withProvenance = false,
): InternalLoadResult {
  const locate = options.resolvePackage!;
  const rootId = rootManifest.id;
  const dirs = new Map<string, string>([[rootId, resolve(rootDir)]]);
  const manifests = new Map<string, PackageManifest>([[rootId, rootManifest]]);

  // Resolve the uses graph and order it topologically (dependencies
  // first, root last). DFS post-order over the declared uses order —
  // deterministic for a given manifest set.
  const order: string[] = [];
  const color = new Map<string, number>(); // 1 = in stack, 2 = done
  const stack: string[] = [];
  const visit = (id: string): void => {
    color.set(id, 1);
    stack.push(id);
    for (const dep of effectiveUses(manifests.get(id)!)) {
      const c = color.get(dep) ?? 0;
      if (c === 1) {
        throw new CompositionError(
          'uses-cycle',
          `uses cycle: ${[...stack.slice(stack.indexOf(dep)), dep].join(' → ')} — package composition must be acyclic (uses-cycle)`,
        );
      }
      if (c === 2) {
        continue;
      }
      if (!dirs.has(dep)) {
        const dir = locate(dep);
        if (!dir) {
          throw new CompositionError(
            'uses-resolves',
            `package "${id}" uses "${dep}", which the package locator cannot resolve (uses-resolves)`,
          );
        }
        const m = readPackageManifest(dir);
        if (m.id !== dep) {
          throw new CompositionError(
            'uses-resolves',
            `package "${id}" uses "${dep}", but the located package (${resolve(dir)}) declares id "${m.id}" (uses-resolves)`,
          );
        }
        dirs.set(dep, dir);
        manifests.set(dep, m);
        if (m.kind === 'product_reference') {
          // Abstract import (TODO.roadmap/36, doctrine ch. 15 §15.3
          // mode 1): a product reference package is CITED at a pinned
          // edition, never content-merged — the import is reference
          // content, not structural inclusion (the consumer maps to it:
          // C24 exempts the edge). The edge is located, id-checked and
          // pin-checked (C83), but contributes nothing to the merge
          // order and its own uses closure is not traversed — a
          // point-in-time import composes nothing downstream.
          color.set(dep, 2);
          continue;
        }
      }
      visit(dep);
    }
    stack.pop();
    color.set(id, 2);
    order.push(id);
  };
  visit(rootId);

  // Parse each package's content as one stream (intra-package duplicates
  // are caught by the dupChecker), then merge in topological order with
  // provenance-tracked no-redefine semantics.
  const parseOptions = withProvenance
    ? { ...options, withProvenance: true }
    : options;
  const ctxs = new Map<string, ParseContext>();
  const pkgChunks = new Map<string, FileChunk[]>();
  for (const id of order) {
    const parsed = parsePackageContent(dirs.get(id)!, parseOptions);
    ctxs.set(id, parsed.ctx);
    pkgChunks.set(id, parsed.chunks);
  }
  const provenance = new Map<string, Map<string, string>>();
  for (const field of MERGE_FIELDS) {
    provenance.set(field, new Map());
  }
  const acc = ctxs.get(order[0]!)!;
  for (const field of MERGE_FIELDS) {
    for (const key of Object.keys(acc[field] as Record<string, unknown>)) {
      provenance.get(field)!.set(key, order[0]!);
    }
  }
  for (const id of order.slice(1)) {
    const next = ctxs.get(id)!;
    for (const field of MERGE_FIELDS) {
      const target = acc[field] as Record<string, unknown>;
      const pm = provenance.get(field)!;
      for (const [key, value] of Object.entries(
        next[field] as Record<string, unknown>,
      )) {
        const prior = pm.get(key);
        if (prior !== undefined) {
          // The overlay marker (Extension: explicit redefine for terms).
          // Authors set `overlay true` inside a term body when their
          // definition intentionally supersedes an upstream package's
          // (e.g. ISO/IEC 17065:2012 `impartiality` overriding
          // ISO/IEC 17000:2020's). Composition honours the marker;
          // last-write-wins for overlay=true entries.
          const isOverlay =
            field === 'terms' &&
            typeof value === 'object' &&
            value !== null &&
            (value as { overlay?: boolean }).overlay === true;
          if (!isOverlay) {
            throw new CompositionError(
              'uses-no-redefine',
              `package "${id}" redefines ${String(field)} id "${key}" already declared by package "${prior}" — an overlay may reference upstream ids, never redefine them (uses-no-redefine)`,
            );
          }
          // Fall through: overlay term replaces the prior entry.
        }
        target[key] = value;
        pm.set(key, id);
      }
    }
    acc.issues.push(...next.issues);
    if (!acc.metadata && next.metadata) {
      acc.metadata = next.metadata;
    }
  }

  // Post-merge: every requires entry names a composed package id or one
  // of its provides entries (satisfied by the composed set, not by the
  // requiring package itself).
  for (const id of order) {
    const m = manifests.get(id)!;
    for (const req of m.requires ?? []) {
      const satisfied = order.some(
        other =>
          other !== id &&
          (other === req ||
            (manifests.get(other)!.provides ?? []).includes(req)),
      );
      if (!satisfied) {
        throw new CompositionError(
          'requires-satisfied',
          `package "${id}" requires "${req}", which no package in the composition provides (requires-satisfied)`,
        );
      }
    }
  }

  // Every provides entry must be consumed by a downstream package (its
  // requires) or explicitly waived — a warning, not an error. The root
  // package has no downstream, so its provides are exempt.
  const compositionIssues: ValidationIssue[] = [];
  order.forEach((id, i) => {
    const m = manifests.get(id)!;
    const downstream = order.slice(i + 1);
    for (const p of m.provides ?? []) {
      const consumed = downstream.some(o =>
        (manifests.get(o)!.requires ?? []).includes(p),
      );
      const waived = downstream.some(o =>
        (manifests.get(o)!.waives ?? []).some(
          w => w === p || w === `${id}:${p}`,
        ),
      );
      if (!consumed && !waived) {
        compositionIssues.push({
          severity: 'warning',
          code: 'provides-unconsumed',
          construct: 'package',
          id: `${id}:${p}`,
          message: `package "${id}" provides "${p}", which no downstream package requires or waives (provides-consumed-or-waived)`,
        });
      }
    }
  });
  for (const m of manifests.values()) {
    const deprecated = extendsDeprecationIssue(m);
    if (deprecated) {
      compositionIssues.push(deprecated);
    }
  }

  acc.packageManifest = rootManifest;
  const standard = resolveFromConfig(acc, RESOLVER_CONFIG);
  const result: InternalLoadResult = {
    standard,
    issues: [...acc.issues, ...compositionIssues],
    composition: { root: rootId, order },
  };
  if (withProvenance) {
    // Fold in merge order with last-write-wins, mirroring the merge
    // exactly: illegal redefines threw above (uses-no-redefine), so the
    // only overwrites possible here are the legal overlay=true terms,
    // whose provenance must name the OVERLAYING package's file.
    const constructs: Record<string, Record<string, ConstructSource>> = {};
    for (const id of order) {
      const perPackage = mapConstructs(
        ctxs.get(id)!.constructs ?? [],
        pkgChunks.get(id)!,
        id,
      );
      for (const [field, byId] of Object.entries(perPackage)) {
        const target = (constructs[field] ??= {});
        for (const [constructId, source] of Object.entries(byId)) {
          target[constructId] = source;
        }
      }
    }
    result.provenance = {
      manifest: join(resolve(rootDir), 'package.primmel'),
      constructs,
    };
  }
  return result;
}

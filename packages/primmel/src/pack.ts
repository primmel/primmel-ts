/**
 * prlpack — the compiled, multi-file model archive (kernel#91). The
 * authoring form (a .prl source tree) is never the distribution form:
 * `compilePack` turns a COMPOSED, LINKED package into the archive —
 * `pack.primmel.json` (the manifest: the identity, the pinned+hashed
 * interlink closure, the file inventory) plus `model/**` (the composed
 * model graph in kernel-canonical JSON, one file per construct entry so
 * a consumer loads only what its surface reads) and `doc/**` (the
 * package's sources-prd layer, when it ships one).
 *
 * The reader is transport-agnostic and Worker-safe: `PackTransport`
 * abstracts "read a path to text" (fetch in a Worker, node:fs in the
 * CLI), `readPack` verifies every file's sha256, reassembles the
 * graph, resolves the pinned closure recursively, and merges with
 * no-redefine semantics — producing the same composed Standard the
 * build-time load produces.
 *
 * The byte contract: the canonical serializer's round-trip fixpoint —
 * `readPack(compilePack(loadPackage(dir)))` deep-equals
 * `loadPackage(dir)`.
 */

import type Standard from './types/Standard';
import { sha256 } from './sha256';

export const PACK_FORMAT = 'primmel-pack/1';
export const PACK_MANIFEST = 'pack.primmel.json';

/** One pinned interlink: a dependency pack, its version pin, and the
 *  sha256 of THAT pack's manifest (the closure verified transitively). */
export interface PackRequire {
  pack: string;
  at: string;
  sha256: string;
}

/** One archived file: its path, its construct kind (or 'doc'), the
 *  sha256, and the byte length. */
export interface PackFile {
  path: string;
  kind: string;
  sha256: string;
  bytes: number;
}

export interface PackManifest {
  format: string;
  id: string;
  version: string;
  kind?: string;
  edition?: string;
  baseUrn?: string;
  spellings?: string[];
  supersedes?: string[];
  requires: PackRequire[];
  files: PackFile[];
  /** The consumer's signature hook rides here untouched (the CNML/
   *  XMLDSig machinery signs the manifest; the kernel never reads it). */
  signature?: Record<string, unknown>;
}

/** The read side's path→text transport: fetch in a Worker, readFileSync
 *  in the CLI. Paths are the manifest's own. */
export interface PackTransport {
  read(path: string): Promise<string>;
}

/** A composed closure entry: the compiled files + the manifest, for one
 *  package (the root or a uses dependency). */
export interface CompiledPack {
  manifest: PackManifest;
  /** path → file text (canonical JSON). */
  files: Map<string, string>;
}

const encoder = new TextEncoder();
const byteLength = (text: string): number => encoder.encode(text).length;

const fileKey = (field: string, id: string): string =>
  `model/${field}/${encodeURIComponent(id)}.json`;

const singleKey = (field: string): string => `model/${field}.json`;

const isRecordArray = (v: unknown): v is Array<Record<string, unknown>> =>
  Array.isArray(v) &&
  (v.length === 0 || (typeof v[0] === 'object' && v[0] !== null));

/**
 * Compile one COMPOSED Standard into the archive files. Id-keyed
 * construct arrays split per entry (`model/<field>/<encoded-id>.json`);
 * everything else (singletons, scalar arrays) lands as one file per
 * field. `doc/` rides from the caller (the sources-prd bytes) — the
 * compiler is the model graph's, not the doc tree's copier.
 */
export function compilePack(
  standard: Standard,
  base: {
    id: string;
    version: string;
    kind?: string;
    edition?: string;
    baseUrn?: string;
    spellings?: string[];
    supersedes?: string[];
    requires?: PackRequire[];
  },
): CompiledPack {
  const files = new Map<string, string>();
  const inventory: PackFile[] = [];
  const put = (path: string, kind: string, text: string): void => {
    files.set(path, text);
    inventory.push({
      path,
      kind,
      sha256: sha256(text),
      bytes: byteLength(text),
    });
  };

  for (const [field, value] of Object.entries(
    standard as unknown as Record<string, unknown>,
  )) {
    if (value === undefined) {
      continue;
    }
    if (isRecordArray(value)) {
      const entries = value as Array<Record<string, unknown>>;
      if (
        entries.length > 0 &&
        entries.every(e => typeof e.id === 'string' && e.id.length > 0)
      ) {
        for (const entry of entries) {
          put(
            fileKey(field, entry.id as string),
            field,
            JSON.stringify(entry, null, 1) + '\n',
          );
        }
        continue;
      }
      put(singleKey(field), field, JSON.stringify(value, null, 1) + '\n');
    } else {
      put(singleKey(field), field, JSON.stringify(value, null, 1) + '\n');
    }
  }

  const manifest: PackManifest = {
    format: PACK_FORMAT,
    id: base.id,
    version: base.version,
    ...(base.kind ? { kind: base.kind } : {}),
    ...(base.edition ? { edition: base.edition } : {}),
    ...(base.baseUrn ? { baseUrn: base.baseUrn } : {}),
    ...(base.spellings?.length ? { spellings: base.spellings } : {}),
    ...(base.supersedes?.length ? { supersedes: base.supersedes } : {}),
    requires: base.requires ?? [],
    files: inventory.sort((a, b) => a.path.localeCompare(b.path)),
  };
  return { manifest, files };
}

/** The manifest's own text (canonical order — the hash pinned by
 *  dependents covers this exact shape). */
export function manifestText(manifest: PackManifest): string {
  return JSON.stringify(manifest, null, 1) + '\n';
}

/** The pack's model files reassembled into a Standard — every file's
 *  sha256 verified against the manifest, duplicate ids a hard error. */
export function assemblePack(
  manifest: PackManifest,
  read: (path: string) => Promise<string>,
): Promise<Standard> {
  const merged: Record<string, unknown> = {};
  const seenIds = new Map<string, string>();
  const modelFiles = manifest.files.filter(f => f.path.startsWith('model/'));
  return (async () => {
    for (const f of modelFiles) {
      const text = await read(f.path);
      const actual = sha256(text);
      if (actual !== f.sha256) {
        throw new Error(
          `[pack] ${f.path}: sha256 mismatch — the manifest pins ${f.sha256}, the bytes hash ${actual} (the pack is corrupt or was edited after compile)`,
        );
      }
      const parsed = JSON.parse(text) as unknown;
      const m = f.path.match(/^model\/([^/]+)\//);
      if (m) {
        // The per-entry spelling (model/<field>/<encoded-id>.json): the
        // file holds ONE entry — wrap it into the field's array.
        const field = m[1]!;
        const target = (merged[field] ??= []) as unknown[];
        target.push(parsed);
      } else {
        const field = f.path.slice('model/'.length, -5);
        if (Array.isArray(parsed)) {
          const target = (merged[field] ??= []) as unknown[];
          target.push(...parsed);
        } else {
          merged[field] = parsed;
        }
      }
    }
    for (const [field, items] of Object.entries(merged)) {
      if (!Array.isArray(items)) {
        continue;
      }
      for (const item of items as unknown[]) {
        const id = (item as Record<string, unknown>)?.id;
        if (typeof id !== 'string') {
          continue;
        }
        const owner = seenIds.get(id);
        if (owner !== undefined) {
          throw new Error(
            `[pack] duplicate id "${id}" across ${owner} and ${field} — a pack composes with no-redefine semantics`,
          );
        }
        seenIds.set(id, field);
      }
    }
    return merged as unknown as Standard;
  })();
}

/** Read one pack (the manifest + its model files), then recursively
 *  resolve the pinned requires through `resolvePack` (a dependency's
 *  pack id → its transport), merging the whole closure with no-redefine
 *  semantics. Returns the composed Standard + every manifest read. */
export async function readPack(
  transport: PackTransport,
  opts: {
    resolvePack?: (packId: string, at: string) => Promise<PackTransport>;
  } = {},
): Promise<{ standard: Standard; manifests: PackManifest[] }> {
  const manifest = JSON.parse(
    await transport.read(PACK_MANIFEST),
  ) as PackManifest;
  if (manifest.format !== PACK_FORMAT) {
    throw new Error(
      `[pack] ${PACK_MANIFEST}: format "${manifest.format}" is not ${PACK_FORMAT}`,
    );
  }
  const manifests: PackManifest[] = [manifest];
  const standard = await assemblePack(manifest, p => transport.read(p));
  const mergeInto = (
    into: Record<string, unknown>,
    from: Record<string, unknown>,
  ): void => {
    for (const [field, items] of Object.entries(from)) {
      if (!Array.isArray(items)) {
        continue;
      }
      const target = (into[field] ??= []) as unknown[];
      for (const item of items) {
        const id = (item as Record<string, unknown>)?.id;
        if (
          typeof id === 'string' &&
          target.some(t => (t as Record<string, unknown>)?.id === id)
        ) {
          continue; // the shared dependency entry — merge once
        }
        target.push(item);
      }
    }
  };
  const merged: Record<string, unknown> = {
    ...(standard as unknown as Record<string, unknown>),
  };
  for (const req of manifest.requires ?? []) {
    const depTransport = (await opts.resolvePack?.(req.pack, req.at)) ?? null;
    if (!depTransport) {
      throw new Error(
        `[pack] the pinned dependency "${req.pack}@${req.at}" has no resolver — supply resolvePack (the worker fetches, the CLI reads the checkout)`,
      );
    }
    const dep = await readPack(depTransport, opts);
    manifests.push(...dep.manifests);
    mergeInto(merged, dep.standard as unknown as Record<string, unknown>);
  }
  return { standard: merged as unknown as Standard, manifests };
}

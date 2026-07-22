// ─────────────────────────────────────────────────────────────────────
// `.prm` — the STANDALONE serialization of the mapping primitive
// (TODO.roadmap/04; concept doc §5.5). A .prm file is JSON, versioned
// independently of the models it links:
//
//   {
//     "@context": "https://bsi-ribose-smart.org",
//     "@type": "Primmel_MAP",
//     "id": "OrgO-to-StandardS",
//     "mapSet": {
//       "StdS": {
//         "id": "StdS",
//         "mappings": {
//           "OpA": { "StdS#Process5": {
//             "description": "Batch logging fulfils the record requirement.",
//             "justification": "The roaster writes the record on completion."
//           } }
//         }
//       }
//     }
//   }
//
// v2 compatibility: `@type` "MMEL_MAP" (the 2021 .map seed) is READ as an
// alias of "Primmel_MAP"; the authored @type and target spellings (bare
// or Namespace#ElementID) are preserved verbatim — load/dump is a fixed
// point on the normalized model. v3 adds the optional per-pair
// "coverage" assertion (full | minimal | partial | none), which the
// linter (C23) checks against the computed calculus.
//
// `mapSet` is keyed by TARGET (reference) namespace: one implementation
// may map to many reference models, with coverage computed per target
// (concept doc §5.6 c).
// ─────────────────────────────────────────────────────────────────────

import type MapProfile from '../types/MapProfile';
import type { CoverageLevel, MappingPair } from '../types/MapProfile';

/** Per-pair metadata as carried in a .prm mappings object. */
export interface PrmPairMeta {
  description: string;
  justification: string;
  /** Authored coverage assertion ('' = none) — checked by C23. */
  coverage: CoverageLevel | '';
}

/** One target namespace of a .prm file. */
export interface PrmMapSetEntry {
  id: string;
  /** source id → { target id → per-pair metadata } */
  mappings: Record<string, Record<string, PrmPairMeta>>;
  /**
   * Authored coverage assertions about reference components
   * (regression tripwires — C23-checked against the calculus).
   */
  coverage: Record<string, CoverageLevel>;
}

/** A parsed .prm mapping file. */
export interface PrmFile {
  /** The authored `@context` ('' when absent). */
  context: string;
  /** The authored `@type` ("MMEL_MAP" v2 or "Primmel_MAP" v3). */
  type: string;
  id: string;
  /** Target namespace → the mappings into it. */
  mapSet: Record<string, PrmMapSetEntry>;
}

const KNOWN_TYPES = new Set(['MMEL_MAP', 'Primmel_MAP']);
const COVERAGE_LEVELS = new Set<CoverageLevel>([
  'full',
  'minimal',
  'partial',
  'none',
]);

function fail(message: string): never {
  throw new Error(`.prm parse error: ${message}`);
}

function readPairMeta(raw: unknown, where: string): PrmPairMeta {
  const meta: PrmPairMeta = {
    description: '',
    justification: '',
    coverage: '',
  };
  if (raw === null || raw === undefined) {
    return meta;
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    fail(`${where}: pair metadata must be an object`);
  }
  const obj = raw as Record<string, unknown>;
  if (obj.description !== undefined) {
    if (typeof obj.description !== 'string') {
      fail(`${where}: "description" must be a string`);
    }
    meta.description = obj.description;
  }
  if (obj.justification !== undefined) {
    if (typeof obj.justification !== 'string') {
      fail(`${where}: "justification" must be a string`);
    }
    meta.justification = obj.justification;
  }
  if (obj.coverage !== undefined) {
    if (
      typeof obj.coverage !== 'string' ||
      !COVERAGE_LEVELS.has(obj.coverage as CoverageLevel)
    ) {
      fail(
        `${where}: "coverage" must be one of full | minimal | partial | none`,
      );
    }
    meta.coverage = obj.coverage as CoverageLevel;
  }
  return meta;
}

/**
 * Parse a .prm JSON string. Accepts the v2 (`MMEL_MAP`) and v3
 * (`Primmel_MAP`) @type spellings; preserves the authored target
 * spellings (bare ids are scoped by their mapSet namespace at
 * interpretation time — see parseTargetRef in src/mapping-coverage.ts).
 */
export function loadPrm(json: string): PrmFile {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    fail(`invalid JSON — ${(e as Error).message}`);
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    fail('top level must be an object');
  }
  const obj = raw as Record<string, unknown>;
  const type = typeof obj['@type'] === 'string' ? obj['@type'] : '';
  if (!KNOWN_TYPES.has(type)) {
    fail(`"@type" must be MMEL_MAP or Primmel_MAP (got "${type}")`);
  }
  const prm: PrmFile = {
    context: typeof obj['@context'] === 'string' ? obj['@context'] : '',
    type,
    id: typeof obj.id === 'string' ? obj.id : '',
    mapSet: {},
  };
  const mapSet = obj.mapSet ?? {};
  if (typeof mapSet !== 'object' || mapSet === null || Array.isArray(mapSet)) {
    fail('"mapSet" must be an object keyed by target namespace');
  }
  for (const [ns, entryRaw] of Object.entries(
    mapSet as Record<string, unknown>,
  )) {
    if (
      typeof entryRaw !== 'object' ||
      entryRaw === null ||
      Array.isArray(entryRaw)
    ) {
      fail(`mapSet."${ns}": entry must be an object`);
    }
    const entryObj = entryRaw as Record<string, unknown>;
    const entry: PrmMapSetEntry = {
      id: typeof entryObj.id === 'string' ? entryObj.id : ns,
      mappings: {},
      coverage: {},
    };
    const coverageRaw = entryObj.coverage ?? {};
    if (
      typeof coverageRaw !== 'object' ||
      coverageRaw === null ||
      Array.isArray(coverageRaw)
    ) {
      fail(`mapSet."${ns}".coverage: must be an object`);
    }
    for (const [ref, levelRaw] of Object.entries(
      coverageRaw as Record<string, unknown>,
    )) {
      if (
        typeof levelRaw !== 'string' ||
        !COVERAGE_LEVELS.has(levelRaw as CoverageLevel)
      ) {
        fail(
          `mapSet."${ns}".coverage."${ref}": must be one of full | minimal | partial | none`,
        );
      }
      entry.coverage[ref] = levelRaw as CoverageLevel;
    }
    const mappings = entryObj.mappings ?? {};
    if (
      typeof mappings !== 'object' ||
      mappings === null ||
      Array.isArray(mappings)
    ) {
      fail(`mapSet."${ns}".mappings: must be an object`);
    }
    for (const [source, targetsRaw] of Object.entries(
      mappings as Record<string, unknown>,
    )) {
      if (
        typeof targetsRaw !== 'object' ||
        targetsRaw === null ||
        Array.isArray(targetsRaw)
      ) {
        fail(`mapSet."${ns}".mappings."${source}": must be an object`);
      }
      const targets: Record<string, PrmPairMeta> = {};
      for (const [target, metaRaw] of Object.entries(
        targetsRaw as Record<string, unknown>,
      )) {
        targets[target] = readPairMeta(
          metaRaw,
          `mapSet."${ns}".mappings."${source}"."${target}"`,
        );
      }
      entry.mappings[source] = targets;
    }
    prm.mapSet[ns] = entry;
  }
  return prm;
}

/**
 * Serialize a .prm mapping file. The authored `@type` and target
 * spellings round-trip verbatim (v2 files stay v2-spelled); `@context`
 * is emitted only when present. Key order is the model's insertion
 * order, so load(dump(load(json))) is a fixed point.
 */
export function dumpPrm(prm: PrmFile): string {
  const out: Record<string, unknown> = {};
  if (prm.context) {
    out['@context'] = prm.context;
  }
  out['@type'] = prm.type || 'Primmel_MAP';
  out.id = prm.id;
  const mapSet: Record<string, unknown> = {};
  for (const [ns, entry] of Object.entries(prm.mapSet)) {
    const mappings: Record<string, unknown> = {};
    for (const [source, targets] of Object.entries(entry.mappings)) {
      const t: Record<string, unknown> = {};
      for (const [target, meta] of Object.entries(targets)) {
        const m: Record<string, unknown> = {
          description: meta.description,
          justification: meta.justification,
        };
        if (meta.coverage) {
          m.coverage = meta.coverage;
        }
        t[target] = m;
      }
      mappings[source] = t;
    }
    const outEntry: Record<string, unknown> = { id: entry.id, mappings };
    if (Object.keys(entry.coverage ?? {}).length > 0) {
      outEntry.coverage = entry.coverage;
    }
    mapSet[ns] = outEntry;
  }
  out.mapSet = mapSet;
  return JSON.stringify(out, null, 2) + '\n';
}

/**
 * Bridge a .prm file into in-model map profiles (one per mapSet
 * namespace) so the linter and the coverage engine treat both
 * serializations uniformly.
 */
export function prmToMapProfiles(prm: PrmFile): MapProfile[] {
  const profiles: MapProfile[] = [];
  for (const [ns, entry] of Object.entries(prm.mapSet)) {
    const mappings: Record<string, MappingPair[]> = {};
    for (const [source, targets] of Object.entries(entry.mappings)) {
      mappings[source] = Object.entries(targets).map(([target, meta]) => ({
        target,
        description: meta.description,
        justification: meta.justification,
        coverage: meta.coverage,
      }));
    }
    profiles.push({
      namespace: ns,
      description: '',
      mappings,
      coverage: { ...(entry.coverage ?? {}) },
    });
  }
  return profiles;
}

/** Bridge in-model map profiles into a standalone .prm file. */
export function mapProfilesToPrm(id: string, profiles: MapProfile[]): PrmFile {
  const prm: PrmFile = {
    context: '',
    type: 'Primmel_MAP',
    id,
    mapSet: {},
  };
  for (const profile of profiles) {
    const entry: PrmMapSetEntry = {
      id: profile.namespace,
      mappings: {},
      coverage: { ...(profile.coverage ?? {}) },
    };
    for (const [source, pairs] of Object.entries(profile.mappings)) {
      const targets: Record<string, PrmPairMeta> = {};
      for (const pair of pairs) {
        targets[pair.target] = {
          description: pair.description,
          justification: pair.justification,
          coverage: pair.coverage,
        };
      }
      entry.mappings[source] = targets;
    }
    prm.mapSet[profile.namespace] = entry;
  }
  return prm;
}

// ─────────────────────────────────────────────────────────────────────
// Package-dir diff loading (TODO.roadmap/28) — the node side of the
// model diff: load two package directories, collect their standalone
// .prm mappings (the check.ts discovery pattern) and, on request, their
// sources-prd sentence payloads (the rewording classifier's input), then
// run the pure engine (model-diff.ts). Pure for testing: every I/O edge
// is this module's; diffStandards never touches the disk.
// ─────────────────────────────────────────────────────────────────────

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import type Standard from './types/Standard';
import type { ValidationIssue } from './validate';
import { loadPackageWithIssues, type ResolvePackage } from './ser-des/package';
import { loadPrm, prmToMapProfiles } from './ser-des/prm';
import { mappingsFromProfile, type MappingRecord } from './mapping-coverage';
import {
  clauseTextKey,
  diffStandards,
  normalizeSourceRef,
  type ClauseTextIndex,
  type ModelDiff,
  type ModelDiffOptions,
} from './model-diff';

export interface PackageDiffOptions extends ModelDiffOptions {
  /** Package locator for `uses` composition (the check.mts --with map). */
  resolvePackage?: ResolvePackage;
  /**
   * Also read `sources-prd/<part>.sentences.json` payloads on both sides
   * and classify renumbered clauses as same-text / differed (the
   * rewording detector). Off by default — structural drift needs none.
   */
  compareTexts?: boolean;
}

export interface PackageDiffResult {
  diff: ModelDiff;
  standardA: Standard;
  standardB: Standard;
  issuesA: ValidationIssue[];
  issuesB: ValidationIssue[];
}

/** In-model map profiles + standalone .prm files in the package root —
 *  both serializations of the mapping primitive, diffed uniformly (the
 *  check.ts C21 discovery pattern). */
export function packageMappings(
  dir: string,
  standard: Standard,
): MappingRecord[] {
  const profiles = [...(standard.mapProfiles ?? [])];
  if (existsSync(dir)) {
    for (const entry of readdirSync(dir).sort()) {
      if (!entry.endsWith('.prm')) {
        continue;
      }
      profiles.push(
        ...prmToMapProfiles(loadPrm(readFileSync(join(dir, entry), 'utf8'))),
      );
    }
  }
  const modelId =
    standard.packageManifest?.id ?? standard.meta?.namespace ?? '';
  return profiles.flatMap(p => mappingsFromProfile(p, modelId));
}

interface SentencesPayload {
  document?: { urn?: string };
  sentences?: { clause?: string; text?: string }[];
}

/** Clause → text index over a package's sources-prd sentence payloads. */
export function packageClauseTexts(dir: string): ClauseTextIndex {
  const out: ClauseTextIndex = new Map();
  const prdDir = join(dir, 'sources-prd');
  if (!existsSync(prdDir)) {
    return out;
  }
  for (const entry of readdirSync(prdDir).sort()) {
    if (!entry.endsWith('.sentences.json')) {
      continue;
    }
    let payload: SentencesPayload;
    try {
      payload = JSON.parse(readFileSync(join(prdDir, entry), 'utf8'));
    } catch {
      continue; // a malformed payload is not the diff's business
    }
    const urn = payload.document?.urn ?? '';
    if (!urn) {
      continue;
    }
    const basis = normalizeSourceRef(urn, '').basis;
    const byClause = new Map<string, string[]>();
    for (const s of payload.sentences ?? []) {
      if (!s.clause || s.text === undefined) {
        continue;
      }
      (
        byClause.get(s.clause) ?? byClause.set(s.clause, []).get(s.clause)!
      ).push(s.text);
    }
    for (const [clause, texts] of byClause) {
      out.set(clauseTextKey(basis, clause), texts.join('\n'));
    }
  }
  return out;
}

/**
 * Diff two package directories — any two states of a package (working
 * tree vs baseline, baseline vs baseline, edition vs edition). This is
 * the change-audit entry point; the CLI (`primmel diff <a> <b>`) wires
 * it into review flows.
 */
export function diffPackageDirs(
  dirA: string,
  dirB: string,
  options: PackageDiffOptions = {},
): PackageDiffResult {
  const loadedA = loadPackageWithIssues(dirA, {
    resolvePackage: options.resolvePackage,
  });
  const loadedB = loadPackageWithIssues(dirB, {
    resolvePackage: options.resolvePackage,
  });
  const diff = diffStandards(loadedA.standard, loadedB.standard, {
    ...options,
    mappingsA: packageMappings(dirA, loadedA.standard),
    mappingsB: packageMappings(dirB, loadedB.standard),
    ...(options.compareTexts
      ? {
          sentencesA: packageClauseTexts(dirA),
          sentencesB: packageClauseTexts(dirB),
        }
      : {}),
  });
  return {
    diff,
    standardA: loadedA.standard,
    standardB: loadedB.standard,
    issuesA: loadedA.issues,
    issuesB: loadedB.issues,
  };
}

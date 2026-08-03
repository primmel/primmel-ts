import Standard from '../types/Standard';
import parse from './parse';
import type { ParseOptions } from './parse';
import resolve from './resolve';
import _dump from './dump';
import { PARSER_CONFIG, RESOLVER_CONFIG, DUMPER_CONFIG } from './config';
import { preprocessIncludes } from './includes';
import {
  validate as _validate,
  type ValidationIssue,
  type ValidationSeverity,
  type Position,
} from '../validate';

export type LoadOptions = ParseOptions;

export interface LoadResult {
  standard: Standard;
  /** Issues collected during parse (e.g. duplicate IDs). */
  issues: ValidationIssue[];
  /**
   * Present when the load composed multiple packages (`uses` with a
   * package locator — TODO.roadmap/05): the merge order, root last.
   */
  composition?: import('./package').CompositionInfo;
}

/**
 * Parse a .mmel string into a typed Standard.
 * Does NOT resolve include directives — use loadFile() for that.
 *
 * Default mode is lenient (unknown keywords skipped). Pass `{ strict: true }`
 * to throw on unknown top-level keywords.
 */
export function load(mmelString: string, options: LoadOptions = {}): Standard {
  const context = parse(mmelString, PARSER_CONFIG, options);
  return resolve(context, RESOLVER_CONFIG);
}

/**
 * Like load(), but also returns parse-time issues (duplicate IDs, etc.).
 *
 * Post-resolution validation (dangling refs, missing required fields)
 * is NOT included here — call validate(standard) for that.
 */
export function loadWithIssues(
  mmelString: string,
  options: LoadOptions = {},
): LoadResult {
  const context = parse(mmelString, PARSER_CONFIG, options);
  const standard = resolve(context, RESOLVER_CONFIG);
  return { standard, issues: context.issues };
}

/**
 * Load a .mmel FILE, resolving include directives first.
 * Use this when the model uses `include "..."` to split across files.
 */
export function loadFile(
  filePath: string,
  options: LoadOptions = {},
): Standard {
  const content = preprocessIncludes(filePath);
  return load(content, options);
}

/**
 * Like loadFile(), but also returns parse-time issues.
 */
export function loadFileWithIssues(
  filePath: string,
  options: LoadOptions = {},
): LoadResult {
  const content = preprocessIncludes(filePath);
  return loadWithIssues(content, options);
}

export function dump(standard: Standard): string {
  return _dump(standard, DUMPER_CONFIG);
}

export {
  loadPackage,
  loadPackageWithIssues,
  packageFiles,
  effectiveUses,
  readPackageManifest,
  CompositionError,
  type CompositionInfo,
  type CompositionRule,
  type LoadPackageOptions,
  type ResolvePackage,
} from './package';
export { dumpPackage } from './config/packageManifest';
export {
  loadPrm,
  dumpPrm,
  prmToMapProfiles,
  mapProfilesToPrm,
  type PrmFile,
  type PrmMapSetEntry,
  type PrmPairMeta,
} from './prm';

export function validate(standard: Standard): ValidationIssue[] {
  return _validate(standard);
}

export type { ParseOptions };
export type { ValidationIssue, ValidationSeverity, Position };
export type {
  Subprocess,
  SubprocessComponent,
  Edge,
} from '../types/flow';

// The browser bundle's entry is THIS file (vite.browser.config.ts) —
// every runtime API the root index exposes must be re-exported here
// too, or the browser build silently drops it (the editor's datatype
// selector and the coverage overlay both hit this).
export {
  PRIMITIVE_TYPES,
  parseTypeExpression,
  isWellFormedMapType,
  type TypeExpr,
} from '../type-expr';
export {
  parseTargetRef,
  mappingsFromProfile,
  collectMappings,
  buildProcessTree,
  computeCoverage,
  discoverTransitive,
  repoMap,
  applyView,
  componentIds,
  type MappingRecord,
  type TargetRef,
  type ProcessTreeNode,
  type ComponentCoverage,
  type DiscoveryProposal,
  type CoverageSummary,
  type CoverageReport,
  type UnresolvedMapping,
  type ModelMappings,
  type RepoMapEdge,
  type ViewProjection,
} from '../mapping-coverage';
export {
  canonical,
  clauseTextKey,
  diffStandards,
  elementIndex,
  formatDiffReport,
  normalizeSourceRef,
  TIER_BY_FIELD,
  TIER_ORDER,
  type ChangeEntry,
  type ClauseDriftKind,
  type ClauseDriftRow,
  type ClauseTextIndex,
  type CoverageDeltaEntry,
  type DiffElement,
  type DiffEntry,
  type MappingDiff,
  type MappingPairChange,
  type ModelDiff,
  type ModelDiffOptions,
  type MoveEntry,
  type NormalizedSourceRef,
  type TierName,
  type TierTally,
} from '../model-diff';

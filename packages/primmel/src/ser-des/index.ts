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

export function validate(standard: Standard): ValidationIssue[] {
  return _validate(standard);
}

export type { ParseOptions };
export type { ValidationIssue, ValidationSeverity, Position };

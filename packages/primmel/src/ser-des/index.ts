import Standard from '../types/Standard';
import parse from './parse';
import type { ParseOptions } from './parse';
import resolve from './resolve';
import _dump from './dump';
import { PARSER_CONFIG, RESOLVER_CONFIG, DUMPER_CONFIG } from './config';
import { preprocessIncludes } from './includes';
import { validate, type ValidationIssue } from '../validate';

export type LoadOptions = ParseOptions;

export interface LoadResult {
  standard: Standard;
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
 * Load + validate in one call. Returns the parsed Standard plus a list of
 * validation issues (cross-reference integrity bugs the lenient parser
 * silently dropped). Empty `issues` array means clean.
 *
 * Caller decides how to surface issues: log them, throw on severity,
 * display in an editor, etc.
 */
export function loadWithIssues(
  filePath: string,
  options: LoadOptions = {},
): LoadResult {
  const content = preprocessIncludes(filePath);
  const standard = load(content, options);
  const issues = validate(standard);
  return { standard, issues };
}

export function dump(standard: Standard): string {
  return _dump(standard, DUMPER_CONFIG);
}

export type { ParseOptions };

import Standard from '../types/Standard';
import parse from './parse';
import resolve from './resolve';
import _dump from './dump';
import { PARSER_CONFIG, RESOLVER_CONFIG, DUMPER_CONFIG } from './config';
import { preprocessIncludes } from './includes';

/**
 * Parse a .mmel string into a typed Standard.
 * Does NOT resolve include directives — use loadFile() for that.
 */
export function load(mmelString: string): Standard {
  const context = parse(mmelString, PARSER_CONFIG);
  return resolve(context, RESOLVER_CONFIG);
}

/**
 * Load a .mmel FILE, resolving include directives first.
 * Use this when the model uses `include "..."` to split across files.
 */
export function loadFile(filePath: string): Standard {
  const content = preprocessIncludes(filePath);
  return load(content);
}

export function dump(standard: Standard): string {
  return _dump(standard, DUMPER_CONFIG);
}

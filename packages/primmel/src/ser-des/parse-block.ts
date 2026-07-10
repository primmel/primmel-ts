// ─────────────────────────────────────────────────────────────────────
// Shared parse-loop helpers.
//
// Every keyword-with-block parser follows the same shape:
//   - tokenize the block
//   - walk tokens pairwise (keyword, value)
//   - dispatch on keyword
//   - throw if a value is missing
//   - skip unknown keywords for forward compatibility
//
// `forEachEntry` concentrates that boilerplate. Each parser supplies a
// visitor; the visitor claims a keyword by reading its value via the
// passed `value()` callback. Unclaimed keywords auto-skip their value.
//
// `forEachAttribute` handles the slightly different shape used by
// `class` bodies: a flat sequence of `<name-and-type-spec> { <block> }`
// pairs, where the name part can include `: type`, `[cardinality]`,
// etc. The visitor receives the un-tokenized name spec and the brace
// block as a single string.
// ─────────────────────────────────────────────────────────────────────

import { tokenizePackage, removePackage } from './tokenize';

export interface ParseEntryErrorContext {
  /** Construct name for error messages, e.g. "process", "enum value". */
  construct: string;
  /** Owning ID for error messages (may be empty for anonymous blocks). */
  id: string;
}

/**
 * Walk the (keyword, value) pairs of a `{ ... }` block, calling the
 * visitor for each. Returns silently for empty input.
 *
 * The visitor receives the keyword and a `value()` reader. Returning
 * `true` claims the keyword (the visitor called `value()` itself);
 * returning `false` lets the helper auto-skip the value token, which
 * is how forward compatibility with newer revisions is preserved.
 *
 * Throws on a truncated block (keyword with no value).
 */
export function forEachEntry(
  data: string,
  visitor: (keyword: string, value: () => string) => boolean,
  errCtx: ParseEntryErrorContext,
): void {
  if (data === '') {
    return;
  }
  const t: string[] = tokenizePackage(data);
  let i = 0;
  while (i < t.length) {
    const keyword = t[i++];
    if (i >= t.length) {
      throw new Error(
        `Parsing error: ${errCtx.construct}. ID ${errCtx.id}: Expecting value for ${keyword}`,
      );
    }
    const claimed = visitor(keyword, () => t[i++]);
    if (!claimed) {
      i++; // forward-compat: skip unknown keyword value
    }
  }
}

/**
 * Walk the `<name-spec> { <block> }` pairs of an attributes-style body,
 * calling the visitor for each pair. Used by `class` bodies where each
 * entry has the shape `id[: type][[cardinality]] { details }`.
 *
 * Unlike `forEachEntry`, the name spec can span multiple whitespace-
 * separated tokens (e.g. `attr1: string [0..1]`). Consecutive non-brace
 * tokens are accumulated into one name spec until the next `{ ... }`
 * block, which becomes the pair's block.
 *
 * The visitor receives the raw name spec (e.g. `"attr1: string [0..1]"`)
 * and the inner content of the brace block. Empty input is a no-op.
 *
 * Throws on a truncated body (name with no block).
 */
export function forEachAttribute(
  data: string,
  visitor: (nameSpec: string, block: string) => void,
  errCtx: ParseEntryErrorContext,
): void {
  if (data === '') {
    return;
  }
  const t: string[] = tokenizePackage(data);
  let i = 0;
  while (i < t.length) {
    // Accumulate name-spec tokens until we hit the brace block.
    const nameParts: string[] = [];
    while (i < t.length && t[i].charAt(0) !== '{') {
      nameParts.push(t[i++]);
    }
    if (nameParts.length === 0) {
      // Leading brace with no name — malformed.
      throw new Error(
        `Parsing error: ${errCtx.construct}. ID ${errCtx.id}: Attribute is missing its name`,
      );
    }
    if (i >= t.length) {
      throw new Error(
        `Parsing error: ${errCtx.construct}. ID ${errCtx.id}: Expecting { after ${nameParts.join(' ')}`,
      );
    }
    const blockRaw = t[i++];
    visitor(nameParts.join(' '), removePackage(blockRaw));
  }
}

/**
 * Convenience: read the next value with surrounding quotes/braces
 * stripped. Pairs with `forEachEntry` for the common case where a
 * visitor wants the unwrapped string form.
 *
 *     forEachEntry(data, (kw, value) => {
 *       if (kw === 'name') result.name = unwrapped(value);
 *       else if (kw === 'modality') result.modality = value();
 *       else return false;
 *       return true;
 *     }, { construct: 'process', id });
 */
export function unwrapped(value: () => string): string {
  return removePackage(value());
}

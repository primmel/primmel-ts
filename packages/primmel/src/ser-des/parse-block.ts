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

import { tokenizePackage, unwrapBlock, unescapeString } from './tokenize';

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
 * The visitor receives the keyword, a `value()` reader, and a `peek()`
 * reader (the next token without consuming it — for optional trailing
 * shapes such as the ref note block). Returning `true` claims the
 * keyword (the visitor called `value()` itself); returning `false` lets
 * the helper auto-skip the value token, which is how forward
 * compatibility with newer revisions is preserved.
 *
 * Throws on a truncated block (keyword with no value).
 */
export function forEachEntry(
  data: string,
  visitor: (
    keyword: string,
    value: () => string,
    peek: () => string | undefined,
  ) => boolean,
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
    const claimed = visitor(
      keyword,
      () => t[i++],
      () => t[i],
    );
    if (!claimed) {
      // The unified ref construct (docs/primmel/18) is tolerated on every
      // construct — even where the construct's own facets don't model it
      // yet: skip the predicate + the target + the optional note block.
      if (keyword === 'ref') {
        i++; // the predicate
        i++; // the target
        if (i < t.length && t[i]!.startsWith('{')) {
          i++; // the note block
        }
      } else {
        i++; // forward-compat: skip unknown keyword value
      }
    }
  }
}

/**
 * The manual-walk forward-compat skip, ref-aware (docs/primmel/18): the
 * unknown-keyword fallback consumes ONE value token, EXCEPT the unified
 * ref construct, whose shape is `ref <predicate> "<target>"` plus an
 * optional `{ note }` block — a one-token skip there would desync the
 * walk and silently eat every following facet. `i` sits just AFTER the
 * keyword; returns the index past the skipped value.
 */
export function skipUnknownValue(
  t: string[],
  i: number,
  keyword: string,
): number {
  if (keyword === 'ref') {
    i++; // the predicate
    if (i < t.length) {
      i++; // the target
    }
    if (i < t.length && t[i]!.startsWith('{')) {
      i++; // the note block
    }
    return i;
  }
  if (i < t.length) {
    i++;
  }
  return i;
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
    // Special-case: the unified `ref` construct (`ref <predicate>
    // "<target>"` plus an optional `{ note "…" }` block) has no
    // per-attribute `{block}` after the target. When the first token
    // is `ref`, accumulate predicate + target (and optional note block)
    // and dispatch as a single entry. The visitor distinguishes by
    // checking `nameSpec.startsWith('ref ')`.
    if (t[i] === 'ref') {
      const nameParts: string[] = [t[i++]];
      if (i < t.length) {
        nameParts.push(t[i++]);
      } // predicate
      if (i < t.length) {
        nameParts.push(t[i++]);
      } // target
      let blockContent = '';
      if (i < t.length && t[i]!.charAt(0) === '{') {
        blockContent = unwrapBlock(t[i++]!);
      }
      visitor(nameParts.join(' '), blockContent);
      continue;
    }
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
    visitor(nameParts.join(' '), unwrapBlock(blockRaw));
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
  const x = value();
  // Quoted values must be unescaped on consumption (same contract as
  // stripWrapping) — otherwise dump/load cycles keep adding backslashes.
  if (x.length >= 2 && x.charAt(0) === '"' && x.charAt(x.length - 1) === '"') {
    return unescapeString(x.substr(1, x.length - 2));
  }
  return unwrapBlock(x);
}

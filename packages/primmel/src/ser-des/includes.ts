// ─────────────────────────────────────────────────────────────────────
// Include preprocessor.
//
// Resolves `include "path"` directives BEFORE tokenization. The parser
// sees a single concatenated string with all includes expanded.
//
// Design: recursive, relative-path, cycle-detecting. Follows the
// same convention as C preprocessor #include and AsciiDoc include::.
//
// Comment-aware: `#` and `//` comments containing `include "foo"` are
// NOT expanded. The tokenizer's own comment-stripping logic is mirrored
// here so the two stages agree on what counts as content.
// ─────────────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, isAbsolute } from 'path';

const INCLUDE_RE = /^include\s+"([^"]+)"/gm;
const COMMENT_LINE_RE = /^[ \t]*(#|\/\/)/;

/**
 * Preprocess include directives in a .mmel file.
 *
 * Reads the file at `filePath`, finds all `include "..."` directives,
 * recursively resolves them, and returns the concatenated content.
 *
 * Include paths are resolved relative to the directory of the
 * including file. Absolute paths are also supported.
 *
 * Comment-aware: lines starting (after optional whitespace) with `#`
 * or `//` are skipped, so a comment like `// include "ignored.mmel"`
 * is NOT expanded. This matches the tokenizer's comment handling.
 *
 * Cycles are detected and rejected.
 */
export function preprocessIncludes(
  filePath: string,
  _seen: Set<string> = new Set(),
): string {
  const absPath = resolve(filePath);

  if (_seen.has(absPath)) {
    throw new Error(
      `Include cycle detected: ${absPath} (chain: ${[..._seen, absPath]
        .map(s => s.split('/').pop())
        .join(' → ')})`,
    );
  }
  _seen.add(absPath);

  if (!existsSync(absPath)) {
    throw new Error(`Include file not found: ${absPath}`);
  }

  const content = readFileSync(absPath, 'utf8');
  const dir = dirname(absPath);

  // Replace each include directive with the preprocessed content of
  // the referenced file. Skip comment lines so a `// include "..."` in
  // a comment doesn't get falsely expanded.
  return content.replace(
    INCLUDE_RE,
    (match, includePath: string, offset: number) => {
      const lineStart = content.lastIndexOf('\n', offset) + 1;
      const prefix = content.slice(lineStart, offset);
      if (COMMENT_LINE_RE.test(prefix)) {
        return match;
      }

      const resolved = isAbsolute(includePath)
        ? includePath
        : resolve(dir, includePath);

      const withExt = resolved.endsWith('.mmel')
        ? resolved
        : `${resolved}.mmel`;

      return preprocessIncludes(withExt, new Set(_seen));
    },
  );
}

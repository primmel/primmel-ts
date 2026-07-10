// ─────────────────────────────────────────────────────────────────────
// Position tracking
//
// Every token can carry its source position (line, column, offset) so
// that error messages can point at the exact source location. The
// legacy tokenize() / tokenizePackage() / tokenizeAttributes() APIs
// remain string[]-returning for backward compatibility with parser
// configs that don't need positions.
// ─────────────────────────────────────────────────────────────────────

export interface Position {
  /** 1-based line number */
  line: number;
  /** 1-based column number (counted in UTF-16 code units) */
  col: number;
  /** 0-based absolute character offset from start of source */
  offset: number;
}

export interface Token {
  value: string;
  start: Position;
  /** Position immediately AFTER the last character of `value`. */
  end: Position;
}

/**
 * Tokenize while recording each token's source position.
 *
 * Same tokenization rules as tokenize(): comments skipped, quoted
 * strings and brace blocks kept as single tokens, escape sequences
 * honoured. Tokens that cross newlines (e.g. multi-line brace blocks)
 * record the start position only; `end` is computed from value length.
 */
export function tokenizeWithPositions(x: string): Token[] {
  const out: Token[] = [];
  let line = 1;
  let col = 1;
  let offset = 0;
  let i = 0;

  const advance = (n: number) => {
    for (let k = 0; k < n; k++) {
      if (x.charAt(offset) === '\n') {
        line++;
        col = 1;
      } else {
        col++;
      }
      offset++;
      i++;
    }
  };

  while (i < x.length) {
    const char = x.charAt(i);

    // Comment handling
    if (
      char === '#' ||
      (char === '/' && i + 1 < x.length && x.charAt(i + 1) === '/')
    ) {
      while (i < x.length && x.charAt(i) !== '\n') {
        advance(1);
      }
      continue;
    }

    if (isWhiteSpace(char)) {
      advance(1);
      continue;
    }

    // Token starts here
    const startLine = line;
    const startCol = col;
    const startOffset = offset;
    let value = '';

    if (char === '"') {
      value += char;
      advance(1);
      while (i < x.length) {
        const c = x.charAt(i);
        if (c === '\\' && i + 1 < x.length) {
          value += c + x.charAt(i + 1);
          advance(2);
          continue;
        }
        value += c;
        advance(1);
        if (c === '"') {
          break;
        }
      }
    } else if (char === '{') {
      let depth = 1;
      value += char;
      advance(1);
      while (i < x.length && depth > 0) {
        const c = x.charAt(i);
        if (c === '"') {
          value += c;
          advance(1);
          while (i < x.length) {
            const sc = x.charAt(i);
            if (sc === '\\' && i + 1 < x.length) {
              value += sc + x.charAt(i + 1);
              advance(2);
              continue;
            }
            value += sc;
            advance(1);
            if (sc === '"') {
              break;
            }
          }
          continue;
        }
        if (c === '{') {
          depth++;
        }
        if (c === '}') {
          depth--;
        }
        value += c;
        advance(1);
      }
    } else {
      while (i < x.length && !isWhiteSpace(x.charAt(i))) {
        value += x.charAt(i);
        advance(1);
      }
    }

    out.push({
      value,
      start: { line: startLine, col: startCol, offset: startOffset },
      end: { line, col, offset },
    });
  }
  return out;
}

export default function tokenize(x: string): string[] {
  return tokenizeWithPositions(x).map(t => t.value);
}

export function tokenizePackage(x: string): Array<string> {
  return tokenize(removePackage(x));
}

export function removePackage(x: string): string {
  if (x.length >= 2) {
    return x.substr(1, x.length - 2);
  } else {
    return x;
  }
}

/**
 * Strip surrounding quotes OR braces if (and only if) the token starts
 * and ends with them. Returns the token unchanged otherwise.
 *
 * Use this instead of removePackage for values that may be either bare
 * IDs (`realProc`) or quoted strings (`"My Form"`) — common in form
 * field references, calculation IDs, conformance process IDs, etc.
 *
 * removePackage unconditionally strips first+last char, which mangles
 * bare IDs (e.g. `DetermineMeasurementError` → `etermineMeasurementErro`).
 * stripWrapping only strips when the wrapping chars are actually
 * matching quote-or-brace.
 */
export function stripWrapping(x: string): string {
  if (x.length < 2) {
    return x;
  }
  const first = x.charAt(0);
  const last = x.charAt(x.length - 1);
  if ((first === '"' && last === '"') || (first === '{' && last === '}')) {
    return x.substr(1, x.length - 2);
  }
  return x;
}

/**
 * Escape a string for emission inside double-quotes. The tokenizer's
 * string scanner honours backslash escapes, so `"` and `\` inside
 * values MUST be escaped to round-trip cleanly.
 *
 * Use this in dumpers: `out += '  name "' + escapeString(role.name) + '"\n'`
 */
export function escapeString(x: string): string {
  return x.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function isWhiteSpace(x: string): boolean {
  return /\s/.test(x);
}

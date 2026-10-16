// ─────────────────────────────────────────────────────────────────────
// The shared carrier of a machine-executable payload (register 18):
// the legacy quoted string (the ocl{…} convention) and the v3.3 inline
// block. The value's shape — a string token or a block token — is the
// entire carrier decision; they never mix in one facet.
// ─────────────────────────────────────────────────────────────────────

import { canonicalizeExpression } from '../expressions';
import tokenize from './tokenize';
import { unescapeString, unwrapBlock } from './tokenize';

export interface ExpressionCarrier {
  /** The stored expression source (the canonical render when inline). */
  source: string;
  /** The v3.3 block carrier — the checker walks the AST, exactly. */
  inline: boolean;
}

export function readExpressionCarrier(
  token: string,
  what: string,
): ExpressionCarrier {
  if (token.startsWith('{')) {
    try {
      return {
        source: canonicalizeExpression(unwrapBlock(token)),
        inline: true,
      };
    } catch (e) {
      throw new Error(
        `Parsing error: ${what}: ${(e as Error).message ?? String(e)}`,
      );
    }
  }
  if (token.length >= 2 && token.charAt(0) === '"') {
    return {
      source: unescapeString(token.substr(1, token.length - 2)),
      inline: false,
    };
  }
  return { source: token, inline: false };
}

/** The block-carrier dump: the keyword, the indented canonical source. */
export function dumpExpressionBlock(
  keyword: string,
  source: string,
  indent: string,
): string {
  const body = source
    .split('\n')
    .map(l => indent + '  ' + l)
    .join('\n');
  return indent + keyword + ' {\n' + body + '\n' + indent + '}\n';
}

/** The args block's entry shape: `name <- source` per line — the scope
 *  any expression carrier's body binds. Shared by the limit and the
 *  constraint. */
export function readArgsBlock(token: string): {
  name: string;
  source: string;
}[] {
  const at = tokenize(token);
  const args: { name: string; source: string }[] = [];
  let k = 0;
  while (k < at.length) {
    const name = unescapeStringOrBare(at[k++]);
    if (k >= at.length) {
      throw new Error(`limit args: "${name}" binds to nothing`);
    }
    if (at[k] !== '<-') {
      throw new Error(`limit args: expected "<-" after "${name}" (name <- source)`);
    }
    k += 1;
    if (k >= at.length) {
      throw new Error(`limit args: "${name}" binds to nothing`);
    }
    args.push({ name, source: unescapeStringOrBare(at[k++]) });
  }
  return args;
}

function unescapeStringOrBare(t: string): string {
  if (t.length >= 2 && t.charAt(0) === '"' && t.charAt(t.length - 1) === '"') {
    return unescapeString(t.substr(1, t.length - 2));
  }
  return t;
}

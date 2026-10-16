// ─────────────────────────────────────────────────────────────────────
// The shared carrier of a machine-executable payload (register 18):
// the legacy quoted string (the ocl{…} convention) and the v3.3 inline
// block. The value's shape — a string token or a block token — is the
// entire carrier decision; they never mix in one facet.
// ─────────────────────────────────────────────────────────────────────

import { canonicalizeExpression } from '../expressions';
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

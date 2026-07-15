import { tokenizeWithPositions, type Token } from './tokenize';
import { ParseContext, ParserConfiguration } from './types';
import { createDuplicateIdChecker } from '../duplicate-id';

export interface ParseOptions {
  /**
   * When true, an unrecognized top-level keyword throws immediately.
   * When false (default), unknown keywords are silently skipped for
   * forward compatibility with newer MMEL/Primmel revisions.
   */
  strict?: boolean;
}

/**
 * Parse a .mmel string into a ParseContext.
 *
 * Position tracking is enabled by default — every parser error message
 * includes the line:column of the offending token. Positions are also
 * recorded on each ValidationIssue, so consumers can point at the
 * exact source location of any model problem.
 *
 * Duplicate-ID detection runs during parsing (not post-resolution),
 * because the parser silently overwrites duplicate ctx entries. The
 * detection itself lives in `duplicate-id.ts` — this module just calls
 * it at the moment each declaration is parsed.
 */
export default function parse(
  mmelString: string,
  parsers: ParserConfiguration,
  options: ParseOptions = {},
): ParseContext {
  const tokens: Token[] = tokenizeWithPositions(mmelString);
  const dupChecker = createDuplicateIdChecker();

  // ctx is mutated by parser functions; declared with let because
  // some parsers return a new ctx object via immutable update.
  let ctx: ParseContext = {
    root: '',
    metadata: null,
    approvals: {},
    roles: {},
    processes: {},
    pages: {},
    gateways: {},
    regs: {},
    references: {},
    provisions: {},
    dataclasses: {},
    events: {},
    enums: {},
    variables: {},
    // MMEL 0.1 constructs missing from earlier parser versions
    notes: {},
    tables: {},
    figures: {},
    links: {},
    mapProfiles: {},
    viewProfiles: {},
    // Primmel extensions (MN 113-6 to 113-10)
    terms: {},
    forms: {},
    subforms: {},
    symbols: {},
    calculations: {},
    stateMachines: {},
    conformanceTests: {},
    // Issue collection (duplicate IDs, etc.)
    issues: [],
  };

  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i++];
    const keyword = tok.value;
    const cfg = parsers[keyword];

    if (!cfg) {
      if (options.strict) {
        throw new Error(
          `Unknown keyword "${keyword}" at line ${tok.start.line} col ${tok.start.col}. Use lenient mode (default) to skip unknown keywords.`,
        );
      }
      // Lenient: skip unknown keywords for forward compatibility.
      continue;
    }

    let updateCtx: (ctx: ParseContext) => ParseContext;
    if (cfg.takesID) {
      if (i + 1 > tokens.length) {
        throw new Error(
          `Keyword "${keyword}" at line ${tok.start.line} col ${tok.start.col} expects an ID and payload, but only ${tokens.length - i + 1} token(s) remain.`,
        );
      }
      const idTok = tokens[i++];
      const payloadTok = tokens[i++];

      // Duplicate-ID detection runs at parse time because the parser
      // silently overwrites ctx entries — without this check, the
      // issue would never surface.
      if (cfg.field) {
        const issue = dupChecker.check(
          cfg.field,
          keyword,
          idTok.value,
          idTok.start,
        );
        if (issue) {
          ctx.issues.push(issue);
        }
      }

      updateCtx = cfg.parse(idTok.value, payloadTok.value);
    } else {
      if (i >= tokens.length) {
        throw new Error(
          `Keyword "${keyword}" at line ${tok.start.line} col ${tok.start.col} expects a payload, but no tokens remain.`,
        );
      }
      const payloadTok = tokens[i++];
      updateCtx = cfg.parse(payloadTok.value);
    }

    const next = updateCtx(ctx);
    // updateCtx returns a new ctx (immutable style) OR the same ctx
    // (mutating style). Preserve issues across the swap.
    if (next !== ctx) {
      next.issues = ctx.issues;
    }
    ctx = next;
  }

  return ctx;
}

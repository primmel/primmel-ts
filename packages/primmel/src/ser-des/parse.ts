import tokenize from './tokenize';
import { ParseContext, ParserConfiguration } from './types';

export interface ParseOptions {
  /**
   * When true, an unrecognized top-level keyword throws immediately.
   * When false (default), unknown keywords are silently skipped for
   * forward compatibility with newer MMEL/Primmel revisions.
   */
  strict?: boolean;
}

export default function parse(
  mmelString: string,
  parsers: ParserConfiguration,
  options: ParseOptions = {},
): ParseContext {
  let ctx: ParseContext = {
    root: '',
    metadata: null,
    approvals: {},
    roles: {},
    processes: {},
    pages: {},
    gateways: {},
    registers: {},
    references: {},
    provisions: {},
    dataClasses: {},
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
    // Primmel extensions (MN 113-7 to 113-10)
    forms: {},
    subforms: {},
    symbols: {},
    calculations: {},
    stateMachines: {},
  };

  const token: Array<string> = tokenize(mmelString);
  let i = 0;
  while (i < token.length) {
    const keyword: string = token[i++];
    const cfg = parsers[keyword];

    if (!cfg) {
      if (options.strict) {
        throw new Error(
          `Unknown keyword "${keyword}" at token ${i}. Use lenient mode (default) to skip unknown keywords.`,
        );
      }
      // Lenient: skip unknown keywords for forward compatibility.
      continue;
    }

    let updateCtx: (ctx: ParseContext) => ParseContext;
    if (cfg.takesID) {
      if (i + 1 > token.length) {
        throw new Error(
          `Keyword "${keyword}" expects an ID and payload, but only ${
            token.length - i + 1
          } token(s) remain.`,
        );
      }
      updateCtx = cfg.parse(token[i++], token[i++]);
    } else {
      if (i >= token.length) {
        throw new Error(
          `Keyword "${keyword}" expects a payload, but no tokens remain.`,
        );
      }
      updateCtx = cfg.parse(token[i++]);
    }

    ctx = updateCtx(ctx);
  }

  return ctx;
}

import tokenize from './tokenize';
import { ParseContext, ParserConfiguration } from './types';

export default function parse(
  mmelString: string,
  parsers: ParserConfiguration
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
  };

  const token: Array<string> = tokenize(mmelString);
  let i = 0;
  while (i < token.length) {
    const keyword: string = token[i++];
    const cfg = parsers[keyword];

    let updateCtx: (ctx: ParseContext) => ParseContext;
    if (cfg.takesID) {
      updateCtx = cfg.parse(token[i++], token[i++]);
    } else {
      updateCtx = cfg.parse(token[i++]);
    }

    ctx = updateCtx(ctx);
  }

  return ctx;
}

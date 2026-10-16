//! The Primmel expression language: the lexer, the precedence parser, and
//! the AST. The machine-executable core — first-class syntax, never a
//! quoted string. The identifiers resolve against the caller's scope (the
//! argument bindings); the unbound names surface at parse time.

// ── the tokens ─────────────────────────────────────────────────────────

export type ExprToken =
  | { kind: 'num'; value: number }
  | { kind: 'name'; value: string }
  | { kind: 'op'; value: string };

const OPERATORS = [
  '<=', '>=', '!=', '≠', '<', '>', '=',
  '+', '-', '*', '/', '(', ')', ',', '.',
];

export function lex(src: string): ExprToken[] {
  const tokens: ExprToken[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i += 1;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j += 1;
      tokens.push({ kind: 'num', value: Number(src.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_.]/.test(src[j])) j += 1;
      tokens.push({ kind: 'name', value: src.slice(i, j) });
      i = j;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (OPERATORS.includes(two)) {
      tokens.push({ kind: 'op', value: two });
      i += 2;
      continue;
    }
    if (OPERATORS.includes(c)) {
      tokens.push({ kind: 'op', value: c });
      i += 1;
      continue;
    }
    throw new Error(
      `expression: unexpected character "${c}" at offset ${i}`,
    );
  }
  return tokens;
}

// ── the AST ────────────────────────────────────────────────────────────

export type ExprAst =
  | { type: 'num'; value: number }
  | { type: 'name'; path: string[] }
  | { type: 'call'; callee: string; args: ExprAst[] }
  | { type: 'binop'; op: string; left: ExprAst; right: ExprAst }
  | { type: 'unop'; op: string; operand: ExprAst };

// ── the precedence-climbing parser ─────────────────────────────────────

const BINARY_LEVELS: string[][] = [
  ['implies'],
  ['or'],
  ['xor'],
  ['and'],
  ['<=', '>=', '<', '>', '=', '!=', '≠'],
  ['+', '-'],
  ['*', '/'],
];

/** The word-spelled binary operators — never call targets. */
const WORD_BINOPS = new Set(['implies', 'or', 'xor', 'and']);

class ExprParser {
  private tokens: ExprToken[];
  private pos = 0;

  constructor(tokens: ExprToken[]) {
    this.tokens = tokens;
  }

  private peek(): ExprToken | undefined {
    return this.tokens[this.pos];
  }

  private take(): ExprToken {
    const tok = this.tokens[this.pos];
    if (tok === undefined) {
      throw new Error('expression: unexpected end');
    }
    this.pos += 1;
    return tok;
  }

  parse(): ExprAst {
    const ast = this.parseLevel(0);
    if (this.pos !== this.tokens.length) {
      throw new Error(
        `expression: trailing tokens at position ${this.pos}`,
      );
    }
    return ast;
  }

  private parseLevel(level: number): ExprAst {
    if (level >= BINARY_LEVELS.length) {
      return this.parseUnary();
    }
    let left = this.parseLevel(level + 1);
    for (;;) {
      const tok = this.peek();
      const op =
        tok?.kind === 'op'
          ? tok.value
          : tok?.kind === 'name' && WORD_BINOPS.has(tok.value)
            ? tok.value
            : undefined;
      if (op === undefined || !BINARY_LEVELS[level].includes(op)) {
        return left;
      }
      this.take();
      const right = this.parseLevel(level + 1);
      left = { type: 'binop', op, left, right };
    }
  }

  private parseUnary(): ExprAst {
    const tok = this.peek();
    if (tok?.kind === 'name' && (tok.value === 'not' || tok.value === '-')) {
      this.take();
      return { type: 'unop', op: tok.value, operand: this.parseUnary() };
    }
    if (tok?.kind === 'op' && tok.value === '-') {
      this.take();
      return { type: 'unop', op: '-', operand: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ExprAst {
    const tok = this.take();
    if (tok.kind === 'num') {
      return { type: 'num', value: tok.value };
    }
    if (tok.kind === 'op' && tok.value === '(') {
      const inner = this.parseLevel(0);
      const close = this.take();
      if (close.kind !== 'op' || close.value !== ')') {
        throw new Error('expression: expected closing parenthesis');
      }
      return inner;
    }
    if (tok.kind === 'name') {
      // the dotted path first — its segments join; a following '(' makes
      // it a call (the table-as-object idiom: table.permits(a, b))
      const segs = [tok.value];
      while (this.peek()?.kind === 'op' && this.peek()!.value === '.') {
        this.take();
        const seg = this.take();
        if (seg.kind !== 'name') {
          throw new Error('expression: expected a path segment after "."');
        }
        segs.push(seg.value);
      }
      const next = this.peek();
      if (
        next?.kind === 'op' &&
        next.value === '(' &&
        !WORD_BINOPS.has(segs[0])
      ) {
        this.take();
        const args: ExprAst[] = [];
        const closing = this.peek();
        if (closing?.kind === 'op' && closing.value === ')') {
          this.take();
          return { type: 'call', callee: segs.join('.'), args };
        }
        for (;;) {
          args.push(this.parseLevel(0));
          const sep = this.peek();
          if (sep?.kind === 'op' && sep.value === ',') {
            this.take();
            continue;
          }
          break;
        }
        const close = this.take();
        if (close.kind !== 'op' || close.value !== ')') {
          throw new Error('expression: expected closing parenthesis');
        }
        return { type: 'call', callee: segs.join('.'), args };
      }
      return { type: 'name', path: segs };
    }
    throw new Error(`expression: unexpected token "${String(tok.value)}"`);
  }
}

export function parseExpression(src: string): ExprAst {
  return new ExprParser(lex(src)).parse();
}

// ── the identifier extraction ──────────────────────────────────────────

export interface ExprIdentifiers {
  /** The name leaves, as written (dotted paths joined). */
  names: string[];
  /** The call targets. */
  calls: string[];
}

/** The named leaves and the call targets of the AST. */
export function freeIdentifiers(ast: ExprAst): ExprIdentifiers {
  const out: ExprIdentifiers = { names: [], calls: [] };
  const walk = (node: ExprAst): void => {
    switch (node.type) {
      case 'num':
        return;
      case 'name':
        out.names.push(node.path.join('.'));
        return;
      case 'call':
        out.calls.push(node.callee);
        for (const a of node.args) walk(a);
        return;
      case 'unop':
        walk(node.operand);
        return;
      case 'binop':
        walk(node.left);
        walk(node.right);
        return;
    }
  };
  walk(ast);
  return out;
}

/** The canonical source form of the AST (the dumper's output). */
export function renderExpression(ast: ExprAst): string {
  switch (ast.type) {
    case 'num':
      return String(ast.value);
    case 'name':
      return ast.path.join('.');
    case 'call':
      return (
        ast.callee + '(' + ast.args.map(renderExpression).join(', ') + ')'
      );
    case 'unop': {
      // a unary over a binary needs the parens back — the rendered
      // source must reparse to the same tree
      const inner = renderExpression(ast.operand);
      return (
        ast.op +
        (ast.operand.type === 'binop' ? ' (' + inner + ')' : ' ' + inner)
      );
    }
    case 'binop':
      return (
        renderExpression(ast.left) + ' ' + ast.op + ' ' +
        renderExpression(ast.right)
      );
  }
}

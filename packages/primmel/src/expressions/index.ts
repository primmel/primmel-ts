//! The Primmel expression language: the lexer, the precedence parser, and
//! the AST. The machine-executable core — first-class syntax, never a
//! quoted string. The identifiers resolve against the caller's scope (the
//! argument bindings); the unbound names surface at parse time.

// ── the tokens ─────────────────────────────────────────────────────────

export type ExprToken =
  | { kind: 'num'; value: number }
  | { kind: 'str'; value: string }
  | { kind: 'name'; value: string }
  | { kind: 'op'; value: string };

const OPERATORS = [
  '->',
  '<=',
  '>=',
  '!=',
  '≠',
  '<',
  '>',
  '=',
  '+',
  '-',
  '*',
  '/',
  '(',
  ')',
  ',',
  '.',
  '|',
];

const NAV_OPS = new Set(['forAll', 'exists', 'select', 'collect']);

export function lex(src: string): ExprToken[] {
  const tokens: ExprToken[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i += 1;
      continue;
    }
    if (c === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== "'") {
        j += 1;
      }
      if (j >= src.length) {
        throw new Error(`expression: unterminated string at offset ${i}`);
      }
      tokens.push({ kind: 'str', value: src.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) {
        j += 1;
      }
      tokens.push({ kind: 'num', value: Number(src.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_.]/.test(src[j])) {
        j += 1;
      }
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
    throw new Error(`expression: unexpected character "${c}" at offset ${i}`);
  }
  return tokens;
}

// ── the AST ────────────────────────────────────────────────────────────

export type ExprAst =
  | { type: 'num'; value: number }
  | { type: 'str'; value: string }
  | { type: 'bool'; value: boolean }
  | { type: 'name'; path: string[] }
  | { type: 'call'; callee: string; args: ExprAst[] }
  /**
   * The member access on a call result (the OCL property navigation):
   * `lookupProfile('n_LC_range', cls).min` — the range record's field.
   * The property is not an identifier; freeIdentifiers walks the object
   * alone.
   */
  | { type: 'member'; object: ExprAst; property: string }
  | { type: 'binop'; op: string; left: ExprAst; right: ExprAst }
  | { type: 'unop'; op: string; operand: ExprAst }
  /**
   * The conditional (the OCL if-then-else heritage): the branches share
   * the expression's kind discipline; endif delimits, so no parens are
   * ever needed around a branch.
   */
  | { type: 'ifelse'; cond: ExprAst; then: ExprAst; else: ExprAst }
  /**
   * The collection navigation (register 24): `source -> op(v | body)` —
   * the OCL iterator heritage; the lambda parameter scopes the body
   * exactly like an argument binds a limit's.
   */
  | {
      type: 'nav';
      source: string;
      op: string;
      var: string;
      body: ExprAst;
    };

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
      throw new Error(`expression: trailing tokens at position ${this.pos}`);
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
    if (tok.kind === 'str') {
      return { type: 'str', value: tok.value };
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
      // the boolean and conditional keywords — reserved literals and
      // the OCL conditional form, never call targets
      if (tok.value === 'true' || tok.value === 'false') {
        return { type: 'bool', value: tok.value === 'true' };
      }
      if (tok.value === 'if') {
        const cond = this.parseLevel(0);
        const thenTok = this.take();
        if (thenTok.kind !== 'name' || thenTok.value !== 'then') {
          throw new Error('expression: expected "then" in the conditional');
        }
        const whenTrue = this.parseLevel(0);
        const elseTok = this.take();
        if (elseTok.kind !== 'name' || elseTok.value !== 'else') {
          throw new Error('expression: expected "else" in the conditional');
        }
        const whenFalse = this.parseLevel(0);
        const endTok = this.take();
        if (endTok.kind !== 'name' || endTok.value !== 'endif') {
          throw new Error(
            'expression: expected "endif" to close the conditional',
          );
        }
        return { type: 'ifelse', cond, then: whenTrue, else: whenFalse };
      }
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
        let node: ExprAst = { type: 'call', callee: segs.join('.'), args };
        // The member access on the call result (the OCL property
        // navigation): `.min` / `.max` chain after the closing paren; a
        // zero-arg call on the chain (`.oclIsUndefined()`) wraps the
        // chain as its receiver — the OCL null-check the tiered lookups
        // compose with.
        while (this.peek()?.kind === 'op' && this.peek()!.value === '.') {
          this.take();
          const prop = this.take();
          if (prop.kind !== 'name') {
            throw new Error('expression: expected a property name after "."');
          }
          // The name token carries its dots whole — the segments chain
          // as members, the last one the operation when a call follows.
          const segs = prop.value.split('.');
          for (const seg of segs) {
            node = { type: 'member', object: node, property: seg };
          }
          if (this.peek()?.kind === 'op' && this.peek()!.value === '(') {
            this.take();
            const closing = this.take();
            if (closing.kind !== 'op' || closing.value !== ')') {
              throw new Error(
                'expression: expected closing parenthesis — the property call takes no arguments',
              );
            }
            node = {
              type: 'call',
              callee: segs[segs.length - 1]!,
              args: [node],
            };
          }
        }
        return node;
      }
      // the collection navigation (register 24):
      // source -> forAll(v | body) / exists / select
      const arrow = this.peek();
      if (arrow?.kind === 'op' && arrow.value === '->') {
        this.take();
        const opTok = this.take();
        if (opTok.kind !== 'name' || !NAV_OPS.has(opTok.value)) {
          throw new Error(
            'expression: expected a collection iterator (forAll | exists | select | collect)',
          );
        }
        if (this.peek()?.kind !== 'op' || this.peek()!.value !== '(') {
          throw new Error('expression: expected ( after the iterator');
        }
        this.take();
        const varTok = this.take();
        if (varTok.kind !== 'name') {
          throw new Error('expression: expected the lambda parameter');
        }
        if (this.peek()?.kind !== 'op' || this.peek()!.value !== '|') {
          throw new Error('expression: expected | after the parameter');
        }
        this.take();
        const body = this.parseLevel(0);
        const close = this.take();
        if (close.kind !== 'op' || close.value !== ')') {
          throw new Error('expression: expected closing parenthesis');
        }
        return {
          type: 'nav',
          source: segs.join('.'),
          op: opTok.value,
          var: varTok.value,
          body,
        };
      }
      return { type: 'name', path: segs };
    }
    throw new Error(`expression: unexpected token "${String(tok.value)}"`);
  }
}

export function parseExpression(src: string): ExprAst {
  return new ExprParser(lex(src)).parse();
}

/**
 * The inline-block carrier's canonical form: the raw block text parsed
 * and re-rendered — every carrier stores this, and the canonical source
 * reparses to the same tree (the dump fixpoint).
 */
export function canonicalizeExpression(raw: string): string {
  const body = raw.trim();
  if (body.length === 0) {
    throw new Error('expression: the block is empty');
  }
  return renderExpression(parseExpression(body));
}

// ── the identifier extraction ──────────────────────────────────────────

export interface ExprIdentifiers {
  /** The name leaves, as written (dotted paths joined). */
  names: string[];
  /** The call targets. */
  calls: string[];
}

/** The named leaves and the call targets of the AST. The lambda
 *  parameters bind their bodies: a name rooted at a bound parameter is
 *  the navigation's own, never free. */
export function freeIdentifiers(ast: ExprAst): ExprIdentifiers {
  const out: ExprIdentifiers = { names: [], calls: [] };
  const walk = (node: ExprAst, bound: Set<string>): void => {
    switch (node.type) {
      case 'num':
        return;
      case 'str':
        return;
      case 'bool':
        return;
      case 'ifelse':
        walk(node.cond, bound);
        walk(node.then, bound);
        walk(node.else, bound);
        return;
      case 'name': {
        // the lexer's name token carries its dots whole — the root is
        // the token's first dot-segment, not the path array's
        if (bound.has(node.path[0]!.split('.')[0]!)) {
          return;
        }
        out.names.push(node.path.join('.'));
        return;
      }
      case 'call':
        out.calls.push(node.callee);
        for (const a of node.args) {
          walk(a, bound);
        }
        return;
      case 'member':
        // the property is the result's own field — the object walked
        walk(node.object, bound);
        return;
      case 'unop':
        walk(node.operand, bound);
        return;
      case 'binop':
        walk(node.left, bound);
        walk(node.right, bound);
        return;
      case 'nav': {
        const inner = new Set(bound);
        inner.add(node['var']);
        walk({ type: 'name', path: [node.source] }, bound);
        walk(node.body, inner);
        return;
      }
    }
  };
  walk(ast, new Set());
  return out;
}

/** The canonical source form of the AST (the dumper's output). */
export function renderExpression(ast: ExprAst): string {
  switch (ast.type) {
    case 'num':
      return String(ast.value);
    case 'str':
      return "'" + ast.value + "'";
    case 'bool':
      return ast.value ? 'true' : 'false';
    case 'ifelse':
      return (
        'if ' +
        renderExpression(ast.cond) +
        ' then ' +
        renderExpression(ast.then) +
        ' else ' +
        renderExpression(ast.else) +
        ' endif'
      );
    case 'name':
      return ast.path.join('.');
    case 'call':
      return ast.callee + '(' + ast.args.map(renderExpression).join(', ') + ')';
    case 'member':
      return renderExpression(ast.object) + '.' + ast.property;
    case 'unop': {
      // a unary over a binary needs the parens back — the rendered
      // source must reparse to the same tree
      const inner = renderExpression(ast.operand);
      return (
        ast.op +
        (ast.operand.type === 'binop' ? ' (' + inner + ')' : ' ' + inner)
      );
    }
    case 'nav':
      return (
        ast.source +
        ' -> ' +
        ast.op +
        '(' +
        ast['var'] +
        ' | ' +
        renderExpression(ast.body) +
        ')'
      );
    case 'binop':
      // The precedence-critical parens: a rendered operand wraps when it
      // would reparse to a DIFFERENT tree — a lower-precedence operand
      // under either side (or under and, etc.), or a same-precedence
      // operand on the right (the parser folds same-level chains
      // leftward, so a right-nested chain needs its parens back). The
      // r144 measuring-range guard is the degeneration this prevents:
      // bare `(a or b) and (c or d)` renders as `a or b and c or d` and
      // reparses to a flat disjunction that cannot fail.
      return (
        renderBinopOperand(ast.left, ast.op, 'left') +
        ' ' +
        ast.op +
        ' ' +
        renderBinopOperand(ast.right, ast.op, 'right')
      );
  }
}

const BINOP_LEVEL = new Map(
  BINARY_LEVELS.flatMap((ops, level) => ops.map(op => [op, level] as const)),
);

function renderBinopOperand(
  operand: ExprAst,
  parentOp: string,
  side: 'left' | 'right',
): string {
  const rendered = renderExpression(operand);
  if (
    operand.type === 'binop' &&
    (side === 'right'
      ? BINOP_LEVEL.get(operand.op)! <= BINOP_LEVEL.get(parentOp)!
      : BINOP_LEVEL.get(operand.op)! < BINOP_LEVEL.get(parentOp)!)
  ) {
    return '(' + rendered + ')';
  }
  return rendered;
}

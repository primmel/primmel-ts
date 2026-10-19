// ─────────────────────────────────────────────────────────────────────
// The second checker's expression reader — the second implementation of
// the Primmel expression grammar (register 18). A compact recursive
// descent over whitespace tokens, sharing no code with the kernel's
// expressions module: this one builds a flat node tree with explicit
// parent links and reads identifiers by walking it.
// ─────────────────────────────────────────────────────────────────────

export interface XNode {
  kind: 'num' | 'name' | 'call' | 'bin' | 'un' | 'nav' | 'if';
  op?: string;
  path?: string[];
  callee?: string;
  /** The navigation: the source name and the lambda parameter. */
  source?: string;
  lambda?: string;
  kids: XNode[];
}

const WORD_OPS = ['implies', 'or', 'xor', 'and'];
const CMP_OPS = ['<=', '>=', '!=', '≠', '<', '>', '='];
const FUNCS = new Set([
  'abs',
  'max',
  'min',
  'floor',
  'ceil',
  'round',
  'sqrt',
  'exp',
  'ln',
  'log',
  'mod',
  'sum',
  'count',
  'exists',
  'forall',
  'max_of',
  'min_of',
  'mean_of',
  'stddev_of',
  'count_of',
]);
const CONTEXT_ROOTS = new Set([
  'sample',
  'family',
  'group',
  'model',
  'instrument',
  'specimen',
]);

export const X_FUNCS = FUNCS;
export const X_CONTEXT_ROOTS = CONTEXT_ROOTS;

function tokenizeX(src: string): string[] {
  // the identifiers carry dots, the operators split — the kernel's
  // lexer contract, independently implemented; the single-quoted
  // strings and the navigation tokens ride their own alternatives
  const out: string[] = [];
  const re =
    /[A-Za-z_][\w.]*|\d+(?:\.\d+)?|'[^']*'|->|<=|>=|!=|≠|[<>=()+\-*,./|]/g;
  let m: RegExpExecArray | null;
  let last = 0;
  while ((m = re.exec(src)) !== null) {
    if (m.index > last && src.slice(last, m.index).trim() !== '') {
      return []; // an unlexable gap — the parse fails on it
    }
    out.push(m[0]!);
    last = m.index + m[0].length;
  }
  if (src.slice(last).trim() !== '') {
    return [];
  }
  return out;
}

class XParser {
  private toks: string[];
  private i = 0;

  constructor(src: string) {
    this.toks = tokenizeX(src);
  }

  static parse(src: string): XNode {
    const p = new XParser(src);
    if (p.toks.length === 0) {
      throw new Error('the expression is empty');
    }
    const n = p.binary(0);
    if (p.i !== p.toks.length) {
      throw new Error('trailing tokens');
    }
    return n;
  }

  private peek(): string | undefined {
    return this.toks[this.i];
  }

  private static opLevel(tok: string | undefined): number {
    if (tok === undefined) {
      return -1;
    }
    const wi = WORD_OPS.indexOf(tok);
    if (wi >= 0) {
      return wi;
    }
    if (CMP_OPS.includes(tok)) {
      return 4;
    }
    if (tok === '+' || tok === '-') {
      return 5;
    }
    if (tok === '*' || tok === '/') {
      return 6;
    }
    return -1;
  }

  private binary(level: number): XNode {
    if (level > 6) {
      return this.unary();
    }
    let left = this.binary(level + 1);
    for (;;) {
      const lvl = XParser.opLevel(this.peek());
      if (lvl !== level) {
        return left;
      }
      const op = this.toks[this.i++]!;
      const right = this.binary(level + 1);
      left = { kind: 'bin', op, kids: [left, right] };
    }
  }

  private unary(): XNode {
    const t = this.peek();
    if (t === 'not' || t === '-') {
      this.i++;
      return { kind: 'un', op: t, kids: [this.unary()] };
    }
    return this.primary();
  }

  private primary(): XNode {
    const t = this.toks[this.i++];
    if (t === undefined) {
      throw new Error('unexpected end');
    }
    if (/^[0-9]/.test(t)) {
      return { kind: 'num', kids: [] };
    }
    if (t.startsWith("'")) {
      return { kind: 'num', kids: [] }; // a string: kindless, leaf
    }
    if (t === 'true' || t === 'false') {
      return { kind: 'num', kids: [] }; // a boolean literal: kindless
    }
    if (t === 'if') {
      const cond = this.binary(0);
      if (this.toks[this.i++] !== 'then') {
        throw new Error('expected then in the conditional');
      }
      const whenTrue = this.binary(0);
      if (this.toks[this.i++] !== 'else') {
        throw new Error('expected else in the conditional');
      }
      const whenFalse = this.binary(0);
      if (this.toks[this.i++] !== 'endif') {
        throw new Error('expected endif to close the conditional');
      }
      return { kind: 'if', kids: [cond, whenTrue, whenFalse] };
    }
    if (t === '(') {
      const inner = this.binary(0);
      if (this.toks[this.i++] !== ')') {
        throw new Error('unbalanced parenthesis');
      }
      return inner;
    }
    if (!/^[A-Za-z_]/.test(t)) {
      throw new Error(`unexpected token "${t}"`);
    }
    const segs = t.split('.');
    while (this.peek() === '.') {
      this.i++;
      const seg = this.toks[this.i++];
      if (seg === undefined || !/^[A-Za-z_]/.test(seg)) {
        throw new Error('expected a path segment');
      }
      segs.push(seg);
    }
    if (this.peek() === '(' && !WORD_OPS.includes(segs[0]!)) {
      this.i++;
      if (this.peek() === ')') {
        this.i++;
        return { kind: 'call', callee: segs.join('.'), kids: [] };
      }
      const kids: XNode[] = [];
      for (;;) {
        kids.push(this.binary(0));
        if (this.peek() === ',') {
          this.i++;
          continue;
        }
        break;
      }
      if (this.toks[this.i++] !== ')') {
        throw new Error('unbalanced parenthesis');
      }
      return { kind: 'call', callee: segs.join('.'), kids };
    }
    if (this.peek() === '->') {
      this.i++;
      const op = this.toks[this.i++];
      if (
        op !== 'forAll' &&
        op !== 'exists' &&
        op !== 'select' &&
        op !== 'collect'
      ) {
        throw new Error('expected a collection iterator');
      }
      if (this.peek() !== '(') {
        throw new Error('expected ( after the iterator');
      }
      this.i++;
      const lambda = this.toks[this.i++];
      if (lambda === undefined || !/^[A-Za-z_]/.test(lambda)) {
        throw new Error('expected the lambda parameter');
      }
      if (this.peek() !== '|') {
        throw new Error('expected | after the parameter');
      }
      this.i++;
      const body = this.binary(0);
      if (this.toks[this.i++] !== ')') {
        throw new Error('unbalanced parenthesis');
      }
      return { kind: 'nav', source: segs.join('.'), op, lambda, kids: [body] };
    }
    return { kind: 'name', path: segs, kids: [] };
  }
}

export interface XIds {
  names: string[];
  calls: string[];
  comparisons: { op: string; left: XNode; right: XNode }[];
  mixes: { node: XNode; leftKind: string; rightKind: string }[];
}

/** The identifiers, the calls, the comparisons, and the kind-mix sites
 *  of one expression. The kind inference: a bare number is null; a name
 *  resolves through `kindOf` (the checker's binding map); a comparison
 *  of two known different kinds is a mix. */
export function readExpression(
  src: string,
  kindOf: (path: string[]) => string | null | undefined,
): XIds {
  const root = XParser.parse(src);
  const names: string[] = [];
  const calls: string[] = [];
  const comparisons: XIds['comparisons'] = [];
  const mixes: XIds['mixes'] = [];

  const nodeKind = (n: XNode): string | null | undefined => {
    switch (n.kind) {
      case 'num':
        return null;
      case 'name': {
        if (n.path!.length > 1) {
          const r = n.path![0]!;
          if (r === 'self' || CONTEXT_ROOTS.has(r)) {
            return undefined;
          }
        }
        return kindOf(n.path!);
      }
      case 'call': {
        if (n.callee!.includes('.')) {
          return undefined;
        }
        const kinded = [
          'abs',
          'max',
          'min',
          'floor',
          'ceil',
          'round',
          'sqrt',
          'exp',
          'ln',
          'log',
          'mod',
        ];
        if (!kinded.includes(n.callee!)) {
          return null;
        }
        let acc: string | null | undefined = undefined;
        for (const k of n.kids) {
          const kk = nodeKind(k);
          if (kk === undefined) {
            continue;
          }
          if (acc === undefined || acc === null) {
            acc = kk;
            continue;
          }
          if (kk !== undefined && kk !== null && kk !== acc) {
            mixes.push({ node: n, leftKind: acc, rightKind: kk });
          }
        }
        return acc;
      }
      case 'un':
        return n.op === 'not' ? null : nodeKind(n.kids[0]!);
      case 'if': {
        nodeKind(n.kids[0]!);
        const l = nodeKind(n.kids[1]!);
        const r = nodeKind(n.kids[2]!);
        if (
          l !== undefined &&
          r !== undefined &&
          l !== null &&
          r !== null &&
          l !== r
        ) {
          mixes.push({ node: n, leftKind: l, rightKind: r });
        }
        return l !== undefined && l !== null ? l : r;
      }
      case 'nav':
        return n.op === 'select'
          ? undefined
          : n.op === 'collect'
            ? nodeKind(n.kids[0]!)
            : null;
      case 'bin': {
        if (CMP_OPS.includes(n.op!)) {
          comparisons.push({ op: n.op!, left: n.kids[0]!, right: n.kids[1]! });
          const l = nodeKind(n.kids[0]!);
          const r = nodeKind(n.kids[1]!);
          if (
            l !== undefined &&
            r !== undefined &&
            l !== null &&
            r !== null &&
            l !== r
          ) {
            mixes.push({ node: n, leftKind: l, rightKind: r });
          }
          return null;
        }
        if (WORD_OPS.includes(n.op!)) {
          nodeKind(n.kids[0]!);
          nodeKind(n.kids[1]!);
          return null;
        }
        const l = nodeKind(n.kids[0]!);
        const r = nodeKind(n.kids[1]!);
        if (
          l !== undefined &&
          r !== undefined &&
          l !== null &&
          r !== null &&
          l !== r
        ) {
          mixes.push({ node: n, leftKind: l, rightKind: r });
        }
        return l !== undefined && l !== null ? l : r;
      }
    }
  };

  const walkIds = (n: XNode, bound: Set<string>): void => {
    if (n.kind === 'nav') {
      // the collection itself is free; the lambda parameter binds its
      // body exactly like an argument binds a limit's
      names.push(n.source!);
      const inner = new Set(bound);
      inner.add(n.lambda!.split('.')[0]!);
      walkIds(n.kids[0]!, inner);
      return;
    }
    if (n.kind === 'name') {
      const root = n.path![0]!.split('.')[0]!;
      if (!bound.has(root)) {
        names.push(n.path!.join('.'));
      }
    } else if (n.kind === 'call') {
      calls.push(n.callee!);
    }
    for (const k of n.kids) {
      walkIds(k, bound);
    }
  };
  walkIds(root, new Set());
  nodeKind(root);
  return { names, calls, comparisons, mixes };
}

/** The collection-navigation members of one expression: for each
 *  `source -> op(v | body)`, the dotted fields the lambda body reads
 *  off the parameter (`m.served` → `served`). The variable↔subform
 *  type link's mirror reads these (C182). */
export function readNavMembers(
  src: string,
): { source: string; op: string; lambda: string; fields: string[] }[] {
  const root = XParser.parse(src);
  const out: {
    source: string;
    op: string;
    lambda: string;
    fields: string[];
  }[] = [];
  const walk = (n: XNode, bound: Map<string, string>): void => {
    if (n.kind === 'nav') {
      const fields: string[] = [];
      const collect = (k: XNode, inner: Map<string, string>): void => {
        if (k.kind === 'name' && k.path!.length > 0) {
          const parts = [...k.path![0]!.split('.'), ...k.path!.slice(1)];
          if (parts.length > 1) {
            const srcName = inner.get(parts[0]!);
            if (srcName === n.source) {
              fields.push(parts.slice(1).join('.'));
            }
          }
          return;
        }
        if (k.kind === 'nav') {
          const deeper = new Map(inner);
          deeper.set(k.lambda!.split('.')[0]!, k.source!);
          collect(k.kids[0]!, deeper);
          return;
        }
        for (const kk of k.kids) {
          collect(kk, inner);
        }
      };
      const inner = new Map(bound);
      inner.set(n.lambda!.split('.')[0]!, n.source!);
      collect(n.kids[0]!, inner);
      out.push({ source: n.source!, op: n.op!, lambda: n.lambda!, fields });
      const deeper = new Map(bound);
      deeper.set(n.lambda!.split('.')[0]!, n.source!);
      walk(n.kids[0]!, deeper);
      return;
    }
    for (const k of n.kids) {
      walk(k, bound);
    }
  };
  walk(root, new Map());
  return out;
}

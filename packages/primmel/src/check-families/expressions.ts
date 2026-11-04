// ─────────────────────────────────────────────────────────────────────
// The expressions family (C171 expression-identifiers-resolve, C177
// kind-coherence, and the run plane through the test-program legs):
// the machine-executable expressions are the executable core — every
// identifier inside a limit expression, a derivation, or a derive must
// resolve to a declared name in scope. The region moves verbatim from
// check.ts with its whole machinery (the OCL vocabulary, the global
// expression-name index, the kind maps, the lambda-aware free-
// identifier walk); the compiler and the suite pin the move.
// ─────────────────────────────────────────────────────────────────────

import {
  freeIdentifiers,
  parseExpression,
  renderExpression,
} from '../expressions';
import type ConformanceTest from '../types/ConformanceTest';
import type Symbol from '../types/Symbol';
import type { ExprAst } from '../expressions';
import { loadPackageWithIssues } from '../ser-des/package';
import type { RequirementLimit } from '../types/Requirement';
import type Standard from '../types/Standard';

export interface ExpressionsContext {
  standard: Standard;
  attrIds: Set<string>;
  dimIds: Map<string, Set<string> | null>;
  err: (check: string, message: string) => void;
  warn: (check: string, message: string) => void;
  resolvePackage?: (id: string) => string | undefined;
}

export function runExpressionsFamily({
  standard,
  attrIds,
  dimIds,
  err,
  warn,
  resolvePackage,
}: ExpressionsContext): void {
  // ── C171 expression-identifiers-resolve ─────────────────────────────
  // The machine-executable expressions are the executable core: every
  // identifier inside a limit expression, a derivation, or a derive
  // must resolve to a declared name in scope — the expression's own
  // uses list, the test's declared variables, or the package's
  // symbols/datums/verdicts. An identifier naming nothing is air inside
  // the formula. Dotted paths (the subject-chain binds) and the OCL
  // keywords are not identifiers for this purpose.
  const OCL_WORDS = new Set([
    'and',
    'or',
    'not',
    'xor',
    'implies',
    'if',
    'then',
    'else',
    'endif',
    'true',
    'false',
    'null',
    'invalid',
    'abs',
    'max',
    'min',
    'floor',
    'ceil',
    'mod',
    'div',
    'round',
    'sqrt',
    'exp',
    'ln',
    'log',
    'sum',
    'count',
    'exists',
    // The series-access vocabulary (the series construct's read
    // operations): window selects the readings inside a range of an
    // axis, reading_at reads one cell's value at an axis point — the
    // creep-family derivations are their case. oclIsUndefined is the
    // OCL null-check the tiered lookups compose with.
    'window',
    'reading_at',
    'oclIsUndefined',
    'forall',
    'oclIsUndefined',
    'oclIsKindOf',
    'oclIsTypeOf',
    'String',
    'Integer',
    'Real',
    'Boolean',
    'Set',
    'Bag',
    'Sequence',
    'Collection',
    // the subject-chain roots: every expression reads the dispatch
    // context through them — context, never air
    'sample',
    'family',
    'group',
    'model',
    'instrument',
    'specimen',
    'max_of',
    'min_of',
    'mean_of',
    'stddev_of',
    'count_of',
  ]);
  const globalExprNames = new Set<string>(
    [
      ...(standard.symbols ?? []).map(s => s.id),
      ...(standard.symbols ?? []).map(s => s.id.split('/').pop() ?? ''),
      // the measurement plane (the spec's canonical test-quantity
      // keyword, MN 113 §2.3; `variable` is the legacy alias) — an
      // `observable:` arg binds these like the kind-observable symbols
      ...(standard.variables ?? []).map(v => v.id),
      ...(standard.variables ?? []).map(v => v.id.split('/').pop() ?? ''),
      ...(standard.datums ?? []).map(d => d.id),
      ...(standard.verdicts ?? []).map(v => v.id),
      // the lookup tables: a dotted helper call's OBJECT is declared here —
      // the method name rides the declared object
      ...(standard.tables ?? []).map(v => v.id),
      // the subject anatomy: a declared attribute is a declaration
      ...(standard.attributeDefinitions ?? []).map(a => a.id),
      ...(standard.attributeDefinitions ?? []).map(
        a => a.id.split('/').pop() ?? '',
      ),
      // the calculations: a derivation may call a declared calculation
      // (twin-cert's lookupMPE) — the callable registry
      ...(standard.calculations ?? []).map(c => c.id),
      ...(standard.calculations ?? []).map(c => c.id.split('/').pop() ?? ''),
    ].filter(x => x !== ''),
  );

  // The declared quantity kinds (C177 kind-coherence): only the
  // declarations that STATE a kind participate; everything else is
  // unknown and never conflicts.
  const symbolKinds = new Map<string, string>();
  for (const s of standard.symbols ?? []) {
    if (s.quantityKind) {
      symbolKinds.set(s.id, s.quantityKind);
      symbolKinds.set(s.id.split('/').pop() ?? '', s.quantityKind);
    }
  }
  const attributeKinds = new Map<string, string>();
  for (const a of standard.attributeDefinitions ?? []) {
    if ((a as { quantityKind?: string }).quantityKind) {
      attributeKinds.set(a.id, (a as { quantityKind?: string }).quantityKind!);
      attributeKinds.set(
        a.id.split('/').pop() ?? '',
        (a as { quantityKind?: string }).quantityKind!,
      );
    }
  }
  const verdictKinds = new Map<string, string>();
  for (const v of standard.verdicts ?? []) {
    if (v.quantityKind) {
      verdictKinds.set(v.id, v.quantityKind);
    }
  }
  const tableColumnTypes = new Map<string, Map<string, string>>();
  for (const t of standard.tables ?? []) {
    const cols = new Map<string, string>();
    for (const c of t.columnDefs ?? []) {
      cols.set(c.name, (c.type || '').toLowerCase());
    }
    if (cols.size > 0) {
      tableColumnTypes.set(t.id, cols);
    }
  }
  const bare = (q: string): string => q.split(':').pop() ?? q;
  const usesCovers = (uses: string[], id: string): boolean =>
    uses.some(u => {
      const tail = bare(u.replace(/\./g, ':'));
      return u === id || tail === id || u.endsWith('.' + id);
    });
  const exprIds = (expr: string): string[] => {
    // dotted paths are WHOLE references: the interior segments are the
    // chain's structure — only the final segment names the datum, and
    // usesCovers judges the path against the uses entries.
    const paths =
      expr.match(/[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*/g) ?? [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const p of paths) {
      if (p.includes('.')) {
        const segs = p.split('.');
        // a method call on a declared object (table.permits(...)) rides
        // the declared object — the final segment is its method
        if (globalExprNames.has(segs[0])) {
          continue;
        }
        const finalSeg = segs[segs.length - 1];
        if (!seen.has(p)) {
          seen.add(p);
          if (!OCL_WORDS.has(finalSeg)) {
            out.push(finalSeg);
          }
        }
        continue;
      }
      if (!OCL_WORDS.has(p) && !seen.has(p)) {
        seen.add(p);
        out.push(p);
      }
    }
    return out;
  };
  const unresolvedIn = (
    expr: string,
    scope: string[],
    uses: string[],
  ): string[] => {
    const scopeSet = new Set([...scope, ...globalExprNames]);
    const seen = new Set<string>();
    const out: string[] = [];
    const push = (id: string): void => {
      if (seen.has(id)) {
        return;
      }
      seen.add(id);
      if (
        OCL_WORDS.has(id) ||
        id.startsWith('#') ||
        scopeSet.has(id) ||
        usesCovers(uses, id)
      ) {
        return;
      }
      out.push(id);
    };
    // The lambda-aware walk: the nav iterators (runs->collect(r | …))
    // scope their variable, and calls resolve as CALLABLES (the
    // calculation registry) with their arguments walked as names — the
    // regex extractor counted the iterator variable and the nav method
    // as free names (the r60-lml repeatability derivations were the
    // case). A body that does not parse falls back to the regex view.
    try {
      const ids = freeIdentifiers(parseExpression(expr));
      for (const n of ids.names) {
        // The self-rooted paths read the entity's own fields (the
        // dispatch-context doctrine the inline arm applies): the root
        // never resolves against the scope — skipped whole.
        if (n === 'self' || n.startsWith('self.')) {
          continue;
        }
        // A dotted path whose ROOT is a declared sibling rides the
        // record — the fields are the record's own (initial_run.span_vmin
        // is the case).
        if (n.includes('.') && scopeSet.has(n.split('.')[0]!)) {
          continue;
        }
        push(n);
      }
      for (const c of ids.calls) {
        if (
          c.includes('.') &&
          (scopeSet.has(c.split('.')[0]!) ||
            CONTEXT_ROOTS.has(c.split('.')[0]!))
        ) {
          continue;
        }
        push(c);
      }
      return out;
    } catch {
      for (const id of exprIds(expr)) {
        push(id);
      }
      return out;
    }
  };
  // The mapped computations (register: the mapped-callee plane): a
  // certification program maps to its Recommendations (`maps_to`), and
  // its derivations invoke the mapped Recommendation's declared
  // computations — by reference, never restated. The ids join the
  // callable registry, locator-gated like C168's scoped leg.
  const mappedCalcIds = new Set<string>();
  {
    const mapsTo = standard.packageManifest?.mapsTo ?? [];
    for (const target of mapsTo) {
      if (!resolvePackage) {
        continue;
      }
      try {
        const depDir = resolvePackage(target);
        if (!depDir) {
          continue;
        }
        const dep = loadPackageWithIssues(depDir);
        for (const c of dep.standard?.calculations ?? []) {
          mappedCalcIds.add(c.id);
          mappedCalcIds.add(c.id.split('/').pop() ?? '');
        }
      } catch {
        // Unreadable mapped package — C27 reports the resolution
        // failure; this registry stays silent rather than
        // double-reporting.
      }
    }
    for (const x of mappedCalcIds) {
      if (x !== '') {
        globalExprNames.add(x);
      }
    }
  }

  // The v3.3 inline limit: the AST walked against the args scope. The
  // body's identifiers are the args and nothing else (plus `self`-rooted
  // paths — the dispatch context — and the closed function vocabulary);
  // `memberScope` (a class law) adds the containment to the scope.
  const INLINE_FUNCTION_WORDS = new Set([
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
    // the series aggregations (register W4): the GUM type A vocabulary —
    // the statistics of a captured series; the evaluation is plurimath's
    'max_of',
    'min_of',
    'mean_of',
    'stddev_of',
    'count_of',
    // the OCL null-check literal's call form — OCL_WORDS carries the
    // word; the calls leg needs the call spelling too
    'oclIsUndefined',
    // the runtime's own list aggregator (average(list)): the call form
    // the runtime evaluator implements, so the checker's vocabulary
    // carries the same callable
    'average',
    // the series-access vocabulary (OCL_WORDS carries the words): the
    // creep-family derivations read their windows positionally
    'reading_at',
    'window',
  ]);
  const DECLARATION_KINDS = new Set([
    'symbol',
    'table',
    'datum',
    'verdict',
    'attribute',
    'process',
    // the observable prefix resolves against the symbols registry
    // (kind observable) — C53's limit.uses leg resolves the same way
    'observable',
    // the measurement plane joins the expression registry (the C171
    // closure) — the args walk accepts its sources symmetrically
    'measurement',
  ]);
  // the dispatch-context roots: the chain the expression reads the
  // subject through — allowed as PATH roots, never as bare scalars
  const CONTEXT_ROOTS = new Set([
    'sample',
    'family',
    'group',
    'model',
    'instrument',
    'specimen',
  ]);
  const checkInlineLimit = (
    ownerKind: string,
    ownerId: string,
    limit: RequirementLimit,
    memberScope: Set<string> | null,
  ): void => {
    let ast: ExprAst;
    try {
      ast = parseExpression(limit.expression);
    } catch (e) {
      err(
        'C171',
        `${ownerKind} ${ownerId}: the inline limit expression does not parse — ${String((e as Error).message ?? e)} (expression-identifiers-resolve)`,
      );
      return;
    }
    const ids = freeIdentifiers(ast);
    const args = limit.args ?? [];
    const argNames = new Set(args.map(a => a.name));
    // the expression's own uses list binds (the C171 doctrine's second
    // registry): a name the uses list covers is declared, exactly like
    // an args binding
    const uses = limit.uses ?? [];
    const bareUse = (q: string): string => q.split(':').pop() ?? q;
    const useCoversId = (id: string): boolean =>
      uses.some(u => {
        const tail = bareUse(u.replace(/\./g, ':'));
        return u === id || tail === id || u.endsWith('.' + id);
      });
    // the OCL literals (true/false/null/invalid) are words, never free
    // identifiers — the inline carrier's strict walk sees them raw
    const freeNames = ids.names.filter(
      n => !OCL_WORDS.has(n) && !n.startsWith('#'),
    );
    if (
      memberScope === null &&
      args.length === 0 &&
      freeNames.some(n => !n.includes('.') && !useCoversId(n))
    ) {
      // a body over pure dispatch-context paths (`sample.test_context.*`)
      // binds nothing and is legal; any bare identifier is ambient air
      err(
        'C171',
        `${ownerKind} ${ownerId}: the inline limit declares no arguments — every identifier must bind explicitly, args { name <- <declaration> } (expression-identifiers-resolve)`,
      );
    }
    for (const call of new Set(ids.calls)) {
      if (INLINE_FUNCTION_WORDS.has(call)) {
        continue;
      }
      if (globalExprNames.has(call)) {
        // a declared callable — the calculation registry (twin-cert's
        // mpe(…), R 49's relative_error(…))
        continue;
      }
      if (call.includes('.')) {
        const root = call.split('.')[0];
        if (
          argNames.has(root) ||
          globalExprNames.has(root) ||
          root === 'self' ||
          CONTEXT_ROOTS.has(root)
        ) {
          // the method rides its declared object — the root is the check
          continue;
        }
      }
      if (argNames.has(call)) {
        // an arg-bound callable — the table lookup the args declare
        continue;
      }
      err(
        'C171',
        `${ownerKind} ${ownerId}: the limit calls "${call}(…)", which no argument binds and which is not in the expression function vocabulary (abs max min floor ceil round sqrt exp ln log mod sum count exists forall) — air inside the formula (expression-identifiers-resolve)`,
      );
    }
    for (const id of new Set(freeNames)) {
      if (useCoversId(id)) {
        continue;
      }
      const root = id.split('.')[0];
      if (id.includes('.')) {
        if (root === 'self' || argNames.has(root) || useCoversId(root)) {
          continue;
        }
        if (CONTEXT_ROOTS.has(root)) {
          // the dispatch-context leaf leg (CRITIQUE-2 #4's residue): a
          // DECLARABLE plane resolves its leaf — the attribute planes
          // ({model,family,group}.{parameters,attributes}.X) join the
          // attribute registry (C53's uses leg already compares the
          // same leaf) and the classification plane joins the
          // dimension registry. The run-context roots (sample.*,
          // instrument.*, specimen.*) carry runtime data and stay
          // open; the other planes (aspects, channels) have no
          // registry to join.
          const segs = id.split('.');
          const plane = segs[1];
          const leaf = segs[segs.length - 1];
          if (
            segs.length >= 3 &&
            (plane === 'parameters' || plane === 'attributes')
          ) {
            if (!attrIds.has(leaf)) {
              err(
                'C171',
                `${ownerKind} ${ownerId}: the limit expression reads "${id}" — the ${root} ${plane} declares no "${leaf}" (expression-identifiers-resolve)`,
              );
            }
          } else if (segs.length >= 3 && plane === 'classification') {
            if (!dimIds.has(leaf)) {
              err(
                'C171',
                `${ownerKind} ${ownerId}: the limit expression reads "${id}" — no declared classification dimension "${leaf}" (expression-identifiers-resolve)`,
              );
            }
          }
          continue;
        }
      }
      if (argNames.has(id)) {
        continue;
      }
      if (memberScope !== null && memberScope.has(id)) {
        continue;
      }
      const lawScoped = memberScope !== null;
      const fix = lawScoped
        ? 'the law composes the containment only — its identifiers are the members'
        : 'add args { ' + id + ' <- <declaration> } or remove it';
      err(
        lawScoped ? 'C172' : 'C171',
        `${ownerKind} ${ownerId}: the limit expression names "${id}", which no argument binds — ${fix} (${lawScoped ? 'requirement-algebra-resolves' : 'expression-identifiers-resolve'})`,
      );
    }
    for (const a of args) {
      if (a.source.includes(':')) {
        const segs = a.source.split(':');
        if (segs.some(s => s.length === 0)) {
          err(
            'C171',
            `${ownerKind} ${ownerId}: argument "${a.name}" binds to "${a.source}" — a binding is <kind>:<id> in this package or <package>:<kind>:<id> across a uses edge (expression-identifiers-resolve)`,
          );
          continue;
        }
        if (segs.length === 2) {
          const [kind, id] = segs;
          if (kind === 'process') {
            // register 19: `process:<p>[.<step>[.<io>]]` — the dot
            // descends the declared structure, the leaf names a
            // declared io
            const segs2 = id.split('.');
            const proc = (standard.processes ?? []).find(
              pp => pp.id === segs2[0],
            );
            if (!proc) {
              err(
                'C171',
                `${ownerKind} ${ownerId}: argument "${a.name}" binds to "${a.source}", which no declared process names — air inside the formula (expression-identifiers-resolve)`,
              );
            } else if (segs2.length >= 2) {
              const stp = (proc.steps ?? []).find(ss => ss.id === segs2[1]);
              if (!stp) {
                err(
                  'C171',
                  `${ownerKind} ${ownerId}: argument "${a.name}" binds to "${a.source}" — the process declares no step "${segs2[1]}" (expression-identifiers-resolve)`,
                );
              } else if (segs2.length >= 3) {
                const io = segs2.slice(2).join('.');
                if (
                  !(stp.sigInputs ?? []).includes(io) &&
                  !(stp.sigOutputs ?? []).includes(io)
                ) {
                  err(
                    'C171',
                    `${ownerKind} ${ownerId}: argument "${a.name}" binds to "${a.source}" — the step declares no io "${io}" (expression-identifiers-resolve)`,
                  );
                }
              }
            }
            continue;
          }
          // `observable:` resolves like every declaration kind — the
          // observables live in the symbols registry (kind observable),
          // so the id lands in globalExprNames like any symbol (C53's
          // leg resolves the same prefix in limit.uses).
          if (!DECLARATION_KINDS.has(kind)) {
            err(
              'C171',
              `${ownerKind} ${ownerId}: argument "${a.name}" binds to "${a.source}" — "${kind}" is not a declaration kind (symbol table datum verdict attribute observable) (expression-identifiers-resolve)`,
            );
            continue;
          }
          const idRoot = id.split('.')[0];
          const idTail = id.split('.').pop() ?? id;
          if (
            !globalExprNames.has(id) &&
            !globalExprNames.has(idRoot) &&
            !globalExprNames.has(idTail)
          ) {
            err(
              'C171',
              `${ownerKind} ${ownerId}: argument "${a.name}" binds to "${a.source}", which no declared ${kind} names — air inside the formula (expression-identifiers-resolve)`,
            );
          }
          continue;
        }
        // <package>:<kind>:<id> across a uses edge — the composed gate
        // resolves it against the closure.
        continue;
      }
      if (a.source === 'self' || a.source.startsWith('self.')) {
        continue;
      }
      const bare = (q: string): string => q.split(':').pop() ?? q;
      const sourceBare = bare(a.source.replace(/\./g, ':'));
      if (memberScope !== null) {
        if (!memberScope.has(a.source) && !memberScope.has(sourceBare)) {
          err(
            'C172',
            `requirement class ${ownerId}: the law binds "${a.name}" to "${a.source}", which is not a contained member (requirement-algebra-resolves)`,
          );
        }
        continue;
      }
      if (
        !globalExprNames.has(a.source) &&
        !globalExprNames.has(sourceBare) &&
        !usesCovers(limit.uses, sourceBare)
      ) {
        err(
          'C171',
          `${ownerKind} ${ownerId}: argument "${a.name}" binds to "${a.source}", which no symbol, datum, verdict, attribute, or uses entry declares — air inside the formula (expression-identifiers-resolve)`,
        );
      }
    }
    // ── C194 collection-element-resolves ─────────────────────────────
    // CRITIQUE-3 #4: an arg bound to `collection<T>` gives the
    // navigation's lambda parameter T's shape — the member accesses
    // rooted at the parameter resolve against the class's attributes,
    // and an unknown member is air. A bare `collection` stays untyped
    // (the parameterized form is opt-in).
    {
      const elementOf = new Map<string, string>();
      for (const a of args) {
        if (!a.source.includes(':')) {
          continue;
        }
        const segs = a.source.split(':');
        if (
          segs.length !== 2 ||
          (segs[0] !== 'observable' && segs[0] !== 'symbol')
        ) {
          continue;
        }
        const id = segs[1]!;
        const decl =
          (standard.symbols ?? []).find(
            (s: Symbol) => s.id === id || s.id.split('/').pop() === id,
          ) ?? (standard.variables ?? []).find(v => v.id === id);
        const t = (decl as { type?: string } | undefined)?.type ?? '';
        const m = /^collection<([A-Za-z0-9_]+)>$/.exec(t);
        if (m) {
          elementOf.set(a.name, m[1]!);
        }
      }
      if (elementOf.size > 0 && ast !== null) {
        const fieldsOf = new Map<string, Set<string>>();
        for (const dc of standard.dataclasses ?? []) {
          const fields = new Set(dc.attributes.map(f => f.id));
          fieldsOf.set(dc.id, fields);
          // the class head id may carry a marker (`X#data`); the type
          // parameter names the bare head
          const bare = dc.id.split('#')[0]!;
          if (bare !== dc.id && !fieldsOf.has(bare)) {
            fieldsOf.set(bare, fields);
          }
        }
        const membersOf = (
          n: ExprAst,
          node: { source: string; var: string },
          elem: string,
          fields: Set<string>,
        ): void => {
          if (n.type === 'name') {
            const segs = n.path[0]!.split('.');
            if (
              segs[0] === node['var'] &&
              segs.length >= 2 &&
              !fields.has(segs[1]!)
            ) {
              err(
                'C194',
                `${ownerKind} ${ownerId}: the element type "${elem}" declares no member "${segs[1]}" — the lambda reads "${node['var']}.${segs[1]}" against the class's attributes (${[...fields].join(', ') || 'none'}) (collection-element-resolves)`,
              );
            }
            return;
          }
          switch (n.type) {
            case 'binop':
              membersOf(n.left, node, elem, fields);
              membersOf(n.right, node, elem, fields);
              return;
            case 'unop':
              membersOf(n.operand, node, elem, fields);
              return;
            case 'ifelse':
              membersOf(n.cond, node, elem, fields);
              membersOf(n.then, node, elem, fields);
              membersOf(n.else, node, elem, fields);
              return;
            case 'call':
              for (const x of n.args) {
                membersOf(x, node, elem, fields);
              }
              return;
            case 'member':
              membersOf(n.object, node, elem, fields);
              return;
            default:
              return;
          }
        };
        const visit = (node: ExprAst): void => {
          switch (node.type) {
            case 'nav': {
              const elem = elementOf.get(node.source);
              if (elem !== undefined) {
                const fields = fieldsOf.get(elem);
                if (!fields) {
                  err(
                    'C194',
                    `${ownerKind} ${ownerId}: the navigation over "${node.source}" reads element type "${elem}", which names no declared data class (collection-element-resolves)`,
                  );
                } else {
                  membersOf(node.body, node, elem, fields);
                }
              }
              visit(node.body);
              return;
            }
            case 'binop':
              visit(node.left);
              visit(node.right);
              return;
            case 'unop':
              visit(node.operand);
              return;
            case 'ifelse':
              visit(node.cond);
              visit(node.then);
              visit(node.else);
              return;
            case 'call':
              for (const x of node.args) {
                visit(x);
              }
              return;
            case 'member':
              visit(node.object);
              return;
            default:
              return;
          }
        };
        visit(ast);
      }
    }
    // ── C177 kind-coherence ──────────────────────────────────────────
    // The comparisons compare operands of the same declared quantity
    // kind. The kinds come from the args' declared sources; an operand
    // of unknown kind or a bare number never conflicts — the check is
    // exact where the declarations are, silent everywhere else.
    const kindLabel = (k: string | null | 'TEXT' | undefined): string =>
      k === undefined
        ? 'an operand of unknown kind'
        : k === 'TEXT'
          ? 'text'
          : k === null
            ? 'a bare number'
            : `the "${k}" quantity`;
    const argKindOf = (source: string): string | null | 'TEXT' | undefined => {
      if (source.includes(':')) {
        const segs = source.split(':');
        if (segs.length !== 2) {
          return undefined;
        }
        const [kind, id] = segs;
        if (kind === 'symbol') {
          return symbolKinds.get(id.split('.').pop() ?? id);
        }
        if (kind === 'attribute') {
          return attributeKinds.get(id.split('.').pop() ?? id);
        }
        if (kind === 'verdict') {
          return verdictKinds.get(id.split('.')[0]);
        }
        if (kind === 'table') {
          const segs2 = id.split('.');
          const colType =
            segs2.length === 2
              ? tableColumnTypes.get(segs2[0])?.get(segs2[1])
              : undefined;
          return colType === 'string' ? 'TEXT' : undefined;
        }
        return undefined;
      }
      if (source === 'self' || source.startsWith('self.')) {
        return undefined;
      }
      return symbolKinds.get(source) ?? attributeKinds.get(source) ?? undefined;
    };
    const kindConflicts = new Set<string>();
    const kindMixErr = (
      node: ExprAst,
      l: string | null | 'TEXT' | undefined,
      r: string | null | 'TEXT' | undefined,
    ): void => {
      const key = renderExpression(node);
      if (kindConflicts.has(key)) {
        return;
      }
      kindConflicts.add(key);
      err(
        'C177',
        `${ownerKind} ${ownerId}: ${kindLabel(l)} is set against ${kindLabel(r)} in "${renderExpression(node)}" — the operands must share the quantity kind (kind-coherence)`,
      );
    };
    const kindOf = (node: ExprAst): string | null | 'TEXT' | undefined => {
      switch (node.type) {
        case 'num':
          return null;
        case 'str':
          return null;
        case 'bool':
          return null;
        case 'ifelse': {
          kindOf(node.cond);
          const l = kindOf(node.then);
          const r = kindOf(node.else);
          if (
            l !== undefined &&
            r !== undefined &&
            l !== null &&
            r !== null &&
            l !== r
          ) {
            kindMixErr(node, l, r);
          }
          return l !== undefined && l !== null ? l : r;
        }
        case 'name': {
          const root = node.path[0];
          if (
            node.path.length > 1 &&
            (root === 'self' || CONTEXT_ROOTS.has(root))
          ) {
            return undefined;
          }
          const arg = args.find(a => a.name === root);
          return arg ? argKindOf(arg.source) : undefined;
        }
        case 'member': {
          // The property's kind is the result record's — not derivable
          // here; the object walked for the operands it carries.
          kindOf(node.object);
          return undefined;
        }
        case 'call': {
          if (node.callee.includes('.')) {
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
          if (!kinded.includes(node.callee)) {
            return null;
          }
          let acc: string | null | 'TEXT' | undefined = undefined;
          for (const a of node.args) {
            const k = kindOf(a);
            if (k === undefined) {
              continue;
            }
            if (acc === undefined || acc === null) {
              acc = k;
              continue;
            }
            if (k !== undefined && k !== null && k !== acc) {
              kindMixErr(node, acc, k);
            }
          }
          return acc;
        }
        case 'unop':
          return node.op === 'not' ? null : kindOf(node.operand);
        case 'nav':
          // the iteration predicate's truth over the collection: the
          // boolean iterators; select keeps the source's kind — its
          // element kind is the collection's, unknown here; collect
          // projects to a collection of the body's element kind
          return node.op === 'select'
            ? undefined
            : node.op === 'collect'
              ? kindOf(node.body)
              : null;
        case 'binop': {
          if (['<=', '>=', '<', '>', '=', '!=', '≠'].includes(node.op)) {
            const l = kindOf(node.left);
            const r = kindOf(node.right);
            if (
              l !== undefined &&
              r !== undefined &&
              l !== null &&
              r !== null &&
              l !== r
            ) {
              kindMixErr(node, l, r);
            }
            return null;
          }
          if (['and', 'or', 'xor', 'implies'].includes(node.op)) {
            kindOf(node.left);
            kindOf(node.right);
            return null;
          }
          const l = kindOf(node.left);
          const r = kindOf(node.right);
          if (
            l !== undefined &&
            r !== undefined &&
            l !== null &&
            r !== null &&
            l !== r
          ) {
            kindMixErr(node, l, r);
          }
          return l !== undefined && l !== null ? l : r;
        }
      }
    };
    kindOf(ast);
  };
  // the applicability guard: a boolean expression over the limit's own
  // args — the same resolution, plus the boolean top (C84's shape, the
  // guard is a predicate)
  const checkGuard = (rid: string, name: string, lim: RequirementLimit) => {
    if (!lim.when) {
      return;
    }
    const args = new Set((lim.args ?? []).map(a => a.name));
    try {
      const ast = parseExpression(lim.when);
      const ids = freeIdentifiers(ast);
      for (const call of new Set(ids.calls)) {
        if (!INLINE_FUNCTION_WORDS.has(call)) {
          err(
            'C171',
            `requirement ${rid}: limit ${name}'s when-guard calls "${call}(…)", which no argument binds and which is not in the expression function vocabulary (expression-identifiers-resolve)`,
          );
        }
      }
      for (const id of new Set(ids.names)) {
        const root = id.split('.')[0];
        if (
          args.has(id) ||
          (id.includes('.') &&
            (root === 'self' || CONTEXT_ROOTS.has(root) || args.has(root)))
        ) {
          continue;
        }
        err(
          'C171',
          `requirement ${rid}: limit ${name}'s when-guard names "${id}", which no argument binds (expression-identifiers-resolve)`,
        );
      }
      const top = ast.type;
      if (!(
        (top === 'binop' &&
          [
            '<=',
            '>=',
            '<',
            '>',
            '=',
            '!=',
            '≠',
            'and',
            'or',
            'xor',
            'implies',
          ].includes((ast as { op: string }).op)) ||
        (top === 'unop' && (ast as { op: string }).op === 'not')
      )) {
        err(
          'C84',
          `requirement ${rid}: limit ${name}'s when-guard does not evaluate to a boolean — the guard is one comparison or logical composition (constraint-shape)`,
        );
      }
    } catch (e) {
      err(
        'C171',
        `requirement ${rid}: limit ${name}'s when-guard does not parse — ${String((e as Error).message ?? e)} (expression-identifiers-resolve)`,
      );
    }
  };
  for (const r of standard.requirements ?? []) {
    if (r.limit?.argsBound) {
      checkInlineLimit('requirement', r.id, r.limit, null);
      checkGuard(r.id, '(the unnamed limit)', r.limit);
    }
    for (const lim of r.limits ?? []) {
      const label = lim.name ? `"${lim.name}"` : '(an unnamed limit)';
      if (lim.argsBound) {
        checkInlineLimit('requirement', r.id, lim, null);
      } else if (lim.expression) {
        // the named limits carry the inline carrier (the guard needs
        // the args scope; a legacy string in the list form is air)
        err(
          'C171',
          `requirement ${r.id}: limit ${label} must carry the inline carrier — args { … } and expression { … } (expression-identifiers-resolve)`,
        );
      }
      checkGuard(r.id, label, lim);
    }
    if (r.limit?.argsBound || (r.limits ?? []).length > 0) {
      continue;
    }
    const expr = r.limit?.expression;
    if (!expr) {
      continue;
    }
    const ocl = expr.replace(/^ocl\{/, '').replace(/\}$/, '');
    const uses = r.limit?.uses ?? [];
    for (const id of unresolvedIn(ocl, [], uses)) {
      err(
        'C171',
        `requirement ${r.id}: the limit expression names "${id}", which no uses entry, symbol, datum, or verdict declares — air inside the formula (expression-identifiers-resolve)`,
      );
    }
  }
  // The inline carriers (derive / derivation / check blocks): the
  // AST-exact resolution — the free names against the carrier's declared
  // scope plus the package's declared registries; the calls against the
  // function vocabulary and the declared callables.
  const resolveInlineCarrier = (
    ownerKind: string,
    ownerId: string,
    what: string,
    src: string,
    scope: Set<string>,
  ): void => {
    let ast: ExprAst;
    try {
      ast = parseExpression(src);
    } catch (e) {
      err(
        'C171',
        `${ownerKind} ${ownerId}: the ${what} does not parse — ${String((e as Error).message ?? e)} (expression-identifiers-resolve)`,
      );
      return;
    }
    const ids = freeIdentifiers(ast);
    for (const call of new Set(ids.calls)) {
      if (INLINE_FUNCTION_WORDS.has(call)) {
        continue;
      }
      if (call.includes('.')) {
        const root = call.split('.')[0];
        if (
          scope.has(root) ||
          globalExprNames.has(root) ||
          root === 'self' ||
          CONTEXT_ROOTS.has(root)
        ) {
          continue;
        }
      }
      if (scope.has(call) || globalExprNames.has(call)) {
        continue;
      }
      err(
        'C171',
        `${ownerKind} ${ownerId}: the ${what} calls "${call}(…)", which nothing declares and which is not in the expression function vocabulary — air inside the formula (expression-identifiers-resolve)`,
      );
    }
    for (const id of new Set(ids.names)) {
      const root = id.split('.')[0];
      if (
        id.includes('.') &&
        (scope.has(root) || root === 'self' || CONTEXT_ROOTS.has(root))
      ) {
        continue;
      }
      if (scope.has(id)) {
        continue;
      }
      if (
        globalExprNames.has(id) ||
        globalExprNames.has(id.split('.').pop() ?? id)
      ) {
        continue;
      }
      err(
        'C171',
        `${ownerKind} ${ownerId}: the ${what} names "${id}", which nothing in scope declares — air inside the formula (expression-identifiers-resolve)`,
      );
    }
  };
  for (const v of standard.verdicts ?? []) {
    const expr = (v as unknown as { derive?: string }).derive;
    if (!expr) {
      continue;
    }
    const inputs = (v as unknown as { inputs?: string[] }).inputs ?? [];
    if ((v as unknown as { deriveBound?: boolean }).deriveBound) {
      resolveInlineCarrier('verdict', v.id, 'derive', expr, new Set(inputs));
      continue;
    }
    // the legacy leg: the ocl{…} wrapper strips before the regex walk
    const ocl = expr.replace(/^ocl\{/, '').replace(/\}$/, '');
    for (const id of unresolvedIn(ocl, inputs, [])) {
      err(
        'C171',
        `verdict ${v.id}: the derive expression names "${id}", which no input declares — air inside the formula (expression-identifiers-resolve)`,
      );
    }
  }
  // ── the run plane (input ⇒ output ⇒ store) ─────────────────────────
  const runChecks = (t: ConformanceTest): void => {
    const run = t.run;
    if (!run) {
      return;
    }
    if (
      run.performedBy !== 'laboratory' &&
      run.performedBy !== 'manufacturer'
    ) {
      err(
        'C180',
        `conformance test ${t.id}: run performer "${run.performedBy}" is outside the closed vocabulary (laboratory | manufacturer) (run-plane-shape)`,
      );
    }
    if (run.store) {
      const reg = (standard.regs ?? []).find(r => r.id === run.store);
      if (!reg) {
        err(
          'C180',
          `conformance test ${t.id}: run store "${run.store}" names no declared data_registry — the collected records land in a declared store (run-plane-shape)`,
        );
      } else if (reg.data?.id) {
        for (const formId of t.resultForms ?? []) {
          const form = (standard.forms ?? []).find(f => f.id === formId);
          if (form?.dataClassId && form.dataClassId !== reg.data.id) {
            err(
              'C181',
              `conformance test ${t.id}: the run's store "${run.store}" holds ${reg.data.id}, but its record form ${formId} captures ${form.dataClassId} — the output records and the store must agree on the data class (run-store-binds)`,
            );
          }
        }
      }
    }
    if (run.trajectory) {
      const machine = (standard.stateMachines ?? []).find(
        m =>
          (m as unknown as { entityName?: string }).entityName ===
          run.trajectory,
      );
      if (!machine) {
        err(
          'C180',
          `conformance test ${t.id}: run trajectory "${run.trajectory}" names no declared state_machine — the run folds a declared trajectory (run-plane-shape)`,
        );
      }
    }
    for (const input of run.inputs ?? []) {
      const v = (t.variables ?? []).find(x => x.name === input);
      if (!v) {
        err(
          'C180',
          `conformance test ${t.id}: run input "${input}" names no declared variable — the applied-input contract binds the test's own declarations (run-plane-shape)`,
        );
      } else if (v.source !== 'declared') {
        err(
          'C180',
          `conformance test ${t.id}: run input "${input}" is source ${v.source} — an applied input is declared by the author; a measured variable is an output of the run, never an input (run-plane-shape)`,
        );
      }
    }
  };
  for (const t of standard.conformanceTests ?? []) {
    const scope = (t.variables ?? []).map(v => v.name);
    runChecks(t);
    for (const v of t.variables ?? []) {
      if (!v.derivation) {
        continue;
      }
      if (v.derivationBound) {
        resolveInlineCarrier(
          'conformance test',
          t.id,
          `variable ${v.name}'s derivation`,
          v.derivation,
          new Set(scope),
        );
        continue;
      }
      const ocl = v.derivation.replace(/^ocl\{/, '').replace(/\}$/, '');
      for (const id of unresolvedIn(ocl, scope, [])) {
        err(
          'C171',
          `conformance test ${t.id}: variable ${v.name}'s derivation names "${id}", which no sibling variable, symbol, datum, or verdict declares — air inside the formula (expression-identifiers-resolve)`,
        );
      }
    }
  }
  for (const c of standard.constraints ?? []) {
    if (!c.checkBound || !c.check) {
      continue;
    }
    const cArgs = c.args ?? [];
    const cScope = new Set(cArgs.map(a => a.name));
    for (const a of cArgs) {
      if (a.source.includes(':')) {
        const segs = a.source.split(':');
        if (segs.length === 2) {
          const [kind, id] = segs;
          if (!DECLARATION_KINDS.has(kind)) {
            err(
              'C171',
              `constraint ${c.id}: argument "${a.name}" binds to "${a.source}" — "${kind}" is not a declaration kind (expression-identifiers-resolve)`,
            );
          } else {
            const idRoot = id.split('.')[0]!;
            const idTail = id.split('.').pop() ?? id;
            if (
              !globalExprNames.has(id) &&
              !globalExprNames.has(idRoot) &&
              !globalExprNames.has(idTail)
            ) {
              err(
                'C171',
                `constraint ${c.id}: argument "${a.name}" binds to "${a.source}", which no declared ${kind} names — air inside the formula (expression-identifiers-resolve)`,
              );
            }
          }
        }
        continue;
      }
      if (a.source === 'self' || a.source.startsWith('self.')) {
        continue;
      }
      const bare = a.source.split(':').pop() ?? a.source;
      if (!globalExprNames.has(a.source) && !globalExprNames.has(bare)) {
        err(
          'C171',
          `constraint ${c.id}: argument "${a.name}" binds to "${a.source}", which nothing declares — air inside the formula (expression-identifiers-resolve)`,
        );
      }
    }
    resolveInlineCarrier('constraint', c.id, 'check', c.check, cScope);
    // C84's inline restatement: the check is one BOOLEAN expression
    try {
      const ast = parseExpression(c.check);
      const booleanTop =
        (ast.type === 'binop' &&
          [
            '<=',
            '>=',
            '<',
            '>',
            '=',
            '!=',
            '≠',
            'and',
            'or',
            'xor',
            'implies',
          ].includes(ast.op)) ||
        (ast.type === 'nav' && ['forAll', 'exists'].includes(ast.op));
      if (!booleanTop) {
        err(
          'C84',
          `constraint ${c.id}: the check does not evaluate to a boolean — an invariant is one comparison or logical composition (constraint-shape)`,
        );
      }
    } catch {
      // already reported by resolveInlineCarrier
    }
  }
  // ── C172 requirement-algebra-resolves ───────────────────────────────
  // Containment is conjunction: a requirement class's members are its
  // body, and the class's limit expression (the LAW) names its members —
  // and/or/xor/implies, the OCL booleans. The law's identifiers resolve
  // to members only; every member appears in the law or the class
  // carries no law (pure conjunction); a child's modality is never
  // weaker than the class's.
  const memberSet = new Map<string, Set<string>>();
  for (const rc of standard.requirementClasses ?? []) {
    memberSet.set(rc.id, new Set((rc.members ?? []).map(String)));
  }
  for (const rc of standard.requirementClasses ?? []) {
    const law = rc.limit?.expression;
    const members = memberSet.get(rc.id) ?? new Set<string>();
    if (!law) {
      continue;
    }
    if (rc.limit?.argsBound) {
      checkInlineLimit('requirement class', rc.id, rc.limit, members);
      const covered = new Set<string>();
      try {
        for (const n of freeIdentifiers(parseExpression(law)).names) {
          covered.add(n);
        }
      } catch {
        // already reported inside checkInlineLimit
      }
      for (const a of rc.limit.args ?? []) {
        covered.add(a.name);
        covered.add(a.source);
      }
      for (const m of members) {
        if (!covered.has(m)) {
          warn(
            'C172',
            `requirement class ${rc.id}: member ${m} does not appear in the law — either it is always-required (add it with \`and\`) or it is orphaned (requirement-algebra-resolves)`,
          );
        }
      }
      continue;
    }
    const ocl = law.replace(/^ocl\{/, '').replace(/\}$/, '');
    const ids = (ocl.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []).filter(
      x => !OCL_WORDS.has(x),
    );
    const lawIds = new Set<string>();
    for (const id of ids) {
      lawIds.add(id);
      if (!members.has(id)) {
        err(
          'C172',
          `requirement class ${rc.id}: the law names "${id}", which is not a contained member — the algebra composes the containment only (requirement-algebra-resolves)`,
        );
      }
    }
    for (const m of members) {
      if (!lawIds.has(m)) {
        warn(
          'C172',
          `requirement class ${rc.id}: member ${m} does not appear in the law — either it is always-required (add it with \`and\`) or it is orphaned (requirement-algebra-resolves)`,
        );
      }
    }
  }

  // ── C173 step-plane-refs-resolve (register 19) ──────────────────────
  // A signature step's completion is one expression over the step's own
  // declared ios: the identifiers resolve to `inputs`/`outputs`, the
  // calls stay in the closed vocabulary, and nothing in the completion
  // is air. The calls bindings ride C76's machinery (the typed pass-1
  // fills the same fields the flow dialect uses).
  for (const p of standard.processes ?? []) {
    for (const st of p.steps ?? []) {
      if (!st.completion) {
        continue;
      }
      const ios = new Set([...st.sigInputs, ...st.sigOutputs]);
      let ids;
      try {
        ids = freeIdentifiers(
          parseExpression(
            st.completion.replace(/^ocl\{/, '').replace(/\}$/, ''),
          ),
        );
      } catch (e) {
        err(
          'C173',
          `process ${p.id}: step "${st.id}" completion does not parse — ${String((e as Error).message ?? e)} — the completion is one expression over the step's ios (step-plane-refs-resolve)`,
        );
        continue;
      }
      for (const call of new Set(ids.calls)) {
        if (!INLINE_FUNCTION_WORDS.has(call)) {
          err(
            'C173',
            `process ${p.id}: step "${st.id}" completion calls "${call}(…)", which is not in the expression function vocabulary (step-plane-refs-resolve)`,
          );
        }
      }
      for (const id of new Set(ids.names)) {
        const root = id.split('.')[0]!;
        if (id.includes('.') && (root === 'self' || CONTEXT_ROOTS.has(root))) {
          continue;
        }
        if (ios.has(id) || ios.has(root)) {
          continue;
        }
        err(
          'C173',
          `process ${p.id}: step "${st.id}" completion names "${id}", which is not a declared io of the step — the completion reads the step's own inputs and outputs (step-plane-refs-resolve)`,
        );
      }
    }
  }
}

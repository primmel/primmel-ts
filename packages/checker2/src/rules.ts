// ─────────────────────────────────────────────────────────────────────
// The second checker's rules — the structural family of the suite's
// check corpus, re-implemented over the construct model. Each rule
// mirrors its kernel counterpart's JUDGMENT (the rule id the suite
// pins), derived independently from the shape tree; message text is
// this implementation's own (the runner compares rule ids).
//
// Implemented: C1, C2, C4, C10, C11, C96, C109. Every other rule is
// OUT of scope for this slice and lives in the leg's visible register
// (the only-shrinks discipline the grammar leg established).
// ─────────────────────────────────────────────────────────────────────

import type { Construct, Item, ParsedPackage } from './front-end.ts';

export interface Issue {
  rule: string;
  severity: 'error' | 'warning';
  message: string;
}

/** The lines of a construct's body by key (`key value…` and `key : value`). */
function lines(
  c: Construct,
): { key: string; tokens: string[]; blocks: Item[][] }[] {
  return c.items
    .filter(
      (i): i is Item & { kind: 'line' } =>
        i.kind === 'line' && i.key !== undefined,
    )
    .map(i => ({ key: i.key!, tokens: i.tokens, blocks: i.blocks }));
}

/** Nested constructs of a body. */
function nested(c: Construct): Construct[] {
  return c.items.flatMap(i =>
    i.kind === 'construct' && i.construct ? [i.construct] : [],
  );
}

/** A construct's value tokens for a key, in ANY item form: the line's
 *  own run, a nested same-key construct's raw body (`targets { … }`),
 *  or a raw body item. */
function tokensOf(c: Construct, key: string): string[] {
  const line = lines(c).find(l => l.key === key);
  if (line) {
    return line.tokens;
  }
  for (const n of nested(c)) {
    if (n.keyword === key) {
      return n.items.flatMap(i => i.tokens);
    }
  }
  return c.items
    .filter(i => i.kind === 'raw')
    .flatMap(i => (i.tokens[0] === key ? i.tokens.slice(1) : []));
}

export function check(pkg: ParsedPackage): Issue[] {
  const issues: Issue[] = [];
  const err = (rule: string, message: string): void => {
    issues.push({ rule, severity: 'error', message });
  };

  // ── the declared-name universe ────────────────────────────────────
  const requirements = new Set(
    pkg.constructs
      .filter(c => c.keyword === 'requirement' && c.ident)
      .map(c => c.ident),
  );
  const conformanceClasses = new Set(
    pkg.constructs
      .filter(c => c.keyword === 'conformance_class' && c.ident)
      .map(c => c.ident),
  );
  const attributeDefinitions = new Set(
    pkg.constructs
      .filter(c => c.keyword === 'attribute_definition' && c.ident)
      .map(c => c.ident),
  );

  // ── C96 duplicate-ids: a (keyword, id) pair declared twice ───────
  const seen = new Map<string, number>();
  for (const c of pkg.constructs) {
    if (!c.ident) {
      continue;
    }
    const k = `${c.keyword} ${c.ident}`;
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  for (const [k, n] of seen) {
    if (n > 1) {
      err(
        'C96',
        `${k} is declared ${n} times — every identifier is unique within its kind (duplicate-id)`,
      );
    }
  }

  for (const c of pkg.constructs) {
    // ── C2 targets-resolve: a conformance test's targets name declared
    //    requirements or conformance classes ────────────────────────
    if (c.keyword === 'conformance_test') {
      for (const target of tokensOf(c, 'targets')) {
        if (!requirements.has(target) && !conformanceClasses.has(target)) {
          err(
            'C2',
            `conformance_test ${c.ident}: target "${target}" is not a declared requirement or conformance class (target-resolves)`,
          );
        }
      }
    }

    // ── C1 bind-scope: a form field's bind path names a declared
    //    attribute (the path's attribute segment) ───────────────────
    if (c.keyword === 'form') {
      const fields = [
        ...nested(c),
        ...lines(c)
          .filter(l => l.key === 'field')
          .map(l => ({
            keyword: 'field',
            ident: l.tokens[0] ?? '',
            items: [] as Item[],
          })),
      ];
      for (const field of fields) {
        const bind = tokensOf(field, 'bind');
        if (bind.length === 1) {
          const attr = bind[0]!.split('.').pop() ?? '';
          if (attr !== '' && !attributeDefinitions.has(attr)) {
            err(
              'C1',
              `form ${c.ident}: field ${field.ident} binds "${bind[0]}" whose attribute "${attr}" is not a declared attribute_definition (bind-scope)`,
            );
          }
        }
      }
    }

    // ── C4 store-shared: one persistent store per class ─────────────
    if (c.keyword === 'class') {
      const store = tokensOf(c, 'store');
      if (store.length > 0) {
        const owner = store[0]!;
        const same = pkg.constructs.find(
          o =>
            o !== c &&
            o.keyword === 'class' &&
            o.ident < c.ident &&
            JSON.stringify(tokensOf(o, 'store')) === JSON.stringify(store),
        );
        if (same) {
          err(
            'C4',
            `class ${c.ident}: store "${owner}" is already the store of class ${same.ident} — one persistent store per class (store-shared)`,
          );
        }
      }
    }

    // ── C10 process-two-starts / C11 process-dangling-flow: the
    //    process dialect's event discipline ─────────────────────────
    if (c.keyword === 'process') {
      // The events live in the does block's TOKEN STREAM (the value
      // run is greedy on its line): `start_event begin end_event done`
      // is one kwline naming every event. Flow edges ride the run's
      // block values: key = from, tokens = [->, to].
      const events = new Set<string>();
      let starts = 0;
      let startId = '';
      const edges: { key?: string; tokens: string[] }[] = [];
      const does = [
        ...nested(c),
        ...lines(c)
          .filter(l => l.key === 'does')
          .map(() => ({
            keyword: 'does',
            ident: '',
            items: [] as Item[],
          })),
      ];
      const stream: { tokens: string[]; blocks: Item[][] }[] = [];
      for (const d of does) {
        stream.push(...lines(d));
      }
      for (const line of stream) {
        // An event line is `start_event <id>` / `end_event <id>`: the
        // kind rides the line's key, the id the token run.
        if (line.key === 'start_event' || line.key === 'end_event') {
          const id = line.tokens[0] ?? '';
          if (id !== '') {
            events.add(id);
            if (line.key === 'start_event') {
              starts++;
              startId = id;
            }
          }
        }
        // Flow edges may pass through ACTIONS on multi-hop edges
        // (`begin -> examine -> done`): actions are flow nodes too.
        if (line.key === 'action') {
          const id = line.tokens[0] ?? '';
          if (id !== '') {
            events.add(id);
          }
        }
        for (const block of line.blocks) {
          edges.push(
            ...block.filter(
              (e): e is Item & { kind: 'line' } => e.kind === 'line',
            ),
          );
        }
      }
      for (const sub of does.flatMap(d => nested(d))) {
        if (sub.keyword === 'flow') {
          edges.push(...lines(sub));
        }
        if (sub.keyword === 'action') {
          events.add(sub.ident);
        }
      }
      for (const edge of edges) {
        if (edge.key === undefined) {
          continue;
        }
        for (const end of [edge.key, ...edge.tokens.filter(t => t !== '->')]) {
          if (!events.has(end)) {
            err(
              'C11',
              `process ${c.ident}: flow endpoint "${end}" is not a declared event (dangling-flow)`,
            );
          }
        }
      }
      if (starts > 1) {
        err(
          'C10',
          `process ${c.ident}: ${starts} start events (${startId}, …) — exactly one (process-two-starts)`,
        );
      }
    }

    // ── C109 state-machine-initial: a state machine declares its
    //    initial state ──────────────────────────────────────────────
    if (c.keyword === 'state_machine') {
      const hasInitial =
        lines(c).some(l => l.key === 'initial') ||
        nested(c).some(sub => lines(sub).some(l => l.key === 'initial'));
      if (!hasInitial) {
        err(
          'C109',
          `state_machine ${c.ident}: no initial state declared (state-machine-no-initial)`,
        );
      }
    }
  }

  return issues;
}

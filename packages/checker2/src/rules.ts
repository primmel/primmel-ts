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
import {
  parseX,
  readExpression,
  readNavMembers,
  X_FUNCS,
  X_CONTEXT_ROOTS,
} from './expressions.ts';

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
const BUDGETED_RULES_C = new Set(['C51', 'C52']);

/** The tokens of a construct's raw-or-line body (a refs/targets/uses
 *  list): raw token runs and line keys+runs, both. */
function rawTokensT(c: Construct): string[] {
  return c.items.flatMap(i =>
    i.kind === 'raw'
      ? i.tokens
      : i.kind === 'line'
        ? [i.key ?? '', ...i.tokens]
        : [],
  );
}

function nested(c: Construct): Construct[] {
  return c.items.flatMap(i =>
    i.kind === 'construct' && i.construct ? [i.construct] : [],
  );
}

/** A facet read from an ITEM LIST (a value block's contents): the
 *  line of that key, or `key value` pairs riding a greedy token
 *  stream (`unit kg quantity_kind phantom_kind`). */
function facetTokens(items: Item[], key: string): string[] {
  const out: string[] = [];
  for (const i of items) {
    if (i.kind !== 'line') {
      continue;
    }
    if (i.key === key) {
      out.push(...i.tokens);
      continue;
    }
    for (let j = 0; j < i.tokens.length - 1; j++) {
      if (i.tokens[j] === key) {
        out.push(i.tokens[j + 1]!);
        j++;
      }
    }
  }
  return out;
}

/** A construct's value tokens for a key, in ANY item form: the line's
 *  own run, a nested same-key construct's raw body (`targets { … }`),
 *  or a raw body item. */
function tokensOf(c: Construct, key: string): string[] {
  // ALL lines of this key — a facet declared twice is itself a rule
  // matter (C145), never silently collapsed.
  const all = lines(c)
    .filter(l => l.key === key)
    .flatMap(l => l.tokens);
  if (all.length > 0) {
    return all;
  }
  // The greedy value run: facets authored on one line ride a token
  // stream (`kind permission action read`) — read `key value` pairs
  // from every line's run, in declaration order.
  const fromStream: string[] = [];
  for (const l of lines(c)) {
    for (let i = 0; i < l.tokens.length - 1; i++) {
      if (l.tokens[i] === key) {
        fromStream.push(l.tokens[i + 1]!);
        i++;
      }
    }
  }
  if (fromStream.length > 0) {
    return fromStream;
  }
  for (const n of nested(c)) {
    if (n.keyword === key) {
      // An id list's bare words parse as kwlines — the first id rides
      // the line's KEY, the rest its token run.
      return n.items.flatMap(i =>
        i.kind === 'line' && i.key !== undefined && i.key !== ''
          ? [i.key, ...i.tokens]
          : i.tokens,
      );
    }
  }
  return c.items
    .filter(i => i.kind === 'raw')
    .flatMap(i => (i.tokens[0] === key ? i.tokens.slice(1) : []));
}

/** The package constructs of the directories BESIDE the root package —
 *  the edition-lineage counterparties (C113). */
function siblingManifests(pkg: ParsedPackage): Construct[] {
  if (!pkg.dir) {
    return [];
  }
  const out: Construct[] = [];
  for (const entry of pkg.siblings ?? []) {
    for (const c of entry.constructs) {
      if (c.keyword === 'package') {
        out.push(c);
      }
    }
  }
  return out;
}

function findCycle(adj: Map<string, string[]>): string[] | null {
  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];
  const visit = (node: string): string[] | null => {
    if (state.get(node) === 'done') {
      return null;
    }
    if (state.get(node) === 'visiting') {
      return [...stack.slice(stack.indexOf(node)), node];
    }
    state.set(node, 'visiting');
    stack.push(node);
    for (const next of adj.get(node) ?? []) {
      const found = visit(next);
      if (found) {
        return found;
      }
    }
    stack.pop();
    state.set(node, 'done');
    return null;
  };
  for (const node of adj.keys()) {
    const found = visit(node);
    if (found) {
      return found;
    }
  }
  return null;
}

export interface Located {
  /** id → the parsed package (its manifest construct included). */
  packages: Map<string, ParsedPackage>;
}

export function check(
  pkg: ParsedPackage,
  located?: Located,
  options: { strictness?: 'normal' | 'audit' } = {},
): Issue[] {
  const issues: Issue[] = [];
  const err = (rule: string, message: string): void => {
    issues.push({ rule, severity: 'error', message });
  };

  // ── the declared-name universe ────────────────────────────────────
  // The composition closure: reference rules judge against the
  // COMPOSED universe (an upstream declaration satisfies a consumer's
  // reference), while the shape rules judge the root alone.
  const closureConstructs = located
    ? [
        ...pkg.constructs,
        ...[...located.packages.values()].flatMap(x => x.constructs),
      ]
    : pkg.constructs;

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
    closureConstructs
      .filter(c => c.keyword === 'attribute_definition' && c.ident)
      .map(c => c.ident),
  );
  const roles = new Set(
    closureConstructs
      .filter(c => c.keyword === 'role' && c.ident)
      .map(c => c.ident),
  );
  const organs = new Set(
    pkg.constructs
      .filter(c => c.keyword === 'governance_organ' && c.ident)
      .map(c => c.ident),
  );
  const policies = new Set(
    closureConstructs
      .filter(c => c.keyword === 'policy' && c.ident)
      .map(c => c.ident),
  );
  const symbols = new Set(
    pkg.constructs
      .filter(c => c.keyword === 'symbol' && c.ident)
      .map(c => c.ident),
  );
  const forms = new Set(
    closureConstructs
      .filter(c => c.keyword === 'form' && c.ident)
      .map(c => c.ident),
  );
  const processes = new Set(
    closureConstructs
      .filter(c => c.keyword === 'process' && c.ident)
      .map(c => c.ident),
  );
  const dimensions = new Map<string, Set<string>>();
  for (const c of pkg.constructs) {
    if (c.keyword !== 'dimension') {
      continue;
    }
    const values = new Set<string>();
    for (const sub of nested(c)) {
      if (sub.keyword === 'values' || sub.keyword === 'value') {
        for (const v of nested(sub)) {
          values.add(v.ident !== '' ? v.ident : v.keyword);
        }
      }
    }
    dimensions.set(c.ident, values);
  }
  const verdicts = new Map<string, Set<string>>();
  for (const c of pkg.constructs) {
    if (c.keyword === 'verdict') {
      verdicts.set(
        c.ident,
        new Set([
          ...tokensOf(c, 'inputs'),
          ...(nested(c)
            .find(n => n.keyword === 'inputs')
            ?.items.flatMap(i =>
              i.kind === 'line' && i.key ? [i.key, ...i.tokens] : i.tokens,
            ) ?? []),
        ]),
      );
    }
  }
  const registeredKinds = new Set(
    pkg.constructs
      .filter(c => c.keyword === 'quantity_register')
      .flatMap(r =>
        nested(r)
          .filter(k => k.keyword === 'kind')
          .map(k => k.ident),
      ),
  );
  const symbolsAll = new Set(
    closureConstructs
      .filter(c => c.keyword === 'symbol' && c.ident)
      .map(c => c.ident),
  );
  const variables = new Set(
    pkg.constructs
      .filter(c => c.keyword === 'variable' && c.ident)
      .map(c => c.ident),
  );
  for (const t of pkg.constructs.filter(
    c => c.keyword === 'conformance_test',
  )) {
    for (const group of nested(t)) {
      if (group.keyword !== 'variables' && group.keyword !== 'observables') {
        continue;
      }
      for (const entry of nested(group)) {
        variables.add(entry.ident !== '' ? entry.ident : entry.keyword);
      }
    }
  }
  const classStores = new Set(
    pkg.constructs
      .filter(c => c.keyword === 'class')
      .flatMap(c => tokensOf(c, 'store')),
  );
  const activityKinds = new Set(
    pkg.constructs
      .filter(c => c.keyword === 'scheme_activity_kind' && c.ident)
      .map(c => c.ident),
  );

  // ── the dataspace / policy / correspondence families ────────────
  for (const c of pkg.constructs) {
    // C105: a trust anchor declares its trust reference.
    if (c.keyword === 'dataspace') {
      for (const anchor of nested(c)) {
        if (
          anchor.keyword === 'trust_anchor' &&
          tokensOf(anchor, 'trust_ref').length === 0
        ) {
          err(
            'C105',
            `dataspace ${c.ident}: trust anchor "${anchor.ident}" declares no trust_ref with an organization identifier — an anchor without its trust reference says nothing (dataspace-shape)`,
          );
        }
      }
      for (const p of nested(c)) {
        if (p.keyword === 'policies') {
          void p;
        }
      }
    }
    // C107: a policy rule declares its action.
    if (c.keyword === 'policy') {
      for (const rule of nested(c)) {
        if (rule.keyword === 'rule' && tokensOf(rule, 'action').length === 0) {
          err(
            'C107',
            `policy ${c.ident}: rule "${rule.ident}" declares no action — a rule without its action says nothing (policy-shape)`,
          );
        }
      }
    }
    // C108: one correspondence per scheme, and the entry names its
    // scheme and the scheme's concept identifier.
    if (c.keyword === 'attribute_definition') {
      const schemes = new Map<string, number>();
      for (const line of lines(c).filter(l => l.key === 'corresponds')) {
        const scheme = line.tokens[0] ?? '';
        const concept = line.tokens[1] ?? '';
        if (scheme === '' || concept === '') {
          err(
            'C108',
            `attribute_definition ${c.ident}: a corresponds entry carries an empty scheme or concept — the entry names its scheme and the scheme's concept identifier (corresponds-shape)`,
          );
        }
        schemes.set(scheme, (schemes.get(scheme) ?? 0) + 1);
      }
      for (const [scheme, n] of schemes) {
        if (n > 1) {
          err(
            'C108',
            `attribute_definition ${c.ident}: ${n} corresponds entries name scheme "${scheme}" — one element has at most one correspondence per scheme (corresponds-shape)`,
          );
        }
      }
    }
    // C114: a requirement's limit kind agrees with its acceptance
    // chain's derived kind.
    if (c.keyword === 'requirement') {
      const limit = nested(c).find(n => n.keyword === 'limit');
      if (limit) {
        const limitKind =
          (tokensOf(limit, 'quantity_kind')[0] ??
          nested(limit).find(n => n.keyword === 'quantity'))
            ? (tokensOf(
                nested(limit).find(n => n.keyword === 'quantity')!,
                'kind',
              )[0] ?? '')
            : '';
        for (const accept of nested(limit).find(n => n.keyword === 'accepts')
          ?.items ?? []) {
          void accept;
        }
        for (const line of lines(limit)) {
          void line;
        }
        for (const vName of tokensOf(limit, 'accepts')) {
          const verdict = pkg.constructs.find(
            x => x.keyword === 'verdict' && x.ident === vName,
          );
          const verdictKind = verdict
            ? (tokensOf(
                nested(verdict).find(n => n.keyword === 'quantity') ?? verdict,
                'kind',
              )[0] ?? '')
            : '';
          if (
            limitKind !== '' &&
            verdictKind !== '' &&
            limitKind !== verdictKind
          ) {
            err(
              'C114',
              `requirement ${c.ident}: limit declares quantity kind "${limitKind}" but accepts verdict ${vName} derives kind "${verdictKind}" — a limit and its acceptance chain never drift apart in units (limit-quantity-coherence)`,
            );
          }
        }
      }
    }
    // C115: a calculation input's quantity_kind is registered.
    if (c.keyword === 'calculation') {
      const inputs = nested(c).find(n => n.keyword === 'inputs');
      const fields: { id: string; items: Item[] }[] = [
        ...(inputs ? nested(inputs) : []).map(f => ({
          id: f.ident || f.keyword,
          items: f.items,
        })),
        // `q : number { … }` — the input id rides the line's KEY and
        // the facets ride the value block.
        ...(inputs ? lines(inputs) : []).map(l => ({
          id: l.key ?? '',
          items: l.blocks.flat(),
        })),
      ];
      for (const field of fields) {
        for (const kind of facetTokens(field.items, 'quantity_kind')) {
          if (!registeredKinds.has(kind)) {
            err(
              'C115',
              `calculation ${c.ident}: input ${field.id}: quantity_kind "${kind}" resolves to no registered kind of the merged quantity register (calculation-signature)`,
            );
          }
        }
      }
    }
    // C118: a requirement parameter's bind names a declared attribute.
    if (c.keyword === 'requirement') {
      const params = nested(c).find(n => n.keyword === 'parameters');
      const paramItems: { id: string; items: Item[] }[] = [
        ...(params ? nested(params) : []).map(pm => ({
          id: pm.ident || pm.keyword,
          items: pm.items,
        })),
        // `param e_max: number { … }` inside the parameters block —
        // the param id rides the line's KEY, the facets its block.
        ...(params ? lines(params) : []).map(l => ({
          id:
            l.key === 'param' ? (l.tokens[0]?.replace(/:$/, '') ?? '') : l.key,
          items: l.blocks.flat(),
        })),
      ];
      for (const param of paramItems) {
        for (const bind of facetTokens(param.items, 'bind')) {
          const attr = bind.split('.').pop() ?? '';
          if (attr !== '' && !attributeDefinitions.has(attr)) {
            err(
              'C118',
              `requirement ${c.ident}: param ${param.id}: bind "${bind}" — attribute "${attr}" not defined (requirement-parameter-shape)`,
            );
          }
        }
      }
    }
    // C116: a verdict's inputs resolve.
    if (c.keyword === 'verdict') {
      for (const input of verdicts.get(c.ident) ?? []) {
        if (
          input !== '' &&
          !symbolsAll.has(input) &&
          !variables.has(input) &&
          ![...verdicts.keys()].includes(input)
        ) {
          err(
            'C116',
            `verdict ${c.ident}: input "${input}" resolves to no declared symbol, test variable or observable, or verdict (verdict-inputs-resolve)`,
          );
        }
      }
    }
    // C124: a pair_list declares its key slot.
    if (c.keyword === 'attribute_definition') {
      const pairList = nested(c).find(n => n.keyword === 'pair_list');
      if (pairList && tokensOf(pairList, 'key').length === 0) {
        err(
          'C124',
          `attribute_definition ${c.ident}: pair_list: the key slot is required (pair-list-shape)`,
        );
      }
    }
    // C127: a common test condition carries its description.
    if (
      c.keyword === 'common_test_condition' &&
      tokensOf(c, 'description').length === 0
    ) {
      err(
        'C127',
        `common_test_condition ${c.ident}: the description is required — a condition entry carries its normative text (common-test-condition-shape)`,
      );
    }
    // C131: the promise certificate content binds by XOR.
    if (c.keyword === 'promise_set') {
      for (const promise of nested(c)) {
        if (promise.keyword !== 'promise') {
          continue;
        }
        const cert = nested(promise).find(n => n.keyword === 'certificate');
        if (!cert) {
          continue;
        }
        const bound = ['attribute', 'attributes', 'dimension'].filter(
          k => tokensOf(cert, k).length > 0,
        );
        if (bound.length > 1) {
          err(
            'C131',
            `promise_set ${c.ident}: promise "${promise.ident}": the certificate content binds by XOR — at most one of attribute / attributes / dimension (promise-certificate-projection)`,
          );
        }
      }
    }
    // C133: a calculation context field's source is a subject-chain
    // source.
    if (c.keyword === 'calculation_context') {
      for (const field of nested(c)) {
        if (field.keyword !== 'field') {
          continue;
        }
        const sourceForm = tokensOf(field, 'source')[0] ?? '';
        {
          if (
            !sourceForm.startsWith('classification.') &&
            !sourceForm.startsWith('parameters.') &&
            sourceForm !== 'computed'
          ) {
            err(
              'C133',
              `calculation_context ${c.ident}: field ${field.ident}: source "${sourceForm}" is not a subject-chain source (classification.<dimension>, parameters.<attribute>, computed) (calculation-context-references)`,
            );
          }
        }
      }
    }
    // C134: an evaluation dimension field's enum names a declared
    // classification dimension.
    if (c.keyword === 'evaluation_dimensions') {
      for (const field of nested(c)) {
        if (field.keyword !== 'field') {
          continue;
        }
        for (const e of tokensOf(field, 'enum')) {
          if (!dimensions.has(e)) {
            err(
              'C134',
              `evaluation_dimensions ${c.ident}: field ${field.ident}: enum "${e}" is not a declared classification dimension (evaluation-dimension-references)`,
            );
          }
        }
      }
    }
    // C135: an evaluation profile's dimension values are declared.
    if (c.keyword === 'evaluation_profile') {
      const dimsBlock = nested(c).find(n => n.keyword === 'dimensions');
      const entries: { key: string; tokens: string[] }[] = dimsBlock
        ? dimsBlock.items.flatMap(i =>
            i.kind === 'line' && i.key
              ? [{ key: i.key, tokens: i.tokens }]
              : [],
          )
        : lines(c).filter(l => l.key === 'dimensions');
      for (const entry of entries) {
        const values = dimensions.get(entry.key);
        if (!values) {
          continue;
        }
        // A greedy run alternates key and value (`accuracy_class A
        // technology digital`): the FIRST token is this key's value.
        const v = entry.tokens[0] ?? '';
        if (v !== '' && !values.has(v)) {
          err(
            'C135',
            `evaluation_profile ${c.ident}: dimensions entry "${entry.key}" names value "${v}", which the dimension does not declare (evaluation-profile-coherence)`,
          );
        }
      }
    }
    // C136: the certificate template's characteristic type is in the
    // renderer vocabulary.
    if (c.keyword === 'certificate_template') {
      for (const ch of nested(c)) {
        if (ch.keyword !== 'characteristic') {
          continue;
        }
        const type = tokensOf(ch, 'type')[0] ?? '';
        if (
          type !== '' &&
          !['string', 'integer', 'number', 'quantity', 'statement'].includes(
            type,
          )
        ) {
          err(
            'C136',
            `certificate_template ${c.ident}: characteristic ${ch.ident}: type "${type}" is outside the renderer vocabulary (string, integer, number, quantity, statement) (certificate-template-references)`,
          );
        }
      }
    }
    // C138: a signal trigger carries its event.
    if (c.keyword === 'verification_pathway') {
      const triggerHosts = [
        ...nested(c)
          .map(n => [n, ...nested(n)] as Construct[])
          .flat(),
      ].filter(n => n.keyword === 'trigger');
      for (const trigger of triggerHosts) {
        {
          const kind = tokensOf(trigger, 'kind')[0] ?? '';
          if (kind === 'signal' && tokensOf(trigger, 'event').length === 0) {
            err(
              'C138',
              `verification_pathway ${c.ident}: trigger ${trigger.ident}: kind signal requires the event facet (verification-pathway-references)`,
            );
          }
        }
      }
    }
    // C139: the selection rules' shape.
    if (c.keyword === 'lab_selection_criterion') {
      const match = nested(c).find(n => n.keyword === 'match');
      const op = tokensOf(match ?? c, 'operator')[0] ?? '';
      const required =
        tokensOf(c, 'required_capability').length > 0 ||
        (match ? tokensOf(match, 'required_capability').length > 0 : false);
      if (op === 'has_capability' && !required) {
        err(
          'C139',
          `lab_selection_criterion ${c.ident}: operator has_capability requires the required_capability facet (selection-rule-references)`,
        );
      }
    }
    if (
      (c.keyword === 'specimen_governance_rule' ||
        c.keyword === 'sample_selection_rule' ||
        c.keyword === 'lab_selection_criterion') &&
      tokensOf(c, 'applicability').length === 0 &&
      c.keyword === 'specimen_governance_rule'
    ) {
      err(
        'C139',
        `${c.keyword} ${c.ident}: the applicability facet is required (selection-rule-references)`,
      );
    }
    // C59: a segregation disjoint constraint is ONLY a pair.
    if (c.keyword === 'process') {
      const seg = nested(c).find(n => n.keyword === 'segregation');
      for (const constraint of seg ? nested(seg) : []) {
        const kind = tokensOf(constraint, 'kind')[0] ?? '';
        if (kind.endsWith('_disjoint')) {
          const extras = ['period', 'barred'].filter(
            k => tokensOf(constraint, k).length > 0,
          );
          if (extras.length > 0) {
            err(
              'C59',
              `process ${c.ident}: segregation constraint "${constraint.ident}" is ${kind} but declares ${extras.join('/')} — a disjoint constraint is ONLY a pair; the period/barred facets belong to barred constraints (segregation-kind-xor)`,
            );
          }
        }
      }
    }
  }

  // C117: the verdict acceptance chain is acyclic.
  const verdictAdj = new Map<string, string[]>();
  for (const c of pkg.constructs) {
    if (c.keyword === 'verdict' && verdicts.has(c.ident)) {
      const targets = [...verdicts.get(c.ident)!].filter(x => verdicts.has(x));
      if (targets.length > 0) {
        verdictAdj.set(c.ident, targets);
      }
    }
  }
  const cycle = findCycle(verdictAdj);
  if (cycle) {
    err(
      'C117',
      `verdict chain cycle: ${cycle.join(' → ')} — the acceptance chain is a graph a consumer traverses, so it must be acyclic (verdict-chain-acyclic)`,
    );
  }

  // ── the composition family (the uses closure) ────────────────────
  if (located !== undefined) {
    const rootManifest = pkg.constructs.find(c => c.keyword === 'package');
    const usesEntries = rootManifest ? tokensOf(rootManifest, 'uses') : [];
    const rootId =
      tokensOf(
        rootManifest ?? ({ keyword: '', ident: '', items: [] } as Construct),
        'id',
      )[0] ?? '';
    const rootUrn =
      tokensOf(
        rootManifest ?? ({ keyword: '', ident: '', items: [] } as Construct),
        'base_urn',
      )[0] ??
      tokensOf(
        rootManifest ?? ({ keyword: '', ident: '', items: [] } as Construct),
        'baseUrn',
      )[0] ??
      '';

    // C27: every uses entry resolves to a located package.
    for (const entry of usesEntries) {
      const id = entry.split('@')[0]!;
      if (!located.packages.has(id)) {
        err(
          'C27',
          `package "${rootId}": uses "${entry}" resolves to no package of the composition (uses-resolves)`,
        );
      }
    }

    // C83: a version-pinned product reference pins its located version.
    for (const entry of usesEntries) {
      const [id, pin] = entry.split('@');
      const target = id !== undefined ? located.packages.get(id) : undefined;
      if (!target) {
        continue;
      }
      const targetManifest = target.constructs.find(
        c => c.keyword === 'package',
      );
      const version = targetManifest
        ? (tokensOf(targetManifest, 'version')[0] ?? '')
        : '';
      const kind = targetManifest
        ? (tokensOf(targetManifest, 'kind')[0] ?? '')
        : '';
      if (
        kind === 'product_reference' &&
        (pin === undefined || pin !== version)
      ) {
        err(
          'C83',
          `package "${rootId}": uses "${entry}" — a product reference is imported by an exact version pin (expected @${version}) (abstract-import-pin)`,
        );
      }
    }

    // C28: no-redefine across the closure — a downstream package may
    // reference upstream ids but never redeclare them (an overlay
    // construct is the exemption).
    const declared = new Map<string, string>();
    const closureEntries: [string, ParsedPackage][] = [
      ...[...located.packages.entries()],
      [rootId, pkg],
    ];
    for (const [id, pack] of closureEntries) {
      for (const c of pack.constructs) {
        if (!c.ident || c.keyword === 'package') {
          continue;
        }
        if (tokensOf(c, 'overlay').length > 0) {
          continue;
        }
        const k = `${c.keyword} ${c.ident}`;
        const owner = declared.get(k);
        // A collision within ONE package is the duplicate-id rule's
        // matter (C96); C28 is the cross-package redefinition.
        if (owner !== undefined && owner !== id) {
          err(
            'C28',
            `package "${id}" redefines ${k}, already declared in ${owner} — a downstream package references upstream ids, it never redefines them (uses-no-redefine)`,
          );
        } else {
          declared.set(k, id);
        }
      }
    }

    // C29: the uses graph over the closure is acyclic.
    const graph = new Map<string, string[]>();
    const closure = new Map<string, ParsedPackage>([
      [rootId, pkg],
      ...located.packages,
    ]);
    for (const [id, pack] of closure) {
      const m = pack.constructs.find(c => c.keyword === 'package');
      const targets = (m ? tokensOf(m, 'uses') : [])
        .map(e => e.split('@')[0]!)
        .filter(t => closure.has(t));
      if (targets.length > 0) {
        graph.set(id, targets);
      }
    }
    const usesCycle = findCycle(graph);
    if (usesCycle) {
      err(
        'C29',
        `the uses graph is cyclic: ${usesCycle.join(' → ')} — composition order would not exist (uses-cycle)`,
      );
    }

    // C119: a requirement namespace an upstream package owns is never
    // declared into — the consumer references its provisions.
    for (const [, pack] of located.packages) {
      const owned = pack.constructs
        .filter(c => c.keyword === 'requirement_class' && c.ident)
        .map(c => c.ident)
        .concat(
          pack.constructs
            .filter(c => c.keyword === 'document_module')
            .flatMap(m => tokensOf(m, 'namespace')),
        );
      for (const ns of owned) {
        for (const c of pkg.constructs) {
          if (
            (c.keyword === 'requirement_class' ||
              c.keyword === 'requirement') &&
            c.ident !== '' &&
            (c.ident === ns || c.ident.startsWith(`${ns}/`))
          ) {
            err(
              'C119',
              `package "${rootId}" declares ${c.keyword} ${c.ident} inside the namespace "${ns}" an upstream package owns — a downstream package references its provisions, it never declares into the owned namespace (namespace-pin-violation)`,
            );
          }
        }
      }
    }

    // C123: a document module's sequence names declared processes (of
    // the composed closure).
    const closureProcesses = new Set(
      [...closure.values()].flatMap(pack =>
        pack.constructs
          .filter(c => c.keyword === 'process' && c.ident)
          .map(c => c.ident),
      ),
    );
    for (const c of pkg.constructs) {
      if (c.keyword !== 'document_module') {
        continue;
      }
      for (const step of tokensOf(c, 'sequence')) {
        if (!closureProcesses.has(step)) {
          err(
            'C123',
            `document_module ${c.ident}: sequence "${step}" is not a declared process (document-module-references-resolve)`,
          );
        }
      }
    }

    // C141 (the overlay leg): an overlay construct's entries exist
    // upstream — an overlay adds rec-bound entries, never orphans.
    for (const c of pkg.constructs) {
      if (tokensOf(c, 'overlay').length === 0 || c.keyword === 'package') {
        continue;
      }
      const upstreamSame = [...located.packages.values()].flatMap(pack =>
        pack.constructs.filter(
          u => u.keyword === c.keyword && u.ident === c.ident,
        ),
      );
      const upstreamEntries = new Set(
        upstreamSame.flatMap(u =>
          nested(u)
            .filter(e => e.keyword === 'entry')
            .map(e => e.ident),
        ),
      );
      if (upstreamSame.length > 0) {
        for (const e of nested(c).filter(e => e.keyword === 'entry')) {
          if (!upstreamEntries.has(e.ident)) {
            err(
              'C141',
              `package "${rootId}" overlay ${c.keyword} "${c.ident}" declares entry "${e.ident}", which no upstream package's checklist carries — an overlay adds rec-bound entries, never orphans (overlay-entries-exist)`,
            );
          }
        }
      }
    }

    // C113: opposite lineage edges between a package pair agree — the
    // successor's supersedes and the predecessor's superseded_by (the
    // predecessor read from the sibling manifests).
    if (rootManifest) {
      const supersedes = tokensOf(rootManifest, 'supersedes');
      if (supersedes.length > 0) {
        const siblings = siblingManifests(pkg);
        for (const urn of supersedes) {
          const predecessor = siblings.find(
            m =>
              tokensOf(m, 'base_urn').includes(urn) ||
              tokensOf(m, 'baseUrn').includes(urn),
          );
          if (predecessor) {
            const backRefs = tokensOf(predecessor, 'superseded_by');
            if (backRefs.length > 0 && !backRefs.includes(rootUrn)) {
              err(
                'C113',
                `package "${rootId}": supersedes/replaces ${urn}, but that package declares superseded_by { ${backRefs.join(' ')} } without ${rootUrn} — opposite lineage edges between the same pair must agree (edition-lineage-coherent)`,
              );
            }
          }
        }
      }
    }
  }

  // ── the package manifest family ──────────────────────────────────
  for (const m of pkg.constructs.filter(c => c.keyword === 'package')) {
    // C144: the license key's catalog shape (^std:[a-z0-9-]+$).
    // C145: at most one license key.
    // C146: a licensed package declares its holder.
    const keys = tokensOf(m, 'license_key');
    for (const k of keys) {
      if (!/^std:[a-z0-9-]+$/.test(k)) {
        err(
          'C144',
          `package "${m.ident}": license_key "${k}" is not a catalog key — the key shape is std: followed by a lowercase kebab id, ^std:[a-z0-9-]+$ (license-key-shape)`,
        );
      }
    }
    if (keys.length > 1) {
      err(
        'C145',
        `package "${m.ident}": license_key declared again ("${keys[0]}" before "${keys[keys.length - 1]}") — a package declares at most one license key (license-key-unique)`,
      );
    }
    if (keys.length > 0 && tokensOf(m, 'license_holder').length === 0) {
      err(
        'C146',
        `package "${m.ident}": license_key "${keys[0]}" without a license_holder — a licensed package declares its copyright owner (license-holder-required)`,
      );
    }

    // C77: a current/preview edition is the register's newest entry.
    const status = tokensOf(m, 'status')[0] ?? '';
    const version = tokensOf(m, 'version')[0] ?? '';
    const editions = tokensOf(m, 'editions').map(e => e.replace(/^"|"$/g, ''));
    if (status === 'current' || status === 'preview') {
      const register = [...editions, ...(version !== '' ? [version] : [])];
      const newest = register
        .map(Number)
        .filter(Number.isFinite)
        .sort((a, b) => b - a)[0];
      if (
        newest !== undefined &&
        version !== '' &&
        Number(version) !== newest
      ) {
        err(
          'C77',
          `package "${m.ident}": status ${status} but version "${version}" is not the edition register's newest entry (${newest}) (edition-status)`,
        );
      }
    }
  }

  // ── the edition/composition family grows (the register's reach) ────
  {
    const manifests = [pkg, ...(pkg.siblings ?? [])]
      .map(x => x.constructs.find(c => c.keyword === 'package'))
      .filter((m): m is Construct => !!m);

    // C170 edition-lineage-declared: a package declaring more than one
    // edition carries edition-mapping.json — the cross-edition linkage
    // is an artifact, never implicit.
    for (const m of manifests) {
      const editions = tokensOf(m, 'editions').map(e =>
        e.replace(/^"|"$/g, ''),
      );
      if (editions.length < 2) {
        continue;
      }
      const dirEntry =
        pkg.dir === undefined || pkg.files === undefined
          ? null
          : (pkg.files ?? []).find(f => f === 'edition-mapping.json');
      const siblingFiles = (pkg.siblings ?? []).flatMap(s => s.files ?? []);
      const carried =
        dirEntry !== null || siblingFiles.includes('edition-mapping.json');
      if (!carried) {
        err(
          'C170',
          `package "${m.ident}": declares ${editions.length} editions [${editions.join(', ')}] but ships no edition-mapping.json — the cross-edition linkage is an artifact, never implicit (edition-lineage-declared)`,
        );
      }
    }

    // C78 edition-validity-window: the validity window is well-formed
    // ISO 8601, `to` not before `from` — the window is the nested
    // validity construct's from/to lines.
    for (const m of manifests) {
      const validity = nested(m).find(n => n.keyword === 'validity');
      // the greedy run carries both pairs on one line (`from X to Y`) —
      // facetTokens walks the key/value stream
      const from = (
        facetTokens(validity?.items ?? [], 'from')[0] ?? ''
      ).replace(/^"|"$/g, '');
      const to = (facetTokens(validity?.items ?? [], 'to')[0] ?? '').replace(
        /^"|"$/g,
        '',
      );
      if (from === '' && to === '') {
        continue;
      }
      const iso = /^\d{4}-\d{2}-\d{2}$/;
      if (!iso.test(from) || !iso.test(to)) {
        err(
          'C78',
          `package "${m.ident}": the validity window [${from} … ${to}] is not a pair of ISO 8601 dates (edition-validity-window)`,
        );
      } else if (to < from) {
        err(
          'C78',
          `package "${m.ident}": the validity window closes (${to}) before it opens (${from}) (edition-validity-window)`,
        );
      }
    }

    // C79 edition-supersedes-resolves (the URN-shape leg): supersedes
    // and replaces entries are well-formed URNs and never the package's
    // own base URN.
    for (const m of manifests) {
      const selfUrn = (tokensOf(m, 'baseUrn')[0] ?? '').replace(/^"|"$/g, '');
      for (const key of ['supersedes', 'replaces']) {
        for (const raw of tokensOf(m, key)) {
          const urn = raw.replace(/^"|"$/g, '');
          if (!/^urn:\S+$/.test(urn)) {
            err(
              'C79',
              `package "${m.ident}": ${key} entry "${urn}" is not a well-formed URN (edition-supersedes-resolves)`,
            );
          } else if (selfUrn !== '' && urn === selfUrn) {
            err(
              'C79',
              `package "${m.ident}": ${key} names the package's own base URN — an edition never supersedes itself (edition-supersedes-resolves)`,
            );
          }
        }
      }
    }

    // C85 baseurn-wellformed: the manifest base URN carries a scheme and
    // no whitespace or IRI delimiters — the free-string field grounds
    // every downstream IRI.
    for (const m of manifests) {
      const baseUrn = (tokensOf(m, 'baseUrn')[0] ?? '').replace(/^"|"$/g, '');
      if (baseUrn === '') {
        continue;
      }
      if (!/^[A-Za-z][A-Za-z0-9+.-]*:\S+$/.test(baseUrn)) {
        err(
          'C85',
          `package "${m.ident}": baseUrn "${baseUrn}" is not a well-formed IRI — a scheme, no whitespace (baseurn-wellformed)`,
        );
      }
    }

    // C30 provides-consumed-or-waived: every provides entry a closure
    // package declares is required or waived downstream (warning — the
    // deliberate non-consumption is declared, never silent).
    const consume = new Set();
    for (const m of manifests) {
      for (const t of tokensOf(m, 'requires')) {
        consume.add(t.replace(/^"|"$/g, ''));
      }
      for (const t of tokensOf(m, 'waives')) {
        const tok = t.replace(/^"|"$/g, '');
        consume.add(tok.includes(':') ? tok.split(':').pop()! : tok);
      }
    }
    for (const m of manifests) {
      for (const t of tokensOf(m, 'provides')) {
        const tok = t.replace(/^"|"$/g, '');
        if (tok !== '' && !consume.has(tok)) {
          issues.push({
            rule: 'C30',
            severity: 'warning',
            message: `package "${m.ident}" provides "${tok}", which no downstream package requires or waives (provides-consumed-or-waived)`,
          });
        }
      }
    }

    // C51 coverage-test-evidence: a conformance test leaving no
    // evidence — no result_forms, no report_rows, and no form binds its
    // process (warning; the audit family's leg).
    const harvestForms = (): Construct[] => {
      const out: Construct[] = [];
      const walk = (c: Construct): void => {
        if (c.keyword === 'form') {
          out.push(c);
        }
        for (const i2 of c.items) {
          if (i2.kind === 'construct' && i2.construct) {
            walk(i2.construct);
          }
        }
      };
      for (const c of [pkg, ...(pkg.siblings ?? [])].flatMap(
        x => x.constructs,
      )) {
        walk(c);
      }
      return out;
    };
    const allForms51 = harvestForms();
    const boundProcesses = new Set(
      allForms51.flatMap(f => tokensOf(f, 'conformance_process')),
    );
    const formRequirementSets51 = allForms51.map(
      f => new Set(tokensOf(f, 'requirements')),
    );
    // inherits_from chains inherit the parent's evidence links (R 60's
    // class-driven instances) — the kernel's hasEvidence recursion.
    const testById51 = new Map(
      pkg.constructs
        .filter(x => x.keyword === 'conformance_test' && x.ident)
        .map(x => [x.ident!, x]),
    );
    const hasEvidence51 = (c: Construct, seen: Set<string>): boolean => {
      const id = c.ident ?? '';
      if (seen.has(id)) {
        return false;
      }
      seen.add(id);
      if (
        tokensOf(c, 'result_forms').length > 0 ||
        tokensOf(c, 'report_rows').length > 0 ||
        boundProcesses.has(id)
      ) {
        return true;
      }
      const targets51 = tokensOf(c, 'targets');
      if (
        targets51.length > 0 &&
        formRequirementSets51.some(reqs => targets51.some(t2 => reqs.has(t2)))
      ) {
        return true;
      }
      const pid = tokensOf(c, 'inherits_from')[0];
      const parent = pid ? testById51.get(pid) : undefined;
      return parent !== undefined && hasEvidence51(parent, seen);
    };
    for (const c of pkg.constructs.filter(
      x => x.keyword === 'conformance_test' && x.ident,
    )) {
      if (!hasEvidence51(c, new Set())) {
        issues.push({
          rule: 'C51',
          severity: 'warning',
          message: `conformance test ${c.ident}: no form records its evidence — the run happens and nothing permanent records it (coverage-test-evidence)`,
        });
      }
    }
  }

  // ── the composition family (C31) and the coverage judgment (C52) ───
  {
    const manifestOf = (x: ParsedPackage): Construct | undefined =>
      x.constructs.find(c => c.keyword === 'package');
    const closurePkgs: { id: string; m: Construct; x: ParsedPackage }[] = [
      pkg,
      ...(pkg.siblings ?? []),
      ...(located ? [...located.packages.values()] : []),
    ]
      .map(x => ({ x, m: manifestOf(x) }))
      .filter((e): e is { id: string; m: Construct; x: ParsedPackage } => !!e.m)
      .map(e => ({
        // the manifest's id rides its `id` line — `package { … }` carries
        // no head ident
        id:
          e.m.ident ||
          (e.m.items.find(i => i.kind === 'line' && i.key === 'id')
            ?.tokens[0] ??
            ''),
        m: e.m,
        x: e.x,
      }));

    // C31 requires-satisfied: every requires entry names a closure
    // package id or one of its provides entries. The id lists ride
    // line blocks (`provides { a b }` — the bare words parse as the
    // block's kwline keys), so read both the line runs and the blocks.
    const listIds = (m: Construct, key: string): string[] => [
      ...tokensOf(m, key),
      ...m.items.flatMap(i =>
        i.kind === 'line' && i.key === key
          ? i.blocks
              .flat()
              .flatMap(b =>
                b.kind === 'line' && b.key !== undefined
                  ? [b.key, ...b.tokens]
                  : b.tokens,
              )
          : [],
      ),
    ];
    for (const { id, m } of closurePkgs) {
      const provides = new Set(
        closurePkgs.flatMap(p => listIds(p.m, 'provides')),
      );
      for (const raw of listIds(m, 'requires')) {
        const entry = raw.replace(/^"|"$/g, '');
        if (entry === '') {
          continue;
        }
        if (closurePkgs.some(p => p.id === entry) || provides.has(entry)) {
          continue;
        }
        err(
          'C31',
          `package "${id}": requires "${entry}", which no closure package provides and no closure package is — the composition's demands are declarable, never ambient (requires-satisfied)`,
        );
      }
    }

    // C52 coverage-form-judgment: a form binding a conformance process
    // with no pass_fail judgment and no evaluated field (warning; the
    // evidence gathered and never weighed).
    for (const c of pkg.constructs.filter(
      x => x.keyword === 'form' && x.ident,
    )) {
      const binds = tokensOf(c, 'conformance_process').length > 0;
      if (!binds) {
        continue;
      }
      const judged =
        tokensOf(c, 'pass_fail').length > 0 ||
        nested(c).some(n => n.keyword === 'pass_fail') ||
        facetTokens(c.items, 'measurement_method').includes('evaluated') ||
        // a form binding requirements weighs them — the kernel's
        // (f.requirements ?? []).length === 0 gate
        tokensOf(c, 'requirements').length > 0 ||
        nested(c).some(n => n.keyword === 'requirements');
      if (!judged) {
        issues.push({
          rule: 'C52',
          severity: 'warning',
          message: `form ${c.ident}: binds a conformance process with no pass/fail judgment and no evaluated field — evidence gathered and never weighed (coverage-form-judgment)`,
        });
      }
    }

    // C79 edition-supersedes-resolves (the graph leg): the supersedes /
    // replaces edges over the closure manifests are acyclic. An edge
    // lands on the closure package whose base URN (or edition register)
    // carries the target URN.
    const adj = new Map<string, string[]>();
    for (const { id, m } of closurePkgs) {
      const targets: string[] = [];
      for (const key of ['supersedes', 'replaces']) {
        for (const raw of tokensOf(m, key)) {
          const urn = raw.replace(/^"|"$/g, '');
          const owner = closurePkgs.find(
            p =>
              tokensOf(p.m, 'baseUrn').some(
                b => b.replace(/^"|"$/g, '') === urn,
              ) ||
              tokensOf(p.m, 'editions').some(
                e => e.replace(/^"|"$/g, '') === urn,
              ),
          );
          if (owner && owner.id !== id) {
            targets.push(owner.id);
          }
        }
      }
      adj.set(id, targets);
    }
    const cycle = findCycle(adj);
    if (cycle) {
      err(
        'C79',
        `the supersedes graph is cyclic: ${cycle.join(' -> ')} — an edition lineage never loops (edition-supersedes-resolves)`,
      );
    }

    // C81 product-maps-resolves: a product reference's maps_to targets
    // resolve against the closure's package ids (the abstract-import
    // doctrine — the mapping is by reference, never by restatement).
    for (const { id, m } of closurePkgs) {
      const kind = (tokensOf(m, 'kind')[0] ?? '').replace(/^"|"$/g, '');
      if (kind !== 'product_reference') {
        continue;
      }
      const ids = new Set(closurePkgs.map(p => p.id));
      for (const raw of tokensOf(m, 'maps_to')) {
        const target = raw.replace(/^"|"$/g, '');
        if (target !== '' && !ids.has(target)) {
          err(
            'C81',
            `package "${id}": maps_to "${target}", which no closure package declares — the product maps by reference to a declared Recommendation (product-maps-resolves)`,
          );
        }
      }
    }
  }

  // C80: every instance's definition_versions pins resolve against the
  // edition register (editions ∪ version).
  const manifestPkg = pkg.constructs.find(c => c.keyword === 'package');
  const manifestConstruct: Construct =
    manifestPkg ?? ({ keyword: '', ident: '', items: [] } as Construct);
  const editionRegister = new Set<string>([
    ...tokensOf(manifestConstruct, 'editions'),
    ...tokensOf(manifestConstruct, 'version'),
  ]);
  // The pin discipline applies when the register EXISTS — a package
  // with no editions declares no pins to violate.
  if (editionRegister.size > 0) {
    for (const c of pkg.constructs) {
      if (c.keyword !== 'instance') {
        continue;
      }
      for (const pin of nested(c).find(n => n.keyword === 'definition_versions')
        ?.items ?? []) {
        if (pin.kind !== 'line' || pin.tokens.length !== 1) {
          continue;
        }
        const pinned = pin.tokens[0]!.replace(/^"|"$/g, '');
        if (!editionRegister.has(pinned)) {
          err(
            'C80',
            `instance ${c.ident}: definition_versions pin ${pin.key} : "${pinned}" does not resolve against the edition register { ${[...editionRegister].join(' ')} } — every executed definition is version-pinned to a declared edition (INV-8) (edition-pin-resolves)`,
          );
        }
      }
    }
  }

  // ── C155 power-type-chain: the of-chain is coherent and acyclic ─
  const instanceIds = new Set(
    pkg.constructs
      .filter(c => c.keyword === 'instance' && c.ident)
      .map(c => c.ident),
  );
  const ofAdj = new Map<string, string[]>();
  for (const c of pkg.constructs) {
    if (c.keyword !== 'instance') {
      continue;
    }
    const of = tokensOf(c, 'of')[0] ?? '';
    if (of !== '') {
      if (instanceIds.has(of)) {
        ofAdj.set(c.ident, [of]);
        const links = lines(c)
          .filter(
            l => l.key === 'model' || l.key === 'group' || l.key === 'family',
          )
          .map(l => l.key);
        if (links.length > 0) {
          err(
            'C155',
            `instance ${c.ident}: of "${of}" names an instance and the instance carries an upward ${links.join('/')} link — the power-type chain and the subject-chain profile do not mix (power-type-chain)`,
          );
        }
      }
    }
  }
  const ofSeen = new Set<string>();
  for (const start of ofAdj.keys()) {
    let cur: string | undefined = start;
    const path: string[] = [];
    while (cur !== undefined && ofAdj.has(cur) && !ofSeen.has(cur)) {
      ofSeen.add(cur);
      path.push(cur);
      cur = ofAdj.get(cur)![0];
      if (path.includes(cur)) {
        err(
          'C155',
          `the power-type of-chain is cyclic: ${[...path, cur].join(' → ')} (power-type-chain)`,
        );
        break;
      }
    }
  }

  // ── duplicate-entry families ─────────────────────────────────────
  // C110: a term's aliases carry no duplicate entry.
  for (const c of pkg.constructs) {
    if (c.keyword === 'term') {
      const seenAliases = new Set<string>();
      for (const t of tokensOf(c, 'aliases')) {
        if (seenAliases.has(t)) {
          err(
            'C110',
            `term ${c.ident}: aliases: duplicate entry "${t}" — one entry has one home (term-alias-shape)`,
          );
        }
        seenAliases.add(t);
      }
    }
  }

  // C111: a dimension's values carry no duplicate value id.
  for (const c of pkg.constructs) {
    if (c.keyword !== 'dimension') {
      continue;
    }
    const valueIds = new Map<string, number>();
    for (const sub of nested(c)) {
      if (sub.keyword === 'values' || sub.keyword === 'value') {
        for (const v of nested(sub)) {
          const id = v.ident !== '' ? v.ident : v.keyword;
          valueIds.set(id, (valueIds.get(id) ?? 0) + 1);
        }
      }
    }
    for (const [id, n] of valueIds) {
      if (n > 1) {
        err(
          'C111',
          `dimension ${c.ident}: duplicate value id "${id}" (dimension-shape)`,
        );
      }
    }
  }

  // C128: the part-annex register keys one annex per printed letter.
  const annexLetters = new Map<string, string>();
  for (const c of pkg.constructs) {
    if (c.keyword !== 'part_annex') {
      continue;
    }
    const letter = tokensOf(c, 'letter')[0] ?? '';
    if (letter === '') {
      continue;
    }
    const owner = annexLetters.get(letter);
    if (owner !== undefined) {
      err(
        'C128',
        `part_annex ${c.ident}: letter "${letter}" is already keyed by ${owner} (part-annex-register)`,
      );
    } else {
      annexLetters.set(letter, c.ident);
    }
  }

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
          const parts = bind[0]!.split('.');
          // identity binds are always valid (the kernel's own
          // carve-out — identity is not an attribute register).
          if (parts[0] === 'model' && parts[1] === 'identity') {
            continue;
          }
          const attr = parts[2] ?? parts[parts.length - 1] ?? '';
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
      const stream: { key: string; tokens: string[]; blocks: Item[][] }[] = [];
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

    // ── C132: an application declaration's documents are unique.
    if (c.keyword === 'application_declaration') {
      const seen = new Map<string, number>();
      for (const d of nested(c)) {
        if (d.keyword === 'document') {
          seen.set(d.ident, (seen.get(d.ident) ?? 0) + 1);
        }
      }
      for (const [id, n] of seen) {
        if (n > 1) {
          err(
            'C132',
            `application_declaration ${c.ident}: document "${id}" is declared ${n} times (application-declaration-shape)`,
          );
        }
      }
    }

    // ── C141: a test-report checklist's entries are unique.
    if (c.keyword === 'test_report_checklist') {
      const seen = new Map<string, number>();
      for (const e of nested(c)) {
        if (e.keyword === 'entry') {
          seen.set(e.ident, (seen.get(e.ident) ?? 0) + 1);
        }
      }
      for (const [id, n] of seen) {
        if (n > 1) {
          err(
            'C141',
            `test_report_checklist ${c.ident}: entry "${id}" is declared ${n} times (checklist-shape)`,
          );
        }
      }
    }

    // ── C125: an expression-typed calculation variant carries its
    //    expression facet.
    if (c.keyword === 'calculation') {
      for (const v of nested(c)) {
        if (v.keyword !== 'variant') {
          continue;
        }
        const type = tokensOf(v, 'type')[0] ?? '';
        if (type === 'expression' && tokensOf(v, 'expression').length === 0) {
          err(
            'C125',
            `calculation ${c.ident}: variant ${v.ident}: type expression requires the expression facet (formula-variant-shape)`,
          );
        }
      }
    }

    // ── C130: an identity slot declares at least one presentation
    //    channel.
    if (c.keyword === 'identity_slot') {
      const presentations = [
        ...nested(c).filter(n => n.keyword === 'presentation'),
        ...lines(c).filter(l => l.key === 'presentation'),
      ];
      if (presentations.length === 0) {
        err(
          'C130',
          `identity_slot ${c.ident}: at least one presentation channel is required (identity-and-aspect-references)`,
        );
      }
    }

    // ── C104: a dataspace's policy register references declared
    //    policies.
    if (c.keyword === 'dataspace') {
      for (const entry of tokensOf(c, 'policies')) {
        if (!policies.has(entry)) {
          err(
            'C104',
            `dataspace ${c.ident}: policies entry "${entry}" declares no policy of that id (dataspace-references-resolve)`,
          );
        }
      }
    }

    // ── C121: an abstract process's organs reference declared
    //    governance organs.
    if (c.keyword === 'process') {
      for (const entry of tokensOf(c, 'organs')) {
        if (!organs.has(entry)) {
          err(
            'C121',
            `process ${c.ident}: organs "${entry}" is not a declared governance organ (abstract-process-references-resolve)`,
          );
        }
      }
    }

    // ── C173 step-plane-refs-resolve: a signature step's completion is
    //     one expression over the step's own declared ios — the
    //     identifiers resolve to inputs/outputs, the calls stay in the
    //     closed vocabulary, and nothing in the completion is air.
    if (c.keyword === 'process') {
      const stepOf = (
        st: Construct,
      ): { ios: Set<string>; completion?: string } => {
        const ios = new Set<string>();
        for (const key of ['inputs', 'outputs'] as const) {
          for (const io of nested(st).filter(n => n.keyword === key)) {
            for (const i of io.items) {
              if (i.kind === 'line' && i.key) {
                for (const t of [i.key, ...i.tokens]) {
                  ios.add(t);
                }
              } else {
                for (const t of i.tokens) {
                  ios.add(t);
                }
              }
            }
          }
        }
        return { ios, completion: facetTokens(st.items, 'completion')[0] };
      };
      for (const st of nested(c).filter(n => n.keyword === 'step')) {
        const { ios, completion } = stepOf(st);
        if (!completion) {
          continue;
        }
        const stId = st.ident ?? '';
        const src = completion.replace(/^ocl\{/, '').replace(/\}$/, '');
        let ids;
        try {
          ids = readExpression(src, () => null);
        } catch (e) {
          err(
            'C173',
            `process ${c.ident}: step "${stId}" completion does not parse — ${String((e as Error).message ?? e)} — the completion is one expression over the step's ios (step-plane-refs-resolve)`,
          );
          continue;
        }
        for (const call of new Set(ids.calls)) {
          if (!X_FUNCS.has(call)) {
            err(
              'C173',
              `process ${c.ident}: step "${stId}" completion calls "${call}(…)", which is not in the expression function vocabulary (step-plane-refs-resolve)`,
            );
          }
        }
        for (const id of new Set(ids.names)) {
          const root = id.split('.')[0]!;
          if (
            id.includes('.') &&
            (root === 'self' || X_CONTEXT_ROOTS.has(root))
          ) {
            continue;
          }
          if (ios.has(id) || ios.has(root)) {
            continue;
          }
          err(
            'C173',
            `process ${c.ident}: step "${stId}" completion names "${id}", which is not a declared io of the step — the completion reads the step's own inputs and outputs (step-plane-refs-resolve)`,
          );
        }
      }
    }

    // ── the process flow family: C16, C58, C12, C13 (the batch after
    //     C173's step-plane leg) ──
    if (c.keyword === 'activity_archetype') {
      const parent = facetTokens(c.items, 'parent')[0];
      if (parent) {
        const ids = new Set(
          closureConstructs
            .filter(x => x.keyword === 'activity_archetype' && x.ident)
            .map(x => x.ident!),
        );
        if (!ids.has(parent)) {
          err(
            'C58',
            `activity_archetype ${c.ident}: parent "${parent}" is not a declared activity archetype (activity-kind-resolves)`,
          );
        }
      }
    }
    if (c.keyword === 'process' && c.ident) {
      // The flow family applies only to the EXECUTABLE form: the steps
      // live in a `does` body (the kernel's p.does gate — a process
      // with bare signature-steps is the step plane, C173's, not this
      // family's).
      const doesBody = nested(c).find(n => n.keyword === 'does');
      if (!doesBody) {
        // fall through to the signature realization below? No — the
        // kernel's C13 also reads p.does; without it the whole family
        // is out of scope. Use the label jump via an else-less block.
      } else {
        const steps = nested(doesBody).filter(n => n.keyword === 'step');
        // C16: step ids are unique within one does body.
        const seenSteps = new Set<string>();
        for (const st of steps) {
          const id = st.ident ?? '';
          if (seenSteps.has(id)) {
            err(
              'C16',
              `process ${c.ident}: duplicate step id "${id}" in the does body (process-step-ids-unique)`,
            );
          }
          seenSteps.add(id);
        }
        // C58: activity kinds resolve against the declared archetypes
        // (register-gated — an empty register is out of scope, not air).
        const archetypeIds = new Set(
          closureConstructs
            .filter(x => x.keyword === 'activity_archetype' && x.ident)
            .map(x => x.ident!),
        );
        if (archetypeIds.size > 0) {
          for (const kind of tokensOf(c, 'activity_kind')) {
            if (!archetypeIds.has(kind)) {
              err(
                'C58',
                `process ${c.ident}: activity_kind "${kind}" is not a declared activity archetype (activity-kind-resolves)`,
              );
            }
          }
        }
        // C12: step io and gateway self-gates name declared registers or
        // signature parameters (state is a declared HAS).
        const declared = new Set<string>(['state']);
        const regs = nested(c).find(n => n.keyword === 'registers');
        for (const l of regs ? regs.items : []) {
          if (l.kind === 'line' && l.key) {
            declared.add(l.key);
          }
        }
        const sig = nested(c).find(n => n.keyword === 'signature');
        const sigOf = (key: 'inputs' | 'outputs'): string[] => {
          const side = sig
            ? nested(sig).find(n => n.keyword === key)
            : undefined;
          if (!side) {
            return [];
          }
          return side.items.flatMap(i =>
            i.kind === 'construct' && i.construct
              ? i.construct.ident
                ? [i.construct.ident]
                : []
              : i.kind === 'line' && i.key
                ? [i.key, ...i.tokens]
                : i.tokens,
          );
        };
        for (const n of sigOf('inputs')) {
          declared.add(n);
        }
        for (const n of sigOf('outputs')) {
          declared.add(n);
        }
        const stepIo = (st: Construct, key: 'inputs' | 'outputs'): string[] => {
          const out: string[] = [];
          for (const io of nested(st).filter(n => n.keyword === key)) {
            for (const i of io.items) {
              if (i.kind === 'line' && i.key) {
                out.push(i.key, ...i.tokens);
              } else {
                out.push(...i.tokens);
              }
            }
          }
          return out;
        };
        for (const st of steps) {
          for (const n of stepIo(st, 'inputs')) {
            if (!declared.has(n)) {
              err(
                'C12',
                `process ${c.ident}: step "${st.ident}" names undeclared register "${n}" (process-flow-names-resolve)`,
              );
            }
          }
          for (const n of stepIo(st, 'outputs')) {
            if (!declared.has(n)) {
              err(
                'C12',
                `process ${c.ident}: step "${st.ident}" names undeclared register "${n}" (process-flow-names-resolve)`,
              );
            }
          }
        }
        for (const g of nested(doesBody).filter(n => n.keyword === 'gateway')) {
          for (const cond of tokensOf(g, 'condition')) {
            for (const m of cond.matchAll(
              /\bself\.([A-Za-z_][A-Za-z0-9_]*)/g,
            )) {
              if (!declared.has(m[1]!)) {
                err(
                  'C12',
                  `process ${c.ident}: gateway "${g.ident}" edge condition references undeclared register "${m[1]}" (process-flow-names-resolve)`,
                );
              }
            }
          }
        }
        // C13: the executable steps realize the signature — every OUT
        // parameter is written (error), every IN parameter is read
        // (warning).
        if (sig) {
          const written = new Set<string>();
          const read = new Set<string>();
          for (const st of steps) {
            for (const n of stepIo(st, 'outputs')) {
              written.add(n);
            }
            for (const n of stepIo(st, 'inputs')) {
              read.add(n);
            }
            for (const w of tokensOf(st, 'wait')) {
              read.add(w);
            }
            for (const b of nested(st).filter(n => n.keyword === 'binding')) {
              for (const t of b.items) {
                if (t.kind === 'line' && t.key) {
                  (t.key === 'to' ? written : read).add(t.tokens[0] ?? t.key);
                }
              }
            }
          }
          for (const o of sigOf('outputs')) {
            if (!written.has(o)) {
              err(
                'C13',
                `process ${c.ident}: OUT parameter "${o}" is never written by any step (process-signature-realized)`,
              );
            }
          }
          for (const i of sigOf('inputs')) {
            if (!read.has(i)) {
              issues.push({
                rule: 'C13',
                severity: 'warning',
                message: `process ${c.ident}: IN parameter "${i}" is never read by any step (process-signature-realized)`,
              });
            }
          }
        }
      }
    }

    // ── C122: a scheme type's determination list references declared
    //    scheme activity kinds.
    if (c.keyword === 'scheme_type') {
      for (const entry of tokensOf(c, 'determination')) {
        if (!activityKinds.has(entry)) {
          err(
            'C122',
            `scheme_type ${c.ident}: determination "${entry}" is not a declared scheme activity kind (scheme-type-resolves)`,
          );
        }
      }
    }

    // ── C126: a formula note's applies_to reference declared symbols.
    if (c.keyword === 'formula_note') {
      for (const entry of tokensOf(c, 'applies_to')) {
        if (!symbols.has(entry)) {
          err(
            'C126',
            `formula_note ${c.ident}: applies_to "${entry}" is not a declared symbol (formula-note-targets-resolve)`,
          );
        }
      }
    }

    // ── C140: a test-report skeleton's section forms reference
    //    declared forms.
    if (c.keyword === 'test_report_skeleton') {
      for (const section of nested(c)) {
        if (section.keyword !== 'section') {
          continue;
        }
        for (const f of nested(section)) {
          if (f.keyword === 'form' && !forms.has(f.ident)) {
            err(
              'C140',
              `test_report_skeleton ${c.ident}: section ${section.ident}: form ${f.ident}: the entry id is not a declared form (test-report-skeleton-references)`,
            );
          }
        }
      }
    }

    // ── C143: an approval's actor and approver are declared roles,
    //    and its record store is a declared class store.
    if (c.keyword === 'approval') {
      for (const actor of tokensOf(c, 'actor')) {
        if (!roles.has(actor)) {
          err(
            'C143',
            `approval ${c.ident}: actor "${actor}" is not a declared role (approval-references-resolve)`,
          );
        }
      }
      for (const approver of tokensOf(c, 'approve_by')) {
        if (!roles.has(approver)) {
          err(
            'C143',
            `approval ${c.ident}: approve_by "${approver}" is not a declared role (approval-references-resolve)`,
          );
        }
      }
      for (const store of tokensOf(c, 'approval_record')) {
        if (!classStores.has(store)) {
          err(
            'C143',
            `approval ${c.ident}: approval_record "${store}" is not a declared class store (approval-references-resolve)`,
          );
        }
      }
    }

    // ── C142: the exclusive gateway's edge discipline — edge targets
    //    resolve to declared processes, and exactly one default edge.
    if (c.keyword === 'exclusive_gateway') {
      // exhaustive true — the conditions are exhaustive over their
      // dimension domain: no default edge is required (a declared
      // default would be a dead route).
      const exhaustive = facetTokens(c.items, 'exhaustive')[0] === 'true';
      let defaults = 0;
      for (const e of nested(c)) {
        if (e.keyword !== 'edge') {
          continue;
        }
        if (
          lines(e).some(
            l =>
              l.key === 'default' ||
              (l.key === 'condition' && l.tokens.includes('default')),
          )
        ) {
          defaults++;
        }
        // The edge's id IS its target process (`edge skip_tests { … }`);
        // the target leg gates on a process register being in scope
        // (with none declared, only the default discipline fires).
        const targets = [e.ident, ...tokensOf(e, 'to')].filter(Boolean);
        if (processes.size > 0) {
          for (const target of targets) {
            if (!processes.has(target)) {
              err(
                'C142',
                `exclusive_gateway ${c.ident}: edge ${e.ident} targets "${target}", which is not a declared process (gateway-edges-resolve)`,
              );
            }
          }
        }
      }
      const edgesPresent = nested(c).some(e => e.keyword === 'edge');
      if (exhaustive && defaults > 0) {
        err(
          'C142',
          `exclusive_gateway ${c.ident}: declares a default edge but the conditions are exhaustive — the catch-all can never fire (gateway-edges-resolve)`,
        );
      } else if (!exhaustive && defaults === 0 && edgesPresent) {
        err(
          'C142',
          `exclusive_gateway ${c.ident}: no default edge — the first-match-wins cascade needs its catch-all (gateway-edges-resolve)`,
        );
      } else if (defaults > 1) {
        err(
          'C142',
          `exclusive_gateway ${c.ident}: ${defaults} default edges — exactly one catch-all is allowed (gateway-edges-resolve)`,
        );
      }
    }

    // ── C120: a participant kind's approval decider is a declared
    //    governance organ.
    if (c.keyword === 'participant_kind') {
      for (const approval of nested(c)) {
        if (approval.keyword !== 'approval') {
          continue;
        }
        for (const decider of tokensOf(approval, 'decided_by')) {
          if (!organs.has(decider)) {
            err(
              'C120',
              `participant_kind ${c.ident}: approval.decided_by "${decider}" is not a declared governance organ (framework-references-resolve)`,
            );
          }
        }
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

  // ── the expression plane (register 18): C171, C172, C177 ──────────
  // The second implementation of the inline carriers' resolution: the
  // blocks read through this implementation's own expression reader
  // (src/expressions.ts), the identifiers resolved against the args'
  // declarations and the package's registries. The legacy ocl{…} string
  // form is outside this slice (the register documents the reach).
  {
    const tail = (id: string): string => id.split('/').pop() ?? id;
    const kindsOf = (kw: string): Map<string, string> => {
      const m = new Map<string, string>();
      for (const c of closureConstructs.filter(x => x.keyword === kw)) {
        const k = facetTokens(c.items, 'quantity_kind')[0];
        if (k) {
          m.set(c.ident, k);
          m.set(tail(c.ident), k);
        }
      }
      return m;
    };
    const symbolKinds = kindsOf('symbol');
    const attributeKinds = kindsOf('attribute_definition');
    const verdictKinds = kindsOf('verdict');
    // the declared-name registries: every declaration participates in
    // the resolution (the kinds only feed C177); calculations join the
    // callable registry the way the kernel's globalExprNames carries
    // them (a derivation calls a declared calculation)
    const declaredNames = new Set<string>();
    for (const kw of [
      'symbol',
      'datum',
      'verdict',
      'table',
      'attribute_definition',
      'calculation',
    ]) {
      for (const c of closureConstructs.filter(x => x.keyword === kw)) {
        if (c.ident) {
          declaredNames.add(c.ident);
          declaredNames.add(tail(c.ident));
        }
      }
    }
    const tableIds = new Set(
      closureConstructs.filter(c => c.keyword === 'table').map(c => c.ident),
    );
    const seriesVars = new Set<string>();
    for (const t of pkg.constructs.filter(
      x => x.keyword === 'conformance_test',
    )) {
      const vars = nested(t).find(n => n.keyword === 'variables');
      for (const v of vars ? nested(vars) : []) {
        if (v.keyword !== 'variable' || !v.ident) {
          continue;
        }
        if (v.items.some(i => i.kind === 'line' && i.key === 'series')) {
          seriesVars.add(v.ident);
        }
      }
    }
    const DECLARATION_KINDS = new Set([
      'symbol',
      'table',
      'datum',
      'verdict',
      'attribute',
    ]);
    const rawTokens = (l: { blocks: Item[][] }): string[] | null => {
      const first = l.blocks[0]?.[0];
      return first !== undefined && first.kind === 'raw' ? first.tokens : null;
    };
    const inlineOf = (
      limit: Construct,
    ): { args: { name: string; source: string }[]; src: string } | null => {
      let args: { name: string; source: string }[] = [];
      const argsLine = lines(limit).find(l => l.key === 'args');
      if (argsLine) {
        const t = rawTokens(argsLine);
        if (t) {
          args = [];
          for (let i = 0; i + 2 < t.length; i += 3) {
            if (t[i + 1] === '<-') {
              args.push({ name: t[i]!, source: t[i + 2]! });
            }
          }
        }
      }
      const exprLine = lines(limit).find(l => l.key === 'expression');
      if (!exprLine) {
        return null;
      }
      const t = rawTokens(exprLine);
      if (!t) {
        return null;
      }
      return { args, src: t.join(' ') };
    };
    const argKindOf = (
      args: { name: string; source: string }[],
      name: string,
    ): string | null | undefined => {
      const a = args.find(x => x.name === name);
      if (!a) {
        return undefined;
      }
      const source = a.source;
      if (source.includes(':')) {
        const segs = source.split(':');
        if (segs.length !== 2) {
          return undefined;
        }
        const [kind, id] = segs;
        if (kind === 'symbol') {
          return symbolKinds.get(tail(id));
        }
        if (kind === 'attribute') {
          return attributeKinds.get(tail(id));
        }
        if (kind === 'verdict') {
          return verdictKinds.get(id.split('.')[0]!);
        }
        return undefined;
      }
      if (source === 'self' || source.startsWith('self.')) {
        return undefined;
      }
      return symbolKinds.get(source) ?? attributeKinds.get(source) ?? undefined;
    };
    const walkLimit = (
      ownerKind: string,
      ownerId: string,
      limit: Construct,
      memberScope: Set<string> | null,
    ): void => {
      const inline = inlineOf(limit);
      if (!inline) {
        return;
      }
      const { args, src } = inline;
      const argNames = new Set(args.map(a => a.name));
      let ids;
      try {
        ids = readExpression(src, path => argKindOf(args, path.join('.')));
      } catch (e) {
        err(
          'C171',
          `${ownerKind} ${ownerId}: the inline expression does not parse — ${String((e as Error).message)} (expression-identifiers-resolve)`,
        );
        return;
      }
      if (
        memberScope === null &&
        args.length === 0 &&
        ids.names.some(n => !n.includes('.'))
      ) {
        err(
          'C171',
          `${ownerKind} ${ownerId}: the inline limit declares no arguments — every identifier must bind explicitly (expression-identifiers-resolve)`,
        );
      }
      for (const call of new Set(ids.calls)) {
        if (X_FUNCS.has(call) || argNames.has(call)) {
          continue;
        }
        if (declaredNames.has(call)) {
          // a declared callable — the calculation registry (the mapped
          // mpe(…), R 49's relative_error(…))
          continue;
        }
        if (call.includes('.')) {
          const root = call.split('.')[0]!;
          if (
            argNames.has(root) ||
            declaredNames.has(root) ||
            root === 'self' ||
            X_CONTEXT_ROOTS.has(root)
          ) {
            // the method rides its declared object — the root is the check
            continue;
          }
        }
        err(
          'C171',
          `${ownerKind} ${ownerId}: the expression calls "${call}(…)", which nothing declares and which is not in the function vocabulary (expression-identifiers-resolve)`,
        );
      }
      for (const name of new Set(ids.names)) {
        const root = name.split('.')[0]!;
        if (
          name.includes('.') &&
          (root === 'self' || X_CONTEXT_ROOTS.has(root) || argNames.has(root))
        ) {
          continue;
        }
        if (argNames.has(name)) {
          continue;
        }
        if (memberScope !== null && memberScope.has(name)) {
          continue;
        }
        err(
          memberScope !== null ? 'C172' : 'C171',
          `${ownerKind} ${ownerId}: the expression names "${name}", which no argument binds${memberScope !== null ? ' — the law composes the containment only' : ''} (expression-identifiers-resolve)`,
        );
      }
      for (const a of args) {
        if (a.source.includes(':')) {
          const segs = a.source.split(':');
          if (segs.length === 2) {
            const [kind, id] = segs;
            if (kind === 'process') {
              // register 19: process:<p>[.<step>[.<io>]] — the dot
              // descends the declared structure
              const segs2 = id.split('.');
              const proc = pkg.constructs.find(
                x => x.keyword === 'process' && x.ident === segs2[0],
              );
              if (!proc) {
                err(
                  'C171',
                  `${ownerKind} ${ownerId}: argument "${a.name}" binds to "${a.source}", which no declared process names (expression-identifiers-resolve)`,
                );
              } else if (segs2.length >= 2) {
                const stp = nested(proc).find(
                  x => x.keyword === 'step' && x.ident === segs2[1],
                );
                if (!stp) {
                  err(
                    'C171',
                    `${ownerKind} ${ownerId}: argument "${a.name}" binds to "${a.source}" — the process declares no step "${segs2[1]}" (expression-identifiers-resolve)`,
                  );
                } else if (segs2.length >= 3) {
                  const io = segs2.slice(2).join('.');
                  const ios = new Set<string>();
                  for (const key of ['inputs', 'outputs']) {
                    // the io block: a nested construct whose greedy run
                    // puts the first name in the line key, the rest in
                    // the tokens
                    const blk = nested(stp).find(x => x.keyword === key);
                    if (!blk) {
                      continue;
                    }
                    for (const it of blk.items) {
                      if (it.kind === 'line') {
                        if (it.key) {
                          ios.add(it.key);
                        }
                        for (const tok of it.tokens) {
                          ios.add(tok);
                        }
                      } else if (it.kind === 'raw') {
                        for (const tok of it.tokens) {
                          ios.add(tok);
                        }
                      }
                    }
                  }
                  if (!ios.has(io)) {
                    err(
                      'C171',
                      `${ownerKind} ${ownerId}: argument "${a.name}" binds to "${a.source}" — the step declares no io "${io}" (expression-identifiers-resolve)`,
                    );
                  }
                }
              }
              continue;
            }
            if (kind !== 'observable') {
              if (!DECLARATION_KINDS.has(kind)) {
                err(
                  'C171',
                  `${ownerKind} ${ownerId}: argument "${a.name}" binds to "${a.source}" — "${kind}" is not a declaration kind (expression-identifiers-resolve)`,
                );
              } else {
                const reg =
                  kind === 'symbol'
                    ? symbolKinds
                    : kind === 'attribute'
                      ? attributeKinds
                      : kind === 'verdict'
                        ? verdictKinds
                        : null;
                const tableOk =
                  kind === 'table' && tableIds.has(id.split('.')[0]!);
                const declared =
                  declaredNames.has(id) ||
                  declaredNames.has(tail(id)) ||
                  declaredNames.has(id.split('.')[0]!);
                if (reg && !declared && !tableOk) {
                  err(
                    'C171',
                    `${ownerKind} ${ownerId}: argument "${a.name}" binds to "${a.source}", which no declared ${kind} names (expression-identifiers-resolve)`,
                  );
                }
              }
            }
          }
          continue;
        }
        if (a.source === 'self' || a.source.startsWith('self.')) {
          continue;
        }
        const bare = a.source.split(':').pop() ?? a.source;
        if (memberScope !== null) {
          if (!memberScope.has(a.source) && !memberScope.has(bare)) {
            err(
              'C172',
              `requirement class ${ownerId}: the law binds "${a.name}" to "${a.source}", which is not a contained member (requirement-algebra-resolves)`,
            );
          }
          continue;
        }
        if (!declaredNames.has(bare)) {
          err(
            'C171',
            `${ownerKind} ${ownerId}: argument "${a.name}" binds to "${a.source}", which nothing declares (expression-identifiers-resolve)`,
          );
        }
      }
      // C177 kind-coherence
      for (const mix of ids.mixes) {
        const l = mix.leftKind === 'TEXT' ? 'text' : mix.leftKind;
        const r = mix.rightKind === 'TEXT' ? 'text' : mix.rightKind;
        err(
          'C177',
          `${ownerKind} ${ownerId}: the "${l}" quantity is set against the "${r}" quantity — the operands must share the quantity kind (kind-coherence)`,
        );
      }
      // the class law's member coverage
      if (memberScope !== null) {
        const covered = new Set<string>(ids.names);
        for (const a of args) {
          covered.add(a.name);
          covered.add(a.source);
        }
        for (const m of memberScope) {
          if (!covered.has(m)) {
            issues.push({
              rule: 'C172',
              severity: 'warning',
              message: `requirement class ${ownerId}: member ${m} does not appear in the law (requirement-algebra-resolves)`,
            });
          }
        }
      }
    };
    for (const c of pkg.constructs.filter(x => x.keyword === 'requirement')) {
      const limit = nested(c).find(n => n.keyword === 'limit');
      if (limit) {
        walkLimit('requirement', c.ident, limit, null);
      }
    }
    for (const c of pkg.constructs.filter(x => x.keyword === 'constraint')) {
      const args: { name: string; source: string }[] = [];
      const argsLine = lines(c).find(l => l.key === 'args');
      if (argsLine) {
        const t = rawTokens(argsLine);
        if (t) {
          for (let i = 0; i + 2 < t.length; i += 3) {
            if (t[i + 1] === '<-') {
              args.push({ name: t[i]!, source: t[i + 2]! });
            }
          }
        }
      }
      // every check line walks — a doubled check is the last-wins
      // parse's data, and each block is an invariant of its own
      const argItems: Item[] =
        args.length > 0
          ? [
              {
                kind: 'line',
                key: 'args',
                tokens: [],
                blocks: [
                  [
                    {
                      kind: 'raw',
                      tokens: args.flatMap(a => [a.name, '<-', a.source]),
                      blocks: [],
                    },
                  ],
                ],
              },
            ]
          : [];
      for (const checkLine of lines(c).filter(
        l =>
          l.key === 'check' &&
          l.blocks.length > 0 &&
          l.blocks[0]?.[0]?.kind === 'raw',
      )) {
        walkLimit(
          'constraint',
          c.ident,
          {
            keyword: 'limit',
            ident: '',
            items: [
              ...argItems,
              {
                kind: 'line',
                key: 'expression',
                tokens: [],
                blocks: checkLine.blocks,
              },
            ],
          },
          null,
        );
      }
    }
    for (const c of pkg.constructs.filter(
      x => x.keyword === 'requirement_class',
    )) {
      const limit = nested(c).find(n => n.keyword === 'limit');
      const members = new Set(
        nested(c)
          .filter(n => n.keyword === 'requirement' && n.ident)
          .map(n => n.ident),
      );
      if (limit) {
        walkLimit('requirement class', c.ident, limit, members);
      }
    }
    // The run plane (input ⇒ output ⇒ store): C180/C181 — the run
    // facet's performer vocabulary, the store's registry, the
    // trajectory's machine, and the store↔form data-class agreement.
    {
      const registryIds = new Set(
        closureConstructs
          .filter(x => x.keyword === 'data_registry' && x.ident)
          .map(x => x.ident),
      );
      const machineNames = new Set(
        pkg.constructs
          .filter(x => x.keyword === 'state_machine')
          .map(x => x.ident),
      );
      const registryData = new Map<string, string>();
      for (const x of closureConstructs.filter(
        c => c.keyword === 'data_registry' && c.ident,
      )) {
        const dc = facetTokens(x.items, 'data_class')[0];
        if (dc) {
          registryData.set(x.ident!, dc);
        }
      }
      for (const c of pkg.constructs.filter(
        x => x.keyword === 'conformance_test' && x.ident,
      )) {
        const run = nested(c).find(n => n.keyword === 'run');
        if (!run) {
          continue;
        }
        const who = facetTokens(run.items, 'performed_by')[0];
        if (who && who !== 'laboratory' && who !== 'manufacturer') {
          err(
            'C180',
            `conformance test ${c.ident}: run performer "${who}" is outside the closed vocabulary (laboratory | manufacturer) (run-plane-shape)`,
          );
        }
        const store = facetTokens(run.items, 'store')[0];
        if (store && !registryIds.has(store)) {
          err(
            'C180',
            `conformance test ${c.ident}: run store "${store}" names no declared data_registry — the collected records land in a declared store (run-plane-shape)`,
          );
        }
        const trajectory = facetTokens(run.items, 'trajectory')[0];
        if (trajectory && !machineNames.has(trajectory)) {
          err(
            'C180',
            `conformance test ${c.ident}: run trajectory "${trajectory}" names no declared state_machine — the run folds a declared trajectory (run-plane-shape)`,
          );
        }
        // the applied-input contract: each input names a declared
        // declared-source variable of the test — a measured variable is
        // an output of the run, never an input
        const declaredVars = new Map<string, string>();
        for (const v of nested(c).filter(n => n.keyword === 'variables')) {
          for (const vr of nested(v).filter(n => n.keyword === 'variable')) {
            if (vr.ident) {
              declaredVars.set(
                vr.ident,
                facetTokens(vr.items, 'source')[0] ?? '',
              );
            }
          }
        }
        const runInputs: string[] = [];
        for (const inp of nested(run).filter(n => n.keyword === 'inputs')) {
          for (const i of inp.items) {
            if (i.kind === 'line' && i.key) {
              runInputs.push(i.key, ...i.tokens);
            } else {
              runInputs.push(...i.tokens);
            }
          }
        }
        for (const input of runInputs) {
          if (!declaredVars.has(input)) {
            err(
              'C180',
              `conformance test ${c.ident}: run input "${input}" names no declared variable — the applied-input contract binds the test's own declarations (run-plane-shape)`,
            );
          } else if (declaredVars.get(input) !== 'declared') {
            err(
              'C180',
              `conformance test ${c.ident}: run input "${input}" is source ${declaredVars.get(input)} — an applied input is declared by the author; a measured variable is an output of the run, never an input (run-plane-shape)`,
            );
          }
        }
        if (store && registryData.has(store)) {
          const held = registryData.get(store)!;
          const records = tokensOf(c, 'result_forms');
          for (const formId of records) {
            const form = closureConstructs.find(
              x =>
                x.keyword === 'form' &&
                (x.ident === formId || x.ident === formId.replace(/^\//, '')),
            );
            const dc = form
              ? facetTokens(form.items, 'data_class')[0]
              : undefined;
            if (dc && dc !== held) {
              err(
                'C181',
                `conformance test ${c.ident}: the run's store "${store}" holds ${held}, but its record form ${formId} captures ${dc} — the output records and the store must agree on the data class (run-store-binds)`,
              );
            }
          }
        }
      }
    }

    // C183 record-run-inputs (kernel#57's slice): the record form's
    // run_inputs names the applied-input slice — every name is the
    // owning test's run.inputs member and a field of the form's data
    // class; the owning test resolves through the form's
    // conformance_process binding.
    {
      const classFields = new Map<string, Set<string>>();
      for (const dc of closureConstructs.filter(
        x => x.keyword === 'class' && x.ident,
      )) {
        const fields = new Set<string>();
        for (const g of nested(dc).filter(n => n.keyword === 'attributes')) {
          for (const a of nested(g)) {
            if (a.ident) {
              fields.add(a.ident);
            }
          }
        }
        classFields.set(dc.ident!, fields);
      }
      const testInputs = new Map<string, string[]>();
      for (const t of closureConstructs.filter(
        x => x.keyword === 'conformance_test' && x.ident,
      )) {
        for (const run of nested(t).filter(n => n.keyword === 'run')) {
          const inputs: string[] = [];
          for (const inp of nested(run).filter(n => n.keyword === 'inputs')) {
            inputs.push(...rawTokensT(inp));
          }
          if (inputs.length) {
            testInputs.set(t.ident!, inputs);
          }
        }
      }
      for (const form of closureConstructs.filter(
        x => x.keyword === 'form' && x.ident,
      )) {
        const slice = facetTokens(form.items, 'run_inputs');
        if (slice.length === 0) {
          continue;
        }
        const proc = facetTokens(form.items, 'conformance_process')[0] ?? '';
        const inputs = testInputs.get(proc);
        if (!inputs) {
          err(
            'C183',
            `form ${form.ident}: run_inputs names ${slice.join(' ')} but the form binds no conformance test — the slice's contract is the owning test's run.inputs (record-run-inputs)`,
          );
          continue;
        }
        const dc = facetTokens(form.items, 'data_class')[0] ?? '';
        const fields =
          classFields.get(dc) ?? classFields.get(dc.replace(/#data$/, ''));
        for (const name of slice) {
          if (!inputs.includes(name)) {
            err(
              'C183',
              `form ${form.ident}: run_inputs "${name}" is not in the owning test's run.inputs (${proc}) — a record cannot carry what the run does not apply (record-run-inputs)`,
            );
          }
          if (!fields || !fields.has(name)) {
            err(
              'C183',
              `form ${form.ident}: run_inputs "${name}" is no field of the data class ${dc} — the record's slice must be the record's shape (record-run-inputs)`,
            );
          }
        }
      }
    }

    // C184 field-range-order (kernel#90): the form field's scalar
    // min/max — each a numeric literal or a template, a numerically
    // bounded pair ordered min ≤ max; the nested fields judged with
    // the same rule.
    {
      const rangeOk = (
        v: string | undefined,
      ): 'absent' | 'numeric' | 'template' | 'invalid' => {
        if (v === undefined) {
          return 'absent';
        }
        if (/^-?\d+(\.\d+)?$/.test(v)) {
          return 'numeric';
        }
        if (/^\$\{.+\}$/.test(v)) {
          return 'template';
        }
        return 'invalid';
      };
      const walkFields = (
        formIdent: string,
        fields: Construct[],
        path: string,
      ): void => {
        for (const f of fields) {
          const where =
            path === ''
              ? `field ${f.ident ?? ''}`
              : `field ${path}.${f.ident ?? ''}`;
          const kMin = rangeOk(facetTokens(f.items, 'min')[0]);
          const kMax = rangeOk(facetTokens(f.items, 'max')[0]);
          const minV = facetTokens(f.items, 'min')[0];
          const maxV = facetTokens(f.items, 'max')[0];
          if (kMin === 'invalid') {
            err(
              'C184',
              `form ${formIdent}: ${where} min "${minV}" is neither a numeric literal nor a template (field-range-order)`,
            );
          }
          if (kMax === 'invalid') {
            err(
              'C184',
              `form ${formIdent}: ${where} max "${maxV}" is neither a numeric literal nor a template (field-range-order)`,
            );
          }
          if (
            kMin === 'numeric' &&
            kMax === 'numeric' &&
            Number(minV) > Number(maxV)
          ) {
            err(
              'C184',
              `form ${formIdent}: ${where} declares min ${minV} > max ${maxV} — the range is empty by declaration (field-range-order)`,
            );
          }
          walkFields(
            formIdent,
            nested(f).filter(n => n.keyword === 'fields'),
            path === '' ? (f.ident ?? '') : `${path}.${f.ident ?? ''}`,
          );
        }
      };
      for (const form of closureConstructs.filter(
        x => x.keyword === 'form' && x.ident,
      )) {
        walkFields(
          form.ident!,
          nested(form).filter(n => n.keyword === 'field'),
          '',
        );
      }
    }

    // C185 unitsdb-binding-coherent (kernel#87): checker2 runs without
    // the UnitsDB snapshot — the binding's shape is the judgement here
    // (a pin carries at least one identifier); the resolution against a
    // supplied DB is the kernel's option, mirrored never imported.
    {
      for (const reg of closureConstructs.filter(
        x => x.keyword === 'quantity_register' && x.ident,
      )) {
        for (const u of nested(reg).filter(n => n.keyword === 'unit')) {
          const pin = nested(u).find(n => n.keyword === 'unitsdb');
          if (!pin) {
            continue;
          }
          const nist = facetTokens(pin.items, 'nist')[0];
          const unitsml = facetTokens(pin.items, 'unitsml')[0];
          if (!nist && !unitsml) {
            err(
              'C185',
              `quantity_register ${reg.ident}: unit "${u.ident}" pins unitsdb with no identifier (nist / unitsml) (unitsdb-binding-coherent)`,
            );
          }
        }
      }
    }

    // ── #196 parity wave: the mapping, chain, artifact, and LML
    //    families — the kernel judgments checker2 had not mirrored.
    //    Every leg reads the shape tree (never kernel code); the four
    //    kernel-reserved entries (C137 no construct, C163 the diff
    //    surface, C165/C166 the math plane) stay out of the register by
    //    design — see conformance/checker2-rules.json.
    {
      const stripColon2 = (x: string): string =>
        x.endsWith(':') && x.length > 1 ? x.slice(0, -1) : x;

      /** The greedy key/value runs of a block (`x: 1 y: 2` on one
       *  line): each `key:` opens an entry, the rest are its value. */
      const parseKeyValues = (
        block: Construct | undefined,
      ): Array<[string, string]> => {
        const out: Array<[string, string]> = [];
        if (!block) {
          return out;
        }
        for (const l of lines(block)) {
          let key = stripColon2(l.key);
          let vals: string[] = [];
          const flush = (): void => {
            if (key !== '') {
              out.push([key, vals.join(' ')]);
            }
          };
          for (const tok of l.tokens) {
            if (tok.endsWith(':') && tok.length > 1) {
              flush();
              key = tok.slice(0, -1);
              vals = [];
            } else {
              vals.push(tok);
            }
          }
          flush();
        }
        return out;
      };

      const manifest = pkg.constructs.find(c => c.keyword === 'package');
      const manifestFacet = (key: string): string =>
        manifest ? (tokensOf(manifest, key)[0] ?? '') : '';
      const localNs = manifestFacet('id');
      const pkgKind = manifestFacet('kind');
      const imported = new Set<string>();
      if (manifest) {
        for (const u of nested(manifest).filter(n => n.keyword === 'uses')) {
          for (const t of rawTokensT(u)) {
            imported.add(t.split('@')[0]!);
          }
        }
        const ext = tokensOf(manifest, 'extends')[0];
        if (ext) {
          imported.add(ext.split('@')[0]!);
        }
      }
      const siblingKind = (id: string): string => {
        for (const sib of pkg.siblings ?? []) {
          const pm = sib.constructs.find(c => c.keyword === 'package');
          if (!pm) {
            continue;
          }
          const sid = tokensOf(pm, 'id')[0];
          if (sid !== id) {
            continue;
          }
          return tokensOf(pm, 'kind')[0] ?? '';
        }
        return '';
      };

      // The component register (the kernel's componentIds): the
      // constructs a mapping may name, plus the subject IO vocabulary.
      const COMPONENT_KEYWORDS = new Set([
        'process',
        'provision',
        'reg',
        'approval',
        'requirement',
        'conformance_test',
        'form',
        'symbol',
        'table',
        'class',
        'term',
        'note',
        'role',
        'subject',
        'instrument',
        'behavior',
      ]);
      const collectByKeyword = (
        list: Construct[],
        keyword: string,
      ): Construct[] => {
        const out: Construct[] = [];
        const walk = (c: Construct): void => {
          if (c.keyword === keyword) {
            out.push(c);
          }
          for (const n of nested(c)) {
            walk(n);
          }
        };
        for (const c of list) {
          walk(c);
        }
        return out;
      };
      const allProcesses = collectByKeyword(closureConstructs, 'process');
      const compIds = new Set<string>();
      for (const c of closureConstructs) {
        if (c.ident && COMPONENT_KEYWORDS.has(c.keyword)) {
          compIds.add(c.ident);
        }
      }
      for (const p of allProcesses) {
        if (p.ident) {
          compIds.add(p.ident);
        }
      }
      for (const s of closureConstructs.filter(
        x => x.keyword === 'subject' && x.ident,
      )) {
        for (const blk of nested(s)) {
          if (
            blk.keyword === 'is' ||
            blk.keyword === 'has' ||
            blk.keyword === 'does'
          ) {
            for (const sub of nested(blk)) {
              if (
                sub.keyword === 'attributes' ||
                sub.keyword === 'test_context' ||
                sub.keyword === 'design_parameters' ||
                sub.keyword === 'characteristics' ||
                sub.keyword === 'behaviors' ||
                sub.keyword === 'promises'
              ) {
                for (const [k] of parseKeyValues(sub)) {
                  compIds.add(k);
                }
                for (const child of nested(sub)) {
                  compIds.add(child.ident || child.keyword);
                }
              }
            }
            for (const l of lines(blk)) {
              if (l.key === 'behaviors' || l.key === 'artifacts') {
                compIds.add(l.key);
                for (const t of l.tokens) {
                  compIds.add(t);
                }
              }
            }
          }
        }
      }

      interface ParityPair {
        source: string;
        target: string;
        coverage?: string;
        description: boolean;
      }
      const profiles: Array<{
        id: string;
        pairs: ParityPair[];
        assertions: Array<[string, string]>;
      }> = [];
      for (const mp of closureConstructs.filter(
        x => x.keyword === 'map_profile' && x.ident,
      )) {
        const pairs: ParityPair[] = [];
        const pushPair = (l: {
          key: string;
          tokens: string[];
          blocks: Item[][];
        }): void => {
          const ai = l.tokens.indexOf('->');
          if (ai < 0 || ai + 1 >= l.tokens.length) {
            return;
          }
          const facets = l.blocks.flat();
          const coverage = facetTokens(facets, 'coverage')[0];
          const description = facets.some(
            f =>
              f.kind === 'line' &&
              (f.key === 'description' || f.tokens.includes('description')),
          );
          pairs.push({
            source: stripColon2(l.key),
            target: l.tokens[ai + 1]!,
            coverage,
            description,
          });
        };
        for (const ln of lines(mp).filter(l => l.key === 'mapping')) {
          for (const block of ln.blocks) {
            for (const it of block) {
              if (it.kind === 'line' && it.key !== undefined) {
                pushPair({ key: it.key, tokens: it.tokens, blocks: it.blocks });
              }
            }
          }
        }
        const mappingBlock = nested(mp).find(n => n.keyword === 'mapping');
        if (mappingBlock) {
          for (const l of lines(mappingBlock)) {
            pushPair({ key: l.key, tokens: l.tokens, blocks: l.blocks });
          }
        }
        const assertions: Array<[string, string]> = [];
        const covBlock = nested(mp).find(n => n.keyword === 'coverage');
        if (covBlock) {
          for (const l of lines(covBlock)) {
            assertions.push([stripColon2(l.key), l.tokens[0] ?? '']);
          }
        }
        profiles.push({ id: mp.ident!, pairs, assertions });
      }

      const splitRef = (
        raw: string,
        defaultNs: string,
      ): { ns: string; id: string; qualified: string } => {
        const h = raw.indexOf('#');
        const ns = h >= 0 ? raw.slice(0, h) : defaultNs;
        const id = h >= 0 ? raw.slice(h + 1) : raw;
        return { ns, id, qualified: `${ns}#${id}` };
      };

      // C21 mapping-resolves / C22 mapping-direction.
      for (const mp of profiles) {
        for (const pair of mp.pairs) {
          if (pair.source.includes('#')) {
            err(
              'C22',
              `map_profile ${mp.id}: mapping source "${pair.source}" is a namespaced reference element — the mapping direction is implementation → reference (mapping-direction)`,
            );
          } else if (!compIds.has(pair.source)) {
            err(
              'C21',
              `map_profile ${mp.id}: mapping source "${pair.source}" is not a declared component (mapping-resolves)`,
            );
          }
          const ref = splitRef(pair.target, mp.id);
          if (ref.ns !== mp.id) {
            err(
              'C21',
              `map_profile ${mp.id}: target "${pair.target}" carries namespace "${ref.ns}" ≠ the profile namespace "${mp.id}" (Namespace#ElementID aliasing) (mapping-resolves)`,
            );
          }
          if (localNs && ref.ns === localNs) {
            err(
              'C22',
              `map_profile ${mp.id}: target "${pair.target}" is in the model's own namespace — mapping to one's own components inverts the direction (implementation → reference) (mapping-direction)`,
            );
          }
          if (!compIds.has(ref.qualified)) {
            err(
              'C21',
              `map_profile ${mp.id}: target "${ref.qualified}" has no declared alias element — the implementation model declares local copies of the reference elements it maps to (mapping-resolves)`,
            );
          }
          if (options.strictness === 'audit' && !pair.description) {
            issues.push({
              rule: 'C25',
              severity: 'warning',
              message: `map_profile ${mp.id}: mapping ${pair.source} -> ${ref.qualified} has no description — how the fulfilment works is demanded at audit strictness (mapping-description)`,
            });
          }
        }
      }

      // C23 mapping-calculus-consistency: the alias forest per profile
      // namespace (the implementation's local copies), the coverage
      // walk (inheritance down, aggregation up), and the authored
      // assertions checked against the computed levels.
      const coverageLevels = (
        ns: string,
        pairs: ParityPair[],
      ): Map<string, string> => {
        const prefix = `${ns}#`;
        const procs = allProcesses.filter(
          x => x.ident && x.ident.startsWith(prefix),
        );
        interface CovNode {
          id: string;
          composition: 'all' | 'gateway';
          children: CovNode[];
        }
        const nodes = new Map<string, CovNode>();
        for (const p of procs) {
          nodes.set(p.ident!, {
            id: p.ident!.slice(prefix.length),
            composition:
              tokensOf(p, 'child_composition')[0] === 'gateway'
                ? 'gateway'
                : 'all',
            children: [],
          });
        }
        const parentOf = new Map<string, string>();
        for (const p of procs) {
          for (const child of nested(p).filter(
            n => n.keyword === 'process' && n.ident && nodes.has(n.ident),
          )) {
            parentOf.set(child.ident!, p.ident!);
          }
        }
        const roots: CovNode[] = [];
        for (const p of procs) {
          const node = nodes.get(p.ident!)!;
          const parent = parentOf.get(p.ident!);
          if (parent) {
            nodes.get(parent)!.children.push(node);
          } else {
            roots.push(node);
          }
        }
        const direct = new Set<string>();
        for (const pair of pairs) {
          const ref = splitRef(pair.target, ns);
          if (ref.ns === ns) {
            direct.add(ref.id);
          }
        }
        const aggregate = (
          composition: 'all' | 'gateway',
          levels: string[],
        ): string => {
          if (levels.length === 0) {
            return 'none';
          }
          if (levels.every(l => l === 'full')) {
            return 'full';
          }
          if (
            composition === 'gateway' &&
            levels.some(l => l === 'full' || l === 'minimal')
          ) {
            return 'minimal';
          }
          return levels.some(l => l !== 'none') ? 'partial' : 'none';
        };
        const levels = new Map<string, string>();
        const walk = (node: CovNode, inMappedSubtree: boolean): string => {
          const underMapped = direct.has(node.id) || inMappedSubtree;
          const childLevels = node.children.map(c => walk(c, underMapped));
          const level = underMapped
            ? 'full'
            : node.children.length === 0
              ? 'none'
              : aggregate(node.composition, childLevels);
          levels.set(node.id, level);
          return level;
        };
        for (const root of roots) {
          walk(root, false);
        }
        return levels;
      };
      for (const mp of profiles) {
        if (mp.pairs.every(p => !p.coverage) && mp.assertions.length === 0) {
          continue;
        }
        const levels = coverageLevels(mp.id, mp.pairs);
        for (const pair of mp.pairs) {
          if (!pair.coverage) {
            continue;
          }
          const ref = splitRef(pair.target, mp.id);
          const level = levels.get(ref.id);
          if (level === undefined) {
            continue;
          }
          if (level !== pair.coverage) {
            err(
              'C23',
              `map_profile ${mp.id}: ${pair.source} -> ${ref.qualified} asserts coverage "${pair.coverage}" but the calculus computes "${level}" — coverage is computed, not authored (mapping-calculus-consistency)`,
            );
          }
        }
        for (const [target, asserted] of mp.assertions) {
          const ref = splitRef(target, mp.id);
          const level = levels.get(ref.id);
          if (level === undefined) {
            err(
              'C23',
              `map_profile ${mp.id}: coverage assertion for "${ref.qualified}" names a component outside the reference tree (mapping-calculus-consistency)`,
            );
            continue;
          }
          if (level !== asserted) {
            err(
              'C23',
              `map_profile ${mp.id}: coverage assertion "${ref.qualified}: ${asserted}" disagrees with the computed "${level}" — coverage is computed, not authored (mapping-calculus-consistency)`,
            );
          }
        }
      }

      // C24 import-not-mapping: an imported package's namespace may not
      // double as a mapping namespace — unless the import is a product
      // reference (the supply-chain exemption).
      for (const mp of profiles) {
        if (imported.has(mp.id) && siblingKind(mp.id) !== 'product_reference') {
          err(
            'C24',
            `map_profile ${mp.id}: namespace "${mp.id}" is imported (uses/extends) — an import may not be expressed as a mapping, nor a mapping as an import; inclusion ≠ fulfilment (import-not-mapping)`,
          );
        }
      }

      // C26 view-read-only: a view names declared elements and reads
      // against a namespace the model actually maps to.
      const mappedNamespaces = new Set(profiles.map(p => p.id));
      for (const vp of closureConstructs.filter(
        x => x.keyword === 'view_profile' && x.ident,
      )) {
        for (const el of tokensOf(vp, 'visible')) {
          if (!compIds.has(el)) {
            err(
              'C26',
              `view_profile ${vp.ident}: visible element "${el}" is not a declared component — a view reads the model, it does not invent it (view-read-only)`,
            );
          }
        }
        const against = tokensOf(vp, 'against')[0];
        if (against && !mappedNamespaces.has(against)) {
          err(
            'C26',
            `view_profile ${vp.ident}: against "${against}" names no declared map_profile/mapSet namespace — a view reads coverage, it does not create it (view-read-only)`,
          );
        }
      }

      // C14 process-timer-recurrence / C15 process-timer-period: a flow
      // cycle must pass through a period-carrying timer; a timer_event
      // declares its period.
      for (const p of allProcesses.filter(x => x.ident)) {
        const timersWith = new Set<string>();
        const timersWithout = new Set<string>();
        const edges: Array<{ from: string; to: string }> = [];
        const visit = (c: Construct): void => {
          for (const it of c.items) {
            if (it.kind === 'line') {
              if (it.key === 'timer_event') {
                const id = it.tokens[0];
                if (id) {
                  timersWithout.add(id);
                }
              }
              const addEdges = (l: {
                key?: string;
                tokens: string[];
              }): void => {
                if (l.key === undefined || !l.tokens.includes('->')) {
                  return;
                }
                for (const t of l.tokens) {
                  if (t !== '->') {
                    edges.push({ from: l.key, to: t });
                  }
                }
              };
              addEdges(it);
              for (const block of it.blocks) {
                for (const x of block) {
                  if (x.kind === 'line') {
                    addEdges(x);
                  }
                }
              }
            } else if (it.kind === 'construct' && it.construct) {
              const cc = it.construct;
              if (cc.keyword === 'timer_event' && cc.ident) {
                if (tokensOf(cc, 'period').length > 0) {
                  timersWith.add(cc.ident);
                } else {
                  timersWithout.add(cc.ident);
                }
              }
              visit(cc);
            }
          }
        };
        visit(p);
        for (const id of timersWithout) {
          err(
            'C15',
            `process ${p.ident}: timer_event "${id}" declares no period — a timer event without a recurrence period cannot guard a loop (process-timer-period)`,
          );
        }
        const adj = new Map<string, string[]>();
        for (const e of edges) {
          if (timersWith.has(e.from) || timersWith.has(e.to)) {
            continue;
          }
          adj.set(e.from, [...(adj.get(e.from) ?? []), e.to]);
        }
        const cycle = findCycle(adj);
        if (cycle) {
          err(
            'C14',
            `process ${p.ident}: recurrence ${cycle.join(' → ')} contains no timer event — an unguarded infinite self-loop (process-timer-recurrence)`,
          );
        }
      }

      // C17 instance-scope / C19 chain-acyclic: the instance plane's
      // scope discipline and the subject-chain integrity.
      const LEVEL_ORDER: Record<string, number> = {
        family: 0,
        group: 1,
        model: 2,
        sample: 3,
      };
      const instances = closureConstructs.filter(
        x => x.keyword === 'instance' && x.ident,
      );
      const instanceIds = new Set(instances.map(x => x.ident!));
      const attrScopes = new Map<string, string>();
      for (const ad of closureConstructs.filter(
        x => x.keyword === 'attribute_definition' && x.ident,
      )) {
        const scope = tokensOf(ad, 'scope')[0];
        if (scope) {
          attrScopes.set(ad.ident!, scope);
        }
      }
      const dimScopes = new Map<string, string>();
      for (const d of closureConstructs.filter(
        x => x.keyword === 'dimension' && x.ident,
      )) {
        const scope = tokensOf(d, 'scope')[0];
        if (scope) {
          dimScopes.set(d.ident!, scope);
        }
      }
      for (const inst of closureConstructs.filter(
        x => x.keyword === 'instrument' && x.ident,
      )) {
        for (const d of nested(inst).filter(n => n.keyword === 'dimension')) {
          const id = d.ident || d.keyword;
          const scope = tokensOf(d, 'scope')[0];
          if (id && scope) {
            dimScopes.set(id, scope);
          }
        }
      }
      for (const ad of closureConstructs.filter(
        x => x.keyword === 'attribute_definition' && x.ident,
      )) {
        if (tokensOf(ad, 'is_dimension')[0] === 'true') {
          const scope = tokensOf(ad, 'scope')[0];
          if (scope && !dimScopes.has(ad.ident!)) {
            dimScopes.set(ad.ident!, scope);
          }
        }
      }
      const hasBlock = (
        inst: Construct,
        key: string,
      ): Construct | undefined => {
        const has = nested(inst).find(n => n.keyword === 'has');
        return has ? nested(has).find(n => n.keyword === key) : undefined;
      };
      for (const inst of instances) {
        const level = tokensOf(inst, 'level')[0] ?? '';
        const levelIdx = LEVEL_ORDER[level];
        if (levelIdx === undefined) {
          err(
            'C17',
            `instance ${inst.ident}: level "${level}" is not a chain level (family | group | model | sample) (instance-scope)`,
          );
        }
        for (const [key] of parseKeyValues(hasBlock(inst, 'attributes'))) {
          const scope = attrScopes.get(key);
          if (scope === undefined) {
            err(
              'C17',
              `instance ${inst.ident}: attribute "${key}" is not a declared attribute_definition — scope cannot be checked (instance-scope)`,
            );
          } else if (scope === 'sample') {
            err(
              'C17',
              `instance ${inst.ident}: sample-scope attribute "${key}" stated in has.attributes — sample-scope values live in has.test_context and are never inherited (instance-scope)`,
            );
          } else if (
            levelIdx !== undefined &&
            LEVEL_ORDER[scope] !== undefined &&
            levelIdx < LEVEL_ORDER[scope]
          ) {
            err(
              'C17',
              `instance ${inst.ident}: attribute "${key}" (scope ${scope}) stated at ${level} level — values are stated at their declared scope or lower (instance-scope)`,
            );
          }
        }
        for (const [key] of parseKeyValues(hasBlock(inst, 'test_context'))) {
          if (level !== 'sample') {
            err(
              'C17',
              `instance ${inst.ident}: test_context value "${key}" on a ${level}-level instance — test_context exists only at sample level (instance-scope)`,
            );
          }
          const scope = attrScopes.get(key);
          if (scope === undefined) {
            err(
              'C17',
              `instance ${inst.ident}: attribute "${key}" is not a declared attribute_definition — scope cannot be checked (instance-scope)`,
            );
          } else if (scope !== 'sample') {
            err(
              'C17',
              `instance ${inst.ident}: attribute "${key}" (scope ${scope}) stated in test_context — test_context holds sample-scope attributes only (instance-scope)`,
            );
          }
        }
        for (const [key] of parseKeyValues(hasBlock(inst, 'dimensions'))) {
          if (level === 'sample') {
            err(
              'C17',
              `instance ${inst.ident}: classification "${key}" on a sample-level instance — samples carry no classification (instance-scope)`,
            );
          }
          const scope = dimScopes.get(key);
          if (scope === undefined) {
            err(
              'C17',
              `instance ${inst.ident}: classification dimension "${key}" is not declared (instance-scope)`,
            );
          } else if (
            levelIdx !== undefined &&
            LEVEL_ORDER[scope] !== undefined &&
            levelIdx < LEVEL_ORDER[scope]
          ) {
            err(
              'C17',
              `instance ${inst.ident}: classification dimension "${key}" (scope ${scope}) stated at ${level} level — values are stated at their declared scope or lower (instance-scope)`,
            );
          }
        }
      }
      const instAdj = new Map<string, string[]>();
      for (const inst of instances) {
        const targets: string[] = [];
        for (const kind of ['model', 'group', 'family']) {
          const target = tokensOf(inst, kind)[0];
          if (target) {
            if (!instanceIds.has(target)) {
              err(
                'C19',
                `instance ${inst.ident}: chain link ${kind} "${target}" is not a declared instance (chain-acyclic)`,
              );
            } else {
              targets.push(target);
            }
          }
        }
        if (targets.length > 0) {
          instAdj.set(inst.ident!, targets);
        }
      }
      const instCycle = findCycle(instAdj);
      if (instCycle) {
        err(
          'C19',
          `instance subject chain cycle: ${instCycle.join(' → ')} (chain-acyclic)`,
        );
      }

      // C45 artifact-def-contract / C46 artifact-instance-resolves /
      // C47 artifact-evidence-separation / C153
      // artifact-contract-derivation.
      const artifactDefs = new Map<string, Construct>();
      for (const d of closureConstructs.filter(
        x => x.keyword === 'artifact_definition' && x.ident,
      )) {
        artifactDefs.set(d.ident!, d);
      }
      const artifactInstIds = new Set(
        closureConstructs
          .filter(x => x.keyword === 'artifact_instance' && x.ident)
          .map(x => x.ident!),
      );
      interface ContractField {
        name: string;
        type: string;
        optional: boolean;
      }
      const contractOf = (
        d: Construct,
      ): { fields: ContractField[]; media: string[]; hasContract: boolean } => {
        const cc = nested(d).find(n => n.keyword === 'content_contract');
        const fieldsBlock = cc
          ? nested(cc).find(n => n.keyword === 'fields')
          : undefined;
        const fields: ContractField[] = [];
        if (fieldsBlock) {
          for (const l of lines(fieldsBlock)) {
            const name = stripColon2(l.key);
            if (name === '') {
              continue;
            }
            fields.push({
              name,
              type: l.tokens.find(t => t !== 'optional') ?? '',
              optional: l.tokens.includes('optional'),
            });
          }
        }
        const mediaBlock = cc
          ? nested(cc).find(n => n.keyword === 'media')
          : undefined;
        const media = mediaBlock
          ? nested(mediaBlock).map(m => m.ident || m.keyword)
          : [];
        return { fields, media, hasContract: !!cc };
      };
      const KNOWN_PRODUCED_WHEN = new Set([
        'per_measurement',
        'per_interval',
        'on_event',
      ]);
      const DURATION_RE =
        /^P(?:(\d+(?:[.,]\d+)?)Y)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)D)?(?:T(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)S)?)?(?:(\d+(?:[.,]\d+)?)W)?$/;
      const isIsoDuration = (x: string): boolean => {
        const m = DURATION_RE.exec(x);
        if (!m) {
          return false;
        }
        const components = m.slice(1).filter(y => y !== undefined);
        if (components.length === 0) {
          return false;
        }
        return m[7] === undefined || components.length === 1;
      };
      for (const [id, d] of artifactDefs) {
        const contract = contractOf(d);
        const contractFrom = tokensOf(d, 'contract_from')[0];
        if (!contractFrom && contract.fields.length === 0) {
          err(
            'C45',
            `artifact definition ${id}: content contract declares no fields — a definition must contract SOME content (artifact-def-contract)`,
          );
        }
        const seenFields = new Set<string>();
        for (const f of contract.fields) {
          if (seenFields.has(f.name)) {
            err(
              'C45',
              `artifact definition ${id}: duplicate contract field "${f.name}" (artifact-def-contract)`,
            );
          }
          seenFields.add(f.name);
          if (!f.type) {
            err(
              'C45',
              `artifact definition ${id}: contract field "${f.name}" has no type — fields are named AND typed (artifact-def-contract)`,
            );
          }
        }
        for (const field of contract.media) {
          if (!seenFields.has(field)) {
            err(
              'C45',
              `artifact definition ${id}: media entry refines "${field}", which is not a declared contract field (artifact-def-contract)`,
            );
          }
        }
        const producedWhen = tokensOf(d, 'produced_when');
        const kind = producedWhen[0] ?? '';
        if (!KNOWN_PRODUCED_WHEN.has(kind)) {
          err(
            'C45',
            `artifact definition ${id}: produced_when "${kind}" is not one of per_measurement | per_interval | on_event (artifact-def-contract)`,
          );
        } else if (
          kind === 'per_interval' &&
          !isIsoDuration(producedWhen[1] ?? '')
        ) {
          err(
            'C45',
            `artifact definition ${id}: produced_when per_interval "${producedWhen[1] ?? ''}" is not an ISO-8601 duration (artifact-def-contract)`,
          );
        } else if (kind === 'on_event' && producedWhen[1] === undefined) {
          err(
            'C45',
            `artifact definition ${id}: produced_when on_event names no event (artifact-def-contract)`,
          );
        }
      }
      for (const t of closureConstructs.filter(
        x => x.keyword === 'conformance_test' && x.ident,
      )) {
        for (const a of tokensOf(t, 'produces_artifacts')) {
          if (!artifactDefs.has(a)) {
            err(
              'C46',
              `conformance test ${t.ident}: produces_artifacts "${a}" is not a declared artifact_definition (artifact-instance-resolves)`,
            );
          }
        }
      }
      for (const s of closureConstructs.filter(
        x => x.keyword === 'subject' && x.ident,
      )) {
        const isB = nested(s).find(n => n.keyword === 'is');
        const hasB = nested(s).find(n => n.keyword === 'has');
        const artB = isB
          ? nested(isB).find(n => n.keyword === 'artifacts')
          : undefined;
        if (artB) {
          for (const a of rawTokensT(artB)) {
            if (!artifactDefs.has(a)) {
              err(
                'C46',
                `subject ${s.ident}: is.artifacts entry "${a}" is not a declared artifact_definition (artifact-instance-resolves)`,
              );
            }
          }
        }
        const instB = hasB
          ? nested(hasB).find(n => n.keyword === 'artifact_instances')
          : undefined;
        if (instB) {
          for (const a of rawTokensT(instB)) {
            if (!artifactInstIds.has(a)) {
              err(
                'C46',
                `subject ${s.ident}: has.artifact_instances entry "${a}" is not a declared artifact_instance (artifact-instance-resolves)`,
              );
            }
          }
        }
      }
      for (const inst of closureConstructs.filter(
        x => x.keyword === 'artifact_instance' && x.ident,
      )) {
        const of = tokensOf(inst, 'of')[0] ?? '';
        const def = artifactDefs.get(of);
        if (!def) {
          err(
            'C46',
            `artifact instance ${inst.ident}: of "${of}" is not a declared artifact_definition (artifact-instance-resolves)`,
          );
          continue;
        }
        if (!tokensOf(inst, 'by')[0]) {
          err(
            'C46',
            `artifact instance ${inst.ident}: no producer (by) — an artifact instance is unattributable without its producing subject (artifact-instance-resolves)`,
          );
        }
        const contentBlock = nested(inst).find(n => n.keyword === 'content');
        const content = new Map(parseKeyValues(contentBlock));
        const contract = contractOf(def);
        const contractFields = new Map(contract.fields.map(f => [f.name, f]));
        for (const key of content.keys()) {
          if (!contractFields.has(key)) {
            err(
              'C46',
              `artifact instance ${inst.ident}: content field "${key}" is not in the contract of ${of} (artifact-instance-resolves)`,
            );
          }
        }
        for (const [name, f] of contractFields) {
          if (!f.optional && !content.has(name)) {
            err(
              'C46',
              `artifact instance ${inst.ident}: required contract field "${name}" of ${of} is not populated (artifact-instance-resolves)`,
            );
          }
        }
        const producedWhen = tokensOf(def, 'produced_when')[0];
        const linksB = nested(inst).find(n => n.keyword === 'links');
        const links = linksB ? rawTokensT(linksB) : [];
        if (producedWhen === 'per_measurement' && links.length === 0) {
          err(
            'C46',
            `artifact instance ${inst.ident}: ${of} is produced per_measurement but the instance links no run/report — link the producing measurement run or report (artifact-instance-resolves)`,
          );
        }
      }
      const evidenceSlots = new Map<string, string>();
      const addEvidenceSlot = (name: string, where: string): void => {
        if (name && !evidenceSlots.has(name)) {
          evidenceSlots.set(name, where);
        }
      };
      for (const t of closureConstructs.filter(
        x => x.keyword === 'conformance_test' && x.ident,
      )) {
        for (const key of ['variables', 'observables']) {
          const block = nested(t).find(n => n.keyword === key);
          if (!block) {
            continue;
          }
          for (const v of nested(block)) {
            addEvidenceSlot(
              v.ident || v.keyword,
              `a ${key.slice(0, -1)} of conformance test ${t.ident}`,
            );
          }
          for (const [name] of parseKeyValues(block)) {
            addEvidenceSlot(
              name,
              `a ${key.slice(0, -1)} of conformance test ${t.ident}`,
            );
          }
        }
      }
      const TYPE_TOKENS = new Set([
        'string',
        'number',
        'integer',
        'decimal',
        'boolean',
        'date',
        'time',
        'datetime',
        'duration',
        'structure',
        'media',
        'enum',
        'reference',
        'quantity',
      ]);
      const addFormFields = (form: Construct, holder: Construct): void => {
        const fieldsBlock = nested(holder).find(n => n.keyword === 'fields');
        if (fieldsBlock) {
          addFormFields(form, fieldsBlock);
        }
        for (const l of lines(holder)) {
          if (l.tokens.some(t => TYPE_TOKENS.has(t))) {
            addEvidenceSlot(
              stripColon2(l.key),
              `a field of form ${form.ident}`,
            );
          }
        }
        for (const f of nested(holder).filter(n => n.keyword === 'field')) {
          addEvidenceSlot(
            f.ident || f.keyword,
            `a field of form ${form.ident}`,
          );
        }
      };
      for (const form of closureConstructs.filter(
        x => x.keyword === 'form' && x.ident,
      )) {
        addFormFields(form, form);
      }
      for (const [id, d] of artifactDefs) {
        for (const f of contractOf(d).fields) {
          const where = evidenceSlots.get(f.name);
          if (where) {
            err(
              'C47',
              `artifact definition ${id}: contract field "${f.name}" is also ${where} — an artifact is an output OF the instrument, not a record OF the test; keep artifact content out of evidence-record shapes (and vice versa) (artifact-evidence-separation)`,
            );
          }
        }
      }
      const promiseSetIds = new Set<string>();
      for (const ps of closureConstructs.filter(
        x => x.keyword === 'promise_set' && x.ident,
      )) {
        promiseSetIds.add(ps.ident!);
        promiseSetIds.add(`${ps.ident!}.promise_set`);
      }
      for (const s of closureConstructs.filter(
        x => x.keyword === 'subject' && x.ident,
      )) {
        const isB = nested(s).find(n => n.keyword === 'is');
        const promises = isB
          ? nested(isB).find(n => n.keyword === 'promises')
          : undefined;
        if (promises && nested(promises).length > 0) {
          promiseSetIds.add(s.ident!);
          promiseSetIds.add(`${s.ident!}.promise_set`);
        }
      }
      for (const [id, d] of artifactDefs) {
        const contractFrom = tokensOf(d, 'contract_from')[0];
        if (!contractFrom) {
          continue;
        }
        if (!promiseSetIds.has(contractFrom)) {
          err(
            'C153',
            `artifact_definition ${id}: contract_from "${contractFrom}" does not resolve to a declared promise set (artifact-contract-derivation)`,
          );
        }
        const contract = contractOf(d);
        if (contract.fields.length > 0 || contract.media.length > 0) {
          err(
            'C153',
            `artifact_definition ${id}: declares both contract_from and inline contract fields — the derived contract is the referenced set's projection, never a restatement (artifact-contract-derivation)`,
          );
        }
      }

      // C160 signature-closure: every name a check consumes resolves to
      // a declared datum or symbol.
      const datumIds = new Set(
        closureConstructs
          .filter(x => x.keyword === 'datum' && x.ident)
          .map(x => x.ident!),
      );
      const symbolIds = new Set(
        closureConstructs
          .filter(x => x.keyword === 'symbol' && x.ident)
          .map(x => x.ident!),
      );
      for (const c of closureConstructs.filter(
        x => x.keyword === 'check' && x.ident,
      )) {
        const inputsB = nested(c).find(n => n.keyword === 'inputs');
        const inputs = inputsB ? rawTokensT(inputsB) : tokensOf(c, 'inputs');
        for (const inp of inputs) {
          if (!(datumIds.has(inp) || symbolIds.has(inp))) {
            err(
              'C160',
              `check ${c.ident}: input "${inp}" resolves to no declared datum or symbol — the check consumes an undeclared name (signature-closure)`,
            );
          }
        }
      }

      // C82 product-unmapped-promises: a product reference package's
      // block-form IS promise must be a mapping source.
      if (pkgKind === 'product_reference') {
        const mappedSources = new Set<string>();
        for (const mp of profiles) {
          for (const pair of mp.pairs) {
            mappedSources.add(pair.source);
          }
        }
        for (const s of closureConstructs.filter(
          x => x.keyword === 'subject' && x.ident,
        )) {
          const isB = nested(s).find(n => n.keyword === 'is');
          const promises = isB
            ? nested(isB).find(n => n.keyword === 'promises')
            : undefined;
          if (!promises) {
            continue;
          }
          for (const p of nested(promises)) {
            const id = p.ident || p.keyword;
            if (!mappedSources.has(id)) {
              issues.push({
                rule: 'C82',
                severity: 'warning',
                message: `subject ${s.ident}: promise "${id}" is not mapped to any standard — an unmapped promise is a brochure claim; the mapping is the conformance claim made computable (product-unmapped-promises)`,
              });
            }
          }
        }
      }
    }

    // C176 language-declared-wellformed: a declared language generation
    // must be well-formed (v<major>[.<minor>]) — the strict-parse
    // contract's key; this rule checks the declaration's shape.
    {
      const manifest = pkg.constructs.find(c => c.keyword === 'package');
      const langLine = manifest?.items.find(
        i => i.kind === 'line' && i.key === 'language',
      );
      const lang = (langLine?.tokens ?? []).join(' ');
      if (lang && !/^v\d+(\.\d+)?$/.test(lang)) {
        err(
          'C176',
          `the declared language "${lang}" is not a generation (v<major>[.<minor>]) (language-declared-wellformed)`,
        );
      }
    }

    // C157 registry-dataclass-resolves: an authored data_class that
    // names no declared class leaves the registry's rows formless —
    // the pairing the workspace forms and the pickers key on.
    {
      const classIds = new Set(
        closureConstructs
          .filter(x => x.keyword === 'class' && x.ident)
          .map(x => x.ident),
      );
      for (const reg of closureConstructs.filter(
        x => x.keyword === 'data_registry' && x.ident,
      )) {
        const dc = facetTokens(reg.items, 'data_class')[0];
        if (dc && !classIds.has(dc)) {
          err(
            'C157',
            `data_registry ${reg.ident}: the data_class resolves to no declared dataclass — the registry's rows are formless (the pairing the workspace forms and the pickers key on) (registry-dataclass-resolves)`,
          );
        }
      }
    }

    // ── C182 series-record-fields (the variable↔subform type link):
    //     a series variable's record form types its row members — a
    //     collection derivation's lambda members resolve against the
    //     record form's typed fields, never kind-silent.
    {
      // a form's field lines key by the FIELD NAME with the type as
      // the first token (the shape tree drops the `field` head); the
      // nested-construct spelling rides beside it
      const FIELD_TYPES = new Set([
        'string',
        'number',
        'boolean',
        'integer',
        'decimal',
        'enum',
        'date',
        'datetime',
        'collection',
      ]);
      const recordFormFields = new Map<string, Set<string>>();
      for (const f of closureConstructs.filter(
        x => x.keyword === 'form' && x.ident,
      )) {
        const names = new Set(
          nested(f)
            .filter(n => n.keyword === 'field')
            .map(n => n.ident!)
            .filter(Boolean),
        );
        for (const l of f.items) {
          if (
            l.kind === 'line' &&
            l.key &&
            FIELD_TYPES.has(l.tokens[0] ?? '')
          ) {
            names.add(l.key);
          }
        }
        recordFormFields.set(f.ident!, names);
      }
      for (const t of pkg.constructs.filter(
        x => x.keyword === 'conformance_test' && x.ident,
      )) {
        const vars = nested(t).find(n => n.keyword === 'variables');
        for (const v of vars
          ? nested(vars).filter(n => n.keyword === 'variable' && n.ident)
          : []) {
          const series = nested(v).find(n => n.keyword === 'series');
          const rec = series
            ? facetTokens(series.items, 'record')[0]
            : undefined;
          if (!rec) {
            continue;
          }
          const fields = recordFormFields.get(rec);
          if (!fields) {
            err(
              'C182',
              `conformance test ${t.ident}: variable "${v.ident}" series record "${rec}" names no declared form — the row members type by the record form's fields (series-record-fields)`,
            );
            continue;
          }
          const dline = v.items.find(
            i => i.kind === 'line' && i.key === 'derivation',
          );
          const dblock = nested(v).find(n => n.keyword === 'derivation');
          let expr = '';
          if (dline && dline.tokens.length > 0) {
            expr = dline.tokens.join(' ');
          } else if (dblock) {
            for (const i of dblock.items) {
              if (i.kind === 'line' && i.key) {
                expr += ' ' + [i.key, ...i.tokens].join(' ');
              } else {
                expr += ' ' + i.tokens.join(' ');
              }
            }
          }
          expr = expr.trim();
          if (!expr) {
            continue;
          }
          let members: ReturnType<typeof readNavMembers>;
          try {
            members = readNavMembers(
              expr.replace(/^ocl\{/, '').replace(/\}$/, ''),
            );
          } catch {
            continue; // parse errors ride the derivation's own rules
          }
          for (const m of members) {
            if (m.source !== v.ident) {
              continue;
            }
            for (const f of m.fields) {
              if (!fields.has(f)) {
                err(
                  'C182',
                  `conformance test ${t.ident}: variable "${v.ident}" derivation names "m.${f}" — the record form ${rec} declares no such field; the row members are its typed fields (series-record-fields)`,
                );
              }
            }
          }
        }
      }
    }

    // ── C169 provenance-clause-resolves: a provenance binding citing a
    //     SHIPPED document lands on a real fragment or sentence of that
    //     document's harvest; a clause-qualified citation that lands
    //     nowhere is linked to air (error), a bare subpart citation the
    //     clause-only harvest cannot verify is visible debt (warning).
    //     Bindings cite non-shipped documents stay out of scope here.
    {
      const docs = pkg.documents ?? [];
      if (docs.length > 0) {
        const byUrn = new Map(docs.map(d => [d.urn, d]));
        const URN_HASH = /^(urn:[A-Za-z0-9:.-]+)#([A-Za-z0-9./-]+)$/;
        const bindings: { element: string; doc: string; path: string }[] = [];
        const norm = (
          doc: string,
          clause: string,
          fragment: string,
        ): { doc: string; path: string } | null => {
          let d = doc.trim();
          let path = '';
          const hash = d.indexOf('#');
          if (hash >= 0) {
            path = d.slice(hash + 1);
            d = d.slice(0, hash);
          }
          if (path === '') {
            const cl = clause.trim();
            if (cl === '') {
              return null;
            }
            path = /^(clause|table|figure|front)-/.test(cl)
              ? cl
              : 'clause-' + cl;
          }
          if (fragment.trim() !== '') {
            path += '/' + fragment.trim();
          }
          return { doc: d, path };
        };
        // the doc/clause/fragment reader for a nested source/sourceRef block
        const readDocBlock = (
          block: Construct,
        ): { doc: string; path: string } | null => {
          let doc = '';
          let clause = '';
          let fragment = '';
          for (const si of block.items) {
            if (si.kind !== 'line') {
              continue;
            }
            if (si.key === 'doc' && si.tokens.length > 0) {
              doc = si.tokens[0]!;
              for (let k = 1; k + 1 < si.tokens.length; k += 2) {
                if (si.tokens[k] === 'clause') {
                  clause = si.tokens[k + 1] ?? '';
                } else if (si.tokens[k] === 'fragment') {
                  fragment = si.tokens[k + 1] ?? '';
                }
              }
            }
            if (si.key === 'clause') {
              clause = si.tokens[0] ?? '';
            }
            if (si.key === 'fragment') {
              fragment = si.tokens[0] ?? '';
            }
          }
          return norm(doc, clause, fragment);
        };
        const harvest = (c: Construct, owner: string): void => {
          const element = c.ident || owner;
          for (const i of c.items) {
            if (i.kind === 'line' && i.key === 'ref' && i.tokens.length >= 2) {
              const m = URN_HASH.exec(i.tokens[1] ?? '');
              if (m) {
                bindings.push({ element, doc: m[1]!, path: m[2]! });
              }
            }
            // term-style `source "urn#path …"` and `reference "urn#path"`
            // string lines — the kernel's urnStringBindings channels
            if (
              i.kind === 'line' &&
              (i.key === 'source' || i.key === 'reference')
            ) {
              for (const t of i.tokens) {
                const m = URN_HASH.exec(t);
                if (m) {
                  bindings.push({ element, doc: m[1]!, path: m[2]! });
                }
              }
            }
            if (i.kind === 'construct' && i.construct) {
              // source { doc … clause … } / sourceRef { … } blocks — the
              // kernel's isSourceRefLike channels (source, sourceRef,
              // sources plural, sourceRefs)
              if (
                i.construct.keyword === 'source' ||
                i.construct.keyword === 'sourceRef' ||
                i.construct.keyword === 'sources' ||
                i.construct.keyword === 'sourceRefs'
              ) {
                const b = readDocBlock(i.construct);
                if (b) {
                  bindings.push({ element, doc: b.doc, path: b.path });
                }
              }
              // reference constructs with a urn facet (the structured
              // citation registry) — the kernel's references[].urn channel
              if (i.construct.keyword === 'reference') {
                const urn = facetTokens(i.construct.items, 'urn')[0];
                if (urn) {
                  const m = URN_HASH.exec(urn);
                  if (m) {
                    bindings.push({ element, doc: m[1]!, path: m[2]! });
                  }
                }
              }
              harvest(i.construct, element);
            }
          }
        };
        for (const c of closureConstructs) {
          harvest(c, '');
        }
        for (const b of bindings) {
          const d = byUrn.get(b.doc);
          if (!d) {
            continue;
          }
          if (d.fragments.has(b.path) || d.addresses.has(b.path)) {
            continue;
          }
          const prefix = b.path + '.';
          let resolved = false;
          for (const f of d.fragments) {
            if (f.startsWith(prefix) || b.path.startsWith(f + '/')) {
              resolved = true;
              break;
            }
          }
          if (!resolved) {
            // A cited CHILD of a modeled fragment resolves at a
            // boundary: the extract may keep a clause whole (clause-5)
            // while the citation names its subclause (clause-5.1).
            for (const f of d.fragments) {
              if (b.path.startsWith(f + '.') || b.path.startsWith(f + '/')) {
                resolved = true;
                break;
              }
            }
          }
          if (resolved) {
            continue;
          }
          const subpart = /^(table|figure|annex)-/.test(b.path);
          const message = `provenance binding ${b.doc}#${b.path} (${b.element}) names no fragment or sentence of the shipped document — ${subpart ? 'a bare subpart citation the clause-only harvest cannot verify' : 'linked to air'} (provenance-clause-resolves)`;
          if (subpart) {
            issues.push({ rule: 'C169', severity: 'warning', message });
          } else {
            err('C169', message);
          }
        }

        // ── the text-coverage family (C73/C71/C72): the normative-text
        //     metric over the shipped harvests. C73 is config hygiene
        //     (malformed payloads, stale/dead/unreasoned allowances,
        //     unsorted/unreasoned/stale adjudications); C71 warns per
        //     uncovered normative sentence; C72 is the allowlist's
        //     text_coverage_budget (exceeded errors, slack warns).
        {
          for (const d of docs) {
            if (d.malformed) {
              err('C73', d.malformed);
            }
          }
          const cov = pkg.coverage;
          if (cov?.parseError) {
            err('C73', cov.parseError);
          }
          const config = cov?.config;
          const manifests = docs.filter(d => !d.malformed && d.urn !== '');
          const manifestUrns = new Set(manifests.map(m => m.urn));
          if (manifests.length > 0) {
            const SENTENCE_ADDRESS = /\/s[1-9][0-9]*$/;
            const boundFragments = new Set<string>();
            const boundSentences = new Set<string>();
            const textByElement = new Map<string, string>();
            for (const b of bindings) {
              if (!manifestUrns.has(b.doc)) {
                continue;
              }
              const key = `${b.doc}#${b.path}`;
              if (SENTENCE_ADDRESS.test(b.path)) {
                boundSentences.add(key);
              } else {
                boundFragments.add(key);
              }
            }
            // The kernel's DUPLICATE_TEXT_KINDS are the Standard collection
            // names; the shape tree's keywords are their singulars.
            const DUPLICATE_TEXT_KINDS = new Set([
              'requirement',
              'term',
              'instrument',
            ]);
            // The bound text for duplicate detection: the requirement
            // statement / term definition / instrument definition the
            // binding's element carries.
            const textOf = (c: Construct): string => {
              for (const key of ['statement', 'definition']) {
                const l = lines(c).find(x => x.key === key);
                if (l && l.tokens.length > 0) {
                  return l.tokens.join(' ');
                }
              }
              return '';
            };
            const ownerOf = new Map<string, Construct>();
            for (const c of closureConstructs) {
              if (c.ident && DUPLICATE_TEXT_KINDS.has(c.keyword)) {
                ownerOf.set(c.ident, c);
              }
            }
            for (const b of bindings) {
              if (!manifestUrns.has(b.doc) || textByElement.has(b.element)) {
                continue;
              }
              const owner = ownerOf.get(b.element);
              if (owner && DUPLICATE_TEXT_KINDS.has(owner.keyword)) {
                const t = textOf(owner);
                if (t !== '') {
                  textByElement.set(b.element, t);
                }
              }
            }
            const allowances = config?.allowances ?? [];
            const adjudications = config?.duplicate_adjudications ?? [];
            type Sent = {
              address: string;
              fragment: string;
              modality: string;
              kind: string;
              text: string;
            };
            const allowanceAddressMatches = (
              allowance: string,
              sentence: string,
            ): boolean =>
              sentence === allowance ||
              (sentence.startsWith(allowance) &&
                ['.', '/'].includes(sentence.charAt(allowance.length)));
            const allowanceMatches = (
              address: string,
              pins: string[] | undefined,
              urn: string,
              sentences: Sent[],
            ): Sent[] => {
              const hash = address.indexOf('#');
              const fragment = address.slice(hash + 1);
              if (pins) {
                const set = new Set(pins.map(x => `${urn}#${fragment}/${x}`));
                return sentences.filter(x => set.has(`${urn}#${x.address}`));
              }
              return sentences.filter(x =>
                allowanceAddressMatches(address, `${urn}#${x.address}`),
              );
            };
            const matchedByAllowance = new Map<
              { address: string; pins?: string[]; reason?: string },
              Sent[]
            >();
            for (const manifest of manifests) {
              const urn = manifest.urn;
              const sentences = manifest.sentences ?? [];
              const sentenceCovered = (x: Sent): boolean =>
                boundFragments.has(`${urn}#${x.fragment}`) ||
                boundSentences.has(`${urn}#${x.address}`);
              const allowanceOf = new Map<
                string,
                (typeof allowances)[number]
              >();
              for (const a of allowances) {
                if (a.address.slice(0, a.address.indexOf('#')) !== urn) {
                  continue;
                }
                const matched = allowanceMatches(
                  a.address,
                  a.sentences,
                  urn,
                  sentences,
                );
                const arr = matchedByAllowance.get(a) ?? [];
                arr.push(...matched);
                matchedByAllowance.set(a, arr);
                for (const x of matched) {
                  if (x.modality === 'normative' && !sentenceCovered(x)) {
                    allowanceOf.set(x.address, a);
                  }
                }
              }
              for (const x of sentences) {
                if (x.modality !== 'normative' || sentenceCovered(x)) {
                  continue;
                }
                if (allowanceOf.has(x.address)) {
                  continue;
                }
                const text =
                  x.text.length > 100 ? `${x.text.slice(0, 97)}…` : x.text;
                issues.push({
                  rule: 'C71',
                  severity: 'warning',
                  message: `sentence ${urn}#${x.address} (normative, ${x.kind}): bound by no model element and excluded by no allowance — "${text}" (text-coverage-sentence-uncovered)`,
                });
              }
            }
            // C73 — allowance hygiene.
            for (const a of allowances) {
              const label = `coverage allowance '${a.address}'${a.sentences ? ` pins {${a.sentences.join(' ')}}` : ''}`;
              const urn = a.address.slice(0, a.address.indexOf('#'));
              if (!manifestUrns.has(urn)) {
                err(
                  'C73',
                  `${label}: not a document of the shipped manifests (stale or mistyped address) (text-coverage-config)`,
                );
                continue;
              }
              const matched = matchedByAllowance.get(a) ?? [];
              const normative = matched.filter(x => x.modality === 'normative');
              if (matched.length === 0) {
                err(
                  'C73',
                  `${label}: matches no sentence of the decomposition (stale — remove the entry or fix the address/pins) (text-coverage-config)`,
                );
              } else if (normative.length === 0) {
                err(
                  'C73',
                  `${label}: every matched sentence is informative — informative sentences need no allowance (stale — remove the entry) (text-coverage-config)`,
                );
              } else if (a.sentences) {
                const informativePins = matched
                  .filter(x => x.modality !== 'normative')
                  .map(x => x.address);
                if (informativePins.length > 0) {
                  err(
                    'C73',
                    `${label}: pinned sentence(s) ${informativePins.join(', ')} are informative-classified — the pin is stale (text-coverage-config)`,
                  );
                }
              }
              if (normative.length > 0) {
                const bound = (x: Sent): boolean =>
                  boundFragments.has(`${urn}#${x.fragment}`) ||
                  boundSentences.has(`${urn}#${x.address}`);
                if (normative.every(bound)) {
                  err(
                    'C73',
                    `${label}: every matched normative sentence is now bound by a model element — the allowance discharges nothing (stale — remove the entry; the bindings carry the coverage) (text-coverage-config)`,
                  );
                }
              }
              if (!a.reason) {
                err(
                  'C73',
                  `${label}: missing reason (allowances are deliberate, never silent) (text-coverage-config)`,
                );
              }
            }
            // The duplicate detector (the adjudication-staleness input):
            // containment similarity over the bound-text elements.
            const normalizeForSimilarity = (text: string): string[] =>
              text
                .toLowerCase()
                .replace(/[‘’‚]/g, "'")
                .replace(/[“”„]/g, '"')
                .replace(/[‐‑‒–—]/g, '-')
                .replace(/[^a-z0-9]+/g, ' ')
                .trim()
                .split(' ')
                .filter(t => t !== '');
            const containmentSimilarity = (
              a: string[],
              b: string[],
            ): number => {
              const count = (xs: string[]) => {
                const m = new Map<string, number>();
                for (const x of xs) {
                  m.set(x, (m.get(x) ?? 0) + 1);
                }
                return m;
              };
              const ca = count(a);
              const cb = count(b);
              let inter = 0;
              for (const [t, n] of ca) {
                inter += Math.min(n, cb.get(t) ?? 0);
              }
              const denom = Math.min(a.length, b.length);
              return denom === 0 ? 0 : inter / denom;
            };
            const flaggedKeys = new Set<string>();
            {
              const elements = [...textByElement.keys()].sort();
              const tokens = new Map(
                elements.map(e => [
                  e,
                  normalizeForSimilarity(textByElement.get(e)!),
                ]),
              );
              for (let i = 0; i < elements.length; i++) {
                for (let j = i + 1; j < elements.length; j++) {
                  const ta = tokens.get(elements[i]!)!;
                  const tb = tokens.get(elements[j]!)!;
                  if (Math.min(ta.length, tb.length) < 6) {
                    continue;
                  }
                  if (containmentSimilarity(ta, tb) >= 0.8) {
                    flaggedKeys.add(elements[i]! + elements[j]!);
                  }
                }
              }
            }
            // C73 — adjudication hygiene.
            for (const d of adjudications) {
              const els = d.elements ?? [];
              const label = `duplicate adjudication {${els.join(', ')}}`;
              if (els.length !== 2) {
                err(
                  'C73',
                  `${label}: exactly two element ids make a pair (text-coverage-config)`,
                );
                continue;
              }
              if (els[0] === els[1]) {
                err(
                  'C73',
                  `${label}: the pair names the same element twice (text-coverage-config)`,
                );
              }
              if (els[0]! > els[1]!) {
                err(
                  'C73',
                  `${label}: element ids must be sorted (the pair key is order-free) (text-coverage-config)`,
                );
              }
              if (!d.reason) {
                err(
                  'C73',
                  `${label}: missing reason (adjudications are deliberate, never silent) (text-coverage-config)`,
                );
              }
              if (!flaggedKeys.has([...els].sort().join(''))) {
                err(
                  'C73',
                  `${label}: the pair is not currently flagged (similarity below 0.8 or an element unbound/renamed) — the adjudication is STALE (text-coverage-config)`,
                );
              }
            }
            // C72 — the text_coverage_budget (the allowlist's own line).
            const budgetLine = pkg.allowlist?.budgets.find(
              b =>
                b.key === 'coverage_budget' || b.key === 'text_coverage_budget',
            );
            if (budgetLine) {
              const budget = Number.parseInt(budgetLine.raw, 10);
              if (Number.isInteger(budget) && budget >= 0) {
                // KNOWN C71 entries discharge their matches from the count
                // (the kernel's applyAllowlist subtracts `known`).
                const globMatch = (glob: string, text: string): boolean =>
                  new RegExp(
                    '^' +
                      glob
                        .split('*')
                        .map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                        .join('[\\s\\S]*') +
                      '$',
                  ).test(text);
                const knownPats = (pkg.allowlist?.entries ?? [])
                  .filter(e => e.rule === 'C71' && e.match)
                  .map(e => e.match);
                const count = issues.filter(
                  i2 =>
                    i2.rule === 'C71' &&
                    i2.severity === 'warning' &&
                    !knownPats.some(pat => globMatch(pat, i2.message)),
                ).length;
                if (count > budget) {
                  err(
                    'C72',
                    `.primmel-allowlist.prl: ${count} uncovered normative sentences exceed the package text_coverage_budget of ${budget} — bind the sentences, declare allowances with clause-referenced reasons, or raise the budget (text-coverage-budget)`,
                  );
                } else if (count < budget) {
                  issues.push({
                    rule: 'C72',
                    severity: 'warning',
                    message: `.primmel-allowlist.prl: text_coverage_budget ${budget} has slack — only ${count} uncovered normative sentences remain; tighten the budget (the allowlist only shrinks) (text-coverage-budget)`,
                  });
                }
              }
            }
          }
        }
      }
    }
    // ── C56 allowlist-malformed: every allowlist entry carries a rule,
    //     a non-empty match glob, a reason, and an audit_ref; the
    //     budgets are non-negative integers; the directives are the
    //     closed vocabulary. (The unknown-rule leg rides the kernel's
    //     registry — the shape legs are the mirror's own.)
    {
      const al = pkg.allowlist;
      if (al) {
        for (const e of al.entries) {
          const rule = e.rule;
          const match = e.match;
          const id = e.id;
          const reason = e.reason;
          const auditRef = e.auditRef;
          const label = match ? ` "${match}"` : '';
          if (!match) {
            err(
              'C56',
              `.primmel-allowlist.prl: entry for rule "${rule ?? ''}" has an empty match glob (allowlist-malformed)`,
            );
          }
          if (id !== undefined && id === '') {
            err(
              'C56',
              `.primmel-allowlist.prl: entry for rule "${rule ?? ''}" has an empty id glob — the structured key pins the element identity or is absent (allowlist-malformed)`,
            );
          }
          if (!reason) {
            err(
              'C56',
              `.primmel-allowlist.prl: entry${label} has no reason — known debt is recorded with its justification (allowlist-malformed)`,
            );
          }
          if (!auditRef) {
            err(
              'C56',
              `.primmel-allowlist.prl: entry${label} has no audit_ref — new allowlist entries require clause-referenced reasons (allowlist-malformed)`,
            );
          }
        }
        for (const b of al.budgets) {
          const raw = b.raw;
          const n = Number(raw);
          if (raw === '' || !Number.isInteger(n) || n < 0) {
            err(
              'C56',
              `.primmel-allowlist.prl: ${b.key} "${raw}" is not a non-negative integer (allowlist-malformed)`,
            );
          }
        }
      }
    }

    // ── the state family: C37 (state-fires-resolve), C39
    //     (state-machine-states-referenced) and C40
    //     (anatomy-state-resolve). C95's cascade routing contract is its
    //     own batch.
    {
      const machineById = new Map<
        string,
        { kind: string; actions: Set<string>; states: Set<string> }
      >();
      // The transitions both grammar forms deliver: a nested construct
      // (simple bodies) and a `transition` line whose cascade/guard body
      // rides the line's blocks.
      const transitionsByMachine = new Map<
        string,
        {
          action: string;
          to: string;
          guard: string;
          cascades: {
            target: string;
            action?: string;
            via?: string;
            create: boolean;
            setFields: Map<string, string>;
            withKeys: string[];
          }[];
        }[]
      >();
      const readCascade = (cc: Construct) => {
        const setFields = new Map<string, string>();
        const withKeys: string[] = [];
        for (const setName of ['set', 'create', 'with']) {
          for (const blk of nested(cc).filter(n => n.keyword === setName)) {
            for (const l of lines(blk)) {
              const field = l.key!.replace(/:$/, '');
              if (setName === 'with') {
                withKeys.push(field);
              } else {
                setFields.set(field, l.tokens[0] ?? '');
              }
            }
          }
        }
        return {
          target: cc.ident ?? '',
          action: facetTokens(cc.items, 'action')[0],
          via: facetTokens(cc.items, 'via')[0],
          create: nested(cc).some(n => n.keyword === 'create'),
          setFields,
          withKeys,
        };
      };
      const readTransitionLine = (l: {
        key: string;
        tokens: string[];
        blocks?: Item[][];
      }) => {
        const t = [l.key, ...l.tokens];
        const ai = t.indexOf('action');
        const tr = {
          action: ai !== -1 ? (t[ai + 1] ?? '') : '',
          to: t.indexOf('->') > 0 ? (t[t.indexOf('->') + 1] ?? '') : '',
          guard: '',
          cascades: [] as ReturnType<typeof readCascade>[],
        };
        for (const blk of l.blocks ?? []) {
          for (const it of blk) {
            if (it.kind === 'line' && it.key === 'guard' && it.tokens[0]) {
              tr.guard = it.tokens[0];
            } else if (it.kind === 'construct' && it.construct) {
              if (it.construct.keyword === 'cascade') {
                tr.cascades.push(readCascade(it.construct));
              } else if (it.construct.keyword === 'guard') {
                const gl = lines(it.construct)[0];
                if (gl) {
                  tr.guard = [gl.key ?? '', ...gl.tokens].join(' ');
                }
              }
            }
          }
        }
        return tr;
      };
      for (const sm of closureConstructs.filter(
        x => x.keyword === 'state_machine' && x.ident,
      )) {
        const actions = new Set<string>();
        const states = new Set<string>();
        const transitions: ReturnType<typeof readTransitionLine>[] = [];
        for (const l of lines(sm)) {
          if (l.key === 'state') {
            for (const t of l.tokens) {
              states.add(t);
            }
          }
          if (l.key === 'transition') {
            const tr = readTransitionLine(l);
            transitions.push(tr);
            if (tr.action) {
              actions.add(tr.action);
            }
          }
        }
        for (const stC of nested(sm).filter(n => n.keyword === 'states')) {
          for (const i2 of stC.items) {
            if (i2.kind === 'raw') {
              for (const t of i2.tokens) {
                states.add(t);
              }
            } else if (i2.kind === 'line') {
              states.add(i2.key!);
              for (const t of i2.tokens) {
                states.add(t);
              }
            }
          }
        }
        for (const t of nested(sm).filter(n => n.keyword === 'transition')) {
          const fromLine = t.items.find(
            i2 => i2.kind === 'line' && i2.key === 'from',
          );
          if (fromLine) {
            const ti = fromLine.tokens.indexOf('action');
            const toi = fromLine.tokens.indexOf('to');
            const tr = {
              action: ti !== -1 ? (fromLine.tokens[ti + 1] ?? '') : '',
              to: toi !== -1 ? (fromLine.tokens[toi + 1] ?? '') : '',
              guard: facetTokens(t.items, 'guard')[0] ?? '',
              cascades: nested(t)
                .filter(n => n.keyword === 'cascade')
                .map(readCascade),
            };
            transitions.push(tr);
            if (tr.action) {
              actions.add(tr.action);
            }
          }
        }
        machineById.set(sm.ident!, {
          kind: facetTokens(sm.items, 'kind')[0] ?? '',
          actions,
          states,
        });
        transitionsByMachine.set(sm.ident!, transitions);
      }
      // C37: a process bound to a machine (state <machineRef>) fires only
      // that machine's declared transition actions; a step fires with no
      // bound machine is air.
      for (const c2 of pkg.constructs.filter(
        x => x.keyword === 'process' && x.ident,
      )) {
        const bound = facetTokens(c2.items, 'state')[0];
        const firedSteps: { id: string; fires: string }[] = [];
        const doesBody = nested(c2).find(n => n.keyword === 'does');
        for (const st of doesBody
          ? nested(doesBody).filter(n => n.keyword === 'step')
          : []) {
          const fires = facetTokens(st.items, 'fires')[0];
          if (fires) {
            firedSteps.push({ id: st.ident ?? '', fires });
          }
        }
        if (firedSteps.length === 0) {
          continue;
        }
        if (!bound) {
          for (const s2 of firedSteps) {
            err(
              'C37',
              `process ${c2.ident}: step "${s2.id}" fires "${s2.fires}" but the process binds no state machine — declare state <machineRef> (state-fires-resolve)`,
            );
          }
        } else {
          const m = machineById.get(bound);
          if (!m) {
            err(
              'C37',
              `process ${c2.ident}: state machine "${bound}" is not declared — step fires cannot resolve (state-fires-resolve)`,
            );
          } else {
            for (const s2 of firedSteps) {
              if (!m.actions.has(s2.fires)) {
                err(
                  'C37',
                  `process ${c2.ident}: step "${s2.id}" fires "${s2.fires}", which state machine "${bound}" does not declare as a transition action (state-fires-resolve)`,
                );
              }
            }
          }
        }
      }
      // C40: a subject's HAS state binds a declared OPERATIONAL machine;
      // a lifecycle machine is the cross-family reference (C38's message).
      for (const c2 of pkg.constructs.filter(
        x => x.keyword === 'subject' && x.ident,
      )) {
        const isBlock = nested(c2).find(n => n.keyword === 'is');
        const st = isBlock ? facetTokens(isBlock.items, 'state')[0] : undefined;
        if (!st) {
          continue;
        }
        const m = machineById.get(st);
        if (!m) {
          err(
            'C40',
            `subject ${c2.ident}: has.state "${st}" is not a declared state machine — a subject's HAS state binds a declared operational machine (anatomy-state-resolves)`,
          );
        } else if (m.kind !== 'operational') {
          err(
            'C38',
            `subject ${c2.ident}: has.state "${st}" is a lifecycle state machine — a subject's HAS state is its OPERATIONAL machine; workflow lifecycle state lives on entities (state-family-separation)`,
          );
        }
      }
      // C39: a process precondition's self.state gates resolve against
      // the bound machine's declared states. The gate extraction reads
      // the check carrier's captured expression.
      const GATE_FORWARD =
        /\bself\.state\s*(<>|!=|==|=)\s*#([A-Za-z_][A-Za-z0-9_]*)/g;
      const GATE_MIRRORED =
        /#([A-Za-z_][A-Za-z0-9_]*)\s*(==|=)\s*self\.state\b/g;
      const checkTextOf = (pc: Construct): string => {
        const l = pc.items.find(i2 => i2.kind === 'line' && i2.key === 'check');
        if (!l) {
          return '';
        }
        return (l.blocks ?? [])
          .flat()
          .map(b =>
            b.kind === 'raw'
              ? b.tokens.join(' ')
              : b.kind === 'line'
                ? [b.key ?? '', ...b.tokens].join(' ')
                : '',
          )
          .join(' ');
      };
      const gatesOf = (text: string): string[] => {
        const out: string[] = [];
        for (const m of text.matchAll(GATE_FORWARD)) {
          out.push(m[2]!);
        }
        for (const m of text.matchAll(GATE_MIRRORED)) {
          out.push(m[1]!);
        }
        return out;
      };
      // ── C95 cascade-transition-resolve (legs 1–5, the routing
      //     contract): a status-writing cascade step on a machinated
      //     target routes through a declared transition of the target's
      //     own machine — via present, via legal, via resolving, the
      //     route landing on the written status, and unguarded.
      {
        const SEMANTIC_STATUS: Record<string, string> = {
          submit: 'SUBMITTED',
          lock: 'LOCKED',
        };
        for (const sm of closureConstructs.filter(
          x => x.keyword === 'state_machine' && x.ident,
        )) {
          for (const tr of transitionsByMachine.get(sm.ident!) ?? []) {
            const transitionLabel = `-> ${tr.to}${tr.action ? ` action ${tr.action}` : ''}`;
            tr.cascades.forEach((c, k) => {
              const stepLabel = `state_machine ${sm.ident}: transition ${transitionLabel}: cascade ${k} (${c.target})`;
              const self = c.target === sm.ident;
              const targetMachine = machineById.get(c.target);
              const isCreate = c.create;
              const semanticStatus =
                c.action !== undefined ? SEMANTIC_STATUS[c.action] : undefined;
              const setStatus = c.setFields.get('status');
              const writesStatus =
                !isCreate &&
                (semanticStatus !== undefined || setStatus !== undefined);
              const writtenStatus = semanticStatus ?? setStatus ?? '';
              // Leg 1 — via-present.
              if (
                writesStatus &&
                targetMachine &&
                !self &&
                c.via === undefined
              ) {
                err(
                  'C95',
                  `${stepLabel} writes status '${writtenStatus}' on machinated entity '${c.target}' but declares no via — a status-writing cascade routes through a declared transition of the target's machine (cascade-transition-resolve)`,
                );
              }
              // Leg 5 — via-forbidden-elsewhere; legs 2–4 — the routing
              // contract, judged only where a via is legal.
              if (c.via !== undefined) {
                if (
                  self ||
                  isCreate ||
                  !writesStatus ||
                  !targetMachine ||
                  c.action === 'notify' ||
                  c.action === 'record'
                ) {
                  const forbidden = self
                    ? "a self-step (the target is the owning machine's own entity)"
                    : isCreate
                      ? 'a create step (a fresh record has no current-state hop to route)'
                      : c.action === 'notify' || c.action === 'record'
                        ? `an action ${c.action} step (a record-create, never a status hop)`
                        : !writesStatus
                          ? 'a step that writes no status (payload-only)'
                          : `a step on entity '${c.target}', which declares no state machine`;
                  err(
                    'C95',
                    `${stepLabel} declares via '${c.via}' on ${forbidden} — via routes a status write through the target's machine and is forbidden everywhere else (cascade-transition-resolve)`,
                  );
                } else {
                  const candidates = (
                    transitionsByMachine.get(c.target) ?? []
                  ).filter(t2 => t2.action === c.via);
                  if (candidates.length === 0) {
                    err(
                      'C95',
                      `${stepLabel} via '${c.via}' resolves to no transition of machine '${c.target}' (cascade-transition-resolve)`,
                    );
                  } else {
                    const landing = candidates.filter(
                      t2 => t2.to === writtenStatus,
                    );
                    if (landing.length === 0) {
                      err(
                        'C95',
                        `${stepLabel} via '${c.via}' names no transition of machine '${c.target}' whose to is '${writtenStatus}' — the route must land on the written status (cascade-transition-resolve)`,
                      );
                    } else if (landing.some(t2 => t2.guard !== '')) {
                      err(
                        'C95',
                        `${stepLabel} via '${c.via}' names a guarded transition of machine '${c.target}' — a cascade has no caller to supply guard values; the route must be unguarded (cascade-transition-resolve)`,
                      );
                    }
                  }
                }
              }
            });
          }
        }
      }
      for (const p2 of pkg.constructs.filter(
        x => x.keyword === 'process' && x.ident,
      )) {
        const gates: { pc: string; state: string }[] = [];
        for (const pc of nested(p2).filter(n => n.keyword === 'precondition')) {
          for (const st of gatesOf(checkTextOf(pc))) {
            gates.push({ pc: pc.ident ?? '', state: st });
          }
        }
        if (gates.length === 0) {
          continue;
        }
        const bound = facetTokens(p2.items, 'state')[0];
        const m = bound !== undefined ? machineById.get(bound) : undefined;
        if (!bound) {
          err(
            'C39',
            `process ${p2.ident}: precondition "${gates[0]!.pc}" gates on self.state but the process binds no state machine — declare state <machineRef> (state-machine-states-referenced)`,
          );
        } else if (!m) {
          err(
            'C39',
            `process ${p2.ident}: state machine "${bound}" is not declared — state gates cannot resolve (state-machine-states-referenced)`,
          );
        } else {
          for (const g of gates) {
            if (!m.states.has(g.state)) {
              err(
                'C39',
                `process ${p2.ident}: precondition "${g.pc}" gates on #${g.state}, which is not a declared state of machine "${bound}" (state-machine-states-referenced)`,
              );
            }
          }
        }
      }
    }

    // ── the quantities family: C33's register plane, C32's instance
    //     leg, C33's symbol/verdict + instance legs, C34 duality
    //     coherence. Coherence judges KINDS resolved through the
    //     package's quantity_registers, never unit strings.
    {
      const qKindDecl = new Set<string>();
      const qUnitKind = new Map<string, string>();
      const qUnitHome = new Map<string, string>();
      const qUnitEntry = new Map<string, string>();
      const qRegisters = closureConstructs.filter(
        x => x.keyword === 'quantity_register' && x.ident,
      );
      for (const reg of qRegisters) {
        for (const k of nested(reg).filter(n => n.keyword === 'kind')) {
          if (k.ident) {
            qKindDecl.add(k.ident);
          }
        }
      }
      for (const reg of qRegisters) {
        for (const u of nested(reg).filter(n => n.keyword === 'unit')) {
          if (!u.ident) {
            continue;
          }
          const sym = facetTokens(u.items, 'symbol')[0] ?? '';
          const kind = facetTokens(u.items, 'kind')[0] ?? '';
          const factor = facetTokens(u.items, 'factor')[0] ?? '';
          const offset = facetTokens(u.items, 'offset')[0] ?? '';
          if (kind && !qKindDecl.has(kind)) {
            err(
              'C33',
              `quantity_register ${reg.ident}: unit "${u.ident}" declares kind "${kind}", which no quantity_register declares (quantity-coherence)`,
            );
          }
          const entry = `${kind}|${factor}|${offset}|${sym}`;
          for (const key of new Set([u.ident, sym].filter(x => x))) {
            const prior = qUnitHome.get(key);
            if (prior !== undefined) {
              if (qUnitEntry.get(key) !== entry) {
                err(
                  'C33',
                  `quantity_register ${reg.ident}: unit "${u.ident}" ("${key}") redefines a unit already declared by register "${prior}" — a package extends the register, it never redefines entries (quantity-coherence)`,
                );
              }
            } else {
              qUnitHome.set(key, reg.ident!);
              qUnitEntry.set(key, entry);
              qUnitKind.set(key, kind);
            }
          }
        }
      }
      const kindOfUnit = (unit: string | undefined): string | undefined =>
        unit === undefined ? undefined : qUnitKind.get(unit.trim());
      const registersExist = qRegisters.length > 0;
      // C33 — symbols and verdicts: declared quantity_kind vs unit kind.
      for (const kw of ['symbol', 'verdict']) {
        for (const c2 of closureConstructs.filter(
          x => x.keyword === kw && x.ident,
        )) {
          const unit = facetTokens(c2.items, 'unit')[0];
          const qk = facetTokens(c2.items, 'quantity_kind')[0];
          if (!unit || !qk) {
            continue;
          }
          const uKind = kindOfUnit(unit);
          if (uKind && qKindDecl.has(qk) && uKind !== qk) {
            err(
              'C33',
              `${kw} ${c2.ident}: declared quantity_kind "${qk}" but unit "${unit}" measures kind ${uKind} — quantity kinds differ (quantity-coherence)`,
            );
          }
        }
      }
      // C32/C33 — the instance attribute plane. Attributes arrive in
      // two shapes: a nested per-attribute construct (block form, a
      // `value` line) or an inline run riding ONE greedy line of the
      // `attributes` body (key = attribute name, tokens = [value,
      // unit?]; `-` marks an unstated value).
      const attrDefs = new Map<string, Construct>();
      for (const c2 of closureConstructs.filter(
        x => x.keyword === 'attribute_definition' && x.ident,
      )) {
        attrDefs.set(c2.ident!, c2);
      }
      const numberish = (t: string): boolean => /^[-+]?[0-9]/.test(t);
      const statedOf = (
        name: string,
        c2: Construct,
      ): {
        unit?: string;
        kind?: string;
        bare?: boolean;
      } => {
        const block = nested(c2).find(n => n.keyword === name);
        if (block) {
          const vLine = block.items.find(
            i2 => i2.kind === 'line' && i2.key === 'value',
          );
          if (!vLine) {
            return {};
          }
          const toks = vLine.tokens;
          const ui = toks.indexOf('unit');
          const ki = toks.indexOf('kind');
          return {
            unit: ui !== -1 ? toks[ui + 1] : undefined,
            kind: ki !== -1 ? toks[ki + 1] : undefined,
            bare: toks.length > 0 && ui === -1 && ki === -1,
          };
        }
        const l = c2.items.find(i2 => i2.kind === 'line' && i2.key === name);
        if (!l) {
          return {};
        }
        const run = l.tokens.filter(t => t !== ':');
        if (run.length === 0 || run[0] === '-') {
          return {};
        }
        if (run.length >= 2) {
          return { unit: run[1] };
        }
        return { bare: numberish(run[0]!) };
      };
      for (const inst of pkg.constructs.filter(
        x => x.keyword === 'instance' && x.ident,
      )) {
        const has = nested(inst).find(n => n.keyword === 'has');
        for (const planeName of ['attributes', 'test_context']) {
          const plane = has
            ? nested(has).find(n => n.keyword === planeName)
            : undefined;
          if (!plane) {
            continue;
          }
          const names = new Set<string>([
            ...nested(plane).map(n => n.keyword),
            ...lines(plane).map(l => l.key!),
          ]);
          for (const key of names) {
            const def = attrDefs.get(key);
            if (!def) {
              continue; // the undeclared attribute is another rule's finding
            }
            const defUnit = facetTokens(def.items, 'unit')[0] ?? '';
            const defQk = facetTokens(def.items, 'quantity_kind')[0] ?? '';
            const defVt = facetTokens(def.items, 'value_type')[0] ?? '';
            const physical =
              defUnit !== '' || defQk !== '' || defVt === 'QuantityValue';
            const st = statedOf(key, plane);
            if (physical && st.bare) {
              err(
                'C32',
                `instance ${inst.ident}: attribute "${key}" is a declared physical quantity (${defUnit !== '' ? `unit "${defUnit}"` : defVt === 'QuantityValue' ? 'value_type QuantityValue' : `quantity_kind ${defQk}`}) but the stated value is a bare number — INV-1: no bare numbers (inv1-no-bare-quantity)`,
              );
            }
            if (
              st.unit &&
              registersExist &&
              kindOfUnit(st.unit) === undefined
            ) {
              issues.push({
                rule: 'C33',
                severity: 'warning',
                message: `instance ${inst.ident}: attribute "${key}" carries unit "${st.unit}", which no quantity_register declares (quantity-coherence)`,
              });
            }
            const effKind = st.kind ?? kindOfUnit(st.unit);
            if (
              defQk &&
              effKind &&
              qKindDecl.has(effKind) &&
              effKind !== defQk
            ) {
              err(
                'C33',
                `instance ${inst.ident}: attribute "${key}" (kind ${defQk}) stated with ${st.kind ? `kind "${st.kind}"` : `unit "${st.unit}" (kind ${effKind})`} — quantity kinds differ (quantity-coherence)`,
              );
            } else if (!defQk && defUnit && st.unit) {
              const dK = kindOfUnit(defUnit);
              const vK = kindOfUnit(st.unit);
              if (dK && vK && dK !== vK) {
                err(
                  'C33',
                  `instance ${inst.ident}: attribute "${key}" declared with unit "${defUnit}" (kind ${dK}) stated with unit "${st.unit}" (kind ${vK}) — quantity kinds differ (quantity-coherence)`,
                );
              }
            }
          }
        }
      }
      // C34 — the duality: designed and exhibited sides are kind-coherent.
      for (const d of closureConstructs.filter(x => x.keyword === 'dual')) {
        const sideUnit = (name: string): string | undefined => {
          const side = nested(d).find(n => n.keyword === name);
          if (!side) {
            return undefined;
          }
          const vLine = side.items.find(
            i2 => i2.kind === 'line' && i2.key === 'value',
          );
          if (!vLine) {
            return undefined;
          }
          const ui = vLine.tokens.indexOf('unit');
          return ui !== -1 ? vLine.tokens[ui + 1] : undefined;
        };
        const du = sideUnit('designed');
        const eu = sideUnit('exhibited');
        if (du && eu) {
          const dK = kindOfUnit(du);
          const eK = kindOfUnit(eu);
          if (dK && eK && dK !== eK) {
            err(
              'C34',
              `dual ${d.ident}: the designed side's unit "${du}" (kind ${dK}) and the exhibited side's unit "${eu}" (kind ${eK}) measure different quantity kinds — the two roles state ONE quantity (duality-coherence)`,
            );
          }
        }
      }
      // ── C35 time-format (two legs), C36 map-type, C149
      //     closed-derivation-references-declared, C152
      //     payload-typed-by-class, C167 qualified-unit-reference.
      //     (C165/C166 are catalog-only in the kernel too — they await
      //     the calculation math plane.)
      {
        // ISO 8601 primitives (the kernel's time.ts, independently).
        const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
        const DATETIME_RE =
          /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,]\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;
        const DURATION_RE =
          /^P(?:(\d+(?:[.,]\d+)?)Y)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)D)?(?:T(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)S)?)?(?:(\d+(?:[.,]\d+)?)W)?$/;
        const daysInMonth = (year: number, month: number): number =>
          new Date(Date.UTC(year, month, 0)).getUTCDate();
        const isDateV = (v: string): boolean => {
          const m = DATE_RE.exec(v);
          if (!m) {
            return false;
          }
          const month = Number(m[2]);
          const day = Number(m[3]);
          return (
            month >= 1 &&
            month <= 12 &&
            day >= 1 &&
            day <= daysInMonth(Number(m[1]), month)
          );
        };
        const isDateTimeV = (v: string): boolean => {
          const m = DATETIME_RE.exec(v);
          if (!m) {
            return false;
          }
          if (!isDateV(m.slice(1, 4).join('-'))) {
            return false;
          }
          return (
            Number(m[4]) <= 23 &&
            Number(m[5]) <= 59 &&
            (m[6] === undefined || Number(m[6]) <= 60)
          );
        };
        const isDurationV = (v: string): boolean => {
          const m = DURATION_RE.exec(v);
          if (!m) {
            return false;
          }
          const components = m.slice(1).filter(x => x !== undefined);
          if (components.length === 0) {
            return false;
          }
          return m[7] === undefined || components.length === 1;
        };
        const isPeriodV = (v: string): boolean => {
          const parts = v.split('/');
          if (parts.length !== 2) {
            return false;
          }
          const [a, b] = parts;
          const aDate = isDateV(a) || isDateTimeV(a);
          const bDate = isDateV(b) || isDateTimeV(b);
          if (aDate && bDate) {
            return a <= b;
          }
          if (aDate && isDurationV(b)) {
            return true;
          }
          return isDurationV(a) && bDate;
        };
        const isValidTimeValue = (kind: string, v: string): boolean | null => {
          if (kind === 'date') {
            return isDateV(v);
          }
          if (kind === 'datetime') {
            return isDateTimeV(v);
          }
          if (kind === 'duration') {
            return isDurationV(v);
          }
          if (kind === 'period') {
            return isPeriodV(v);
          }
          return null;
        };
        // C35a — a time-typed attribute's stated value is ISO 8601.
        for (const inst of pkg.constructs.filter(
          x => x.keyword === 'instance' && x.ident,
        )) {
          const has = nested(inst).find(n => n.keyword === 'has');
          for (const planeName of ['attributes', 'test_context']) {
            const plane = has
              ? nested(has).find(n => n.keyword === planeName)
              : undefined;
            if (!plane) {
              continue;
            }
            for (const l of lines(plane)) {
              if (l.key === planeName) {
                continue;
              }
              const def = attrDefs.get(l.key!);
              if (!def) {
                continue;
              }
              const vt = facetTokens(def.items, 'value_type')[0] ?? '';
              if (!['date', 'datetime', 'duration', 'period'].includes(vt)) {
                continue;
              }
              const run = l.tokens.filter(t2 => t2 !== ':');
              if (run.length === 0 || run[0] === '-') {
                continue;
              }
              if (isValidTimeValue(vt, run[0]!) === false) {
                err(
                  'C35',
                  `instance ${inst.ident}: attribute "${l.key}" (value_type ${vt}) value "${run[0]}" is not a valid ISO 8601 ${vt} (time-format)`,
                );
              }
            }
          }
        }
        // C35b — a timer_event step's period is an ISO 8601 duration.
        for (const p2 of pkg.constructs.filter(
          x => x.keyword === 'process' && x.ident,
        )) {
          const doesBody = nested(p2).find(n => n.keyword === 'does');
          for (const st of doesBody
            ? nested(doesBody).filter(n => n.keyword === 'step')
            : []) {
            if (facetTokens(st.items, 'kind')[0] !== 'timer_event') {
              continue;
            }
            const period = facetTokens(st.items, 'period')[0];
            if (period && !isDurationV(period)) {
              err(
                'C35',
                `process ${p2.ident}: timer_event "${st.ident}" period "${period}" is not an ISO 8601 duration (time-format)`,
              );
            }
          }
        }
        // C36 — map<K, V> type expressions are well-formed.
        const PRIMITIVES = new Set([
          'integer',
          'float',
          'double',
          'string',
          'text',
          'boolean',
          'date',
          'datetime',
          'duration',
          'period',
          'url',
          'email',
        ]);
        const TYPE_IDENT = /^[A-Za-z_][A-Za-z0-9_-]*$/;
        const splitTopLevelComma = (src: string): [string, string] | null => {
          let depth = 0;
          for (let i = 0; i < src.length; i++) {
            const ch = src[i];
            if (ch === '<') {
              depth++;
            } else if (ch === '>') {
              depth--;
            } else if (ch === ',' && depth === 0) {
              return [src.slice(0, i), src.slice(i + 1)];
            }
          }
          return null;
        };
        const wellFormedType = (src: string, depth = 0): boolean => {
          const v = src.trim();
          if (depth > 8) {
            return false;
          }
          if (v === 'QuantityValue' || PRIMITIVES.has(v)) {
            return true;
          }
          const ref = /^reference\(([^)]+)\)$/.exec(v);
          if (ref) {
            return TYPE_IDENT.test(ref[1]!.trim());
          }
          if (v.startsWith('map<') && v.endsWith('>')) {
            const inner = v.slice(4, -1);
            const parts = splitTopLevelComma(inner);
            if (!parts) {
              return false;
            }
            const rawKey = parts[0].trim();
            const keyOk =
              rawKey === 'string' ||
              (TYPE_IDENT.test(rawKey) && !rawKey.includes('<'));
            if (!keyOk) {
              return false;
            }
            return wellFormedType(parts[1], depth + 1);
          }
          return false;
        };
        const checkMapType = (owner: string, id: string, ty: string) => {
          if (/^map\s*</.test(ty) && !wellFormedType(ty)) {
            err(
              'C36',
              `${owner}: ${/attribute_definition/.test(owner) ? 'value_type' : `attribute "${id}"`} type "${ty}" is not a well-formed map<K, V> type — K is string or an enum id, V a type expression (map-type)`,
            );
          }
        };
        for (const c2 of closureConstructs.filter(
          x => x.keyword === 'class' && x.ident,
        )) {
          for (const f of nested(c2)) {
            if (f.keyword.endsWith(':')) {
              checkMapType(
                `class ${c2.ident}`,
                f.keyword.slice(0, -1),
                f.ident ?? '',
              );
            }
          }
        }
        for (const a2 of closureConstructs.filter(
          x => x.keyword === 'attribute_definition' && x.ident,
        )) {
          const vt = facetTokens(a2.items, 'value_type')[0];
          if (vt) {
            checkMapType(`attribute_definition ${a2.ident}`, '', vt);
          }
        }
        // C149 — closed-derivation-references-declared: a derivation
        // expression references only the declared universe.
        const declared = new Set<string>();
        for (const c2 of closureConstructs.filter(
          x => x.keyword === 'calculation' && x.ident,
        )) {
          declared.add(c2.ident!);
          const nm = facetTokens(c2.items, 'name')[0];
          if (nm) {
            declared.add(nm);
          }
          declared.add(facetTokens(c2.items, 'output')[0] ?? '');
          for (const i2 of nested(c2).filter(n => n.keyword === 'input')) {
            declared.add(i2.ident ?? '');
          }
        }
        for (const kw of [
          'table',
          'symbol',
          'variable',
          'attribute_definition',
          'enum',
          'class',
          'dimension',
        ]) {
          for (const c2 of closureConstructs.filter(
            x => x.keyword === kw && x.ident,
          )) {
            declared.add(c2.ident!);
          }
        }
        for (const inst of closureConstructs.filter(
          x => x.keyword === 'instrument' && x.ident,
        )) {
          for (const d2 of nested(inst).filter(
            n => n.keyword === 'dimension',
          )) {
            if (d2.ident) {
              declared.add(d2.ident);
            }
          }
        }
        declared.delete('');
        const CLOSED_STOP = new Set([
          'self',
          'p',
          'ocl',
          'true',
          'false',
          'null',
          'undefined',
          'and',
          'or',
          'not',
          'implies',
          'if',
          'then',
          'else',
          'endif',
          'xor',
          'let',
          'in',
          'exists',
          'forAll',
          'select',
          'reject',
          'collect',
          'isEmpty',
          'size',
          'sum',
          'min',
          'max',
          'abs',
          'round',
          'floor',
          'sqrt',
          'includes',
          'excludes',
          'includesAll',
          'excludesAll',
          'count',
          'first',
          'last',
          'asSet',
          'asOrderedSet',
          'asSequence',
          'asBag',
          'sortedBy',
          'iterate',
          'oclIsUndefined',
          'oclIsKindOf',
          'oclIsTypeOf',
          'allInstances',
          'lookup',
          'profile',
          'average',
          'mean',
          'div',
          'mod',
        ]);
        const PATH_RE =
          /\b[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)+/g;
        const IDENT_RE = /[A-Za-z_][A-Za-z0-9_]*/g;
        const checkDerivation = (
          expr: string,
          locals: Set<string>,
          where: string,
        ) => {
          if (!expr) {
            return;
          }
          const noLiterals = expr.replace(/'[^']*'/g, ' ');
          const noLambdas = noLiterals.replace(
            /\b([A-Za-z_][A-Za-z0-9_]*)\s*\|/g,
            ' ',
          );
          const stripped = noLambdas.replace(PATH_RE, ' ');
          const seen = new Set<string>();
          for (const raw of stripped.match(IDENT_RE) ?? []) {
            if (
              CLOSED_STOP.has(raw) ||
              locals.has(raw) ||
              seen.has(raw) ||
              /^[a-z][0-9]?$/.test(raw)
            ) {
              continue;
            }
            seen.add(raw);
            err(
              'C149',
              `${where}: expression references "${raw}", which no declared calculation, table, symbol, measurement, or attribute defines (closed-derivation-references-declared)`,
            );
          }
        };
        for (const a2 of closureConstructs.filter(
          x => x.keyword === 'attribute_definition' && x.ident,
        )) {
          const derived = facetTokens(a2.items, 'derived')[0];
          if (derived) {
            checkDerivation(
              derived,
              declared,
              `attribute_definition ${a2.ident}`,
            );
          }
        }
        for (const c2 of closureConstructs.filter(
          x => x.keyword === 'calculation' && x.ident,
        )) {
          const locals = new Set(declared);
          for (const i2 of nested(c2).filter(n => n.keyword === 'input')) {
            if (i2.ident) {
              locals.add(i2.ident);
            }
          }
          const expr = nested(c2)
            .filter(n => n.keyword === 'expression')
            .flatMap(n =>
              n.items.flatMap(i2 =>
                i2.kind === 'raw'
                  ? i2.tokens
                  : i2.kind === 'line'
                    ? [i2.key ?? '', ...i2.tokens]
                    : [],
              ),
            )
            .join(' ');
          if (expr.trim() !== '') {
            checkDerivation(expr, locals, `calculation ${c2.ident}`);
          }
        }
        // C152 — payload-typed-by-class: a dimension value's payload is
        // typed by its payload_class's declared fields.
        const normId = (x: string): string =>
          x.includes('#') ? x.slice(0, x.indexOf('#')) : x;
        const classFields = new Map<string, Set<string>>();
        for (const c2 of closureConstructs.filter(
          x => x.keyword === 'class' && x.ident,
        )) {
          const fields = new Set<string>();
          for (const f of nested(c2)) {
            if (f.keyword.endsWith(':')) {
              fields.add(f.keyword.slice(0, -1));
            }
          }
          classFields.set(normId(c2.ident!), fields);
        }
        const checkDim = (owner: string, d2: Construct) => {
          const pc = facetTokens(d2.items, 'payload_class')[0];
          if (!pc) {
            return;
          }
          const fields = classFields.get(normId(pc));
          if (!fields) {
            err(
              'C152',
              `${owner} dimension ${d2.ident}: payload_class "${pc}" is not a declared class (payload-typed-by-class)`,
            );
            return;
          }
          const values = nested(d2).find(n => n.keyword === 'values');
          for (const v of values ? nested(values) : []) {
            const payload = nested(v).find(n => n.keyword === 'payload');
            const keys = payload
              ? lines(payload)
                  .map(l => l.key!.replace(/:$/, ''))
                  .filter(k => k !== 'payload')
              : [];
            if (keys.length === 0) {
              err(
                'C152',
                `${owner} dimension ${d2.ident}: value ${v.ident} carries no payload — a value of a payload_class dimension IS its definition (payload-typed-by-class)`,
              );
              continue;
            }
            for (const key of keys) {
              if (!fields.has(key)) {
                err(
                  'C152',
                  `${owner} dimension ${d2.ident}: value ${v.ident} payload field "${key}" is not a field of class "${pc}" (payload-typed-by-class)`,
                );
              }
            }
          }
        };
        for (const inst of closureConstructs.filter(
          x => x.keyword === 'instrument' && x.ident,
        )) {
          for (const d2 of nested(inst).filter(
            n => n.keyword === 'dimension',
          )) {
            checkDim(`instrument ${inst.ident}`, d2);
          }
        }
        for (const d2 of closureConstructs.filter(
          x => x.keyword === 'dimension' && x.ident,
        )) {
          checkDim('top-level', d2);
        }
        for (const a2 of closureConstructs.filter(
          x => x.keyword === 'attribute_definition' && x.ident,
        )) {
          const classRef = facetTokens(a2.items, 'class')[0];
          if (classRef && !classFields.has(normId(classRef))) {
            err(
              'C152',
              `attribute_definition ${a2.ident}: class "${classRef}" is not a declared class (payload-typed-by-class)`,
            );
          }
        }
        // C167 — qualified-unit-reference: a datum's unit and quantity
        // kind use the closed <namespace>:<id> form.
        const QUALIFIED_REF = /^[a-z]+:[A-Za-z0-9_-]+$/;
        for (const d2 of closureConstructs.filter(
          x => x.keyword === 'datum' && x.ident,
        )) {
          for (const facet of ['unit', 'quantity_kind']) {
            const v = facetTokens(d2.items, facet)[0];
            if (v && !QUALIFIED_REF.test(v)) {
              err(
                'C167',
                `datum ${d2.ident}: ${facet} "${v}" is bare — a ${facet === 'unit' ? 'unit reference' : 'quantity-kind reference'} uses the qualified <namespace>:<id> form (si:…, unitsdb:…) (qualified-unit-reference)`,
              );
            }
          }
        }
      }
    }

    // ── the twins family: the twin interface (C60–C64), the monitors
    //     (C65–C70), the composition facet (C100–C102), and the
    //     probe-channel provenance (C99). Vocabulary is closed-data;
    //     the serve-aspect vocabulary resolves against the subject's
    //     own declared planes.
    {
      const OP_KINDS = new Set(['query', 'subscribe', 'invoke']);
      const SCOPES = new Set(['public', 'registered', 'authority']);
      const BUILTIN_PROFILES = new Set([
        'rest_json',
        'mqtt',
        'opc_ua',
        'file_drop',
      ]);
      const OUTCOMES = new Set(['pass', 'fail', 'indeterminate', 'invalid']);
      const ACTIONS = new Set([
        'notify',
        'flag_certificate',
        'open_service_case',
      ]);
      const STREAMS = ['evidence', 'verdicts'] as const;
      const REFSET_KINDS = new Set(['all', 'applicable_to', 'refs']);
      const STATE_RULES = new Set(['any_fault_else_analyzer']);
      const SHORTHAND = /^(\d+(?:\.\d+)?)(ms|min|s|h|d)$/;
      const ISODUR =
        /^P(?:(\d+(?:[.,]\d+)?)Y)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)D)?(?:T(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)S)?)?(?:(\d+(?:[.,]\d+)?)W)?$/;
      const parseWindow = (s: string | undefined): boolean => {
        if (!s) {
          return false;
        }
        const t = s.trim();
        if (SHORTHAND.test(t)) {
          return true;
        }
        const m = ISODUR.exec(t);
        return m !== null && m[1] === undefined && m[2] === undefined;
      };
      const norm = (x: string): string =>
        x.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const connectorProfiles = new Set([
        ...BUILTIN_PROFILES,
        ...closureConstructs
          .filter(x => x.keyword === 'connector_profile' && x.ident)
          .map(x => x.ident!),
      ]);
      const behaviorIds = new Set(
        closureConstructs
          .filter(x => x.keyword === 'behavior' && x.ident)
          .map(x => x.ident!),
      );
      const reqIds = new Set(
        closureConstructs
          .filter(x => x.keyword === 'requirement' && x.ident)
          .map(x => x.ident!),
      );
      const roleIds = new Set(
        closureConstructs
          .filter(x => x.keyword === 'role' && x.ident)
          .map(x => x.ident!),
      );
      const attrDefBy = new Map<string, Construct>();
      for (const c2 of closureConstructs.filter(
        x => x.keyword === 'attribute_definition' && x.ident,
      )) {
        attrDefBy.set(c2.ident!, c2);
      }
      const subjectIds2 = new Set(
        pkg.constructs
          .filter(x => x.keyword === 'subject' && x.ident)
          .map(x => x.ident!),
      );
      // One serve-aspect resolver: [level.]{parameters|classification|
      // test_context}.<key>, a bare declared plane name, state,
      // environmental_context.
      const TWIN_CHAIN_LEVELS = new Set(['family', 'group', 'model', 'sample']);
      const attrIds = new Set(
        closureConstructs
          .filter(x => x.keyword === 'attribute_definition' && x.ident)
          .map(x => x.ident!),
      );
      const packageHasOperationalMachine = closureConstructs.some(
        x =>
          x.keyword === 'state_machine' &&
          facetTokens(x.items, 'kind')[0] === 'operational',
      );
      // One serve-aspect resolver (the kernel's resolveServeAspect): an
      // optional chain-level prefix, then parameters/test_context/
      // classification/characteristics.<key>, a bare declared name, the
      // reserved state and environmental_context.
      const planeNames = (subj: Construct, planeName: string): Set<string> => {
        const names = new Set<string>();
        const has = nested(subj).find(n => n.keyword === 'has');
        const plane = has
          ? nested(has).find(n => n.keyword === planeName)
          : undefined;
        if (!plane) {
          return names;
        }
        for (const l of lines(plane)) {
          if (l.key !== planeName) {
            names.add(l.key!);
          } else {
            const t = l.tokens;
            for (let k = 0; k < t.length; k++) {
              if (t[k] === 'in' || t[k] === '=') {
                continue;
              }
              if (t[k + 1] === 'in' || t[k + 1] === '=' || k === t.length - 1) {
                names.add(t[k]!.split(':')[0]!);
              }
            }
          }
          for (const n2 of nested(plane)) {
            names.add(n2.ident || n2.keyword);
          }
        }
        return names;
      };
      const subjectHasState = (subj: Construct): boolean => {
        const has = nested(subj).find(n => n.keyword === 'has');
        return has !== undefined && lines(has).some(l => l.key === 'state');
      };
      const resolvesAspect = (name: string, subj: Construct): boolean => {
        const parts = name.split('.');
        const rest =
          parts.length > 1 && TWIN_CHAIN_LEVELS.has(parts[0]!)
            ? parts.slice(1).join('.')
            : name;
        if (rest === 'state') {
          return subjectHasState(subj) || packageHasOperationalMachine;
        }
        if (rest === 'environmental_context') {
          return true;
        }
        const chars = planeNames(subj, 'characteristics');
        const dims = new Set([
          ...planeNames(subj, 'dimensions'),
          ...planeNames(subj, 'classification'),
        ]);
        const segs = rest.split('.');
        if (segs.length === 2) {
          const [area, key] = segs;
          if (area === 'parameters' || area === 'test_context') {
            return attrIds.has(key);
          }
          if (area === 'classification') {
            return dims.has(key);
          }
          if (area === 'characteristics') {
            return chars.has(key);
          }
          return false;
        }
        if (segs.length === 1 && rest !== '') {
          return attrIds.has(rest) || chars.has(rest) || dims.has(rest);
        }
        return false;
      };
      const rawTokens = (c2: Construct): string[] =>
        c2.items.flatMap(i2 =>
          i2.kind === 'raw'
            ? i2.tokens
            : i2.kind === 'line'
              ? [i2.key!, ...i2.tokens]
              : [],
        );
      for (const subj of pkg.constructs.filter(
        x => x.keyword === 'subject' && x.ident,
      )) {
        const sid = subj.ident!;
        const isB = nested(subj).find(n => n.keyword === 'is');
        const has = nested(subj).find(n => n.keyword === 'has');
        type Op = {
          name: string;
          kind: string;
          serves: string[];
          does: string[];
          payload?: { qk?: string; unit?: string; ts?: string };
        };
        const readPayloadLines = (ls: string[][]): Op['payload'] => {
          const out: { qk?: string; unit?: string; ts?: string } = {};
          for (const t of ls) {
            for (let k = 0; k < t.length; k++) {
              if (t[k] === 'quantity_kind') {
                out.qk = t[++k];
              } else if (t[k] === 'unit') {
                out.unit = t[++k];
              } else if (t[k] === 'timestamp') {
                out.ts = t[++k];
              }
            }
          }
          return out;
        };
        const blockTokenLists = (blk: readonly Item[]): string[][] =>
          blk.map(it =>
            it.kind === 'line'
              ? [it.key!, ...it.tokens]
              : it.kind === 'raw'
                ? [...it.tokens]
                : [],
          );
        const readOp = (oc: Construct): Op => {
          const op: Op = {
            name: oc.ident ?? '',
            kind: '',
            serves: [],
            does: [],
          };
          for (const i of oc.items) {
            if (i.kind === 'construct' && i.construct) {
              if (i.construct.keyword === 'payload') {
                op.payload = readPayloadLines(
                  blockTokenLists(i.construct.items),
                );
              } else if (i.construct.keyword === 'serves') {
                op.serves.push(
                  ...rawTokens(i.construct).map(t2 => t2.replace(/,$/, '')),
                );
              } else if (i.construct.keyword === 'does') {
                op.does.push(
                  ...rawTokens(i.construct).map(t2 => t2.replace(/,$/, '')),
                );
              }
              continue;
            }
            if (i.kind !== 'line') {
              continue;
            }
            const t = [i.key!, ...i.tokens];
            const blocks = i.blocks ?? [];
            let bi = 0;
            for (let k = 0; k < t.length; k++) {
              const w = t[k];
              if (w === 'kind') {
                op.kind = t[++k] ?? '';
              } else if (w === 'serves' || w === 'does') {
                const names: string[] = [];
                if (bi < blocks.length) {
                  for (const lt of blockTokenLists(blocks[bi++]!)) {
                    names.push(...lt.map(x => x.replace(/,$/, '')));
                  }
                } else {
                  while (
                    k + 1 < t.length &&
                    !['kind', 'serves', 'does', 'payload'].includes(t[k + 1]!)
                  ) {
                    k++;
                    names.push(t[k]!.replace(/,$/, ''));
                  }
                }
                (w === 'serves' ? op.serves : op.does).push(...names);
              } else if (w === 'payload') {
                if (bi < blocks.length) {
                  op.payload = readPayloadLines(blockTokenLists(blocks[bi++]!));
                }
              }
            }
          }
          return op;
        };
        const endpoints: {
          id: string;
          ops: Op[];
          access: Construct[];
          profile?: string;
        }[] = [];
        for (const ep of isB
          ? nested(isB).filter(n => n.keyword === 'endpoint')
          : []) {
          const ops = nested(ep)
            .filter(n => n.keyword === 'operation')
            .map(readOp);
          const access = nested(ep).filter(n => n.keyword === 'access');
          endpoints.push({
            id: ep.ident ?? '',
            ops,
            access: access.flatMap(a => nested(a)),
            profile: facetTokens(ep.items, 'profile')[0],
          });
        }
        for (const ep of endpoints) {
          // C64 — endpoint-profile-resolves
          if (!ep.profile) {
            err(
              'C64',
              `subject ${sid}: endpoint ${ep.id} declares no connector profile — the model is protocol-neutral; profiles bind protocols (endpoint-profile-resolves)`,
            );
          } else if (!connectorProfiles.has(ep.profile)) {
            err(
              'C64',
              `subject ${sid}: endpoint ${ep.id} profile "${ep.profile}" is not a declared connector_profile nor a built-in (endpoint-profile-resolves)`,
            );
          }
          const opNames = new Set(ep.ops.map(o => o.name));
          const coverage = new Map<string, number>();
          for (const scope of ep.access) {
            // C62 — the scope vocabulary + coverage
            if (!SCOPES.has(scope.keyword)) {
              err(
                'C62',
                `subject ${sid}: endpoint ${ep.id} access scope "${scope.keyword}" is not one of public | registered | authority (access-scope-covers-serves)`,
              );
            }
            for (const name of rawTokens(scope)) {
              if (!opNames.has(name)) {
                err(
                  'C62',
                  `subject ${sid}: endpoint ${ep.id} access ${scope.keyword} names "${name}", which is not a declared operation of the endpoint (access-scope-covers-serves)`,
                );
              }
              coverage.set(name, (coverage.get(name) ?? 0) + 1);
            }
          }
          for (const op of ep.ops) {
            // C61 — payload-schema-quantity
            if (!OP_KINDS.has(op.kind)) {
              err(
                'C61',
                `subject ${sid}: endpoint ${ep.id} operation ${op.name} kind "${op.kind || '(none)'}" is not one of query | subscribe | invoke (payload-schema-quantity)`,
              );
            }
            if (!op.payload) {
              err(
                'C61',
                `subject ${sid}: endpoint ${ep.id} operation ${op.name} declares no payload schema — every endpoint operation has a payload schema (QuantityValue with timestamp, §14.12) (payload-schema-quantity)`,
              );
            } else {
              if (!op.payload.qk) {
                err(
                  'C61',
                  `subject ${sid}: endpoint ${ep.id} operation ${op.name} payload names no quantity_kind — INV-1: no bare numbers (payload-schema-quantity)`,
                );
              }
              if (!op.payload.unit) {
                err(
                  'C61',
                  `subject ${sid}: endpoint ${ep.id} operation ${op.name} payload names no unit — a QuantityValue always carries a unit (payload-schema-quantity)`,
                );
              }
              if (op.payload.ts !== 'true') {
                err(
                  'C61',
                  `subject ${sid}: endpoint ${ep.id} operation ${op.name} payload does not declare timestamp true — a value without a time is not evidence (§14.3) (payload-schema-quantity)`,
                );
              }
            }
            // C60 — the operation's own targets resolve
            for (const name of op.serves) {
              if (!resolvesAspect(name, subj)) {
                err(
                  'C60',
                  `subject ${sid}: endpoint ${ep.id} operation ${op.name} serves "${name}", which is not a declared aspect of the subject (serve-targets-resolve)`,
                );
              }
            }
            for (const name of op.does) {
              if (!behaviorIds.has(name)) {
                err(
                  'C60',
                  `subject ${sid}: endpoint ${ep.id} operation ${op.name} does "${name}", which is not a declared behavior (serve-targets-resolve)`,
                );
              }
            }
            // C62 — exactly one scope per operation
            const n = coverage.get(op.name) ?? 0;
            if (n === 0) {
              err(
                'C62',
                `subject ${sid}: endpoint ${ep.id} operation ${op.name} has no access scope — every endpoint operation has an access scope (§14.12) (access-scope-covers-serves)`,
              );
            } else if (n > 1) {
              err(
                'C62',
                `subject ${sid}: endpoint ${ep.id} operation ${op.name} is covered by ${n} access scopes — exactly one scope per operation (access-scope-covers-serves)`,
              );
            }
          }
        }
        // The subject's whole API surface, for the serve bindings.
        const operations = new Map<string, Op[]>();
        for (const ep of endpoints) {
          for (const op of ep.ops) {
            const list = operations.get(op.name) ?? [];
            list.push(op);
            operations.set(op.name, list);
          }
        }
        // C60/C63 — the serve bindings.
        for (const l of has ? lines(has).filter(x => x.key === 'serve') : []) {
          const aspect = l.tokens[0];
          const viaIx = l.tokens.indexOf('via');
          const via = viaIx !== -1 ? l.tokens[viaIx + 1] : undefined;
          if (!aspect || !via) {
            continue;
          }
          if (!resolvesAspect(aspect, subj)) {
            err(
              'C60',
              `subject ${sid}: serve "${aspect}" does not resolve to a declared aspect of the subject ([level.]{parameters|classification|test_context}.<key>, a bare attribute/characteristic/dimension name, state, environmental_context) (serve-targets-resolve)`,
            );
          }
          const owners = operations.get(via) ?? [];
          if (owners.length === 0) {
            err(
              'C60',
              `subject ${sid}: serve "${aspect}" via "${via}" names no declared operation of the subject's endpoints (serve-targets-resolve)`,
            );
          } else if (owners.length > 1) {
            err(
              'C60',
              `subject ${sid}: serve "${aspect}" via "${via}" is ambiguous — the operation is declared on ${owners.length} endpoints (serve-targets-resolve)`,
            );
          } else {
            const op = owners[0]!;
            if (op.kind === 'invoke') {
              err(
                'C60',
                `subject ${sid}: serve "${aspect}" via "${via}" targets an invoke operation — invoke triggers a process; a serve binding binds a value channel (query | subscribe) (serve-targets-resolve)`,
              );
            }
            const aspectKey = aspect.split('.').pop()!;
            const def = attrDefBy.get(aspectKey);
            const defUnit = def ? facetTokens(def.items, 'unit')[0] : undefined;
            const defQk = def
              ? facetTokens(def.items, 'quantity_kind')[0]
              : undefined;
            const pu = op.payload?.unit;
            const pk = op.payload?.qk;
            if (defUnit && pu && defUnit !== pu) {
              err(
                'C60',
                `subject ${sid}: serve "${aspect}" unit "${defUnit}" ≠ operation ${via} payload unit "${pu}" — unit coherence between aspect and payload is required (§14.12) (serve-targets-resolve)`,
              );
            }
            if (defQk && pk && defQk !== pk) {
              err(
                'C60',
                `subject ${sid}: serve "${aspect}" quantity kind "${defQk}" ≠ operation ${via} payload quantity kind "${pk}" (serve-targets-resolve)`,
              );
            }
          }
          // C63 — freshness-required-on-live-bindings
          const fw = l.blocks
            .flat()
            .find(
              b =>
                b.kind === 'line' &&
                (b as { key?: string }).key === 'fresh_within',
            ) as { tokens: string[] } | undefined;
          if (!fw) {
            err(
              'C63',
              `subject ${sid}: serve "${aspect}" via "${via}" declares no fresh_within — a live binding without a freshness window is an error (§14.12: no stale semantics, no live binding) (freshness-required-on-live-bindings)`,
            );
          } else if (!parseWindow(fw.tokens[0])) {
            err(
              'C63',
              `subject ${sid}: serve "${aspect}" fresh_within "${fw.tokens[0] ?? ''}" is not a parseable freshness window (shorthand 500ms/5s/1min/1h/1d or ISO 8601 with fixed-length components, e.g. PT5S) (freshness-required-on-live-bindings)`,
            );
          }
        }
        // C100–C102 — the composition facet.
        const composed = isB
          ? nested(isB).find(n => n.keyword === 'composed_of')
          : undefined;
        if (composed) {
          const components = nested(composed).filter(
            n => n.keyword === 'component',
          );
          const componentIds = new Set(components.map(c2 => c2.ident ?? ''));
          for (const c2 of components) {
            const product = facetTokens(c2.items, 'product')[0];
            const endpoint = facetTokens(c2.items, 'endpoint')[0];
            if (product && product.includes('/')) {
              const sub = product
                .slice(product.indexOf('/') + 1)
                .split('@')[0]!;
              if (![...subjectIds2].some(x => norm(x) === norm(sub))) {
                err(
                  'C100',
                  `subject ${sid}: composed_of component ${c2.ident} product "${product}" names no subject of this package (composition-components-resolve)`,
                );
              }
            }
            if (!endpoint) {
              err(
                'C100',
                `subject ${sid}: composed_of component ${c2.ident} declares no endpoint — the component's projection must serve on a named endpoint (composition-components-resolve)`,
              );
            }
          }
          const dec = nested(composed).find(n => n.keyword === 'decomposition');
          const covered = new Map<string, number>();
          if (dec) {
            // One entry per `->`: <register> -> <component>[.<aspect>]
            // | rule <rule-id> (the composite state rule; the kernel's
            // line grammar, glued runs included).
            for (const l of lines(dec)) {
              const t = [l.key!, ...l.tokens];
              const arrows: number[] = [];
              for (let i = 0; i < t.length; i++) {
                if (t[i] === '->' && i > 0) {
                  arrows.push(i);
                }
              }
              for (let a = 0; a < arrows.length; a++) {
                const m = arrows[a]!;
                const register = t[m - 1]!;
                const stop = a + 1 < arrows.length ? arrows[a + 1]! : t.length;
                const rest = t.slice(m + 1, stop);
                let component = '';
                let rule: string | undefined;
                if (rest[0] === 'composite' && rest[1] === 'rule') {
                  component = 'composite';
                  rule = rest[2];
                } else if (rest[0] === 'rule') {
                  component = 'composite';
                  rule = rest[1];
                } else {
                  component = (rest[0] ?? '').split('.')[0]!;
                }
                covered.set(register, (covered.get(register) ?? 0) + 1);
                if (component !== 'composite' && !componentIds.has(component)) {
                  err(
                    'C100',
                    `subject ${sid}: decomposition ${register} names undeclared component "${component}" (composition-components-resolve)`,
                  );
                }
                if (component === 'composite' && !STATE_RULES.has(rule ?? '')) {
                  err(
                    'C102',
                    `subject ${sid}: decomposition ${register} declares unknown composite state rule "${rule ?? '(none)'}" — the vocabulary is closed (composition-state-rule-closed)`,
                  );
                }
              }
            }
          }
          for (const l of has
            ? lines(has).filter(x => x.key === 'serve')
            : []) {
            const aspect = l.tokens[0];
            if (aspect && (covered.get(aspect) ?? 0) !== 1) {
              err(
                'C101',
                `subject ${sid}: serve "${aspect}" is covered ${covered.get(aspect) ?? 0} times by the decomposition — every served register decomposes exactly once (composition-decomposition-covers)`,
              );
            }
          }
        }
      }
      // ── C65–C70 — the monitors.
      for (const m of pkg.constructs.filter(
        x => x.keyword === 'monitor' && x.ident,
      )) {
        const mid = m.ident!;
        const overNames = [
          ...lines(m)
            .filter(l => l.key === 'over')
            .flatMap(l => l.tokens),
          ...nested(m)
            .filter(n => n.keyword === 'over')
            .flatMap(n => rawTokens(n)),
        ];
        const watched = overNames.filter(n => subjectIds2.has(n));
        // C65 — monitor-subject-resolves
        if (overNames.length === 0) {
          err(
            'C65',
            `monitor ${mid}: declares no subject set — a monitor watches a subject set (over { … }) (monitor-subject-resolves)`,
          );
        }
        for (const ref of overNames) {
          if (!subjectIds2.has(ref)) {
            err(
              'C65',
              `monitor ${mid}: over "${ref}" is not a declared subject (monitor-subject-resolves)`,
            );
          }
        }
        // C66 — monitor-trigger-wellformed
        const triggerRuns: string[][] = nested(m)
          .filter(n => n.keyword === 'triggers')
          .flatMap(n => lines(n).map(l => [l.key!, ...l.tokens]));
        if (triggerRuns.length === 0) {
          err(
            'C66',
            `monitor ${mid}: declares no triggers — without triggers, "continuous" has no clock (§14.5 step 1) (monitor-trigger-wellformed)`,
          );
        }
        for (const t of triggerRuns) {
          for (let i = 0; i < t.length; i++) {
            if (t[i] === 'every') {
              const w = t[i + 1];
              if (!parseWindow(w)) {
                err(
                  'C66',
                  `monitor ${mid}: timer trigger every "${w ?? '(none)'}" is not a parseable window (monitor-trigger-wellformed)`,
                );
              }
              i += 1;
            } else if (t[i] === 'on' && t[i + 1] === 'signal') {
              if (!t[i + 2]) {
                err(
                  'C66',
                  `monitor ${mid}: signal trigger names no signal (on signal <name>) (monitor-trigger-wellformed)`,
                );
              }
              i += 2;
            } else if (t[i] === 'on' && t[i + 1] === 'change') {
              const aspect = t[i + 2];
              if (!aspect) {
                err(
                  'C66',
                  `monitor ${mid}: change trigger names no aspect (on change <aspect>) (monitor-trigger-wellformed)`,
                );
              } else if (
                watched.length > 0 &&
                !watched.some(n => {
                  const subj = pkg.constructs.find(
                    x => x.keyword === 'subject' && x.ident === n,
                  );
                  return subj !== undefined && resolvesAspect(aspect, subj);
                })
              ) {
                err(
                  'C66',
                  `monitor ${mid}: change trigger aspect "${aspect}" does not resolve against any monitored subject (monitor-trigger-wellformed)`,
                );
              }
              i += 2;
            } else if (
              t[i] !== 'on' &&
              t[i] !== 'signal' &&
              t[i] !== 'change'
            ) {
              err(
                'C66',
                `monitor ${mid}: trigger kind "${t[i]}" is not one of timer (every) | signal (on signal) | change (on change) (monitor-trigger-wellformed)`,
              );
            }
          }
        }
        // C67 — monitor-evaluate-resolves
        const readRefSet = (
          label: string,
        ): { kind?: string; refs: string[]; expression?: string } | null => {
          const block = nested(m).find(n => n.keyword === 'evaluate');
          if (!block) {
            return null;
          }
          const inner = nested(block).find(n => n.keyword === label);
          if (inner) {
            return { kind: 'refs', refs: rawTokens(inner) };
          }
          const l = lines(block).find(x => x.key === label);
          if (!l) {
            return null;
          }
          const kind = l.tokens[0];
          if (kind === 'applicable_to') {
            return {
              kind: 'applicable_to',
              refs: [],
              expression: l.tokens.slice(1).join(' '),
            };
          }
          if (kind === 'all') {
            return { kind: 'all', refs: [] };
          }
          return { kind, refs: [] };
        };
        const watchedSubjects = pkg.constructs.filter(
          x => x.keyword === 'subject' && watched.includes(x.ident ?? ''),
        );
        const promiseIds2 = new Set(
          watchedSubjects
            .map(s2 => {
              const isB2 = nested(s2).find(n => n.keyword === 'is');
              return isB2
                ? nested(isB2)
                    .filter(n => n.keyword === 'promises')
                    .flatMap(n => nested(n))
                    .map(n => n.ident || n.keyword)
                : [];
            })
            .flat()
            .filter(x => x !== ''),
        );
        const checkRefSet = (
          label: string,
          set: { kind?: string; refs: string[]; expression?: string } | null,
          resolveRef: (r: string) => boolean,
          refKind: string,
        ): void => {
          if (!set || !set.kind) {
            err(
              'C67',
              `monitor ${mid}: evaluate names no ${label} selector (all | applicable_to(…) | { refs… }) — a monitor judges something (monitor-evaluate-resolves)`,
            );
            return;
          }
          if (!REFSET_KINDS.has(set.kind)) {
            err(
              'C67',
              `monitor ${mid}: ${label} selector "${set.kind}" is not one of all | applicable_to(…) | { refs… } (monitor-evaluate-resolves)`,
            );
            return;
          }
          if (set.kind === 'applicable_to' && !set.expression) {
            err(
              'C67',
              `monitor ${mid}: ${label} applicable_to() carries no applicability expression (monitor-evaluate-resolves)`,
            );
          }
          if (set.kind === 'refs') {
            if (set.refs.length === 0) {
              err(
                'C67',
                `monitor ${mid}: ${label} selector { } names no refs (monitor-evaluate-resolves)`,
              );
            }
            for (const ref of set.refs) {
              if (!resolveRef(ref)) {
                err(
                  'C67',
                  `monitor ${mid}: evaluate ${label} ref "${ref}" is not a declared ${refKind} (monitor-evaluate-resolves)`,
                );
              }
            }
          }
        };
        checkRefSet(
          'requirements',
          readRefSet('requirements'),
          r => reqIds.has(r),
          'requirement',
        );
        checkRefSet(
          'promises',
          readRefSet('promises'),
          r => promiseIds2.has(r),
          'promise of the monitored subjects',
        );
        // C68/C69 — escalation.
        const esc = nested(m).filter(n => n.keyword === 'escalate');
        const rulesEsc = esc.flatMap(e =>
          nested(e).filter(n => n.keyword === 'on'),
        );
        if (!rulesEsc.some(r => r.ident === 'fail')) {
          issues.push({
            rule: 'C68',
            severity: 'warning',
            message: `monitor ${mid}: declares no escalation path for fail — §14.12: a monitor without an escalation path for fail is a warning (monitor-fail-escalation)`,
          });
        }
        for (const r of rulesEsc) {
          if (!OUTCOMES.has(r.ident ?? '')) {
            err(
              'C69',
              `monitor ${mid}: escalate on "${r.ident || '(none)'}" — the outcome is not one of pass | fail | indeterminate | invalid (monitor-escalation-resolves)`,
            );
          }
          const toks = rawTokens(r);
          if (toks.length === 0) {
            err(
              'C69',
              `monitor ${mid}: escalate on ${r.ident || '(none)'} names no actions (monitor-escalation-resolves)`,
            );
          }
          for (let i = 0; i < toks.length; i++) {
            const a = toks[i]!;
            if (!ACTIONS.has(a)) {
              err(
                'C69',
                `monitor ${mid}: escalate on ${r.ident} action "${a}" is not one of notify | flag_certificate | open_service_case (monitor-escalation-resolves)`,
              );
              continue;
            }
            if (a === 'notify') {
              const role = toks[i + 1];
              i += 1;
              if (!role) {
                err(
                  'C69',
                  `monitor ${mid}: escalate on ${r.ident} notify names no role (notify <role>) (monitor-escalation-resolves)`,
                );
              } else if (roleIds.size > 0 && !roleIds.has(role)) {
                err(
                  'C69',
                  `monitor ${mid}: escalate on ${r.ident} notify "${role}" is not a declared role (monitor-escalation-resolves)`,
                );
              }
            }
          }
        }
        // C70 — monitor-emit-sinks
        const emitted = new Map<string, number>();
        for (const l of nested(m)
          .filter(n => n.keyword === 'emit')
          .flatMap(n => lines(n))) {
          const t = [l.key!, ...l.tokens];
          for (let i = 0; i < t.length; i++) {
            if (t[i] !== '->' || i === 0) {
              continue;
            }
            const stream = t[i - 1]!;
            const target = t[i + 1] ?? '';
            i += 1;
            if (!(STREAMS as readonly string[]).includes(stream)) {
              err(
                'C70',
                `monitor ${mid}: emit stream "${stream}" is not one of evidence | verdicts (monitor-emit-sinks)`,
              );
            }
            if (!target) {
              err(
                'C70',
                `monitor ${mid}: emit ${stream} names no sink (${stream} -> <sink>) (monitor-emit-sinks)`,
              );
            }
            emitted.set(stream, (emitted.get(stream) ?? 0) + 1);
          }
        }
        for (const stream of STREAMS) {
          const n = emitted.get(stream) ?? 0;
          if (n === 0) {
            err(
              'C70',
              `monitor ${mid}: emit declares no ${stream} sink — §14.5 step 6: values seen, rule results, verdicts, timestamps are appended to the workspace (monitor-emit-sinks)`,
            );
          } else if (n > 1) {
            err(
              'C70',
              `monitor ${mid}: emit declares the ${stream} stream ${n} times — one sink per stream (monitor-emit-sinks)`,
            );
          }
        }
      }
      // ── C99 — the probe-channel provenance.
      const PROBE_CHANNELS = new Set([
        'reference_instrument',
        'observer_attestation',
        'sim_ground_truth',
      ]);
      for (const t of pkg.constructs.filter(
        x => x.keyword === 'conformance_test' && x.ident,
      )) {
        const variables = nested(t).filter(n => n.keyword === 'variable');
        const variableNames = new Set(variables.map(v => v.ident ?? ''));
        for (const v of variables) {
          const prov = nested(v).find(n => n.keyword === 'provenance');
          if (!prov) {
            continue;
          }
          const channel = facetTokens(prov.items, 'channel')[0] ?? '';
          const ref = facetTokens(prov.items, 'ref')[0] ?? '';
          const observedAt = facetTokens(prov.items, 'observed_at')[0] ?? '';
          const limitation = facetTokens(prov.items, 'limitation')[0] ?? '';
          const vname = v.ident ?? '';
          if (!PROBE_CHANNELS.has(channel)) {
            err(
              'C99',
              `conformance test ${t.ident}: variable "${vname}" declares provenance channel "${channel}" — the probe channel is one of reference_instrument | observer_attestation | sim_ground_truth (variable-provenance-channel)`,
            );
          }
          if (ref === '') {
            err(
              'C99',
              `conformance test ${t.ident}: variable "${vname}" declares channel "${channel}" but cites no ref — the channel's register entry is the provenance's substance (variable-provenance-channel)`,
            );
          }
          if (observedAt === '') {
            err(
              'C99',
              `conformance test ${t.ident}: variable "${vname}" declares no observed_at binding — a channel reading without its observation timestamp cannot be paired (variable-provenance-channel)`,
            );
          } else if (!variableNames.has(observedAt)) {
            err(
              'C99',
              `conformance test ${t.ident}: variable "${vname}" binds observed_at to "${observedAt}", which names no declared variable of the test (variable-provenance-channel)`,
            );
          }
          if (channel === 'observer_attestation' && limitation === '') {
            err(
              'C99',
              `conformance test ${t.ident}: variable "${vname}" declares the observer_attestation channel without its traceability limitation — attestation-only evidence proves "twin ≡ display", not "twin ≡ mass" (variable-provenance-channel)`,
            );
          }
          if (channel !== 'observer_attestation' && limitation !== '') {
            issues.push({
              rule: 'C99',
              severity: 'warning',
              message: `conformance test ${t.ident}: variable "${vname}" carries a traceability limitation on the ${channel} channel — the limitation declaration rides the observer_attestation channel (variable-provenance-channel)`,
            });
          }
          const src = facetTokens(v.items, 'source')[0];
          if (src !== undefined && src !== '' && src !== 'measured') {
            issues.push({
              rule: 'C99',
              severity: 'warning',
              message: `conformance test ${t.ident}: variable "${vname}" is source ${src} but declares a physical probe channel — the channel provenance belongs to a measured reference reading (variable-provenance-channel)`,
            });
          }
        }
      }
    }

    // ── C41 precondition-on-violation-known: the only known outcome is
    //     `invalid` — a violated run-validity precondition VOIDS the run
    //     (doctrine ch. 04 §4.5); anything else warns, and a state gate
    //     declared `fail` always names the doctrine.
    for (const kw of ['process', 'conformance_test']) {
      for (const owner of pkg.constructs.filter(
        x => x.keyword === kw && x.ident,
      )) {
        for (const pc of nested(owner).filter(
          n => n.keyword === 'precondition',
        )) {
          const ov = facetTokens(pc.items, 'on_violation')[0];
          if (!ov || ov === 'invalid') {
            continue;
          }
          const checkLine = pc.items.find(
            i2 => i2.kind === 'line' && i2.key === 'check',
          );
          const checkText = checkLine
            ? (checkLine.blocks ?? [])
                .flat()
                .map(b =>
                  b.kind === 'raw'
                    ? b.tokens.join(' ')
                    : b.kind === 'line'
                      ? [b.key ?? '', ...b.tokens].join(' ')
                      : '',
                )
                .join(' ')
            : '';
          const gatesState =
            /\bself\.state\s*(<>|!=|==|=)\s*#([A-Za-z_][A-Za-z0-9_]*)/g;
          const hasStateGate = [...checkText.matchAll(gatesState)].length > 0;
          if (ov === 'fail' && hasStateGate) {
            issues.push({
              rule: 'C41',
              severity: 'warning',
              message: `${kw} ${owner.ident}: precondition "${pc.ident}" declares on_violation fail — a violated run-validity precondition VOIDS the run (invalid); it never fails the instrument (doctrine ch. 04 §4.5) (precondition-on-violation-known)`,
            });
          } else {
            issues.push({
              rule: 'C41',
              severity: 'warning',
              message: `${kw} ${owner.ident}: precondition "${pc.ident}" declares on_violation "${ov}" — the only known outcome is "invalid" (precondition-on-violation-known)`,
            });
          }
        }
      }
    }

    // ── Batch A: the shapes/vocabulary family. C154 the deprecation
    //     inventory, C90/C91 invariants, C92/C93 test sequences, C147/
    //     C148 the executable test programs, C89 the
    //     spelling codes, C158 prose-quarantine, C159 urn-only-refs,
    //     C161 check-surface, C84 the when-guard-is-a-predicate shape.
    {
      // C154 — construct-deprecated: the kernel arms deprecations as
      // data on the construct registry; the mirror holds the same
      // inventory. Empty today (condition_set's arm retired with its
      // parse support in 1.21.20); the provenance-spelling arms of the
      // retirement wave land here.
      const DEPRECATED_CONSTRUCTS: Record<string, string> = {};
      for (const c2 of pkg.constructs) {
        const note = DEPRECATED_CONSTRUCTS[c2.keyword];
        if (note) {
          issues.push({
            rule: 'C154',
            severity: 'warning',
            message: `construct "${c2.keyword}" is deprecated: ${note} (construct-deprecated)`,
          });
        }
      }
      // C90/C91 — the invariants.
      const CLAIM_GRAMMAR = [
        /^kernel:C\d+$/,
        /^linker:[a-z0-9-]+$/,
        /^gate:[a-z0-9-]+$/,
      ];
      for (const inv of closureConstructs.filter(
        x => x.keyword === 'invariant' && x.ident,
      )) {
        const name = facetTokens(inv.items, 'name')[0];
        const statement = facetTokens(inv.items, 'statement')[0];
        const severity = facetTokens(inv.items, 'severity')[0];
        if (!name) {
          err(
            'C90',
            `invariant ${inv.ident}: declares no name — an invariant carries a short rule name (invariant-shape)`,
          );
        }
        if (!statement) {
          err(
            'C90',
            `invariant ${inv.ident}: declares no statement — an invariant carries the rule's prose (invariant-shape)`,
          );
        }
        if (!severity) {
          err(
            'C90',
            `invariant ${inv.ident}: declares no severity (invariant-shape)`,
          );
        }
        // The kernel's surface rule: a braced enforcement value is a
        // CLAIMS LIST (`{ aspirational }` is the marker INSIDE a list,
        // C91's flag); the bare `enforcement aspirational` line is the
        // marker.
        const enfc = nested(inv).find(n => n.keyword === 'enforcement');
        const enfcLine = lines(inv).find(l => l.key === 'enforcement');
        let aspirational = false;
        let claims: string[] = [];
        if (enfc) {
          for (const i2 of enfc.items) {
            if (i2.kind === 'raw') {
              claims.push(...i2.tokens);
            } else if (i2.kind === 'line') {
              claims.push(i2.key ?? '', ...i2.tokens);
            }
          }
          claims = claims.filter(x => x !== '');
        } else if (enfcLine) {
          if (enfcLine.tokens[0] === 'aspirational') {
            aspirational = true;
          } else {
            claims.push(...enfcLine.tokens);
          }
        }
        if (!aspirational && claims.length === 0) {
          err(
            'C90',
            `invariant ${inv.ident}: declares no enforcement — a non-empty claim list (enforcement { kernel:C<n> … }) or the literal marker (enforcement aspirational) (invariant-shape)`,
          );
        }
        if (aspirational && claims.length > 0) {
          err(
            'C90',
            `invariant ${inv.ident}: enforcement mixes the aspirational marker with ${claims.length} claim(s) — one or the other, never both (invariant-shape)`,
          );
        }
        for (const claim of claims) {
          if (claim === 'aspirational') {
            err(
              'C91',
              `invariant ${inv.ident}: the aspirational marker never appears inside a claims list — spell it bare (enforcement aspirational) (invariant-enforcement-grammar)`,
            );
          } else if (!CLAIM_GRAMMAR.some(re => re.test(claim))) {
            err(
              'C91',
              `invariant ${inv.ident}: enforcement claim "${claim}" does not match kernel:C<n> | linker:<kebab-name> | gate:<kebab-name> (invariant-enforcement-grammar)`,
            );
          }
        }
      }
      // C92/C93 — the test sequences.
      const STEP_ROLES = new Set(['baseline', 'follow_up']);
      for (const seq of closureConstructs.filter(
        x => x.keyword === 'test_sequence' && x.ident,
      )) {
        const name = facetTokens(seq.items, 'name')[0];
        const description = facetTokens(seq.items, 'description')[0];
        const steps = nested(seq).filter(n => n.keyword === 'step');
        if (!name) {
          err(
            'C92',
            `test_sequence ${seq.ident}: declares no name — a test sequence carries a short name (test-sequence-shape)`,
          );
        }
        if (!description) {
          err(
            'C92',
            `test_sequence ${seq.ident}: declares no description — a test sequence carries the ordering's prose (test-sequence-shape)`,
          );
        }
        if (steps.length === 0) {
          err(
            'C92',
            `test_sequence ${seq.ident}: declares no steps — a test sequence is a non-empty ordered step list (test-sequence-shape)`,
          );
        }
        const orders = new Set<number>();
        for (const step of steps) {
          const orderNum =
            step.ident !== undefined &&
            step.ident !== '' &&
            /^\d+$/.test(step.ident)
              ? Number(step.ident)
              : null;
          const at = orderNum !== null ? `step ${orderNum}` : 'a step';
          if (orderNum === null || orderNum < 1) {
            err(
              'C92',
              `test_sequence ${seq.ident}: ${at} declares no positive-integer order — the step order is a positive integer (test-sequence-shape)`,
            );
          } else if (orders.has(orderNum)) {
            err(
              'C92',
              `test_sequence ${seq.ident}: step order ${orderNum} is declared twice — the order is unique within the sequence (test-sequence-shape)`,
            );
          } else {
            orders.add(orderNum);
          }
          const test = facetTokens(step.items, 'test')[0];
          const phase = facetTokens(step.items, 'phase')[0];
          if ((test === undefined) === (phase === undefined)) {
            err(
              'C92',
              `test_sequence ${seq.ident}: ${at} carries ${
                test === undefined
                  ? 'neither test nor phase'
                  : 'both test and phase'
              } — exactly one per step (test-sequence-shape)`,
            );
          }
          const role = facetTokens(step.items, 'role')[0];
          if (role !== undefined) {
            if (test === undefined) {
              err(
                'C92',
                `test_sequence ${seq.ident}: ${at} declares role "${role}" on ${
                  phase === undefined
                    ? 'a step carrying neither test nor phase'
                    : 'a phase step'
                } — the role is meaningful on test steps only (test-sequence-shape)`,
              );
            } else if (!STEP_ROLES.has(role)) {
              err(
                'C92',
                `test_sequence ${seq.ident}: ${at} declares role "${role}" — the vocabulary is baseline | follow_up (test-sequence-shape)`,
              );
            }
          }
          const dep = facetTokens(step.items, 'depends_on')[0];
          if (dep !== undefined && !/^\d+$/.test(dep)) {
            err(
              'C92',
              `test_sequence ${seq.ident}: ${at} declares depends_on ${dep} — the dependency is the integer order of an earlier step (test-sequence-shape)`,
            );
          }
          // C93 — the per-edge integrity.
          if (dep !== undefined && /^\d+$/.test(dep)) {
            const depN = Number(dep);
            if (orderNum !== null && depN === orderNum) {
              err(
                'C93',
                `test_sequence ${seq.ident}: ${at} depends on itself — depends_on names an EARLIER step (test-sequence-integrity)`,
              );
            } else if (!orders.has(depN)) {
              err(
                'C93',
                `test_sequence ${seq.ident}: ${at} depends_on ${depN} names no step of the sequence (test-sequence-integrity)`,
              );
            } else if (orderNum !== null && depN > orderNum) {
              err(
                'C93',
                `test_sequence ${seq.ident}: ${at} depends_on ${depN} names a LATER step — a forward reference; depends_on names an EARLIER step (test-sequence-integrity)`,
              );
            }
          }
        }
      }
      // C147/C148 — the executable test programs.
      const SHORTHAND = /^(\d+(?:\.\d+)?)(ms|min|s|h|d)$/;
      const ISODUR =
        /^P(?:(\d+(?:[.,]\d+)?)Y)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)D)?(?:T(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)S)?)?(?:(\d+(?:[.,]\d+)?)W)?$/;
      const parseWindow2 = (v: string | undefined): boolean => {
        if (!v) {
          return false;
        }
        const t2 = v.trim();
        if (SHORTHAND.test(t2)) {
          return true;
        }
        const m = ISODUR.exec(t2);
        return m !== null && m[1] === undefined && m[2] === undefined;
      };
      for (const ct of pkg.constructs.filter(
        x => x.keyword === 'conformance_test' && x.ident,
      )) {
        for (const progName of ['preparation', 'stimulus']) {
          const prog = nested(ct).find(n => n.keyword === progName);
          if (!prog) {
            continue;
          }
          const entries = nested(prog).filter(
            n => n.keyword === 'step' || n.keyword === 'point',
          );
          const orders = new Set<number>();
          for (const e of entries) {
            const isPoint = e.keyword === 'point';
            const noun = isPoint ? 'stimulus point' : 'preparation step';
            const orderNum =
              e.ident !== undefined && /^\d+$/.test(e.ident)
                ? Number(e.ident)
                : null;
            const at = orderNum !== null ? `${noun} ${orderNum}` : `a ${noun}`;
            if (orderNum === null || orderNum < 1) {
              err(
                'C147',
                `conformance_test ${ct.ident}: ${at} declares no positive-integer order — the order is a positive integer (test-program-shape)`,
              );
            } else if (orders.has(orderNum)) {
              err(
                'C147',
                `conformance_test ${ct.ident}: ${noun} order ${orderNum} is declared twice — the order is unique within the program (test-program-shape)`,
              );
            } else {
              orders.add(orderNum);
            }
            // The facets: glued tokens plus the brace groups riding the
            // line at `verify` / `args` (the verify block carries the
            // step's read+tolerance).
            let drive: string | undefined;
            let action: string | undefined;
            let acceptance: string | undefined;
            let verifyRead: string | undefined;
            let verifyTolerance: string | undefined;
            let hasVerify = false;
            let hold: string | undefined;
            let freshWithin: string | undefined;
            for (const i2 of e.items) {
              if (i2.kind !== 'line') {
                continue;
              }
              const t2 = [i2.key ?? '', ...i2.tokens];
              const blocks = i2.blocks ?? [];
              let bi = 0;
              for (let k = 0; k < t2.length; k++) {
                const w = t2[k];
                if (w === 'drive') {
                  drive = t2[++k];
                } else if (w === 'action') {
                  action = t2[++k];
                } else if (w === 'acceptance') {
                  acceptance = t2[++k];
                } else if (w === 'hold') {
                  hold = t2[++k];
                } else if (w === 'fresh_within') {
                  freshWithin = t2[++k];
                } else if (w === 'verify') {
                  hasVerify = true;
                  if (bi < blocks.length) {
                    for (const it of blocks[bi++]!) {
                      if (it.kind !== 'line') {
                        continue;
                      }
                      const vt = [it.key ?? '', ...it.tokens];
                      for (let m = 0; m < vt.length; m++) {
                        if (vt[m] === 'read') {
                          verifyRead = vt[++m];
                        } else if (vt[m] === 'tolerance') {
                          verifyTolerance = vt[++m];
                        }
                      }
                    }
                  }
                } else if (w === 'args' && bi < blocks.length) {
                  bi++;
                }
              }
            }
            if (!isPoint) {
              if (action === undefined && drive === undefined) {
                err(
                  'C147',
                  `conformance_test ${ct.ident}: ${at} declares neither action nor drive — a preparation step carries a prose action AND/OR a drive reference (test-program-shape)`,
                );
              }
              if (hasVerify && (!verifyRead || !verifyTolerance)) {
                err(
                  'C147',
                  `conformance_test ${ct.ident}: ${at} declares a verify block without ${
                    !verifyRead ? 'read' : 'tolerance'
                  } — the verification names what to read AND the tolerance reference (test-program-shape)`,
                );
              }
            } else {
              if (drive === undefined) {
                err(
                  'C147',
                  `conformance_test ${ct.ident}: ${at} declares no drive — a stimulus point names the drive operation (test-program-shape)`,
                );
              }
              if (acceptance === undefined) {
                err(
                  'C147',
                  `conformance_test ${ct.ident}: ${at} declares no acceptance — a stimulus point names the MPE/requirement node it is judged against (test-program-shape)`,
                );
              }
            }
            // C148 — the duration legs.
            if (hold !== undefined && !parseWindow2(hold)) {
              err(
                'C148',
                `conformance_test ${ct.ident}: ${at} hold "${hold}" is not a parseable duration (shorthand 500ms/5s/1min/1h/1d or ISO 8601 with fixed-length components, e.g. PT30M) (test-program-duration)`,
              );
            }
            if (isPoint) {
              if (freshWithin === undefined) {
                err(
                  'C148',
                  `conformance_test ${ct.ident}: ${at} declares no fresh_within — a measurement point's read carries its freshness bound (§14.12: no stale semantics) (test-program-duration)`,
                );
              } else if (!parseWindow2(freshWithin)) {
                err(
                  'C148',
                  `conformance_test ${ct.ident}: ${at} fresh_within "${freshWithin}" is not a parseable freshness window (shorthand 500ms/5s/1min/1h/1d or ISO 8601 with fixed-length components, e.g. PT5S) (test-program-duration)`,
                );
              }
            }
          }
        }
        // The declared procedure's typed-step discipline
        // (TODO.lang-spec/04) — the mirror of the kernel's C147 legs: the
        // `step <id>` forms carry the sequence, so a procedure mixing
        // them with the retired numbered facet is ambiguous, and a
        // duplicate id makes the sequence unresolvable.
        const procBlock = nested(ct).find(n => n.keyword === 'procedure');
        if (procBlock) {
          const procLines = procBlock.items.filter(i2 => i2.kind === 'line');
          const typedSteps = procLines.filter(l => l.key === 'step');
          const numberedSteps = procLines.filter(
            l => l.key !== 'step' && /^\d+$/.test(l.key ?? ''),
          );
          if (typedSteps.length > 0 && numberedSteps.length > 0) {
            err(
              'C147',
              `conformance_test ${ct.ident}: the procedure mixes typed steps with ${numberedSteps.length} numbered step(s) — the named typed step is the one form (the ids are the sequence); re-spell the numbered entries as step <id> (test-program-shape)`,
            );
          }
          const typedIds = new Set<string>();
          for (const l of typedSteps) {
            const id = l.tokens[0];
            if (id === undefined) {
              continue;
            }
            if (typedIds.has(id)) {
              err(
                'C147',
                `conformance_test ${ct.ident}: procedure step "${id}" is declared twice — the typed ids are unique within the procedure (test-program-shape)`,
              );
            } else {
              typedIds.add(id);
            }
          }
        }
      }
      // C89 — the spelling codes (the manifest's default_spelling and
      // the spellings set; ISO 24229 shape).
      const parseSpelling = (code: string): string | null => {
        const segments = code.split('-');
        if (segments.length === 1 && /^[a-z]{3}$/.test(segments[0]!)) {
          return `script segment missing — a bare language code ("${code}") is not a spelling system; add the ISO 15924 script (e.g. ${code}-Latn)`;
        }
        if (segments.length < 2 || segments.length > 4) {
          return `a spelling code is <language>-<script>[-<country>][-<extension>] (2–4 segments), got "${code}"`;
        }
        const [language, script, ...rest] = segments;
        if (!/^[a-z]{3}$/.test(language!)) {
          return `language segment "${language}" is not an ISO 639-3 alpha-3 code (three lower-case letters)`;
        }
        if (!/^[A-Z][a-z]{3}$/.test(script!)) {
          if (/^[a-z]{3}$/.test(script!) && rest.length === 0) {
            return `script segment missing — a bare language code ("${code}") is not a spelling system; add the ISO 15924 script (e.g. ${code}-Latn)`;
          }
          return `script segment "${script}" is not an ISO 15924 script code (title-case four letters, e.g. Latn)`;
        }
        if (rest.length > 0) {
          const first = rest[0]!;
          if (/^[A-Z]{2}$/.test(first)) {
            if (rest.length > 1 && !/^[a-z][a-z0-9]*$/.test(rest[1]!)) {
              return `extension segment "${rest[1]}" is malformed (lower-case alnum, e.g. pre1972)`;
            }
          } else if (/^[a-z][a-z0-9]*$/.test(first)) {
            if (rest.length > 1) {
              return `country segment must precede the extension ("${code}")`;
            }
          } else {
            return `segment "${first}" is neither an ISO 3166-1 alpha-2 country (two upper-case letters) nor an extension (lower-case alnum)`;
          }
        }
        return null;
      };
      for (const m of pkg.constructs.filter(x => x.keyword === 'package')) {
        const mid = m.ident ?? facetTokens(m.items, 'id')[0] ?? '(the package)';
        const def = facetTokens(m.items, 'default_spelling')[0];
        if (def) {
          const bad = parseSpelling(def);
          if (bad) {
            err(
              'C89',
              `package "${mid}": default_spelling "${def}" — ${bad} (spelling-code-wellformed)`,
            );
          }
        }
        // The spellings set: a nested construct OR a brace group riding
        // the manifest's greedy line at the `spellings` token.
        const spellings = nested(m).find(n => n.keyword === 'spellings');
        const codes = spellings
          ? lines(spellings).flatMap(l => [l.key ?? '', ...l.tokens])
          : m.items.flatMap(i2 => {
              if (i2.kind !== 'line') {
                return [];
              }
              const t2 = [i2.key ?? '', ...i2.tokens];
              const blocks = i2.blocks ?? [];
              let bi = 0;
              const out: string[] = [];
              for (let j = 0; j < t2.length; j++) {
                if (t2[j] === 'spellings' && bi < blocks.length) {
                  for (const it of blocks[bi++]!) {
                    if (it.kind === 'raw') {
                      out.push(...it.tokens);
                    } else if (it.kind === 'line') {
                      out.push(it.key ?? '', ...it.tokens);
                    }
                  }
                }
              }
              return out.filter(x => x !== '');
            });
        for (const code of codes) {
          const bad = parseSpelling(code);
          if (bad) {
            err(
              'C89',
              `package "${mid}": declared spelling "${code}" — ${bad} (spelling-code-wellformed)`,
            );
          }
        }
        if (def && codes.length > 0 && !codes.includes(def)) {
          err(
            'C89',
            `package "${mid}": default_spelling "${def}" is not in the declared spellings set (spelling-code-wellformed)`,
          );
        }
      }
      // C158/C161 — the datum's prose quarantine and render surface.
      const CLAUSE_CITATION = /clause-\d|§\d/i;
      const MATH_NOTATIONS = new Set([
        'asciimath',
        'latex',
        'unicodemath',
        'mathml',
        'omml',
      ]);
      for (const d of closureConstructs.filter(
        x => x.keyword === 'datum' && x.ident,
      )) {
        const description = facetTokens(d.items, 'description').join(' ');
        if (description) {
          if (CLAUSE_CITATION.test(description)) {
            err(
              'C158',
              `datum ${d.ident}: the description cites a clause — a reference in prose belongs in a urn reference, not the quarantined free text (prose-quarantine)`,
            );
          } else if (description.includes('TODO.roadmap')) {
            issues.push({
              rule: 'C158',
              severity: 'warning',
              message: `datum ${d.ident}: the description carries the unfinished-prose marker TODO.roadmap (prose-quarantine)`,
            });
          }
        }
        // Both spellings: the nested render construct and the inline
        // `render <notation> "<text>"` line.
        const renderNotations = [
          ...nested(d)
            .filter(n => n.keyword === 'render')
            .map(r2 => facetTokens(r2.items, 'notation')[0] ?? r2.ident),
          ...facetTokens(d.items, 'render').slice(0, 1),
        ];
        for (const notation of renderNotations) {
          if (notation && !MATH_NOTATIONS.has(notation)) {
            err(
              'C161',
              `datum ${d.ident}: render notation "${notation}" is outside the closed vocabulary (asciimath|latex|unicodemath|mathml|omml) (check-surface)`,
            );
          }
        }
      }
      // C159 — urn-only-refs: a mapping's namespace names a declared
      // namespace block.
      const namespaceIds = new Set(
        closureConstructs
          .filter(x => x.keyword === 'namespace' && x.ident)
          .map(x => x.ident!),
      );
      for (const w of closureConstructs.filter(
        x => x.keyword === 'mapping' && x.ident,
      )) {
        const ns = facetTokens(w.items, 'namespace')[0];
        if (ns && !namespaceIds.has(ns)) {
          err(
            'C159',
            `mapping ${w.ident}: namespace "${ns}" names no declared namespace block (urn-only-refs)`,
          );
        }
      }
      // C84 — the when-guard is a predicate: a comparison or logical
      // composition (or its negation) at the top.
      const GUARD_CMP = new Set(['<=', '>=', '!=', '≠', '<', '>', '=']);
      const GUARD_WORD = new Set(['implies', 'or', 'xor', 'and']);
      for (const r of pkg.constructs.filter(
        x => x.keyword === 'requirement' && x.ident,
      )) {
        for (const lim of nested(r).filter(n => n.keyword === 'limit')) {
          const when = nested(lim).find(n => n.keyword === 'when');
          if (!when) {
            continue;
          }
          const src = when.items
            .flatMap(i2 =>
              i2.kind === 'raw'
                ? i2.tokens
                : i2.kind === 'line'
                  ? [i2.key ?? '', ...i2.tokens]
                  : [],
            )
            .join(' ')
            .trim();
          if (src === '') {
            continue;
          }
          try {
            const ast = parseX(src);
            const ok =
              (ast.kind === 'bin' &&
                ast.op !== undefined &&
                (GUARD_CMP.has(ast.op) || GUARD_WORD.has(ast.op))) ||
              (ast.kind === 'un' && ast.op === 'not');
            if (!ok) {
              err(
                'C84',
                `requirement ${r.ident}: limit ${lim.ident ? `"${lim.ident}"` : '(the unnamed limit)'}'s when-guard does not evaluate to a boolean — the guard is one comparison or logical composition (constraint-shape)`,
              );
            }
          } catch {
            // the guard's parse errors ride C171's expression plane
          }
        }
      }
    }

    // ── Batch B: the resolution family — C3 dimension enums, C6–C9
    //     the subject anatomy, C18/C20 the instance pins, C42–C44 the
    //     promises, C48–C50 the characteristics, C156 class-extends,
    //     C168 method-refs, C103 declared predicates, C97/C98 the
    //     certification program maps.
    {
      const subjectIdsB = new Set(
        pkg.constructs
          .filter(x => x.keyword === 'subject' && x.ident)
          .map(x => x.ident!),
      );
      const behaviorIdsB = new Set(
        closureConstructs
          .filter(x => x.keyword === 'behavior' && x.ident)
          .map(x => x.ident!),
      );
      const attrIdsB = new Set(
        closureConstructs
          .filter(x => x.keyword === 'attribute_definition' && x.ident)
          .map(x => x.ident!),
      );
      const symbolIdsB = new Set(
        closureConstructs
          .filter(x => x.keyword === 'symbol' && x.ident)
          .map(x => x.ident!),
      );
      const instanceIdsB = new Set(
        pkg.constructs
          .filter(x => x.keyword === 'instance' && x.ident)
          .map(x => x.ident!),
      );
      const classIdsB = new Set<string>();
      const classBareB = new Set<string>();
      for (const c2 of closureConstructs.filter(
        x => x.keyword === 'class' && x.ident,
      )) {
        classIdsB.add(c2.ident!);
        classBareB.add(
          c2.ident!.includes('#')
            ? c2.ident!.slice(0, c2.ident!.indexOf('#'))
            : c2.ident!,
        );
      }
      const testIdsB = new Set(
        pkg.constructs
          .filter(x => x.keyword === 'conformance_test' && x.ident)
          .map(x => x.ident!),
      );
      const processIdsB = new Set(
        pkg.constructs
          .filter(x => x.keyword === 'process' && x.ident)
          .map(x => x.ident!),
      );
      // The dimension registry: id → value domain (null when open). The
      // spellings: instrument/dimension `values { … }` blocks, the
      // attribute_definition `is_dimension true` + enum facets, and the
      // `values_of` indirection.
      const dimDomainsB = new Map<string, Set<string> | null>();
      const valuesOfB = new Map<string, string>();
      const readValuesBlock = (holder: Construct): Set<string> | null => {
        const values = nested(holder).find(n => n.keyword === 'values');
        if (!values) {
          return null;
        }
        const out = new Set<string>();
        for (const i2 of values.items) {
          if (i2.kind === 'raw') {
            for (const t of i2.tokens) {
              for (const v of t.split(',')) {
                if (v.trim() !== '') {
                  out.add(v.trim());
                }
              }
            }
          } else if (i2.kind === 'line') {
            if (i2.key && i2.key !== 'values') {
              out.add(i2.key);
            }
            for (const t of i2.tokens) {
              out.add(t);
            }
          }
        }
        for (const v of nested(values)) {
          out.add(v.ident || v.keyword);
        }
        return out;
      };
      for (const inst of closureConstructs.filter(
        x => x.keyword === 'instrument' && x.ident,
      )) {
        for (const d2 of nested(inst).filter(
          n => n.keyword === 'dimension' && n.ident,
        )) {
          dimDomainsB.set(d2.ident!, readValuesBlock(d2));
        }
      }
      for (const d2 of closureConstructs.filter(
        x => x.keyword === 'dimension' && x.ident,
      )) {
        if (dimDomainsB.has(d2.ident!)) {
          continue;
        }
        const vo = facetTokens(d2.items, 'values_of')[0];
        if (vo) {
          valuesOfB.set(d2.ident!, vo);
        }
        dimDomainsB.set(d2.ident!, readValuesBlock(d2));
      }
      for (const a2 of closureConstructs.filter(
        x => x.keyword === 'attribute_definition' && x.ident,
      )) {
        if (
          dimDomainsB.has(a2.ident!) ||
          facetTokens(a2.items, 'is_dimension')[0] !== 'true'
        ) {
          continue;
        }
        const enumRef = facetTokens(a2.items, 'enum')[0];
        const enumC = enumRef
          ? closureConstructs.find(
              x => x.keyword === 'enum' && x.ident === enumRef,
            )
          : undefined;
        const ev = nested(a2).find(n => n.keyword === 'enum_values');
        const domain = enumC
          ? readValuesBlock(enumC)
          : ev
            ? new Set(
                lines(ev)
                  .flatMap(l => [l.key ?? '', ...l.tokens])
                  .filter(x => x !== ''),
              )
            : null;
        dimDomainsB.set(a2.ident!, domain);
      }
      for (const [id, src] of valuesOfB) {
        dimDomainsB.set(id, dimDomainsB.get(src) ?? null);
      }
      const dimDomainOf = (dim: string): Set<string> | null | undefined =>
        dimDomainsB.has(dim) ? dimDomainsB.get(dim)! : undefined;
      // C3 — the dimension ids + values exist.
      const RESERVED_KEYS = new Set(['component', 'description']);
      for (const t of pkg.constructs.filter(
        x => x.keyword === 'conformance_test' && x.ident,
      )) {
        const ts = nested(t).find(n => n.keyword === 'test_subject');
        if (!ts) {
          continue;
        }
        for (const l of lines(ts)) {
          const dim = l.key!.replace(/:$/, '');
          if (RESERVED_KEYS.has(dim)) {
            continue;
          }
          const domain = dimDomainOf(dim);
          if (domain === undefined) {
            err(
              'C3',
              `conformance test ${t.ident}: test_subject dimension "${dim}" not declared`,
            );
          } else if (
            domain !== null &&
            l.tokens[0] !== undefined &&
            !domain.has(l.tokens[0])
          ) {
            err(
              'C3',
              `conformance test ${t.ident}: test_subject ${dim}="${l.tokens[0]}" not in the dimension's values`,
            );
          }
        }
      }
      for (const r of pkg.constructs.filter(
        x => x.keyword === 'requirement' && x.ident,
      )) {
        const app = nested(r).find(n => n.keyword === 'applicability');
        if (!app) {
          continue;
        }
        for (const l of lines(app)) {
          const dim = l.key!.replace(/:$/, '');
          const domain = dimDomainOf(dim);
          if (domain === undefined) {
            err(
              'C3',
              `requirement ${r.ident}: applicability dimension "${dim}" not declared`,
            );
            continue;
          }
          if (domain === null) {
            continue;
          }
          for (const raw of l.tokens) {
            for (const v of raw.replace(/^\[|\]$/g, '').split(',')) {
              const val = v.trim();
              if (val !== '' && !domain.has(val)) {
                err(
                  'C3',
                  `requirement ${r.ident}: applicability ${dim}="${val}" not in the dimension's values`,
                );
              }
            }
          }
          for (const blk of l.blocks ?? []) {
            for (const it of blk) {
              if (it.kind !== 'line') {
                continue;
              }
              const key = it.key!.replace(/:$/, '');
              if (!domain.has(key)) {
                err(
                  'C3',
                  `requirement ${r.ident}: applicability ${dim} mapping key "${key}" not in the dimension's values`,
                );
              }
            }
          }
        }
      }
      // C6–C9 — the subject anatomy.
      const ASPECT_FAMILY = new Map<string, string>([
        ['metadata', 'is'],
        ['provenance', 'is'],
        ['structure', 'is'],
        ['design_parameters', 'is'],
        ['designed_conditions', 'is'],
        ['promises', 'is'],
        ['artifacts', 'is'],
        ['endpoint', 'is'],
        ['attributes', 'has'],
        ['dimensions', 'has'],
        ['state', 'has'],
        ['characteristics', 'has'],
        ['environmental_context', 'has'],
        ['artifact_instances', 'has'],
        ['serve', 'has'],
        ['behavior', 'does'],
      ]);
      const CONDITION_TIERS = new Set(['reference', 'rated', 'limiting']);
      for (const subj of pkg.constructs.filter(
        x => x.keyword === 'subject' && x.ident,
      )) {
        const sid = subj.ident!;
        const isB = nested(subj).find(n => n.keyword === 'is');
        const has = nested(subj).find(n => n.keyword === 'has');
        const does = nested(subj).find(n => n.keyword === 'does');
        // C6 — every aspect under its family.
        for (const [family, block] of [
          ['is', isB],
          ['has', has],
          ['does', does],
        ] as const) {
          if (!block) {
            continue;
          }
          const aspectNames = new Set<string>([
            ...nested(block).map(n2 => n2.keyword),
            ...lines(block)
              .map(l => l.key!)
              .filter(k => k !== 'behavior' && k !== 'serve'),
          ]);
          // The parser's own accepted keys per family — the misplaced
          // record exists exactly for keys OUTSIDE these lists.
          const ACCEPTED = new Map<string, Set<string>>([
            [
              'is',
              new Set([
                'metadata',
                'provenance',
                'structure',
                'design_parameters',
                'designed_conditions',
                'promises',
                'artifacts',
                'endpoint',
                'composed_of',
              ]),
            ],
            [
              'has',
              new Set([
                'attributes',
                'dimensions',
                'state',
                'characteristics',
                'environmental_context',
                'artifact_instances',
                'serve',
              ]),
            ],
            ['does', new Set(['behavior'])],
          ]);
          for (const kw of aspectNames) {
            if (ACCEPTED.get(family)?.has(kw)) {
              continue;
            }
            const home = ASPECT_FAMILY.get(kw);
            if (home !== undefined) {
              err(
                'C6',
                `subject ${sid}: aspect "${kw}" declared under family "${family}" — it belongs to "${home}" (anatomy-family)`,
              );
            } else {
              err(
                'C6',
                `subject ${sid}: undeclared aspect "${kw}" in family "${family}" (anatomy-family)`,
              );
            }
          }
        }
        // The two value-level heuristics.
        const dp = isB
          ? nested(isB).find(n => n.keyword === 'design_parameters')
          : undefined;
        if (dp) {
          for (const l of lines(dp)) {
            for (const v of l.tokens) {
              if (/test[-_]dependent/.test(v)) {
                err(
                  'C6',
                  `subject ${sid}: design parameter "${l.key}" is test-dependent — exhibited values belong to has.attributes (anatomy-family)`,
                );
              }
            }
          }
        }
        const attrs = has
          ? nested(has).find(n => n.keyword === 'attributes')
          : undefined;
        if (attrs) {
          for (const l of lines(attrs)) {
            if (CONDITION_TIERS.has(l.key!)) {
              err(
                'C6',
                `subject ${sid}: attribute "${l.key}" is a condition tier — designed tiers belong to is.designed_conditions (anatomy-family)`,
              );
            }
          }
        }
        // C7 — characteristics carry derivations.
        const chars = has
          ? nested(has).find(n => n.keyword === 'characteristics')
          : undefined;
        const charDerivs = new Map<
          string,
          { symbol?: string; derivation?: string; behavior?: string }
        >();
        if (chars) {
          for (const l of lines(chars)) {
            const name = l.key!;
            let symbol: string | undefined;
            let derivation: string | undefined;
            let behavior: string | undefined;
            const bi2 = l.tokens.indexOf('behavior');
            for (let k = 0; k < l.tokens.length; k++) {
              if (l.tokens[k] === '=') {
                derivation = l.tokens
                  .slice(k + 1, bi2 > k ? bi2 : l.tokens.length)
                  .join(' ');
                break;
              }
              if (k === 0) {
                symbol = l.tokens[0];
              }
            }
            if (bi2 > 0) {
              behavior = l.tokens[bi2 + 1];
            }
            charDerivs.set(name, { symbol, derivation, behavior });
            if (!derivation) {
              err(
                'C7',
                `subject ${sid}: characteristic "${name}" names no derivation from behavior I/O (anatomy-characteristic-derivation)`,
              );
            }
            if (behavior && !behaviorIdsB.has(behavior)) {
              err(
                'C49',
                `subject ${sid}: characteristic "${name}" behavior "${behavior}" is not a declared behavior (characteristic-behavior-link)`,
              );
            }
          }
        }
        // C50 — the derivation's reads resolve.
        const OCL_KEYWORDS = new Set([
          'self',
          'and',
          'or',
          'xor',
          'not',
          'implies',
          'true',
          'false',
          'null',
          'if',
          'then',
          'else',
          'endif',
          'let',
          'in',
          'invalid',
        ]);
        const subjectParams = new Set<string>([
          ...attrIdsB,
          ...(dp
            ? lines(dp)
                .flatMap(l => [l.key ?? '', ...l.tokens])
                .filter(x => x !== '')
            : []),
          ...(attrs
            ? lines(attrs)
                .map(l => l.key!)
                .filter(x => x !== '')
            : []),
        ]);
        const ioVocabulary = new Set<string>([...symbolIdsB, ...subjectParams]);
        if (chars) {
          for (const [name, info] of charDerivs) {
            const deriv = info.derivation ?? '';
            if (!/^ocl\{[\s\S]*\}$/.test(deriv.trim())) {
              continue;
            }
            const body = deriv
              .trim()
              .replace(/^ocl\{/, '')
              .replace(/\}$/, '');
            const selfReads: string[] = [];
            const bareReads: string[] = [];
            for (const m of body.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) {
              const id = m[0];
              if (OCL_KEYWORDS.has(id)) {
                continue;
              }
              const idx = m.index ?? 0;
              if (
                body
                  .slice(idx + id.length)
                  .trimStart()
                  .startsWith('(')
              ) {
                continue;
              }
              const before = body.slice(0, idx);
              if (before.endsWith('self.')) {
                selfReads.push(id);
              } else if (before.endsWith('.')) {
                continue;
              } else {
                bareReads.push(id);
              }
            }
            for (const id of selfReads) {
              if (!subjectParams.has(id)) {
                err(
                  'C50',
                  `subject ${sid}: characteristic "${name}" derivation reads self.${id}, which is not a declared subject parameter (design parameter, has.attribute, or attribute definition) — in \`${deriv}\` (characteristic-derivation-inputs)`,
                );
              }
            }
            for (const id of bareReads) {
              if (!ioVocabulary.has(id)) {
                err(
                  'C50',
                  `subject ${sid}: characteristic "${name}" derivation reads "${id}", which is not a declared symbol, attribute, or subject parameter (behavior I/O) — in \`${deriv}\` (characteristic-derivation-inputs)`,
                );
              }
            }
          }
        }
        // C8 — the does behaviors resolve.
        if (does) {
          for (const l of lines(does)) {
            if (l.key === 'behavior') {
              for (const b of l.tokens) {
                if (!behaviorIdsB.has(b)) {
                  err(
                    'C8',
                    `subject ${sid}: behavior "${b}" is not a declared behavior (anatomy-behavior-resolves)`,
                  );
                }
              }
            }
          }
          for (const n2 of nested(does).filter(n => n.keyword === 'behavior')) {
            if (n2.ident && !behaviorIdsB.has(n2.ident)) {
              err(
                'C8',
                `subject ${sid}: behavior "${n2.ident}" is not a declared behavior (anatomy-behavior-resolves)`,
              );
            }
          }
        }
        // C9 — the extends target resolves.
        const ext = lines(subj).find(l => l.key === 'extends')?.tokens[0];
        if (ext && !subjectIdsB.has(ext)) {
          issues.push({
            rule: 'C9',
            severity: 'warning',
            message: `subject ${sid}: extends "${ext}" is not a declared subject (subject-extends-resolves)`,
          });
        }
        // C48 — characteristic-one-home: once a subject declares
        // characteristics, a verdict carrying its own derive shadows the
        // primary model.
        const anySubjectCharacteristics = pkg.constructs.some(x => {
          if (x.keyword !== 'subject') {
            return false;
          }
          const h2 = nested(x).find(n => n.keyword === 'has');
          const ch2 = h2
            ? nested(h2).find(n => n.keyword === 'characteristics')
            : undefined;
          return ch2 !== undefined && lines(ch2).length > 0;
        });
        if (anySubjectCharacteristics) {
          for (const v of pkg.constructs.filter(
            x => x.keyword === 'verdict' && x.ident,
          )) {
            const derive =
              facetTokens(v.items, 'derive')[0] ??
              (nested(v).find(n => n.keyword === 'derive') !== undefined
                ? 'ocl{…}'
                : undefined);
            if (derive) {
              err(
                'C48',
                `verdict ${v.ident}: carries a derivation outside the primary model — a verdict quantity derives ONCE in the subject's has.characteristics and is referenced everywhere else (characteristic-one-home)`,
              );
            }
          }
        }
        // C42–C44 — the subject's promises.
        const bareValueTargets = new Set<string>([
          ...attrIdsB,
          ...(dp
            ? lines(dp)
                .map(l => l.key!)
                .filter(x => x !== '')
            : []),
          ...(attrs
            ? lines(attrs)
                .map(l => l.key!)
                .filter(x => x !== '')
            : []),
        ]);
        const characteristicNames = new Set([
          ...charDerivs.keys(),
          ...new Set(
            [...charDerivs.values()]
              .map(v => v.symbol)
              .filter((x): x is string => !!x),
          ),
        ]);
        const promisesBlock = isB
          ? nested(isB).find(n => n.keyword === 'promises')
          : undefined;
        for (const p of promisesBlock ? nested(promisesBlock) : []) {
          const target = facetTokens(p.items, 'target')[0];
          const label =
            p.ident || facetTokens(p.items, 'statement')[0] || '(a promise)';
          const verifiedBy = nested(p).find(n => n.keyword === 'verified_by');
          const verifiedByIds = verifiedBy ? rawTokensT(verifiedBy) : [];
          const level = nested(p).find(n => n.keyword === 'level');
          const levelQuantity =
            level !== undefined &&
            facetTokens(level.items, 'unit')[0] !== undefined;
          if (!target) {
            if (verifiedByIds.length === 0) {
              issues.push({
                rule: 'C43',
                severity: 'warning',
                message: `subject ${sid}: promise "${label}" has no target and no verified_by — it is unverifiable; give it a characteristic/behavior target or declare the verifying requirement/test (promise-verifiable)`,
              });
            }
            continue;
          }
          const isCharacteristic = characteristicNames.has(target);
          const isBehavior = behaviorIdsB.has(target);
          if (!isCharacteristic && !isBehavior) {
            if (bareValueTargets.has(target)) {
              const restates =
                levelQuantity &&
                !facetTokens(p.items, 'conditions')[0] &&
                verifiedByIds.length === 0;
              if (restates) {
                err(
                  'C44',
                  `subject ${sid}: promise "${label}" only restates the declared attribute value "${target}" — a promise claims a characteristic or behavior (optionally conditioned); bare values stay origin: declared attributes (promise-not-bare-value)`,
                );
              }
            } else if (!dimDomainOf(target) && !symbolIdsB.has(target)) {
              err(
                'C42',
                `subject ${sid}: promise "${label}" target "${target}" is not a declared characteristic, behavior, attribute, dimension, or symbol (promise-target-resolves)`,
              );
            }
            continue;
          }
          if (verifiedByIds.length > 0) {
            continue;
          }
          // C43 — derive the verification from the binding requirements/tests.
          const names = new Set<string>([target]);
          const sym = charDerivs.get(target)?.symbol;
          if (sym) {
            names.add(sym);
          }
          const boundReqs = new Set<string>();
          for (const r of pkg.constructs.filter(
            x => x.keyword === 'requirement' && x.ident,
          )) {
            let binds = false;
            for (const lim of nested(r).filter(n => n.keyword === 'limit')) {
              const uses = nested(lim).find(n => n.keyword === 'uses');
              for (const u of uses ? rawTokensT(uses) : []) {
                if (names.has(u) || names.has(u.split('.').pop() ?? '')) {
                  binds = true;
                }
              }
            }
            const bindsTo = nested(r).find(n => n.keyword === 'binds_to');
            for (const p2 of bindsTo ? rawTokensT(bindsTo) : []) {
              if (names.has(p2.split('.').pop() ?? '')) {
                binds = true;
              }
            }
            if (binds) {
              boundReqs.add(r.ident!);
            }
          }
          let anyBoundTest = false;
          for (const t of pkg.constructs.filter(
            x => x.keyword === 'conformance_test' && x.ident,
          )) {
            const targets = nested(t).find(n => n.keyword === 'targets');
            const tTargets = targets ? rawTokensT(targets) : [];
            if (tTargets.some(x => boundReqs.has(x))) {
              anyBoundTest = true;
              break;
            }
            const vars = nested(t).find(n => n.keyword === 'variables');
            if (vars && nested(vars).some(v => names.has(v.ident ?? ''))) {
              anyBoundTest = true;
              break;
            }
          }
          if (boundReqs.size === 0 && !anyBoundTest) {
            issues.push({
              rule: 'C43',
              severity: 'warning',
              message: `subject ${sid}: promise "${label}" declares no verified_by and no requirement/test binds its target "${target}" — declare the verifying requirement or test (promise-verifiable)`,
            });
          }
        }
      }
      // C42–C44 over the promise_set register.
      for (const ps of pkg.constructs.filter(
        x => x.keyword === 'promise_set' && x.ident,
      )) {
        const owner = pkg.constructs.find(
          x => x.keyword === 'subject' && x.ident === ps.ident,
        );
        const ownerHas = owner
          ? nested(owner).find(n => n.keyword === 'has')
          : undefined;
        const ownerChars = ownerHas
          ? nested(ownerHas).find(n => n.keyword === 'characteristics')
          : undefined;
        const charNames = new Set<string>(
          ownerChars ? lines(ownerChars).map(l => l.key!) : [],
        );
        for (const p of nested(ps)
          .filter(n => n.keyword === 'promises')
          .flatMap(n => nested(n))) {
          const target = facetTokens(p.items, 'target')[0];
          const label =
            p.ident || facetTokens(p.items, 'statement')[0] || '(a promise)';
          const where = `promise_set ${ps.ident}: promise "${label}"`;
          const verifiedBy = nested(p).find(n => n.keyword === 'verified_by');
          const verifiedByIds = verifiedBy ? rawTokensT(verifiedBy) : [];
          if (!target) {
            if (verifiedByIds.length === 0) {
              issues.push({
                rule: 'C43',
                severity: 'warning',
                message: `${where} has no target and no verified_by — it is unverifiable; give it a characteristic/behavior target or declare the verifying requirement/test (promise-verifiable)`,
              });
            }
            continue;
          }
          if (!charNames.has(target) && !behaviorIdsB.has(target)) {
            if (
              !attrIdsB.has(target) &&
              !symbolIdsB.has(target) &&
              !dimDomainOf(target) &&
              owner !== undefined
            ) {
              err(
                'C42',
                `${where} target "${target}" is not a declared characteristic, behavior, attribute, dimension, or symbol (promise-target-resolves)`,
              );
            }
          }
        }
      }
      // C18/C20 — the instance pins.
      for (const inst of pkg.constructs.filter(
        x => x.keyword === 'instance' && x.ident,
      )) {
        if (!nested(inst).find(n => n.keyword === 'definition_versions')) {
          err(
            'C18',
            `instance ${inst.ident}: no definition_versions — every instance is version-pinned to its definitions (INV-8) (instance-version-pin)`,
          );
        }
        const ofRef = lines(inst).find(l => l.key === 'of')?.tokens[0] ?? '';
        if (
          !subjectIdsB.has(ofRef) &&
          !instanceIdsB.has(ofRef) &&
          !classIdsB.has(ofRef) &&
          !classBareB.has(ofRef)
        ) {
          err(
            'C20',
            `instance ${inst.ident}: of "${ofRef}" is not a declared subject, instrument, class, or instance (instance-of-resolves)`,
          );
        }
      }
      // C156 — class extends resolves.
      for (const c2 of closureConstructs.filter(
        x => x.keyword === 'class' && x.ident,
      )) {
        const ext = lines(c2).find(l => l.key === 'extends')?.tokens[0];
        if (
          ext &&
          !classIdsB.has(ext) &&
          !classBareB.has(ext) &&
          !instanceIdsB.has(ext)
        ) {
          issues.push({
            rule: 'C156',
            severity: 'warning',
            message: `class ${c2.ident}: extends "${ext}" is not a declared class or instance (class-extends-resolves)`,
          });
        }
      }
      // C168 — method refs (the local leg; the scoped leg is
      // locator-gated and stays silent without one).
      for (const t of pkg.constructs.filter(
        x => x.keyword === 'conformance_test' && x.ident,
      )) {
        const ref = facetTokens(t.items, 'method_ref')[0];
        if (
          ref &&
          !ref.includes(':') &&
          !processIdsB.has(ref) &&
          !testIdsB.has(ref)
        ) {
          err(
            'C168',
            `conformance test ${t.ident}: the reference "${ref}" names no process or conformance test declared in this package (method-ref-resolves)`,
          );
        }
      }
      for (const pr of pkg.constructs.filter(
        x => x.keyword === 'process' && x.ident,
      )) {
        const doesBody = nested(pr).find(n => n.keyword === 'does');
        for (const st of doesBody
          ? nested(doesBody).filter(n => n.keyword === 'step')
          : []) {
          const call = facetTokens(st.items, 'calls')[0];
          if (call && !call.includes(':') && !processIdsB.has(call)) {
            err(
              'C168',
              `${pr.ident}/step/${st.ident}: the reference "${call}" names no process or conformance test declared in this package (method-ref-resolves)`,
            );
          }
        }
      }
      // C103 — ref predicates against the declared registry.
      const predicateRegistry = new Set(
        closureConstructs
          .filter(x => x.keyword === 'predicate' && x.ident)
          .map(x => x.ident!),
      );
      const predicatesBlock = closureConstructs.find(
        x => x.keyword === 'predicates',
      );
      if (predicatesBlock) {
        for (const p2 of nested(predicatesBlock)) {
          predicateRegistry.add(p2.ident || p2.keyword);
        }
      }
      if (predicateRegistry.size > 0) {
        for (const owner of pkg.constructs.filter(
          x =>
            ['requirement', 'conformance_test', 'form'].includes(x.keyword) &&
            x.ident,
        )) {
          for (const refs of nested(owner).filter(n => n.keyword === 'refs')) {
            for (const ref of nested(refs).filter(n => n.keyword === 'ref')) {
              const pred = facetTokens(ref.items, 'predicate')[0] ?? ref.ident;
              if (pred && !predicateRegistry.has(pred)) {
                err(
                  'C103',
                  `${owner.keyword} ${owner.ident}: ref predicate "${pred}" is not declared in the composed predicate registry (declared-predicate)`,
                );
              }
            }
          }
        }
      }
      // C97/C98 — the certification program maps.
      const manifestB = pkg.constructs.find(x => x.keyword === 'package');
      const manifestId =
        manifestB?.ident ??
        (manifestB ? facetTokens(manifestB.items, 'id')[0] : undefined);
      const manifestKind = manifestB
        ? facetTokens(manifestB.items, 'kind')[0]
        : undefined;
      if (manifestB && manifestKind === 'certification_program') {
        const mapsTo = nested(manifestB).find(n => n.keyword === 'maps_to');
        const targets = mapsTo
          ? rawTokensT(mapsTo)
          : facetTokens(manifestB.items, 'maps_to');
        const siblingIds = new Set(
          (pkg.siblings ?? []).flatMap(s2 =>
            s2.constructs
              .filter(x => x.keyword === 'package')
              .map(x => x.ident || facetTokens(x.items, 'id')[0] || ''),
          ),
        );
        const siblingKinds = new Map<string, string>();
        for (const s2 of pkg.siblings ?? []) {
          for (const m2 of s2.constructs.filter(x => x.keyword === 'package')) {
            const id2 = m2.ident || facetTokens(m2.items, 'id')[0] || '';
            const kind2 = facetTokens(m2.items, 'id')
              ? facetTokens(m2.items, 'kind')[0] || 'rec'
              : 'rec';
            siblingKinds.set(id2, kind2);
          }
        }
        if (targets.length === 0) {
          err(
            'C97',
            `package "${manifestId}": a certification program declares the Recommendation vocabulary it certifies against (maps_to) — a program that maps to nothing certifies nothing (program-maps-resolves)`,
          );
        }
        for (const target of targets) {
          if (!siblingIds.has(target) && !located?.packages.has(target)) {
            err(
              'C97',
              `package "${manifestId}": maps_to "${target}" does not resolve to a known package — the requirement vocabulary a program certifies against must resolve (program-maps-resolves)`,
            );
          } else if (siblingKinds.get(target) === 'certification_program') {
            err(
              'C97',
              `package "${manifestId}": maps_to "${target}" is itself a certification program — a program maps to the standards vocabulary, never to another program (program-maps-resolves)`,
            );
          } else if (siblingKinds.get(target) === 'product_reference') {
            err(
              'C97',
              `package "${manifestId}": maps_to "${target}" is a product reference package — the product twin declarations a program certifies are pinned abstract imports (program-maps-resolves)`,
            );
          }
        }
        // C98 — the surveillance shapes.
        const schemeType = facetTokens(manifestB.items, 'scheme_type')[0];
        const NO_SURVEILLANCE = new Set(['type_1a', 'type_1b']);
        if (schemeType && NO_SURVEILLANCE.has(schemeType)) {
          const claims: string[] = [];
          const monitors = pkg.constructs.filter(
            x => x.keyword === 'monitor' && x.ident,
          );
          if (monitors.length > 0) {
            claims.push(
              `${monitors.length} monitor(s): ${monitors.map(m2 => m2.ident).join(', ')}`,
            );
          }
          const surveillance = pkg.constructs.filter(
            x =>
              x.keyword === 'process' &&
              x.ident &&
              facetTokens(x.items, 'activity_kinds').includes('surveillance'),
          );
          if (surveillance.length > 0) {
            claims.push(
              `surveillance-classified process(es): ${surveillance.map(p2 => p2.ident).join(', ')}`,
            );
          }
          if (claims.length > 0) {
            issues.push({
              rule: 'C98',
              severity: 'warning',
              message: `package "${manifestId}": scheme_type "${schemeType}" certifies a type sample with no surveillance, but the program declares ${claims.join(' and ')} — the ${schemeType} shape structurally can't say "continuously"; a surveillance-constitutive program self-classifies type_5 (ISO/IEC 17067 Table 1) (program-surveillance-required)`,
            });
          }
        }
      }
    }

    // ── Batch D wave 1: the spec planes — C86–C88 the passport, C150/
    //     C151 the attestations, C106 dataspace governance provenance,
    //     C162 namespace-coherence, C164 wire-mapping-coverage.
    {
      // C86–C88 — the model-native DPP.
      const CONTENT_CLASSES = new Set([
        'identity',
        'composition',
        'promises_as_verified',
        'live_compliance_status',
        'artifacts',
        'sustainability',
      ]);
      const UPI_LEVELS = new Set(['model', 'batch', 'item']);
      const subjectIdsD = new Set(
        pkg.constructs
          .filter(x => x.keyword === 'subject' && x.ident)
          .map(x => x.ident!),
      );
      const compositionIds = new Set<string>();
      const passportPromises = new Set<string>();
      const subjectArtifacts = new Set<string>();
      for (const subj of pkg.constructs.filter(
        x => x.keyword === 'subject' && x.ident,
      )) {
        const isB = nested(subj).find(n => n.keyword === 'is');
        const has = nested(subj).find(n => n.keyword === 'has');
        const structure = isB
          ? nested(isB).find(n => n.keyword === 'structure')
          : undefined;
        if (structure) {
          for (const id of lines(structure)
            .flatMap(l => [l.key ?? '', ...l.tokens])
            .filter(x => x !== '')) {
            compositionIds.add(id);
          }
        }
        const dp = isB
          ? nested(isB).find(n => n.keyword === 'design_parameters')
          : undefined;
        if (dp) {
          for (const id of lines(dp)
            .map(l => l.key!)
            .filter(x => x !== '')) {
            compositionIds.add(id);
          }
        }
        const chars = has
          ? nested(has).find(n => n.keyword === 'characteristics')
          : undefined;
        if (chars) {
          for (const id of lines(chars)
            .map(l => l.key!)
            .filter(x => x !== '')) {
            compositionIds.add(id);
          }
        }
        for (const l of has ? lines(has).filter(x => x.key === 'serve') : []) {
          if (l.tokens[0]) {
            compositionIds.add(l.tokens[0]);
          }
        }
        const promises = isB
          ? nested(isB).find(n => n.keyword === 'promises')
          : undefined;
        for (const p2 of promises ? nested(promises) : []) {
          const nm = p2.ident || p2.keyword;
          if (nm) {
            passportPromises.add(nm);
          }
        }
        const arts = isB
          ? nested(isB).find(n => n.keyword === 'artifacts')
          : undefined;
        if (arts) {
          for (const id of arts.items
            .flatMap(i2 =>
              i2.kind === 'raw'
                ? i2.tokens
                : i2.kind === 'line'
                  ? [i2.key ?? '', ...i2.tokens]
                  : i2.kind === 'construct' && i2.construct
                    ? [i2.construct.ident || i2.construct.keyword]
                    : [],
            )
            .filter(x => x !== '')) {
            subjectArtifacts.add(id);
          }
        }
      }
      const artifactDefIds = new Set(
        closureConstructs
          .filter(x => x.keyword === 'artifact_definition' && x.ident)
          .map(x => x.ident!),
      );
      const monitorIdsD = new Set(
        pkg.constructs
          .filter(x => x.keyword === 'monitor' && x.ident)
          .map(x => x.ident!),
      );
      const CONTENT_DOMAINS: Record<string, Set<string> | null> = {
        identity: subjectIdsD,
        composition: compositionIds,
        promises_as_verified: passportPromises,
        live_compliance_status: new Set([...monitorIdsD, ...passportPromises]),
        artifacts: new Set([...artifactDefIds, ...subjectArtifacts]),
        sustainability: null,
      };
      for (const pp of pkg.constructs.filter(
        x => x.keyword === 'passport' && x.ident,
      )) {
        const entries: { cls: string; ref: string; access: string }[] = [];
        for (const l of lines(pp).filter(x => x.key === 'entry')) {
          const t2 = l.tokens;
          if (t2.length < 2) {
            continue;
          }
          const dotted = t2[0]!.split('.');
          entries.push({
            cls: dotted[0]!,
            ref: dotted.length > 1 ? dotted.slice(1).join('.') : '',
            access: t2[1]!,
          });
        }
        const tokens = new Set(
          entries.map(e2 => (e2.ref === '' ? e2.cls : `${e2.cls}.${e2.ref}`)),
        );
        const publicBare = new Set(
          entries
            .filter(e2 => e2.access === 'public' && e2.ref === '')
            .map(e2 => e2.cls),
        );
        for (const e2 of entries) {
          if (!CONTENT_CLASSES.has(e2.cls)) {
            err(
              'C86',
              `passport ${pp.ident}: content entry "${e2.ref === '' ? e2.cls : `${e2.cls}.${e2.ref}`}" names an unknown content class — one of identity | composition | promises_as_verified | live_compliance_status | artifacts | sustainability (passport-content-resolves)`,
            );
            continue;
          }
          if (e2.ref !== '') {
            const domain = CONTENT_DOMAINS[e2.cls];
            if (
              domain !== null &&
              domain !== undefined &&
              !domain.has(e2.ref)
            ) {
              err(
                'C86',
                `passport ${pp.ident}: content entry "${e2.cls}.${e2.ref}" — "${e2.ref}" does not resolve against the package's declared aspects/promises (the passport projection contains only aspects that resolve, §15.9) (passport-content-resolves)`,
              );
            }
          }
          if (e2.access === 'restricted' || e2.access === 'authority') {
            const token = e2.ref === '' ? e2.cls : `${e2.cls}.${e2.ref}`;
            if (
              (tokens.has(token) &&
                entries.some(
                  x2 =>
                    x2.access === 'public' &&
                    (x2.ref === '' ? x2.cls : `${x2.cls}.${x2.ref}`) === token,
                )) ||
              publicBare.has(e2.cls)
            ) {
              err(
                'C87',
                `passport ${pp.ident}: entry "${token}" is marked ${e2.access} but reachable from the public class — public classes contain nothing marked restricted (§15.9) (passport-access-leak)`,
              );
            }
          }
        }
        const upi = nested(pp).find(n => n.keyword === 'upi');
        const pattern = upi ? facetTokens(upi.items, 'pattern')[0] : undefined;
        const level = upi ? facetTokens(upi.items, 'level')[0] : undefined;
        if (!pattern) {
          err(
            'C88',
            `passport ${pp.ident}: declares no UPI pattern — a passport is reached through its unique product identifier (upi { pattern … level … }) (passport-upi-scheme)`,
          );
        }
        if (!level) {
          err(
            'C88',
            `passport ${pp.ident}: the UPI pattern declares no level — the ESPR unique product identifier is model | batch | item level (passport-upi-scheme)`,
          );
        } else if (!UPI_LEVELS.has(level)) {
          err(
            'C88',
            `passport ${pp.ident}: UPI level "${level}" is not one of model | batch | item (passport-upi-scheme)`,
          );
        }
      }
      // C150/C151 — the attestations.
      const instanceIdsD = new Set(
        pkg.constructs
          .filter(x => x.keyword === 'instance' && x.ident)
          .map(x => x.ident!),
      );
      const roleIdsD = new Set(
        closureConstructs
          .filter(x => x.keyword === 'role' && x.ident)
          .map(x => x.ident!),
      );
      const verdictIdsD = new Set(
        pkg.constructs
          .filter(x => x.keyword === 'verdict' && x.ident)
          .map(x => x.ident!),
      );
      // The promise-set views: promise_set registers AND subjects carrying
      // is.promises (the kernel's setViews).
      const setViews = new Map<string, Construct[]>();
      const promiseName = (p2: Construct): string => p2.ident || p2.keyword;
      for (const ps of pkg.constructs.filter(
        x => x.keyword === 'promise_set' && x.ident,
      )) {
        const promises = nested(ps).find(n => n.keyword === 'promises');
        setViews.set(
          ps.ident!,
          (promises ? nested(promises) : []).map(p2 => ({
            ...p2,
            ident: promiseName(p2),
          })),
        );
      }
      for (const subj of pkg.constructs.filter(
        x => x.keyword === 'subject' && x.ident,
      )) {
        const isB = nested(subj).find(n => n.keyword === 'is');
        const promises = isB
          ? nested(isB).find(n => n.keyword === 'promises')
          : undefined;
        const list = promises ? nested(promises) : [];
        if (list.length > 0) {
          setViews.set(
            subj.ident!,
            list.map(p2 => ({ ...p2, ident: promiseName(p2) })),
          );
        }
      }
      for (const a of pkg.constructs.filter(
        x => x.keyword === 'attestation' && x.ident,
      )) {
        const subjectRef = facetTokens(a.items, 'subject')[0];
        if (!subjectRef) {
          err(
            'C150',
            `attestation ${a.ident}: no subject facet (attestation-references-resolve)`,
          );
        } else if (!instanceIdsD.has(subjectRef)) {
          err(
            'C150',
            `attestation ${a.ident}: subject "${subjectRef}" is not a declared instance (attestation-references-resolve)`,
          );
        }
        const promisesRef = facetTokens(a.items, 'promises')[0];
        if (!promisesRef) {
          err(
            'C150',
            `attestation ${a.ident}: no promises facet (attestation-references-resolve)`,
          );
        }
        const set =
          promisesRef !== undefined
            ? (setViews.get(promisesRef) ??
              setViews.get(promisesRef.split('.').slice(1).join('.')) ??
              null)
            : null;
        if (promisesRef !== undefined && set === null) {
          err(
            'C150',
            `attestation ${a.ident}: promises "${promisesRef}" does not resolve to a declared promise set (attestation-references-resolve)`,
          );
        }
        for (const basis of nested(a).filter(n => n.keyword === 'basis')) {
          for (const l of lines(basis)) {
            const kind =
              l.key === 'kind'
                ? l.tokens[0]
                : facetTokens([l as unknown as Item], 'kind')[0];
            void kind;
          }
          // The basis entries: greedy lines [kind, id] — the first token
          // pair of each run.
          const t2 = lines(basis).flatMap(l => [l.key ?? '', ...l.tokens]);
          for (let k = 0; k + 1 < t2.length; k += 2) {
            if (!t2[k] || !t2[k + 1]) {
              err(
                'C150',
                `attestation ${a.ident}: a basis entry needs an evidence kind and an id (attestation-references-resolve)`,
              );
            }
          }
        }
        const authority = nested(a).find(n => n.keyword === 'authority');
        const role = authority
          ? facetTokens(authority.items, 'role')[0]
          : undefined;
        if (role && roleIdsD.size > 0 && !roleIdsD.has(role)) {
          err(
            'C150',
            `attestation ${a.ident}: authority role "${role}" is not a declared role (attestation-references-resolve)`,
          );
        }
        const claimsBlock = nested(a).find(n => n.keyword === 'claims');
        const claims = claimsBlock
          ? nested(claimsBlock).filter(n => n.keyword === 'claim')
          : [];
        const carried = new Set(claims.map(c2 => c2.ident ?? ''));
        const mandatory = new Set(
          (set ?? [])
            .filter(
              p2 => facetTokens(p2.items, 'obligation')[0] === 'mandatory',
            )
            .map(p2 => p2.ident ?? ''),
        );
        for (const c2 of claims) {
          const pid = c2.ident ?? '';
          if (set !== null && !set.some(p2 => (p2.ident ?? '') === pid)) {
            err(
              'C150',
              `attestation ${a.ident}: claim "${pid}" is not a promise of "${promisesRef}" (attestation-references-resolve)`,
            );
          }
          const declared = facetTokens(c2.items, 'declared')[0];
          if (!declared) {
            err(
              'C151',
              `attestation ${a.ident}: claim "${pid}" carries no declaration reference (attestation-claim-lineage)`,
            );
          }
          const validatedBy = facetTokens(c2.items, 'validated_by')[0];
          if (!validatedBy) {
            err(
              'C151',
              `attestation ${a.ident}: claim "${pid}" carries no verdict reference (attestation-claim-lineage)`,
            );
          } else if (
            verdictIdsD.size > 0 &&
            !validatedBy.startsWith('/') &&
            !verdictIdsD.has(validatedBy)
          ) {
            err(
              'C150',
              `attestation ${a.ident}: claim "${pid}" names verdict "${validatedBy}", which is not declared (attestation-references-resolve)`,
            );
          }
        }
        if (set !== null) {
          for (const pid of mandatory) {
            if (!carried.has(pid)) {
              err(
                'C151',
                `attestation ${a.ident}: the mandatory promise "${pid}" of "${promisesRef}" is carried by no claim — a mandatory characteristic is carried by lineage, never restated (attestation-claim-lineage)`,
              );
            }
          }
        }
      }
      // C106 — dataspace governance provenance.
      for (const d2 of closureConstructs.filter(
        x => x.keyword === 'dataspace' && x.ident,
      )) {
        const hasSourceRefs = nested(d2).some(
          n => n.keyword === 'sourceRefs' || n.keyword === 'sourceRef',
        );
        const sourceLine = lines(d2).some(l => l.key === 'source');
        const refLine = lines(d2).some(l => l.key === 'ref');
        if (!hasSourceRefs && !sourceLine && !refLine) {
          issues.push({
            rule: 'C106',
            severity: 'warning',
            message: `dataspace ${d2.ident}: the dataspace cites no governance clause — the definition's charter is its clause-cited provenance (ref derives-from); an orphan definition is a warning, never silent (dataspace-governance-provenance)`,
          });
        }
      }
      // C162 — namespace-coherence.
      const namespaceIdsD = new Set(
        closureConstructs
          .filter(x => x.keyword === 'namespace' && x.ident)
          .map(x => x.ident!),
      );
      const metadata = pkg.constructs.find(x => x.keyword === 'metadata');
      const metaNs = metadata
        ? facetTokens(metadata.items, 'namespace')[0]
        : undefined;
      if (metaNs && namespaceIdsD.size > 0 && !namespaceIdsD.has(metaNs)) {
        err(
          'C162',
          `metadata namespace "${metaNs}" names no declared namespace block (namespace-coherence)`,
        );
      }
      // C164 — wire-mapping-coverage.
      const MAPPING_FORMATS = new Set(['xml', 'yaml', 'json', 'toml', 'csv']);
      const dataclassIdsD = new Set<string>();
      for (const c2 of closureConstructs.filter(
        x => x.keyword === 'class' && x.ident,
      )) {
        dataclassIdsD.add(c2.ident!);
        if (c2.ident!.includes('#')) {
          dataclassIdsD.add(c2.ident!.slice(0, c2.ident!.indexOf('#')));
        }
      }
      for (const w of closureConstructs.filter(x => x.keyword === 'mapping')) {
        if (w.format && !MAPPING_FORMATS.has(w.format)) {
          err(
            'C164',
            `mapping ${w.format}:${w.ident}: format "${w.format}" is outside the wire vocabulary (xml|yaml|json|toml|csv) (wire-mapping-coverage)`,
          );
        }
        if (
          dataclassIdsD.size > 0 &&
          w.ident &&
          !dataclassIdsD.has(w.ident) &&
          !dataclassIdsD.has(`${w.format}:${w.ident}`)
        ) {
          err(
            'C164',
            `mapping ${w.ident}: the class "${w.ident}" is no declared dataclass — a class serialized to a format carries the declared mapping (wire-mapping-coverage)`,
          );
        }
      }
    }

    // ── Batch D wave 2: the typed transition boundaries — C74 one
    //     name one type, C75 the action-chain dataflow, C76 the calls
    //     bindings. Boundary types resolve to KINDS through the
    //     package's quantity registers (kind id directly, or a unit id/
    //     symbol via its kind); unresolved tokens compare as plain type
    //     names; untyped composes with anything.
    {
      const kindDeclW2 = new Set<string>();
      const unitKindW2 = new Map<string, string>();
      for (const reg of closureConstructs.filter(
        x => x.keyword === 'quantity_register' && x.ident,
      )) {
        for (const k of nested(reg).filter(
          n => n.keyword === 'kind' && n.ident,
        )) {
          kindDeclW2.add(k.ident!);
        }
        for (const u of nested(reg).filter(
          n => n.keyword === 'unit' && n.ident,
        )) {
          const kind = facetTokens(u.items, 'kind')[0];
          if (kind) {
            unitKindW2.set(u.ident!, kind);
            const sym = facetTokens(u.items, 'symbol')[0];
            if (sym) {
              unitKindW2.set(sym, kind);
            }
          }
        }
      }
      type ResolvedT = { kind: string } | { token: string } | null;
      const resolveParamType = (type: string): ResolvedT => {
        const t2 = (type ?? '').trim();
        if (t2 === '') {
          return null;
        }
        if (kindDeclW2.has(t2)) {
          return { kind: t2 };
        }
        const k = unitKindW2.get(t2);
        if (k !== undefined) {
          return { kind: k };
        }
        return { token: t2 };
      };
      const typesCompatible = (a: ResolvedT, b: ResolvedT): boolean => {
        if (a === null || b === null) {
          return true;
        }
        if ('kind' in a && 'kind' in b) {
          return a.kind === b.kind;
        }
        if ('token' in a && 'token' in b) {
          return a.token === b.token;
        }
        return false;
      };
      const processByIdW2 = new Map(
        pkg.constructs
          .filter(x => x.keyword === 'process' && x.ident)
          .map(x => [x.ident!, x]),
      );
      // signature { in { name : type … } out { … } } — map entries.
      const sigParamsOf = (
        p2: Construct,
        direction: 'in' | 'out',
      ): { name: string; type: string }[] => {
        const sig = nested(p2).find(n => n.keyword === 'signature');
        if (!sig) {
          return [];
        }
        const dir = nested(sig).find(n => n.keyword === direction);
        return (dir ? lines(dir) : []).map(l => ({
          name: l.key ?? '',
          type: l.tokens[0] ?? '',
        }));
      };
      // registers { name : type … } — entries directly on the block.
      const registersOf = (p2: Construct): { name: string; type: string }[] => {
        const regs = nested(p2).find(n => n.keyword === 'registers');
        return (regs ? lines(regs) : []).map(l => ({
          name: l.key ?? '',
          type: l.tokens[0] ?? '',
        }));
      };
      // The calls bindings: `calls X { with { in { param : bind } out { … } } }`.
      const readBindingsOf = (
        calls: Construct,
        dirName: 'in' | 'out',
      ): { param: string; bind: string }[] => {
        const withB = nested(calls).find(n => n.keyword === 'with');
        const dir = withB
          ? nested(withB).find(n => n.keyword === dirName)
          : undefined;
        return (dir ? lines(dir) : []).map(l => ({
          param: l.key ?? '',
          bind: l.tokens[0] ?? '',
        }));
      };
      for (const p2 of pkg.constructs.filter(
        x => x.keyword === 'process' && x.ident,
      )) {
        const sites = new Map<string, { pos: string; type: string }[]>();
        const note = (pos: string, name: string, type: string) => {
          if (name !== '') {
            sites.set(name, [...(sites.get(name) ?? []), { pos, type }]);
          }
        };
        for (const prm of sigParamsOf(p2, 'in')) {
          note('signature in', prm.name, prm.type);
        }
        for (const prm of sigParamsOf(p2, 'out')) {
          note('signature out', prm.name, prm.type);
        }
        for (const prm of registersOf(p2)) {
          note('registers', prm.name, prm.type);
        }
        // C74 — one name, ONE type.
        for (const [name, decls] of sites) {
          let conflict: { a: string; b: string } | null = null;
          for (let x = 0; x < decls.length && !conflict; x++) {
            for (let y = x + 1; y < decls.length && !conflict; y++) {
              if (
                !typesCompatible(
                  resolveParamType(decls[x]!.type),
                  resolveParamType(decls[y]!.type),
                )
              ) {
                conflict = {
                  a: `${decls[x]!.pos} "${decls[x]!.type}"`,
                  b: `${decls[y]!.pos} "${decls[y]!.type}"`,
                };
              }
            }
          }
          if (conflict) {
            err(
              'C74',
              `process ${p2.ident}: "${name}" declares incompatible types — ${conflict.a} vs ${conflict.b} — one name, one type at a transition boundary (process-io-type-coherence)`,
            );
          }
        }
        const doesBody = nested(p2).find(n => n.keyword === 'does');
        if (!doesBody) {
          continue;
        }
        const actions = nested(doesBody).filter(n => n.keyword === 'action');
        const actionById = new Map(actions.map(a2 => [a2.ident ?? '', a2]));
        const readsOf = (a2: Construct): Set<string> => {
          const out = new Set<string>();
          for (const key of ['read', 'wait']) {
            const blk = nested(a2).find(n => n.keyword === key);
            if (blk) {
              for (const l of lines(blk)) {
                if (l.key && l.key !== key) {
                  out.add(l.key);
                }
                for (const t2 of l.tokens) {
                  out.add(t2);
                }
              }
            } else {
              for (const t2 of facetTokens(a2.items, key)) {
                out.add(t2);
              }
            }
          }
          const calls = nested(a2).find(n => n.keyword === 'calls');
          if (calls) {
            for (const b2 of readBindingsOf(calls, 'in')) {
              if (b2.bind !== '') {
                out.add(b2.bind);
              }
            }
          }
          out.delete('');
          return out;
        };
        const writesOf = (a2: Construct): Set<string> => {
          const out = new Set<string>();
          const write = nested(a2).find(n => n.keyword === 'write');
          if (write) {
            for (const l of lines(write)) {
              if (l.key && l.key !== 'write') {
                out.add(l.key);
              }
              for (const t2 of l.tokens) {
                out.add(t2);
              }
            }
            for (const i2 of write.items) {
              if (i2.kind === 'raw') {
                for (const t2 of i2.tokens) {
                  out.add(t2);
                }
              }
            }
          }
          const calls = nested(a2).find(n => n.keyword === 'calls');
          if (calls) {
            for (const b2 of readBindingsOf(calls, 'out')) {
              if (b2.bind !== '') {
                out.add(b2.bind);
              }
            }
          }
          out.delete('');
          return out;
        };
        const declaredNames = new Set<string>(['state', ...sites.keys()]);
        const provided = new Set<string>(['state']);
        for (const prm of sigParamsOf(p2, 'in')) {
          provided.add(prm.name);
        }
        // flow { s -> run -> e when "cond" } — the edges.
        const edgeRuns: { from: string; to: string; when?: string }[] = [];
        const flowBlock = nested(doesBody).find(n => n.keyword === 'flow');
        if (flowBlock) {
          for (const l of lines(flowBlock)) {
            const t2 = [l.key ?? '', ...l.tokens];
            for (let k2 = 1; k2 < t2.length; k2++) {
              if (t2[k2] !== '->') {
                continue;
              }
              const wi = t2.indexOf('when');
              edgeRuns.push({
                from: t2[k2 - 1]!,
                to: t2[k2 + 1] ?? '',
                when: wi > k2 ? t2[wi + 1] : undefined,
              });
            }
          }
        }
        const condReads = new Map<string, Set<string>>();
        for (const e of edgeRuns) {
          for (const m of (e.when ?? '').matchAll(
            /\bself\.([A-Za-z_][A-Za-z0-9_]*)/g,
          )) {
            condReads.set(
              e.from,
              (condReads.get(e.from) ?? new Set()).add(m[1]!),
            );
          }
        }
        // C75 — the must-analysis: definitely-written on EVERY incoming
        // path, shrink-to-fixpoint from the top.
        const allWritten = new Set<string>();
        for (const a2 of actions) {
          writesOf(a2).forEach(n2 => allWritten.add(n2));
        }
        const preds = new Map<string, string[]>();
        for (const e of edgeRuns) {
          if (actionById.has(e.from) && actionById.has(e.to)) {
            preds.set(e.to, [...(preds.get(e.to) ?? []), e.from]);
          }
        }
        const availIn = new Map<string, Set<string>>();
        for (const a2 of actions) {
          availIn.set(a2.ident ?? '', new Set(allWritten));
        }
        let changed = true;
        while (changed) {
          changed = false;
          for (const a2 of actions) {
            const sid = a2.ident ?? '';
            const ps = preds.get(sid) ?? [];
            let next = new Set<string>();
            if (ps.length > 0) {
              next = new Set(allWritten);
              for (const pid of ps) {
                const pOut = new Set([
                  ...(availIn.get(pid) ?? []),
                  ...writesOf(actionById.get(pid)!),
                ]);
                next = new Set([...next].filter(n2 => pOut.has(n2)));
              }
            }
            const cur = availIn.get(sid)!;
            if (next.size !== cur.size || [...next].some(n2 => !cur.has(n2))) {
              availIn.set(sid, next);
              changed = true;
            }
          }
        }
        for (const a2 of actions) {
          const sid = a2.ident ?? '';
          for (const n2 of readsOf(a2)) {
            if (!declaredNames.has(n2) || provided.has(n2)) {
              continue;
            }
            if (!(availIn.get(sid) ?? new Set<string>()).has(n2)) {
              err(
                'C75',
                `process ${p2.ident}: action "${sid}" reads "${n2}", which is neither an IN parameter/instance value nor written on every incoming flow path (process-flow-io-cover)`,
              );
            }
          }
          for (const n2 of condReads.get(sid) ?? new Set<string>()) {
            if (!declaredNames.has(n2) || provided.has(n2)) {
              continue;
            }
            if (
              !new Set([...(availIn.get(sid) ?? []), ...writesOf(a2)]).has(n2)
            ) {
              err(
                'C75',
                `process ${p2.ident}: the edge condition at "${sid}" reads "${n2}", which is neither an IN parameter/instance value nor written on every incoming flow path (process-flow-io-cover)`,
              );
            }
          }
        }
        // The dead-write warning leg.
        const allRead = new Set<string>();
        for (const a2 of actions) {
          readsOf(a2).forEach(n2 => allRead.add(n2));
        }
        for (const names of condReads.values()) {
          names.forEach(n2 => allRead.add(n2));
        }
        const outNames = new Set(sigParamsOf(p2, 'out').map(o2 => o2.name));
        for (const a2 of actions) {
          if (facetTokens(a2.items, 'capture')[0] === 'true') {
            continue;
          }
          for (const n2 of writesOf(a2)) {
            if (!declaredNames.has(n2)) {
              continue;
            }
            if (!allRead.has(n2) && !outNames.has(n2)) {
              issues.push({
                rule: 'C75',
                severity: 'warning',
                message: `process ${p2.ident}: action "${a2.ident}" writes "${n2}", which no action reads and no OUT parameter names — a dead output (process-flow-io-cover)`,
              });
            }
          }
        }
        // C76 — the calls bindings.
        for (const a2 of actions) {
          const calls = nested(a2).find(n => n.keyword === 'calls');
          if (!calls) {
            continue;
          }
          const calleeName =
            calls.ident || (facetTokens(calls.items, 'target')[0] ?? '');
          const callee = processByIdW2.get(calleeName);
          if (!callee) {
            err(
              'C76',
              `process ${p2.ident}: action "${a2.ident}" calls "${calleeName}", which is not a declared process (subprocess-signature-bound)`,
            );
            continue;
          }
          const checkBindings = (
            direction: 'IN' | 'OUT',
            params: { name: string; type: string }[],
            bindings: { param: string; bind: string }[],
          ): void => {
            for (const prm of params) {
              const bs = bindings.filter(b2 => b2.param === prm.name);
              if (bs.length === 0) {
                err(
                  'C76',
                  `process ${p2.ident}: action "${a2.ident}" calls "${calleeName}": ${direction} parameter "${prm.name}" is not ${direction === 'IN' ? 'bound from a caller register' : 'mapped back to a caller register'} — the signature binds completely (subprocess-signature-bound)`,
                );
              } else if (bs.length > 1) {
                err(
                  'C76',
                  `process ${p2.ident}: action "${a2.ident}" calls "${calleeName}": ${direction} parameter "${prm.name}" is bound ${bs.length} times — exactly once (subprocess-signature-bound)`,
                );
              }
            }
            for (const b2 of bindings) {
              const prm = params.find(q2 => q2.name === b2.param);
              if (!prm) {
                err(
                  'C76',
                  `process ${p2.ident}: action "${a2.ident}" calls "${calleeName}": "${b2.param}" is not a declared ${direction} parameter of the callee (subprocess-signature-bound)`,
                );
                continue;
              }
              const callerType = sites.get(b2.bind)?.[0]?.type;
              if (callerType === undefined) {
                continue;
              }
              if (
                !typesCompatible(
                  resolveParamType(callerType),
                  resolveParamType(prm.type),
                )
              ) {
                err(
                  'C76',
                  `process ${p2.ident}: action "${a2.ident}" calls "${calleeName}": caller "${b2.bind}" (${callerType || 'untyped'}) and ${direction} parameter "${b2.param}" (${prm.type || 'untyped'}) are not kind-compatible (subprocess-signature-bound)`,
                );
              }
            }
          };
          checkBindings(
            'IN',
            sigParamsOf(callee, 'in'),
            readBindingsOf(calls, 'in'),
          );
          checkBindings(
            'OUT',
            sigParamsOf(callee, 'out'),
            readBindingsOf(calls, 'out'),
          );
        }
      }
    }

    // C178 legacy-carrier-deprecated: a package declaring the language
    // revision that arms the deprecation counts its legacy ocl{…} string
    // carriers — the register's reach grows here (the kernel judges the
    // same, inert below the declared revision).
    {
      const manifest = pkg.constructs.find(c => c.keyword === 'package');
      const langLine = manifest?.items.find(
        i => i.kind === 'line' && i.key === 'language',
      );
      const lang = (langLine?.tokens ?? []).join(' ');
      if (/^v(3\.[4-9]|[4-9]|\d{2})/.test(lang)) {
        const carriers = new Set([
          'expression',
          'derive',
          'derivation',
          'check',
        ]);
        const owners: { keyword: string; ident: string; items: Item[] }[] = [];
        const gather = (
          keyword: string,
          ident: string,
          items: Item[],
        ): void => {
          owners.push({ keyword, ident, items });
          for (const it of items) {
            if (it.kind === 'construct' && it.construct) {
              gather(
                it.construct.keyword,
                it.construct.ident ?? '',
                it.construct.items,
              );
            }
          }
        };
        for (const c of pkg.constructs) {
          gather(c.keyword, c.ident ?? '', c.items);
        }
        for (const o of owners) {
          for (const it of o.items) {
            if (
              it.kind === 'line' &&
              carriers.has(it.key ?? '') &&
              it.blocks.length === 0 &&
              it.tokens.some(t => t.includes('ocl{'))
            ) {
              err(
                'C178',
                `${o.keyword} ${o.ident}: the legacy ocl{…} carrier is deprecated at ${lang} — migrate to the inline block (legacy-carrier-deprecated)`,
              );
            }
          }
        }
      }
    }
    // C179 uncertainty-budget-resolves
    const verdictIds = new Set(
      closureConstructs
        .filter(x => x.keyword === 'verdict' && x.ident)
        .map(x => x.ident),
    );
    for (const b of pkg.constructs.filter(
      x => x.keyword === 'uncertainty_budget',
    )) {
      const target = facetTokens(b.items, 'target')[0];
      if (!target) {
        err(
          'C179',
          `uncertainty_budget ${b.ident}: declares no target — the budget backs a declared verdict's measured quantity (uncertainty-budget-resolves)`,
        );
      } else if (!verdictIds.has(target)) {
        err(
          'C179',
          `uncertainty_budget ${b.ident}: target "${target}" is not a declared verdict (uncertainty-budget-resolves)`,
        );
      }
      const covRun = facetTokens(b.items, 'coverage');
      const coverage =
        covRun.length >= 2 && covRun[0] === 'k' ? covRun[1] : undefined;
      if (coverage !== undefined && !(Number(coverage) > 0)) {
        err(
          'C179',
          `uncertainty_budget ${b.ident}: coverage k "${coverage}" is not a positive number (uncertainty-budget-resolves)`,
        );
      }
      for (const comp of nested(b).filter(x => x.keyword === 'component')) {
        const type = facetTokens(comp.items, 'type')[0];
        if (type === 'A') {
          const series = facetTokens(comp.items, 'series')[0];
          if (!series || !seriesVars.has(series)) {
            err(
              'C179',
              `uncertainty_budget ${b.ident}: component ${comp.ident}'s series "${series ?? '(none)'}" is not a declared captured series (uncertainty-budget-resolves)`,
            );
          }
        } else if (type === 'B') {
          if (!facetTokens(comp.items, 'distribution')[0]) {
            err(
              'C179',
              `uncertainty_budget ${b.ident}: component ${comp.ident} is Type B but states no distribution (uncertainty-budget-resolves)`,
            );
          }
          if (!facetTokens(comp.items, 'half_width')[0]) {
            err(
              'C179',
              `uncertainty_budget ${b.ident}: component ${comp.ident} is Type B but states no half_width (uncertainty-budget-resolves)`,
            );
          }
        }
      }
    }
  }

  // ── Batch C: the coverage plane — C5 the req⇄test closure, C53/C54
  //     the uses anchoring, and the allowlist
  //     applied BY THIS IMPLEMENTATION (C57's stale ratchet + C55's
  //     coverage budget) — the second pair of eyes on the KNOWN
  //     register, judging the retirement waves' entry retirement.
  {
    const rawTokensC = (c2: Construct): string[] =>
      c2.items.flatMap(i2 =>
        i2.kind === 'raw'
          ? i2.tokens
          : i2.kind === 'line'
            ? [i2.key ?? '', ...i2.tokens]
            : [],
      );
    const reqIdsC = new Set(
      pkg.constructs
        .filter(x => x.keyword === 'requirement' && x.ident)
        .map(x => x.ident!),
    );
    const symbolIdsC = new Set(
      closureConstructs
        .filter(x => x.keyword === 'symbol' && x.ident)
        .map(x => x.ident!),
    );
    const attrIdsC = new Set(
      closureConstructs
        .filter(x => x.keyword === 'attribute_definition' && x.ident)
        .map(x => x.ident!),
    );
    const behaviorIdsC = new Set(
      closureConstructs
        .filter(x => x.keyword === 'behavior' && x.ident)
        .map(x => x.ident!),
    );
    const dimIdsC = new Set<string>();
    for (const c2 of closureConstructs.filter(
      x => x.keyword === 'dimension' && x.ident,
    )) {
      dimIdsC.add(c2.ident!);
    }
    for (const inst of closureConstructs.filter(
      x => x.keyword === 'instrument' && x.ident,
    )) {
      for (const d2 of nested(inst).filter(n => n.keyword === 'dimension')) {
        if (d2.ident) {
          dimIdsC.add(d2.ident);
        }
      }
    }
    const classMembersC = new Map<string, string[]>();
    for (const rc of pkg.constructs.filter(
      x => x.keyword === 'requirement_class' && x.ident,
    )) {
      const members = nested(rc).find(n => n.keyword === 'members');
      classMembersC.set(
        rc.ident!,
        members ? rawTokensC(members).filter(x => x !== '') : [],
      );
    }
    const NON_TEST_VERIFICATION = new Set([
      'definitional',
      'examination',
      'inspection',
      'documentation',
      'computational',
      'deferred',
      'implicit',
    ]);
    const covered = new Set<string>();
    const coverWithMembers = (id: string): void => {
      covered.add(id);
      for (const m of classMembersC.get(id) ?? []) {
        covered.add(m);
      }
    };
    for (const t of pkg.constructs.filter(
      x => x.keyword === 'conformance_test' && x.ident,
    )) {
      const targets = nested(t).find(n => n.keyword === 'targets');
      if (targets) {
        for (const id of rawTokensC(targets)) {
          coverWithMembers(id);
        }
      }
    }
    const provisioned = new Set<string>();
    for (const p2 of pkg.constructs.filter(
      x => x.keyword === 'process' && x.ident,
    )) {
      for (const u of facetTokens(p2.items, 'provision_refs')) {
        provisioned.add(u);
      }
      // Both spellings: provision_refs and the OIML-CS validate_provision
      // channel (the abstract-process doctrine's coverage route).
      for (const prName of ['provision_refs', 'validate_provision']) {
        const pr = nested(p2).find(n => n.keyword === prName);
        if (pr) {
          for (const id of rawTokensC(pr)) {
            provisioned.add(id);
          }
        }
      }
    }
    // C5 — the req⇄test closure.
    for (const r of pkg.constructs.filter(
      x => x.keyword === 'requirement' && x.ident,
    )) {
      if (covered.has(r.ident!) || provisioned.has(r.ident!)) {
        continue;
      }
      const verif = nested(r).find(n => n.keyword === 'verification');
      const vm =
        (verif ? facetTokens(verif.items, 'method')[0] : undefined) ??
        facetTokens(r.items, 'verification')[0] ??
        '';
      if (NON_TEST_VERIFICATION.has(vm)) {
        continue;
      }
      issues.push({
        rule: 'C5',
        severity: 'warning',
        message: `requirement ${r.ident}: no conformance test targets it and it declares no non-test verification — an undeclared coverage gap is always a finding (req-test-coverage)`,
      });
    }
    for (const t of pkg.constructs.filter(
      x => x.keyword === 'conformance_test' && x.ident,
    )) {
      const targets = nested(t).find(n => n.keyword === 'targets');
      const n = targets ? rawTokensC(targets).length : 0;
      if (n === 0) {
        issues.push({
          rule: 'C5',
          severity: 'warning',
          message: `conformance test ${t.ident}: targets no requirement`,
        });
      }
    }
    // C53 — coverage-uses-bound.
    const calcNamesC = new Set<string>();
    for (const c2 of closureConstructs.filter(
      x => x.keyword === 'calculation' && x.ident,
    )) {
      if (c2.ident) {
        calcNamesC.add(c2.ident);
      }
      const nm = facetTokens(c2.items, 'name')[0];
      if (nm) {
        calcNamesC.add(nm);
      }
    }
    const tableIdsC = new Set(
      closureConstructs
        .filter(x => x.keyword === 'table' && x.ident)
        .map(x => x.ident!),
    );
    const profileDefsOf = (tableId: string): Set<string> => {
      const out = new Set<string>();
      const tbl = closureConstructs.find(
        x => x.keyword === 'table' && x.ident === tableId,
      );
      // Both spellings: `profile_defs { <name> { } }` and the corpus's
      // `profiles { profile <name> { } }`.
      for (const defsName of ['profile_defs', 'profiles']) {
        const defs = tbl
          ? nested(tbl).find(n => n.keyword === defsName)
          : undefined;
        for (const d2 of defs ? nested(defs) : []) {
          const name =
            d2.ident || (d2.keyword === 'profile' ? d2.ident : d2.keyword);
          if (name && name !== 'profile') {
            out.add(name);
          }
        }
        if (defs) {
          for (const l of defs ? lines(defs) : []) {
            if (l.key && l.key !== defsName && l.key !== 'profile') {
              out.add(l.key);
            }
          }
        }
      }
      return out;
    };
    const profileRefResolves = (ref: string): boolean => {
      if (tableIdsC.has(ref)) {
        return true;
      }
      const dot = ref.indexOf('.');
      if (dot > 0) {
        const tbl = ref.slice(0, dot);
        const name = ref.slice(dot + 1);
        if (profileDefsOf(tbl).has(name)) {
          return true;
        }
      }
      return profileDefsOf('profiles').has(ref);
    };
    const limitUsesOf = (r: Construct): string[] => {
      const out: string[] = [];
      for (const lim of nested(r).filter(n => n.keyword === 'limit')) {
        const uses = nested(lim).find(n => n.keyword === 'uses');
        if (uses) {
          out.push(
            ...lines(uses)
              .flatMap(l => [l.key ?? '', ...l.tokens])
              .filter(x => x !== ''),
          );
        }
      }
      return out;
    };
    for (const r of pkg.constructs.filter(
      x => x.keyword === 'requirement' && x.ident,
    )) {
      for (const u of limitUsesOf(r)) {
        if (/^(table|profile):/.test(u)) {
          // C54's lookup-table leg.
          if (u.startsWith('table:')) {
            const id = u.slice('table:'.length);
            if (!tableIdsC.has(id)) {
              err(
                'C54',
                `requirement ${r.ident}: limit.uses "${u}" — table "${id}" is not declared (coverage-lookup-table-exists)`,
              );
            }
          } else {
            const ref = u.slice('profile:'.length);
            if (!profileRefResolves(ref)) {
              err(
                'C54',
                `requirement ${r.ident}: limit.uses "${u}" — profile "${ref}" is not a declared table or profile definition (coverage-lookup-table-exists)`,
              );
            }
          }
          continue;
        }
        if (u.startsWith('observable:')) {
          const id = u.slice('observable:'.length);
          if (!symbolIdsC.has(id)) {
            err(
              'C53',
              `requirement ${r.ident}: limit.uses "${u}" — observable "${id}" is not a declared symbol (coverage-uses-bound)`,
            );
          }
          continue;
        }
        if (u.startsWith('formula:')) {
          const id = u.slice('formula:'.length);
          if (!calcNamesC.has(id)) {
            err(
              'C53',
              `requirement ${r.ident}: limit.uses "${u}" — formula "${id}" is not a declared calculation (coverage-uses-bound)`,
            );
          }
          continue;
        }
        const leaf = u.split('.').pop() ?? u;
        if (
          !attrIdsC.has(leaf) &&
          !attrIdsC.has(u) &&
          !symbolIdsC.has(leaf) &&
          !symbolIdsC.has(u) &&
          !reqIdsC.has(u) &&
          !dimIdsC.has(leaf) &&
          !behaviorIdsC.has(leaf) &&
          u !== 'load'
        ) {
          err(
            'C53',
            `requirement ${r.ident}: limit.uses "${u}" binds nothing — it is not a declared attribute, symbol, requirement, dimension, or behavior (coverage-uses-bound)`,
          );
        }
      }
    }
    for (const c2 of closureConstructs.filter(
      x => x.keyword === 'calculation' && x.ident,
    )) {
      const profile = facetTokens(c2.items, 'profile')[0];
      if (profile && !profileRefResolves(profile)) {
        err(
          'C54',
          `calculation ${facetTokens(c2.items, 'name')[0] || c2.ident}: lookup profile "${profile}" is not a declared table or profile definition (coverage-lookup-table-exists)`,
        );
      }
    }
    // (C51/C52 the audit links are mirrored above — the pre-existing
    // legs at the composition family.)
  }

  // ── the allowlist applied BY THIS IMPLEMENTATION (the kernel's
  //    applyAllowlist): KNOWN entries mark their issues and the stale
  //    ratchet (C57) plus the coverage budget (C55) judge the register.
  //    A dormant rule's entry — one this implementation does not mirror
  //    — never goes stale, exactly like the kernel's level gate.
  {
    const al = pkg.allowlist;
    if (al) {
      const globMatch = (glob: string, text: string): boolean =>
        new RegExp(
          '^' +
            glob
              .split('*')
              .map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
              .join('[\\s\\S]*') +
            '$',
        ).test(text);
      const elementId = (message: string): string => {
        const m = /^[a-z_]+ ([^:\s][^:]*):/.exec(message);
        return m ? m[1]! : '';
      };
      const activeRules = pkg.mirroredRules;
      const knownIdx = new Set<number>();
      const staleEntries: { rule: string; match: string }[] = [];
      for (const e of al.entries) {
        if (activeRules !== undefined && !activeRules.has(e.rule)) {
          continue;
        }
        let matched = false;
        issues.forEach((i2, idx) => {
          if (i2.rule !== e.rule || knownIdx.has(idx)) {
            return;
          }
          if (!globMatch(e.match, i2.message)) {
            return;
          }
          if (
            e.id !== undefined &&
            e.id !== '' &&
            !globMatch(e.id, elementId(i2.message))
          ) {
            return;
          }
          knownIdx.add(idx);
          matched = true;
        });
        if (!matched) {
          staleEntries.push(e);
        }
      }
      for (const e of staleEntries) {
        err(
          'C57',
          `.primmel-allowlist.prl: STALE entry [${e.rule}] "${e.match}" matches no issue — the data was fixed; remove the entry (allowlist-stale)`,
        );
      }
      // The C55 budget caps the C51/C52 coverage warnings; the C72 text
      // budget is judged inside the text-coverage family. A budget line
      // that is NOT the text budget governs C51/C52 (the kernel's
      // coverage_budget key).
      const covBudget = al.budgets.find(b2 => b2.key === 'coverage_budget');
      if (covBudget) {
        const budget = Number.parseInt(covBudget.raw, 10);
        if (Number.isInteger(budget) && budget >= 0) {
          const active =
            activeRules === undefined ||
            [...BUDGETED_RULES_C].some(r2 => activeRules.has(r2));
          if (active) {
            const count = issues.filter(
              (i2, idx) =>
                BUDGETED_RULES_C.has(i2.rule) &&
                i2.severity === 'warning' &&
                !knownIdx.has(idx),
            ).length;
            if (count > budget) {
              err(
                'C55',
                `.primmel-allowlist.prl: ${count} coverage warnings exceed the package budget of ${budget} — close the gaps or raise the budget with a clause-referenced reason (coverage-budget)`,
              );
            } else if (count < budget) {
              issues.push({
                rule: 'C55',
                severity: 'warning',
                message: `.primmel-allowlist.prl: coverage budget ${budget} has slack — only ${count} coverage warnings remain; tighten the budget (the allowlist only shrinks) (coverage-budget)`,
              });
            }
          }
        }
      }
    }
  }

  return issues;
}

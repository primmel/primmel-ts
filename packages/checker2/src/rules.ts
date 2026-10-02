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

export function check(pkg: ParsedPackage, located?: Located): Issue[] {
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
    // C112: a reference's urn is a well-formed IRI.
    if (c.keyword === 'reference') {
      const urn = tokensOf(c, 'urn')[0] ?? '';
      if (
        urn !== '' &&
        !/^[A-Za-z][A-Za-z0-9+.-]*:[^\s<>"{}|^`\\]*$/.test(urn)
      ) {
        err(
          'C112',
          `reference ${c.ident}: urn "${urn}" is not a well-formed IRI (a scheme followed by no whitespace or IRI delimiters) (reference-identity)`,
        );
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
      if (defaults > 1) {
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

  return issues;
}

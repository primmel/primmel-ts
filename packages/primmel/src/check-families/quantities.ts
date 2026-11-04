// ─────────────────────────────────────────────────────────────────────
// The quantities family (C32–C36, C114/C115, C118; TODO.roadmap/06,
// doctrine ch. 6; MN 114 v3.2 clauses 11.1.2/11.1.3/13.7.1): the
// quantity-kind coherence plane. Coherence is judged on quantity KINDS
// — resolved through the package's quantity_registers — never on unit
// strings. The register walk builds the shared indexes (kindDecl,
// unitToKind/unitHome/unitEntry — a redeclaration that is IDENTICAL is
// idempotent under composition, only a CONFLICTING entry redefines);
// the C32 INV-1 no-bare-numbers legs, the C33 coherence legs (units,
// instances, symbols/verdicts, the strayed duals leg), the C35 ISO
// 8601 time legs (instance values + timer-event periods), the C36
// map<K, V> well-formedness, the C114 limit↔verdict quantity chain,
// the C115 calculation-signature shape (unit legs on the rollout
// WARNING), and the C118 requirement-parameter shape.
//
// THE FAMILY-MODULE PATTERN (the check.ts decomposition, one family
// at a time): the family takes the context record it actually uses —
// `standard`, the precomputed id sets its resolve legs read, and the
// two emit closures — and nothing else. The bodies move verbatim from
// check.ts; the compiler and the suite pin the move. (The C34 duals
// leg, C35 timer leg, and C36 map-type leg lived after the SSOT
// families in check.ts and ride here with the rest of the family.)
// ─────────────────────────────────────────────────────────────────────

import { isValidTimeValue, isDuration } from '../time';
import { isWellFormedMapType } from '../type-expr';
import { DIM_ALIASES, isIdentityPath } from '../check-paths';
import type { AttributeDefinition } from '../types/Subject';
import type Standard from '../types/Standard';

export interface QuantitiesIndexes {
  /** kind id → register id (the register walk's kind index). */
  kindDecl: Map<string, string>;
  /** unit id/symbol → its declared kind (the C33 machinery). */
  kindOfUnit: (unit: string | undefined) => string | undefined;
}

export interface QuantitiesContext {
  standard: Standard;
  dimIds: Map<string, Set<string> | null>;
  attrIds: Set<string>;
  behaviorIds: Set<string>;
  symbolIds: Set<string>;
  err: (check: string, message: string) => void;
  warn: (check: string, message: string) => void;
}

export function runQuantitiesFamily({
  standard,
  dimIds,
  attrIds,
  behaviorIds,
  symbolIds,
  err,
  warn,
}: QuantitiesContext): QuantitiesIndexes {
  // ── C32–C36: quantities, time, and the IS↔HAS duality ──
  // (TODO.roadmap/06; doctrine ch. 6). Coherence is judged on quantity
  // KINDS — resolved through the package's quantity_registers — never on
  // unit strings.
  const kindDecl = new Map<string, string>(); // kind id → register id
  for (const reg of standard.quantityRegisters ?? []) {
    for (const k of reg.kinds) {
      if (!kindDecl.has(k.id)) {
        kindDecl.set(k.id, reg.id);
      }
    }
  }
  const unitToKind = new Map<string, string>(); // unit id|symbol → kind id
  const unitHome = new Map<string, string>(); // unit id|symbol → register id
  // The full entry behind each key: a redeclaration that is
  // IDENTICAL (same kind, factor, symbol) is idempotent under
  // composition — the sibling IEC packages each declare kV/degC for
  // standalone self-containment, and the merged register set carries
  // one shared entry, not a conflict. Only a CONFLICTING entry (the
  // same key, different meaning) is a redefinition.
  const unitEntry = new Map<string, string>(); // key → kind|factor|symbol
  const registersExist = (standard.quantityRegisters ?? []).length > 0;
  for (const reg of standard.quantityRegisters ?? []) {
    for (const u of reg.units) {
      // C33 — the unit's kind must resolve across the package's registers.
      if (!kindDecl.has(u.kind)) {
        err(
          'C33',
          `quantity_register ${reg.id}: unit "${u.id}" declares kind "${u.kind}", which no quantity_register declares (quantity-coherence)`,
        );
      }
      // C33 — no cross-register redefinition: a rec EXTENDS the register
      // with domain units; it never redefines an existing entry.
      const entry = `${u.kind}|${u.factorToSI}|${u.offsetToSI ?? ''}|${u.symbol}`;
      for (const key of new Set([u.id, u.symbol].filter(s => s))) {
        const prior = unitHome.get(key);
        if (prior !== undefined) {
          if (unitEntry.get(key) !== entry) {
            err(
              'C33',
              `quantity_register ${reg.id}: unit "${u.id}" ("${key}") redefines a unit already declared by register "${prior}" — a package extends the register, it never redefines entries (quantity-coherence)`,
            );
          }
        } else {
          unitHome.set(key, reg.id);
          unitEntry.set(key, entry);
          unitToKind.set(key, u.kind);
        }
      }
      // the declared normalization layer (CRITIQUE-2 #8): a variant
      // token resolves to its unit — the same home, entry, and kind.
      // A collision refused at parse; a cross-register variant rehome
      // follows the unit's own entry.
      for (const v of u.spellingVariants ?? []) {
        const prior = unitHome.get(v);
        if (prior !== undefined && unitEntry.get(v) !== entry) {
          err(
            'C33',
            `quantity_register ${reg.id}: unit "${u.id}" ("${v}") redefines a token already answered by register "${prior}" — a package extends the register, it never redefines entries (quantity-coherence)`,
          );
        } else if (prior === undefined) {
          unitHome.set(v, reg.id);
          unitEntry.set(v, entry);
          unitToKind.set(v, u.kind);
        }
      }
    }
  }
  const kindOfUnit = (unit: string | undefined): string | undefined =>
    unit === undefined ? undefined : unitToKind.get(unit.trim());

  // C32 — INV-1: no bare numbers. A value stated for a declared physical
  // quantity (the attribute definition carries a unit, declares a
  // quantity_kind, or is typed QuantityValue) must itself carry a unit.
  // An empty-string unit token counts as bare, not as unit'd.
  const attrDefs = standard.attributeDefinitions ?? [];
  const isPhysicalAttr = (def: AttributeDefinition): boolean =>
    def.unit !== '' ||
    def.quantityKind !== '' ||
    def.valueType === 'QuantityValue';
  const physicalFacet = (def: AttributeDefinition): string =>
    def.unit !== ''
      ? `unit "${def.unit}"`
      : def.valueType === 'QuantityValue'
        ? 'value_type QuantityValue'
        : `quantity_kind ${def.quantityKind}`;
  for (const inst of standard.instances ?? []) {
    const planes: Array<'attributes' | 'testContext'> = [
      'attributes',
      'testContext',
    ];
    for (const plane of planes) {
      for (const [key, v] of Object.entries(inst.has?.[plane] ?? {})) {
        const def = attrDefs.find(a => a.id === key);
        if (!def) {
          continue; // C17 reports the undeclared attribute
        }
        if (isPhysicalAttr(def) && (v.unit ?? '') === '') {
          err(
            'C32',
            `instance ${inst.id}: attribute "${key}" is a declared physical quantity (` +
              physicalFacet(def) +
              `) but the stated value is a bare number — INV-1: no bare numbers (inv1-no-bare-quantity)`,
          );
        }
        // C33 (warning leg) — a stated unit no register declares is
        // unmapped (doctrine §6.8: unmapped units are warnings). An empty
        // unit token is bare (C32 above), not unmapped.
        if (
          v.unit !== undefined &&
          v.unit !== '' &&
          registersExist &&
          kindOfUnit(v.unit) === undefined
        ) {
          warn(
            'C33',
            `instance ${inst.id}: attribute "${key}" carries unit "${v.unit}", which no quantity_register declares (quantity-coherence)`,
          );
        }
        // C33 — stated kind vs the definition's declared kind: an explicit
        // `kind` on the value, or the stated unit's kind, must agree with
        // the attribute definition's quantity_kind / declared unit's kind.
        const statedKind = v.quantityKind ?? kindOfUnit(v.unit);
        if (def.quantityKind && statedKind && statedKind !== def.quantityKind) {
          err(
            'C33',
            `instance ${inst.id}: attribute "${key}" (kind ${def.quantityKind}) stated with ` +
              (v.quantityKind
                ? `kind "${v.quantityKind}"`
                : `unit "${v.unit}" (kind ${statedKind})`) +
              ` — quantity kinds differ (quantity-coherence)`,
          );
        } else if (!def.quantityKind && def.unit && v.unit) {
          const defKind = kindOfUnit(def.unit);
          const vKind = kindOfUnit(v.unit);
          if (defKind && vKind && defKind !== vKind) {
            err(
              'C33',
              `instance ${inst.id}: attribute "${key}" declared with unit "${def.unit}" (kind ${defKind}) stated with unit "${v.unit}" (kind ${vKind}) — quantity kinds differ (quantity-coherence)`,
            );
          }
        }
        // C35 — time-typed attributes carry ISO 8601 time values.
        if (
          ['date', 'datetime', 'duration', 'period'].includes(def.valueType) &&
          !isValidTimeValue(
            def.valueType as 'date' | 'datetime' | 'duration' | 'period',
            String(v.value),
          )
        ) {
          err(
            'C35',
            `instance ${inst.id}: attribute "${key}" (value_type ${def.valueType}) value "${String(v.value)}" is not a valid ISO 8601 ${def.valueType} (time-format)`,
          );
        }
      }
    }
  }

  // C32/C33 — condition-set entries. C32: a NUMERIC entry value (with or
  // without tolerance) stated without a unit is a bare physical quantity —
  // INV-1 (free-text values like "local ambient" stay legal). C33: the

  // C33 — symbols and verdict quantities: a declared quantity_kind must
  // agree with the declared unit's kind.
  const unitables: Array<{
    kind: string;
    id: string;
    unit: string;
    qk: string;
  }> = [
    ...(standard.symbols ?? []).map(s => ({
      kind: 'symbol',
      id: s.id,
      unit: s.unit,
      qk: s.quantityKind,
    })),
    ...(standard.verdicts ?? []).map(v => ({
      kind: 'verdict',
      id: v.id,
      unit: v.unit,
      qk: v.quantityKind,
    })),
  ];
  for (const u of unitables) {
    if (!u.unit || !u.qk) {
      continue;
    }
    const uKind = kindOfUnit(u.unit);
    if (uKind && kindDecl.has(u.qk) && uKind !== u.qk) {
      err(
        'C33',
        `${u.kind} ${u.id}: declared quantity_kind "${u.qk}" but unit "${u.unit}" measures kind ${uKind} — quantity kinds differ (quantity-coherence)`,
      );
    }
  }

  // ── C114/C115: the v3.2 units-typed quantities (MN 114 v3.2, clauses
  // 11.1.2 and 13.7.1; TODO.primmel/11) ──
  // C114 — limit-quantity-coherence: a limit that declares its derived
  // quantity's typing AND binds a verdict must agree with the verdict's
  // declared quantity, so a limit and its acceptance chain can never
  // drift apart in units. Silent when either side leaves the facet
  // undeclared (the block is the migration path); an unresolvable
  // accepts.verdict is the resolution rule's leg, not this one's.
  for (const r of standard.requirements ?? []) {
    const q = r.limit?.quantity;
    const accepts = r.limit?.accepts;
    if (!q || !accepts) {
      continue;
    }
    const verdict = (standard.verdicts ?? []).find(
      v => v.id === accepts.verdict,
    );
    if (!verdict) {
      continue;
    }
    if (q.kind && verdict.quantityKind && q.kind !== verdict.quantityKind) {
      err(
        'C114',
        `requirement ${r.id}: limit declares quantity kind "${q.kind}" but accepts verdict ${verdict.id} derives kind "${verdict.quantityKind}" — a limit and its acceptance chain never drift apart in units (limit-quantity-coherence)`,
      );
    }
    if (q.unit && verdict.unit && q.unit !== verdict.unit) {
      err(
        'C114',
        `requirement ${r.id}: limit declares quantity unit "${q.unit}" but accepts verdict ${verdict.id} derives unit "${verdict.unit}" (limit-quantity-coherence)`,
      );
    }
  }

  // C115 — calculation-signature-shape: a retrieved calculation is
  // executable exactly when its signature is data. Every declared unit
  // resolves to a registered unit and every quantity_kind to a registered
  // kind of the merged quantity register, the two agree in kind, a
  // range's min never exceeds its max, and an enum-typed input declares
  // its values. The parser's dimensionless default ('1') is not an
  // authored unit — the unit legs fire on authored units only. The
  // unit-resolution leg ships as a WARNING during the v3.2 rollout (see
  // the rule's catalog entry).
  type SignatureEntry = {
    owner: string;
    type: string;
    unit: string;
    isInput: boolean;
    quantityKind?: string;
    rangeMin?: string;
    rangeMax?: string;
    hasRange?: boolean;
    enumValues?: string[];
  };
  for (const c of standard.calculations ?? []) {
    const entries: SignatureEntry[] = [
      ...(c.inputs ?? []).map(inp => ({
        owner: `calculation ${c.id}: input ${inp.name}`,
        type: inp.type,
        unit: inp.unit,
        isInput: true,
        quantityKind: inp.quantityKind,
        rangeMin: inp.rangeMin,
        rangeMax: inp.rangeMax,
        hasRange: inp.hasRange,
        enumValues: inp.enumValues,
      })),
      {
        owner: `calculation ${c.id}: output`,
        type: c.output.type,
        unit: c.output.unit,
        isInput: false,
        quantityKind: c.output.quantityKind,
        rangeMin: c.output.rangeMin,
        rangeMax: c.output.rangeMax,
        hasRange: c.output.hasRange,
      },
    ];
    for (const e of entries) {
      const declaredUnit = e.unit && e.unit !== '1' ? e.unit : '';
      const unitKind = declaredUnit ? kindOfUnit(declaredUnit) : undefined;
      if (declaredUnit && registersExist && unitKind === undefined) {
        // Rollout warning leg (see the rule's catalog entry): the spec's
        // error tightens when the estate's registers catch up.
        warn(
          'C115',
          `${e.owner}: unit "${declaredUnit}" resolves to no registered unit of the merged quantity register (calculation-signature-shape)`,
        );
      }
      if (e.quantityKind) {
        if (!kindDecl.has(e.quantityKind)) {
          err(
            'C115',
            `${e.owner}: quantity_kind "${e.quantityKind}" resolves to no registered kind of the merged quantity register (calculation-signature-shape)`,
          );
        } else if (unitKind !== undefined && unitKind !== e.quantityKind) {
          err(
            'C115',
            `${e.owner}: declared quantity_kind "${e.quantityKind}" but unit "${declaredUnit}" measures kind ${unitKind} — the typed-unit pair must agree in kind (calculation-signature-shape)`,
          );
        }
      }
      if (e.hasRange && e.rangeMin && e.rangeMax) {
        const lo = Number(e.rangeMin);
        const hi = Number(e.rangeMax);
        if (!Number.isNaN(lo) && !Number.isNaN(hi) && lo > hi) {
          err(
            'C115',
            `${e.owner}: range min ${e.rangeMin} exceeds max ${e.rangeMax} (calculation-signature-shape)`,
          );
        }
      }
      if (
        e.isInput &&
        e.type === 'enum' &&
        (e.enumValues === undefined || e.enumValues.length === 0)
      ) {
        err(
          'C115',
          `${e.owner}: an enum-typed input declares its values — enum_values is absent or empty (calculation-signature-shape)`,
        );
      }
    }
  }

  // ── C118: requirement-parameter-shape (MN 114 v3.2, clause 11.1.3) ──
  // The instance-parameter schema is the binding contract an execution
  // environment reads: a parameter's bind path resolves against the
  // subject's aspect catalog (the binds_to path discipline of C2), its
  // unit resolves against the merged quantity register (the rollout
  // WARNING leg — the C33 §6.8 precedent, shared with C115), and a
  // range's min never exceeds its max.
  for (const r of standard.requirements ?? []) {
    for (const p of r.parameters ?? []) {
      const where = `requirement ${r.id}: param ${p.name}`;
      if (p.bind) {
        const parts = String(p.bind).split('.');
        const id = parts[2];
        if (id) {
          if (parts[1] === 'classification') {
            const dim = DIM_ALIASES[id] ?? id;
            if (!dimIds.has(dim) && !attrIds.has(id) && !attrIds.has(dim)) {
              err(
                'C118',
                `${where}: bind "${p.bind}" — dimension "${id}" not declared (requirement-parameter-shape)`,
              );
            }
          } else if (parts[1] === 'behaviors') {
            if (!behaviorIds.has(id)) {
              err(
                'C118',
                `${where}: bind "${p.bind}" — behavior "${id}" not declared (requirement-parameter-shape)`,
              );
            }
          } else if (
            !isIdentityPath(String(p.bind)) &&
            !attrIds.has(id) &&
            !symbolIds.has(id)
          ) {
            err(
              'C118',
              `${where}: bind "${p.bind}" — attribute "${id}" not defined (requirement-parameter-shape)`,
            );
          }
        }
      }
      if (p.unit && registersExist && kindOfUnit(p.unit) === undefined) {
        // Rollout warning leg (see the rule's catalog entry).
        warn(
          'C118',
          `${where}: unit "${p.unit}" resolves to no registered unit of the merged quantity register (requirement-parameter-shape)`,
        );
      }
      if (p.hasRange && p.rangeMin && p.rangeMax) {
        const lo = Number(p.rangeMin);
        const hi = Number(p.rangeMax);
        if (!Number.isNaN(lo) && !Number.isNaN(hi) && lo > hi) {
          err(
            'C118',
            `${where}: range min ${p.rangeMin} exceeds max ${p.rangeMax} (requirement-parameter-shape)`,
          );
        }
      }
    }
  }

  // C34 — duality-coherence: one value structure, two roles.
  for (const d of standard.duals ?? []) {
    if (d.attribute && !attrIds.has(d.attribute)) {
      err(
        'C34',
        `dual ${d.id}: attribute "${d.attribute}" is not a declared attribute_definition (duality-coherence)`,
      );
    }
    if (!d.designed && !d.exhibited) {
      err(
        'C34',
        `dual ${d.id}: neither designed nor exhibited stated — a dual pair carries at least one role (duality-coherence)`,
      );
      continue;
    }
    // Tolerance marks the designed side, uncertainty the measured side —
    // the two never merge (doctrine §6.3).
    if (d.designed?.uncertainty !== undefined) {
      warn(
        'C34',
        `dual ${d.id}: the designed role carries an uncertainty — uncertainty belongs to the measured (exhibited) side (duality-coherence)`,
      );
    }
    if (d.exhibited?.tolerance !== undefined) {
      warn(
        'C34',
        `dual ${d.id}: the exhibited role carries a tolerance — tolerance belongs to the specified (designed) side (duality-coherence)`,
      );
    }
    // INV-1: a role stated for a declared physical quantity carries a unit
    // (or an explicit quantity kind) — never a bare number. An empty-string
    // unit token counts as bare, not as unit'd.
    const dualAttr = d.attribute
      ? attrDefs.find(a => a.id === d.attribute)
      : undefined;
    if (dualAttr && isPhysicalAttr(dualAttr)) {
      for (const [role, v] of [
        ['designed', d.designed],
        ['exhibited', d.exhibited],
      ] as const) {
        if (v && (v.unit ?? '') === '' && (v.quantityKind ?? '') === '') {
          err(
            'C34',
            `dual ${d.id}: role "${role}" of attribute "${d.attribute}" is a bare physical value — INV-1 (duality-coherence)`,
          );
        }
      }
    }
    if (d.designed && d.exhibited) {
      const roleKind = (v: {
        unit?: string;
        quantityKind?: string;
      }): string | undefined => v.quantityKind ?? kindOfUnit(v.unit);
      const dk = roleKind(d.designed);
      const ek = roleKind(d.exhibited);
      for (const [role, v] of [
        ['designed', d.designed],
        ['exhibited', d.exhibited],
      ] as const) {
        if (
          v.unit !== undefined &&
          v.unit !== '' &&
          registersExist &&
          kindOfUnit(v.unit) === undefined
        ) {
          warn(
            'C34',
            `dual ${d.id}: the ${role} role carries unit "${v.unit}", which no quantity_register declares (duality-coherence)`,
          );
        }
      }
      if (dk && ek && dk !== ek) {
        err(
          'C34',
          `dual ${d.id}: designed (kind ${dk}) vs exhibited (kind ${ek}) — the two roles of one quantity must share a quantity kind (duality-coherence)`,
        );
      }
    }
  }

  // C35 — timer-event recurrence periods are ISO 8601 durations (closes
  // task 02's deferred format check; C15 checks presence only).
  for (const p of standard.processes ?? []) {
    for (const s of p.does?.steps ?? []) {
      if (s.kind === 'timer_event' && s.period && !isDuration(s.period)) {
        err(
          'C35',
          `process ${p.id}: timer_event "${s.id}" period "${s.period}" is not an ISO 8601 duration (time-format)`,
        );
      }
    }
  }

  // C36 — map<K, V> field/value types are well-formed (K = string or an
  // enum id; V a valid type expression).
  for (const c of standard.dataclasses ?? []) {
    for (const a of c.attributes ?? []) {
      if (/^map\s*</.test(a.type) && !isWellFormedMapType(a.type)) {
        err(
          'C36',
          `class ${c.id}: attribute "${a.id}" type "${a.type}" is not a well-formed map<K, V> type — K is string or an enum id, V a type expression (map-type)`,
        );
      }
    }
  }
  for (const a of standard.attributeDefinitions ?? []) {
    if (/^map\s*</.test(a.valueType) && !isWellFormedMapType(a.valueType)) {
      err(
        'C36',
        `attribute_definition ${a.id}: value_type "${a.valueType}" is not a well-formed map<K, V> type — K is string or an enum id, V a type expression (map-type)`,
      );
    }
  }

  return { kindDecl, kindOfUnit };
}

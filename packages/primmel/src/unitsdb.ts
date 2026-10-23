/**
 * The UnitsDB adapter (kernel#87): the data types of the unitsml/unitsdb
 * v3 release (units, prefixes — the machine-readable source the corpus's
 * stem blocks carry UnitsML markup for), the id indexes, and the
 * SI-structure resolver.
 *
 * The kernel owns NO copy of the database and NO dependency on its
 * runtime: the caller supplies the data (a vendored snapshot, the
 * UnitsDB release, a checkout — whatever the consuming pipeline pins)
 * and every entry the kernel touches is looked up in what was supplied.
 * The DB is authoritative for STRUCTURE — the decomposition trees, the
 * prefixes, the dimension wiring — while the register keeps its authored
 * conversion numbers (factorToSI / offsetToSI): maps-to, never imports
 * (the correspondence doctrine, v3.2 clause 13.4).
 */

export interface UnitsDbIdentifier {
  type?: string;
  id?: string;
}

export interface UnitsDbUnit {
  identifiers?: UnitsDbIdentifier[];
  names?: Array<{ value?: string; lang?: string }>;
  /** The decomposition to other units (recursively to the SI bases):
   *  { power, unit_reference: { type, id } } — null for an SI base. */
  si_derived_bases?: Array<{
    power?: number;
    unit_reference?: UnitsDbIdentifier;
  }> | null;
  root?: boolean;
  /** The measurement scale (continuous_interval for degC — the interval
   *  scale whose offset the REGISTER authors as offsetToSI). */
  scale_reference?: UnitsDbIdentifier;
  /** The quantities the unit measures (NISTq* / q:*). */
  quantity_references?: UnitsDbIdentifier[];
  unit_system_reference?: UnitsDbIdentifier[];
  symbols?: Array<{ id?: string; ascii?: string; unicode?: string }>;
  short?: string;
}

export interface UnitsDbPrefix {
  identifiers?: UnitsDbIdentifier[];
  /** The prefix's numeric base (10 for SI). */
  base?: number;
  /** The prefix's power (kilo → 3). */
  power?: number;
  symbols?: Array<{ id?: string; ascii?: string }>;
}

export interface UnitsDbQuantity {
  identifiers?: UnitsDbIdentifier[];
  /** The dimension the quantity belongs to (NISTd* / d:*). */
  dimension_reference?: UnitsDbIdentifier;
  names?: Array<{ value?: string; lang?: string }>;
  /** base | derived (the release's quantity_type). */
  quantity_type?: string;
  short?: string;
}

/** One per-base-quantity component of a dimension vector. The release
 *  spells the power either as a bare number or as an object carrying
 *  the symbol (`thermodynamic_temperature: 1` beside
 *  `electric_current: { power: -1, symbol: "I" }`). */
export type UnitsDbDimensionComponent =
  number | { power?: number; symbol?: string };

export interface UnitsDbDimension {
  identifiers?: UnitsDbIdentifier[];
  names?: Array<{ value?: string; lang?: string }>;
  short?: string;
  /** The per-base-quantity components, keyed by the base quantity's
   *  short name (length, mass, time, electric_current,
   *  thermodynamic_temperature, …). */
  [key: string]: UnitsDbDimensionComponent | unknown;
}

export interface UnitsDbScaleProperties {
  continuous?: boolean;
  ordered?: boolean;
  logarithmic?: boolean;
  interval?: boolean;
  ratio?: boolean;
}

export interface UnitsDbScale {
  identifiers?: UnitsDbIdentifier[];
  names?: Array<{ value?: string; lang?: string }>;
  short?: string;
  properties?: UnitsDbScaleProperties;
}

export interface UnitsDbData {
  units: UnitsDbUnit[];
  prefixes: UnitsDbPrefix[];
  quantities?: UnitsDbQuantity[];
  dimensions?: UnitsDbDimension[];
  scales?: UnitsDbScale[];
}

/** The normalized dimension vector: base-quantity short name → signed
 *  power; absent keys are 0. Dimension equality is scale-independent
 *  (the kelvin and the ITS-90 celsius share one vector). */
export type DimensionVector = Record<string, number>;

const DIMENSION_META_KEYS = new Set([
  'identifiers',
  'names',
  'references',
  'short',
]);

/** One resolved SI-base factor: the base unit's id and its signed power
 *  (the prefix powers fold into the carrying factor, the unit powers
 *  into this). */
export interface SiBase {
  id: string;
  power: number;
}

/** The structure the DB resolves for one unit id: the SI-base product,
 *  the prefix (when the unitsml id spells one), and the scale — the
 *  consumer combines this with the register's authored conversion. */
export interface ResolvedUnitStructure {
  requestedId: string;
  /** The DB entry the id names. */
  unit: UnitsDbUnit;
  /** The full decomposition to SI bases (a root unit resolves to
   *  itself). */
  siBases: SiBase[];
  /** The prefix the unitsml id carries, resolved from the prefixes
   *  data: { base, power } (kilo → { 10, 3 }). */
  prefix?: { base: number; power: number };
  /** The unit's measurement scale id (continuous_interval for degC). */
  scale?: string;
}

export class UnitsDb {
  private readonly byId = new Map<string, UnitsDbUnit>();
  private readonly prefixesBySymbol = new Map<string, UnitsDbPrefix>();
  private readonly quantitiesById = new Map<string, UnitsDbQuantity>();
  private readonly dimensionsById = new Map<string, UnitsDbDimension>();
  private readonly scalesById = new Map<string, UnitsDbScale>();

  constructor(data: UnitsDbData) {
    for (const u of data.units ?? []) {
      for (const i of u.identifiers ?? []) {
        if (i.id) {
          this.byId.set(i.id, u);
        }
      }
      if (u.short) {
        this.byId.set(u.short, u);
      }
      // The symbols are ids too — the unitsml root spelling after a
      // prefix strip (`u:kV` → the root `V`) resolves through them.
      for (const sym of u.symbols ?? []) {
        if (sym.id) {
          this.byId.set(sym.id, u);
        }
        if (sym.ascii) {
          this.byId.set(sym.ascii, u);
        }
      }
    }
    for (const p of data.prefixes ?? []) {
      for (const s of p.symbols ?? []) {
        if (s.id) {
          this.prefixesBySymbol.set(s.id, p);
        }
        if (s.ascii) {
          this.prefixesBySymbol.set(s.ascii, p);
        }
      }
    }
    for (const q of data.quantities ?? []) {
      for (const i of q.identifiers ?? []) {
        if (i.id) {
          this.quantitiesById.set(i.id, q);
        }
      }
      if (q.short) {
        this.quantitiesById.set(q.short, q);
      }
    }
    for (const d of data.dimensions ?? []) {
      for (const i of d.identifiers ?? []) {
        if (i.id) {
          this.dimensionsById.set(i.id, d);
        }
      }
      if (d.short) {
        this.dimensionsById.set(d.short, d);
      }
    }
    for (const s of data.scales ?? []) {
      for (const i of s.identifiers ?? []) {
        if (i.id) {
          this.scalesById.set(i.id, s);
        }
      }
      if (s.short) {
        this.scalesById.set(s.short, s);
      }
    }
  }

  unit(id: string): UnitsDbUnit | undefined {
    return this.byId.get(id);
  }

  /** The longest prefix symbol heading the unitsml id's local part —
   *  `kV` carries kilo, `m` alone is the root meter (the grammar's
   *  ambiguity resolved longest-prefix-first against the prefix
   *  symbols; a full-string match is never a prefix). Returns the
   *  matched SYMBOL and its length: the symbols carry the long name as
   *  `id` (kilo) and the abbreviation as `ascii` (k) — the slice is by
   *  the abbreviation, never the name. */
  prefixFor(
    localPart: string,
  ): { prefix: UnitsDbPrefix; symbol: string } | undefined {
    let best: { prefix: UnitsDbPrefix; symbol: string } | undefined;
    let bestLen = 0;
    for (const [symbol, p] of this.prefixesBySymbol) {
      if (
        symbol.length > bestLen &&
        symbol.length < localPart.length &&
        localPart.startsWith(symbol)
      ) {
        best = { prefix: p, symbol };
        bestLen = symbol.length;
      }
    }
    return best;
  }

  /** Decompose one unit id to its SI bases (the si_derived_bases walk,
   *  cycle-guarded). A root resolves to itself; an unknown id throws —
   *  the caller decided the DB when it supplied it, so a miss is the
   *  caller's data gap, never a silent undefined. */
  resolveSiBases(id: string, seen: Set<string> = new Set()): SiBase[] {
    if (seen.has(id)) {
      throw new Error(
        `[unitsdb] cycle at "${id}" — the decomposition does not terminate`,
      );
    }
    seen.add(id);
    const unit = this.unit(id);
    if (!unit) {
      throw new Error(`[unitsdb] "${id}" is not in the supplied data`);
    }
    const bases = unit.si_derived_bases;
    if (!bases || bases.length === 0) {
      return [{ id, power: 1 }];
    }
    const out = new Map<string, number>();
    for (const b of bases) {
      const ref = b.unit_reference?.id;
      if (!ref) {
        continue;
      }
      const power = b.power ?? 1;
      for (const base of this.resolveSiBases(ref, seen)) {
        out.set(base.id, (out.get(base.id) ?? 0) + base.power * power);
      }
    }
    return [...out].map(([id2, power]) => ({ id: id2, power }));
  }

  /** Resolve one id (a nist id or a unitsml id, optionally prefixed) to
   *  its structure. The unitsml spelling `u:<Prefix?><Root>` splits
   *  longest-prefix-first; a nist id never carries a prefix. */
  resolveUnit(id: string): ResolvedUnitStructure {
    let unit = this.unit(id);
    let prefix: UnitsDbPrefix | undefined;
    let resolvedId = id;
    if (!unit && id.startsWith('u:')) {
      const local = id.slice(2);
      const matched = this.prefixFor(local);
      prefix = matched?.prefix;
      const rootPart =
        matched !== undefined ? local.slice(matched.symbol.length) : local;
      unit = this.unit(rootPart) ?? this.unit(`u:${rootPart}`);
      resolvedId = rootPart;
    }
    if (!unit) {
      throw new Error(`[unitsdb] "${id}" is not in the supplied data`);
    }
    const siBases = this.resolveSiBases(resolvedId);
    return {
      requestedId: id,
      unit,
      siBases,
      prefix:
        prefix !== undefined
          ? { base: prefix.base ?? 10, power: prefix.power ?? 1 }
          : undefined,
      scale: unit.scale_reference?.id,
    };
  }

  // ── The second half (kernel#208): quantities, dimensions, scales —
  //    the data plane the evaluation engine reads. Same law as the
  //    first half: the DB is authoritative for STRUCTURE, a miss in
  //    the supplied data is the caller's data gap and throws.

  quantity(id: string): UnitsDbQuantity | undefined {
    return this.quantitiesById.get(id);
  }

  dimension(id: string): UnitsDbDimension | undefined {
    return this.dimensionsById.get(id);
  }

  scale(id: string): UnitsDbScale | undefined {
    return this.scalesById.get(id);
  }

  /** The unit's declared quantities, in authored order. The id may be
   *  a plain id or a prefixed unitsml spelling — both resolve to the
   *  DB entry first. */
  quantitiesOfUnit(id: string): UnitsDbQuantity[] {
    const unit = this.resolveUnit(id).unit;
    return (unit.quantity_references ?? []).map(ref => {
      const qid = ref.id;
      const q = qid ? this.quantitiesById.get(qid) : undefined;
      if (!q) {
        throw new Error(
          `[unitsdb] "${id}" names quantity "${qid ?? '?'}" which is not in the supplied data`,
        );
      }
      return q;
    });
  }

  /** The unit's primary quantity — the first declared reference that
   *  carries a dimension (a unit may serve several quantities; the
   *  first is the naming one). */
  primaryQuantityOfUnit(id: string): UnitsDbQuantity {
    const q = this.quantitiesOfUnit(id).find(x => x.dimension_reference?.id);
    if (!q) {
      throw new Error(
        `[unitsdb] "${id}" declares no quantity carrying a dimension`,
      );
    }
    return q;
  }

  /** The dimension of one quantity id (the quantity's
   *  dimension_reference, resolved). */
  dimensionOfQuantity(qid: string): UnitsDbDimension {
    const q = this.quantitiesById.get(qid);
    const ref = q?.dimension_reference?.id;
    const d = ref ? this.dimensionsById.get(ref) : undefined;
    if (!d) {
      throw new Error(
        `[unitsdb] quantity "${qid}" names dimension "${ref ?? '?'}" which is not in the supplied data`,
      );
    }
    return d;
  }

  /** The normalized dimension vector of one dimension entry: the
   *  per-base-quantity components (bare numbers or { power, symbol })
   *  collected to signed powers; meta keys skipped; zero powers
   *  dropped. */
  normalizeDimension(d: UnitsDbDimension): DimensionVector {
    const out: DimensionVector = {};
    for (const [key, value] of Object.entries(d)) {
      if (DIMENSION_META_KEYS.has(key)) {
        continue;
      }
      let power: number | undefined;
      if (typeof value === 'number') {
        power = value;
      } else if (
        value !== null &&
        typeof value === 'object' &&
        typeof (value as { power?: unknown }).power === 'number'
      ) {
        power = (value as { power: number }).power;
      } else if (value !== null && typeof value === 'object') {
        // A component with a symbol but no power states the axis.
        power = 1;
      } else {
        continue;
      }
      if (power !== 0) {
        out[key] = (out[key] ?? 0) + power;
      }
    }
    return out;
  }

  /** The unit's dimension vector, through its primary quantity. A
   *  prefixed spelling (`u:kV`) resolves to the root unit's vector —
   *  the prefix scales the magnitude, never the dimension. */
  dimensionVectorOfUnit(id: string): DimensionVector {
    const q = this.primaryQuantityOfUnit(id);
    const qid =
      q.identifiers?.find(i => i.type === 'nist')?.id ??
      q.identifiers?.[0]?.id ??
      q.short ??
      '';
    return this.normalizeDimension(this.dimensionOfQuantity(qid));
  }

  /** Dimension equality: every axis in the union carries the same
   *  signed power (absent = 0). */
  sameDimension(a: DimensionVector, b: DimensionVector): boolean {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if ((a[k] ?? 0) !== (b[k] ?? 0)) {
        return false;
      }
    }
    return true;
  }

  /** The unit's measurement scale, resolved through its
   *  scale_reference. */
  scaleOfUnit(id: string): UnitsDbScale {
    const unit = this.unit(id);
    const sid = unit?.scale_reference?.id;
    const s = sid ? this.scalesById.get(sid) : undefined;
    if (!s) {
      throw new Error(
        `[unitsdb] "${id}" names scale "${sid ?? '?'}" which is not in the supplied data`,
      );
    }
    return s;
  }
}

/** Load the DB from its data (the caller's snapshot — the shape of the
 *  unitsml/unitsdb release's units/prefixes/quantities/dimensions YAML,
 *  JSON-encoded). */
export function loadUnitsDb(data: UnitsDbData): UnitsDb {
  return new UnitsDb(data);
}

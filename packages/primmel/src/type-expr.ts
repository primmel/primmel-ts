// ─────────────────────────────────────────────────────────────────────
// Field type expressions (TODO.roadmap/06): QuantityValue as a
// first-class field type, and map<K, V> for parameter maps.
//
// A type expression is one of:
//   - a primitive name (integer, float, double, string, text, boolean,
//     date, datetime, duration, period, enum, reference, object, any)
//   - QuantityValue            — the INV-1 quantity shape (value + unit)
//   - reference(<ClassId>)     — a typed reference to a data class
//   - map<K, V>                — a key/value map; K is `string` (or an
//                                enum id), V any type expression
//
// parseTypeExpression returns null for strings that are not recognized
// type expressions — legacy free-form type strings stay untouched (the
// linter C36 validates only well-formedness of `map<…>` heads).
// ─────────────────────────────────────────────────────────────────────

export type TypeExpr =
  | { kind: 'primitive'; name: string }
  | { kind: 'quantity' }
  | { kind: 'reference'; target: string }
  | { kind: 'map'; key: TypeExpr; value: TypeExpr };

/** The closed primitive vocabulary (data/schemas/value-types.yaml + period). */
export const PRIMITIVE_TYPES = [
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
  'enum',
  'reference',
  'object',
  'any',
] as const;

const IDENT = /^[A-Za-z_][A-Za-z0-9_-]*$/;

function splitTopLevelComma(s: string): [string, string] | null {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '<') {
      depth++;
    } else if (c === '>') {
      depth--;
    } else if (c === ',' && depth === 0) {
      return [s.slice(0, i), s.slice(i + 1)];
    }
  }
  return null;
}

/**
 * Parse a type expression. Returns null when `src` is not a recognized
 * type expression at all (callers treat legacy free-form types as
 * unchecked). Throws nothing — malformed `map<…>`/`reference(…)` shapes
 * parse to null just like unrecognized names; isWellFormedMapType
 * distinguishes the two for the linter.
 */
export function parseTypeExpression(src: string): TypeExpr | null {
  const s = src.trim();
  if (s === 'QuantityValue') {
    return { kind: 'quantity' };
  }
  if ((PRIMITIVE_TYPES as readonly string[]).includes(s)) {
    return { kind: 'primitive', name: s };
  }
  const refMatch = /^reference\(([^)]+)\)$/.exec(s);
  if (refMatch) {
    const target = refMatch[1].trim();
    return IDENT.test(target) ? { kind: 'reference', target } : null;
  }
  if (s.startsWith('map<') && s.endsWith('>')) {
    const inner = s.slice(4, -1);
    const parts = splitTopLevelComma(inner);
    if (!parts) {
      return null;
    }
    // K is a key type: `string` (parameter maps) or a bare enum id
    // (dimension-keyed maps) — never a composite.
    const rawKey = parts[0].trim();
    let key: TypeExpr | null = null;
    if (rawKey === 'string') {
      key = { kind: 'primitive', name: 'string' };
    } else if (IDENT.test(rawKey)) {
      key = { kind: 'reference', target: rawKey };
    }
    const value = parseTypeExpression(parts[1]);
    if (!key || !value) {
      return null;
    }
    return { kind: 'map', key, value };
  }
  return null;
}

/**
 * Well-formedness of a map type for the linter (C36): a type string that
 * HEADS with `map` must parse as map<K, V> with K = string or an enum id
 * and V a valid type expression (QuantityValue, primitive, reference, or
 * a nested map).
 */
export function isWellFormedMapType(src: string): boolean {
  const expr = parseTypeExpression(src);
  return expr !== null && expr.kind === 'map';
}

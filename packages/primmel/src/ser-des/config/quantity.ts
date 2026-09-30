// ─────────────────────────────────────────────────────────────────────
// QuantityValue block ser-des (TODO.roadmap/06) — shared by the
// `instance` construct (has.attributes / has.test_context values) and the
// `dual` construct (designed / exhibited roles).
//
// Block form (the full INV-1 contract):
//   { value 2.2 unit t kind mass uncertainty 0.001 tolerance 0.5 }
// The inline form `2.2 t` (value [unit]) stays the compact spelling for
// the common case; the block form is required as soon as a value carries
// kind/uncertainty/tolerance.
// ─────────────────────────────────────────────────────────────────────

import tokenize, {
  escapeString,
  stripWrapping,
  unwrapBlock,
} from '../tokenize';
import { dumpBareSafe, stripColon } from './field-parser';
import type { QuantityValue, ValueProvenance } from '../../types/Quantity';

const NUMERIC = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;

/** Coerce a raw value token: quoted stays string; numeric literal → number. */
export function coerceValueToken(raw: string): string | number {
  if (raw.startsWith('"')) {
    return stripWrapping(raw);
  }
  return NUMERIC.test(raw) ? Number(raw) : stripWrapping(raw);
}

/**
 * Read one QuantityValue block (content INSIDE the braces):
 * `value <v> [unit <u>] [kind <k>] [uncertainty <u>] [tolerance <t>]`.
 * Unknown keywords are skipped (forward compatibility).
 */
export function readQuantityBlock(content: string): QuantityValue {
  const out: QuantityValue = { value: '' };
  const t = tokenize(content);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'value') {
      out.value = coerceValueToken(t[i++]);
    } else if (cmd === 'unit') {
      out.unit = stripWrapping(t[i++]);
    } else if (cmd === 'kind' || cmd === 'quantity_kind') {
      out.quantityKind = stripWrapping(t[i++]);
    } else if (cmd === 'uncertainty') {
      out.uncertainty = coerceValueToken(t[i++]);
    } else if (cmd === 'tolerance') {
      out.tolerance = coerceValueToken(t[i++]);
    } else if (cmd === 'provenance') {
      out.provenance = readProvenanceBlock(unwrapBlock(t[i++]));
    } else {
      unwrapBlock(t[i++]);
    }
  }
  return out;
}

/** True when the value needs the block form (carries more than value+unit). */
export function needsQuantityBlock(v: QuantityValue): boolean {
  return (
    v.quantityKind !== undefined ||
    v.uncertainty !== undefined ||
    v.tolerance !== undefined ||
    v.provenance !== undefined
  );
}

/** The per-entry provenance block (the typed kernel, clause 10). */
export function readProvenanceBlock(content: string): ValueProvenance {
  const out: ValueProvenance = { source: '' };
  const t = tokenize(content);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'source') {
      out.source = stripWrapping(t[i++]);
    } else if (cmd === 'page') {
      out.page = String(coerceValueToken(t[i++]));
    } else if (cmd === 'entry_wording') {
      out.entryWording = stripWrapping(t[i++]);
    } else if (cmd === 'read_at') {
      out.readAt = stripColon(stripWrapping(t[i++]));
    } else if (cmd === 'declaration') {
      out.declaration = stripColon(stripWrapping(t[i++]));
    } else if (cmd === 'verdict') {
      out.verdict = stripColon(stripWrapping(t[i++]));
    } else {
      unwrapBlock(t[i++]);
    }
  }
  return out;
}

export function dumpProvenanceBlock(p: ValueProvenance): string {
  const parts: string[] = ['source "' + escapeString(p.source) + '"'];
  if (p.page !== undefined) {
    parts.push('page ' + dumpScalarToken(p.page));
  }
  if (p.entryWording !== undefined) {
    parts.push('entry_wording "' + escapeString(p.entryWording) + '"');
  }
  if (p.readAt !== undefined) {
    parts.push('read_at ' + dumpScalarToken(p.readAt));
  }
  if (p.declaration !== undefined) {
    parts.push('declaration ' + dumpScalarToken(p.declaration));
  }
  if (p.verdict !== undefined) {
    parts.push('verdict ' + dumpScalarToken(p.verdict));
  }
  return '{ ' + parts.join(' ') + ' }';
}

/** Emit one value token: numbers bare; strings quoted when unsafe. */
export function dumpScalarToken(v: string | number): string {
  if (typeof v === 'number') {
    return String(v);
  }
  if (v === '') {
    return '""';
  }
  // A bare trailing-colon token re-parses as a KEY head; numeric-looking
  // strings must stay strings (quoted-numeric round-trip).
  if (NUMERIC.test(v) || /[\s{}"]/.test(v) || v.endsWith(':')) {
    return '"' + escapeString(v) + '"';
  }
  return v;
}

/**
 * Dump one QuantityValue. Compact inline form (`2.2 t`) when only
 * value+unit are set; the block form otherwise.
 */
export function dumpQuantityValue(v: QuantityValue): string {
  if (!needsQuantityBlock(v)) {
    const val = dumpScalarToken(v.value);
    return v.unit === undefined ? val : val + ' ' + dumpBareSafe(v.unit);
  }
  return dumpQuantityBlock(v);
}

/** Dump one QuantityValue in block form unconditionally (dual roles). */
export function dumpQuantityBlock(v: QuantityValue): string {
  const parts: string[] = ['value ' + dumpScalarToken(v.value)];
  if (v.unit !== undefined) {
    parts.push('unit "' + escapeString(v.unit) + '"');
  }
  if (v.quantityKind !== undefined) {
    parts.push('kind ' + dumpBareSafe(v.quantityKind));
  }
  if (v.uncertainty !== undefined) {
    parts.push('uncertainty ' + dumpScalarToken(v.uncertainty));
  }
  if (v.tolerance !== undefined) {
    parts.push('tolerance ' + dumpScalarToken(v.tolerance));
  }
  if (v.provenance !== undefined) {
    parts.push('provenance ' + dumpProvenanceBlock(v.provenance));
  }
  return '{ ' + parts.join(' ') + ' }';
}

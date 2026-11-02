// ─────────────────────────────────────────────────────────────────────
// The datum origin axis ([[datum-unification]]): the runtime face of
// types/DatumOrigin. The flat facets (attribute_definition, symbol) and
// the datum blocks all validate through assertDatumOrigin — the corpus
// migrated onto the axis (measured→observed, derived→computed,
// test-dependent→observed, lookup→declared) before the enforcement
// landed, so the refusal names the axis, never a migration.
// ─────────────────────────────────────────────────────────────────────

import type DatumOrigin from '../../types/DatumOrigin';

export const DATUM_ORIGINS = [
  'declared',
  'design-fixed',
  'observed',
  'computed',
] as const;

export function assertDatumOrigin(
  value: string,
  construct: string,
  id: string,
): DatumOrigin {
  if (!(DATUM_ORIGINS as readonly string[]).includes(value)) {
    throw new Error(
      `Parsing error: ${construct}. ID ${id}: Unknown origin "${value}" (valid: ${DATUM_ORIGINS.join(', ')})`,
    );
  }
  return value as DatumOrigin;
}

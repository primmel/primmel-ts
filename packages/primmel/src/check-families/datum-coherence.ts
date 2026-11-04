// ─────────────────────────────────────────────────────────────────────
// The datum-coherence family (C191–C193, TODO.lang-gaps/04, the datum
// unification's rungs): the four plane carriers are ALIAS spellings of
// the one "named, typed, unit-ed value" primitive ([[datum-unification]],
// spec#87). When a carrier declares an inline `datum { … }` block, a
// facet the block restates must AGREE with its flat spelling — the two
// spellings name ONE value, and a contradiction is an error (normal
// level, following C190). A facet the block leaves silent carries no
// leg (the flat facet IS the view); an absent block carries no leg —
// the flat spelling alone is the whole story.
//
// Carriers judged: identity_slot (C191, the inscription plane),
// attribute_definition (C192, the model plane — type/origin/scope),
// and the form/subform field (C193, the run plane — the head's type is
// OPTIONAL, so the leg gates on an AUTHORED flat spelling
// (`typeDeclared` — the untyped head's `string` is the parse default,
// not a spelling); subform fields share the grammar and are judged
// with the same rule (a subform's shape is the form's shape, the C184
// doctrine).
//
// THE FAMILY-MODULE PATTERN (the check.ts decomposition, one family
// at a time): the family takes the context record it actually uses —
// `standard` and the emit closure — and nothing else. The bodies move
// verbatim from check.ts; the compiler and the suite pin the move.
// ─────────────────────────────────────────────────────────────────────

import type Standard from '../types/Standard';
import type { FormField } from '../types/Form';

export interface DatumCoherenceContext {
  standard: Standard;
  err: (check: string, message: string) => void;
}

export function runDatumCoherenceFamily({
  standard,
  err,
}: DatumCoherenceContext): void {
  // ── C191: identity-slot-datum-coherence (TODO.lang-gaps/04, the ─────
  // datum unification's second rung) ───────────────────────────────────
  // The identity_slot is the inscription plane of the datum substrate
  // ([[datum-unification]], spec#87): the four plane carriers are ALIAS
  // spellings of the one "named, typed, unit-ed value" primitive. When
  // the slot declares an inline `datum { … }` block, its facets are the
  // slot's datum view — and a type the block restates must AGREE with
  // the slot's flat `type`, because the two spellings name ONE value
  // (a contradiction is an error, normal level, following C190). An
  // absent block carries no leg: the flat spelling alone is the whole
  // story, and every corpus site spells it that way (the wave 04
  // census: 15 slots, 0 quantity-bearing).
  for (const s of standard.identitySlots ?? []) {
    if (s.datum && s.datum.type && s.type && s.datum.type !== s.type) {
      err(
        'C191',
        `identity_slot ${s.id}: the inline datum block's type "${s.datum.type}" contradicts the slot's flat type "${s.type}" — the two spellings name one value (identity-slot-datum-coherence)`,
      );
    }
  }

  // ── C192: attribute-definition-datum-coherence (TODO.lang-gaps/04, ──
  // the datum unification's fourth rung) ───────────────────────────────
  // The attribute_definition is the MODEL plane of the datum substrate
  // ([[datum-unification]], spec#87): the four plane carriers are ALIAS
  // spellings of the one "named, typed, unit-ed value" primitive. When
  // the attribute declares an inline `datum { … }` block, a facet the
  // block restates must AGREE with its flat spelling — the block's
  // `type` against the flat `value_type`, `origin` against the flat
  // `origin`, `scope` against the flat `scope` — because the two
  // spellings name ONE value (a contradiction is an error, normal
  // level, following C190/C191). A facet the block leaves silent
  // carries no leg (the flat facet IS the view), and an absent block
  // carries no leg: the flat spelling alone is the whole story — the
  // wave 04 census: 359 attribute_definition sites in 34 corpus files,
  // 0 inline datum blocks, all flat facets already datum vocabulary
  // (`origin design-fixed scope model`).
  for (const a of standard.attributeDefinitions ?? []) {
    const d = a.datum;
    if (!d) {
      continue;
    }
    const restated: Array<[string, string, string]> = [
      ['type', d.type, a.valueType],
      ['origin', d.origin, a.origin],
      ['scope', d.scope, a.scope],
    ];
    for (const [facet, blockValue, flatValue] of restated) {
      if (blockValue && flatValue && blockValue !== flatValue) {
        err(
          'C192',
          `attribute_definition ${a.id}: the inline datum block's ${facet} "${blockValue}" contradicts the flat ${facet === 'type' ? 'value_type' : facet} "${flatValue}" — the two spellings name one value (attribute-definition-datum-coherence)`,
        );
      }
    }
  }

  // ── C193: field-datum-coherence (TODO.lang-gaps/04, the datum ───────
  // unification's fifth rung — the wave's last) ────────────────────────
  // The form field is the RUN plane of the datum substrate
  // ([[datum-unification]], spec#87): the four plane carriers are ALIAS
  // spellings of the one "named, typed, unit-ed value" primitive, and
  // the field's name/type/unit already ARE the datum's id/type/unit
  // (the wave 04 PR 3 finding). When the field declares an inline
  // `datum { … }` block, a type the block restates must AGREE with the
  // field's head type — because the two spellings name ONE value (a
  // contradiction is an error, normal level, following C190/C191/C192).
  // The head's type is OPTIONAL, so the leg gates on an AUTHORED flat
  // spelling (`typeDeclared` — the untyped head's `string` is the parse
  // default, not a spelling; a block type over an untyped head is the
  // override the view resolves, never a contradiction). A block silent
  // on the type — or the absent block — carries no leg. Subform fields
  // share the grammar and are judged with the same rule (a subform's
  // shape is the form's shape, the C184 doctrine).
  const walkFieldDatum = (
    formId: string,
    fields: readonly FormField[],
    path: string,
  ): void => {
    for (const f of fields) {
      const where = path === '' ? `field ${f.name}` : `field ${path}.${f.name}`;
      if (
        f.datum &&
        f.datum.type &&
        f.typeDeclared &&
        f.type &&
        f.datum.type !== f.type
      ) {
        err(
          'C193',
          `form ${formId}: ${where}: the inline datum block's type "${f.datum.type}" contradicts the field's flat type "${f.type}" — the two spellings name one value (field-datum-coherence)`,
        );
      }
      if (f.fields?.length) {
        walkFieldDatum(
          formId,
          f.fields,
          path === '' ? f.name : `${path}.${f.name}`,
        );
      }
    }
  };
  for (const form of standard.forms ?? []) {
    walkFieldDatum(form.id, form.fields ?? [], '');
  }
  for (const sf of standard.subforms ?? []) {
    walkFieldDatum(sf.id, sf.fields ?? [], '');
  }
}

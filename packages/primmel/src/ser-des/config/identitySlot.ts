// ─────────────────────────────────────────────────────────────────────
// `identity_slot` construct (smart TODO.roadmap/40 batch 3; the
// packages-as-SSOT epic) — the subject's documentary identity register
// (types/IdentitySlot.ts carries the banner and the grammar sketch).
// The type and presentation vocabularies are parse-enforced (the
// fail-closed precedent); the ≥1-presentation shape leg and the
// bind-path resolution are check-enforced (C130) — the codec stays
// total. The datum unification's second rung (TODO.lang-gaps/04): the
// value core reads the datum substrate — an inline `datum { … }` block
// carries the substrate facets, the C191 coherence leg keeps it honest.
// ─────────────────────────────────────────────────────────────────────

import type { Dumper, Parser } from '../types';
import tokenize, {
  escapeString,
  stripWrapping,
  unwrapBlock,
} from '../tokenize';
import { forEachEntry, proseBlock } from '../parse-block';
import { dumpBareSafe, readSource, stripColon } from './field-parser';
import IdentitySlot, { IdentitySlotDatum } from '../../types/IdentitySlot';
import { refTargetToSourceRef, dumpSourceRefAsRef } from './ref';

const IDENTITY_SLOT_TYPES = [
  'string',
  'designation',
  'serial',
  'year',
  'mark',
  'map',
] as const;

const IDENTITY_SLOT_PRESENTATIONS = [
  'marked-on-instrument',
  'accompanying-document',
] as const;

// The datum origin axis ([[datum-unification]]): the value's epistemic
// provenance — the same closed vocabulary the datum construct enforces.
const IDENTITY_SLOT_DATUM_ORIGINS = [
  'declared',
  'design-fixed',
  'observed',
  'computed',
] as const;

/** The `datum { … }` block authored inside an identity slot (the datum
 *  unification's second rung, TODO.lang-gaps/04, spec
 *  [[datum-unification]]): the slot's inscription value rides the datum
 *  substrate — the block's facets override/extend the slot's flat
 *  `type`. The block takes NO id and NO type parg: the slot's id names
 *  the datum, and the type rides the `type` facet (the slot's
 *  parse-enforced vocabulary — the fail-closed precedent). */
function readIdentitySlotDatum(data: string, id: string): IdentitySlotDatum {
  const datum: IdentitySlotDatum = {
    type: '',
    unit: '',
    quantityKind: '',
    origin: 'declared',
    scope: '',
  };
  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'type') {
        const type = stripWrapping(value());
        if (!(IDENTITY_SLOT_TYPES as readonly string[]).includes(type)) {
          throw new Error(
            `Parsing error: identity_slot. ID ${id}: Unknown identity slot type "${type}" (valid: ${IDENTITY_SLOT_TYPES.join(', ')})`,
          );
        }
        datum.type = type;
      } else if (keyword === 'unit') {
        datum.unit = stripWrapping(value());
      } else if (keyword === 'quantity_kind') {
        datum.quantityKind = stripWrapping(value());
      } else if (keyword === 'origin') {
        const origin = stripWrapping(value());
        if (
          !(IDENTITY_SLOT_DATUM_ORIGINS as readonly string[]).includes(origin)
        ) {
          throw new Error(
            `Parsing error: identity_slot. ID ${id}: Unknown datum origin "${origin}" (valid: ${IDENTITY_SLOT_DATUM_ORIGINS.join(', ')})`,
          );
        }
        datum.origin = origin as IdentitySlotDatum['origin'];
      } else if (keyword === 'scope') {
        datum.scope = stripWrapping(value());
      } else {
        return false;
      }
      return true;
    },
    { construct: 'identity_slot', id },
  );
  return datum;
}

/** The slot's datum view ([[datum-unification]]): the inscription value
 *  wherever a datum is expected. The inline block's facets override;
 *  the slot's flat facets stand in where the block is silent (and the
 *  origin defaults to `declared`). The wire shape stays the authored
 *  spelling — this is the normalized read, never the dump's input. */
export function identitySlotDatumView(s: IdentitySlot): IdentitySlotDatum {
  const d = s.datum;
  return {
    type: d?.type || s.type,
    unit: d?.unit ?? '',
    quantityKind: d?.quantityKind ?? '',
    origin: d?.origin ?? 'declared',
    scope: d?.scope ?? '',
  };
}

export const parseIdentitySlot: Parser = (id: string, data: string) => {
  const slot: IdentitySlot = {
    id,
    label: '',
    type: '',
    presentation: [],
    optional: false,
    definition: '',
    metamodelClass: '',
    source: null,
    datum: null,
  };

  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'label') {
        slot.label = stripWrapping(value());
      } else if (keyword === 'type') {
        const type = stripWrapping(value());
        if (!(IDENTITY_SLOT_TYPES as readonly string[]).includes(type)) {
          throw new Error(
            `Parsing error: identity_slot. ID ${id}: Unknown identity slot type "${type}" (valid: ${IDENTITY_SLOT_TYPES.join(', ')})`,
          );
        }
        slot.type = type;
      } else if (keyword === 'datum') {
        // THE DATUM UNIFICATION'S SECOND RUNG (TODO.lang-gaps/04, spec
        // [[datum-unification]]): the slot's inscription value rides the
        // datum substrate — the inline `datum { … }` block carries the
        // substrate facets (type/unit/quantity_kind/origin/scope) that
        // override/extend the flat `type`. The block takes no id (the
        // slot's id names the datum) and no type parg — a malformed
        // spelling is a parse error, the fail-closed precedent.
        const block = value();
        if (!block.startsWith('{')) {
          throw new Error(
            `Parsing error: identity_slot. ID ${id}: the inline datum block is "datum { … }" — the slot's id names the datum, the type rides the type facet`,
          );
        }
        slot.datum = readIdentitySlotDatum(unwrapBlock(block), id);
      } else if (keyword === 'presentation') {
        const channels = tokenize(stripWrapping(value()))
          .map(stripColon)
          .map(stripWrapping)
          .filter(s => s.length > 0);
        for (const channel of channels) {
          if (
            !(IDENTITY_SLOT_PRESENTATIONS as readonly string[]).includes(
              channel,
            )
          ) {
            throw new Error(
              `Parsing error: identity_slot. ID ${id}: Unknown presentation channel "${channel}" (valid: ${IDENTITY_SLOT_PRESENTATIONS.join(', ')})`,
            );
          }
        }
        slot.presentation = channels;
      } else if (keyword === 'optional') {
        slot.optional = value() === 'true';
      } else if (keyword === 'definition') {
        // THE PROSE QUARANTINE (TODO.lang-gaps/02): the block form only.
        slot.definition = proseBlock(
          value(),
          'identity_slot',
          id,
          'definition',
        );
      } else if (keyword === 'metamodel_class') {
        slot.metamodelClass = stripWrapping(value());
      } else if (keyword === 'source') {
        slot.source = readSource(unwrapBlock(value()));
      } else if (keyword === 'ref') {
        const predicate = stripWrapping(value());
        const target = stripWrapping(value());
        if (predicate === 'derives-from') {
          const b = refTargetToSourceRef(target);
          if (b) {
            slot.source = b;
          }
        }
      } else {
        return false;
      }
      return true;
    },
    { construct: 'identity_slot', id },
  );

  return ctx => {
    ctx.identitySlots[id] = slot;
    return ctx;
  };
};

export const dumpIdentitySlot: Dumper<IdentitySlot> = function (s) {
  let out: string = 'identity_slot ' + s.id + ' {\n';
  if (s.label) {
    out += '  label "' + escapeString(s.label) + '"\n';
  }
  if (s.type) {
    out += '  type ' + dumpBareSafe(s.type) + '\n';
  }
  if (s.datum) {
    // The AUTHORED spelling ([[datum-unification]]): the inline datum
    // block re-emits beside the flat type it extends — `origin declared`
    // is the datum's default and stays omitted, the same convention the
    // datum construct's dump holds. The fixpoint: parse(dump(m)) === m.
    const d = s.datum;
    const facets: string[] = [];
    if (d.type) {
      facets.push('type ' + dumpBareSafe(d.type));
    }
    if (d.unit) {
      facets.push('unit ' + dumpBareSafe(d.unit));
    }
    if (d.quantityKind) {
      facets.push('quantity_kind ' + dumpBareSafe(d.quantityKind));
    }
    if (d.origin !== 'declared') {
      facets.push('origin ' + dumpBareSafe(d.origin));
    }
    if (d.scope) {
      facets.push('scope ' + dumpBareSafe(d.scope));
    }
    out += '  datum { ' + facets.join(' ') + ' }\n';
  }
  if (s.presentation.length > 0) {
    out +=
      '  presentation { ' + s.presentation.map(dumpBareSafe).join(' ') + ' }\n';
  }
  if (s.optional) {
    out += '  optional true\n';
  }
  if (s.definition) {
    out += '  definition { ' + s.definition + ' }\n';
  }
  if (s.metamodelClass) {
    out += '  metamodel_class ' + dumpBareSafe(s.metamodelClass) + '\n';
  }
  if (s.source && (s.source.doc || s.source.clause)) {
    out += dumpSourceRefAsRef(s.source, '  ', escapeString);
  }
  out += '}\n';
  return out;
};

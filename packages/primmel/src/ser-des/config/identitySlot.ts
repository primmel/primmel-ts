// ─────────────────────────────────────────────────────────────────────
// `identity_slot` construct (smart TODO.roadmap/40 batch 3; the
// packages-as-SSOT epic) — the subject's documentary identity register
// (types/IdentitySlot.ts carries the banner and the grammar sketch).
// The type and presentation vocabularies are parse-enforced (the
// fail-closed precedent); the ≥1-presentation shape leg and the
// bind-path resolution are check-enforced (C130) — the codec stays
// total.
// ─────────────────────────────────────────────────────────────────────

import type { Dumper, Parser } from '../types';
import tokenize, {
  escapeString,
  stripWrapping,
  unwrapBlock,
} from '../tokenize';
import { forEachEntry, proseBlock } from '../parse-block';
import { dumpBareSafe, readSource, stripColon } from './field-parser';
import IdentitySlot from '../../types/IdentitySlot';
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

// ─────────────────────────────────────────────────────────────────────
// `activity_archetype` construct (TODO.roadmap/39) — one entry of an
// ISO/IEC 17000 functional-approach activity-kind register:
//
//   activity_archetype testing {
//     label "testing"
//     clause "6.2"
//     definition "determination of one or more characteristics of an
//       object of conformity assessment (4.2), according to a procedure
//       (5.2)"
//     parent determination
//   }
//
// The register is the resolution target of a process's
// `activity_kind { <id>+ }` classification facet (C58
// activity-kind-resolves). `parent` carries only the type-of
// relationships the source standard states (ISO/IEC 17000 A.3.2
// determination types, A.4.3 attestation types).
// ─────────────────────────────────────────────────────────────────────

import type { Dumper, Parser } from '../types';
import { escapeString, stripWrapping } from '../tokenize';
import { forEachEntry } from '../parse-block';
import { dumpBareSafe } from './field-parser';
import ActivityArchetype from '../../types/ActivityArchetype';

export const parseActivityArchetype: Parser = (id: string, data: string) => {
  const archetype: ActivityArchetype = {
    id: id,
    label: '',
    clause: '',
    definition: '',
    parent: '',
  };

  forEachEntry(
    data,
    (keyword, value) => {
      // stripWrapping (not unwrapped): `parent` is a BARE id, and
      // unwrapped's unwrapBlock would strip its first/last characters.
      if (keyword === 'label') {
        archetype.label = stripWrapping(value());
      } else if (keyword === 'clause') {
        archetype.clause = stripWrapping(value());
      } else if (keyword === 'definition') {
        archetype.definition = stripWrapping(value());
      } else if (keyword === 'parent') {
        archetype.parent = stripWrapping(value());
      } else {
        return false;
      }
      return true;
    },
    { construct: 'activity_archetype', id },
  );

  return ctx => {
    ctx.activityArchetypes[id] = archetype;
    return ctx;
  };
};

export const dumpActivityArchetype: Dumper<ActivityArchetype> = function (a) {
  let out: string = 'activity_archetype ' + a.id + ' {\n';
  if (a.label) {
    out += '  label "' + escapeString(a.label) + '"\n';
  }
  if (a.clause) {
    out += '  clause "' + escapeString(a.clause) + '"\n';
  }
  if (a.definition) {
    out += '  definition "' + escapeString(a.definition) + '"\n';
  }
  if (a.parent) {
    out += '  parent ' + dumpBareSafe(a.parent) + '\n';
  }
  out += '}\n';
  return out;
};

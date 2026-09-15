// ─────────────────────────────────────────────────────────────────────
// `scheme_activity_kind` + `scheme_type` constructs (smart
// TODO.roadmap/40 batch 2; the packages-as-SSOT epic) — the ISO/IEC
// 17067 scheme-type register (types/SchemeType.ts carries the banner and
// the grammar sketch).
//
// The `family` and `attestation_object` vocabularies are parse-enforced
// (the fail-closed precedent — the dataspace/policy vocabularies, the
// process child_composition); every cross-reference resolves at check
// time (C122 scheme-type-resolves, per-register gated — the C58
// doctrine); the codecs stay total otherwise.
// ─────────────────────────────────────────────────────────────────────

import type { Dumper, Parser } from '../types';
import { escapeString, stripWrapping, unwrapBlock } from '../tokenize';
import { tokenizePackage } from '../tokenize';
import { forEachEntry } from '../parse-block';
import { dumpBareSafe, readSource, stripColon } from './field-parser';
import SchemeType, {
  SchemeActivityKind,
  SchemeSurveillance,
} from '../../types/SchemeType';

const SCHEME_ACTIVITY_FAMILIES = [
  'common',
  'determination',
  'attestation',
  'surveillance',
] as const;

const ATTESTATION_OBJECTS = [
  'product_type',
  'batch',
  'ongoing_production',
  'service_or_process',
] as const;

/** Read an activity-id list facet: `determination { testing … }`. */
function parseKindList(value: string): string[] {
  return tokenizePackage(unwrapBlock(value))
    .map(stripColon)
    .map(stripWrapping)
    .filter(s => s.length > 0);
}

export const parseSchemeActivityKind: Parser = (id: string, data: string) => {
  const kind: SchemeActivityKind = {
    id,
    family: 'common',
    row: '',
    label: '',
    source: { doc: '', clause: '' },
  };

  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'family') {
        const family = stripWrapping(value());
        if (!(SCHEME_ACTIVITY_FAMILIES as readonly string[]).includes(family)) {
          throw new Error(
            `Parsing error: scheme_activity_kind. ID ${id}: Unknown family "${family}" (valid: ${SCHEME_ACTIVITY_FAMILIES.join(', ')})`,
          );
        }
        kind.family = family as SchemeActivityKind['family'];
      } else if (keyword === 'row') {
        kind.row = stripWrapping(value());
      } else if (keyword === 'label') {
        kind.label = stripWrapping(value());
      } else if (keyword === 'source') {
        kind.source = readSource(unwrapBlock(value()));
      } else {
        return false;
      }
      return true;
    },
    { construct: 'scheme_activity_kind', id },
  );

  return ctx => {
    ctx.schemeActivityKinds[id] = kind;
    return ctx;
  };
};

function parseSchemeSurveillance(block: string): SchemeSurveillance {
  const surveillance: SchemeSurveillance = { required: false, activities: [] };
  forEachEntry(
    block,
    (keyword, value) => {
      if (keyword === 'required') {
        surveillance.required = stripWrapping(value()) === 'true';
      } else if (keyword === 'activities') {
        surveillance.activities = parseKindList(value());
      } else {
        return false;
      }
      return true;
    },
    { construct: 'scheme_type surveillance', id: '' },
  );
  return surveillance;
}

export const parseSchemeType: Parser = (id: string, data: string) => {
  const type: SchemeType = {
    id,
    label: '',
    clause: '',
    description: '',
    sampling: '',
    attestationObject: '',
    determination: [],
    attestation: [],
    surveillance: null,
    notes: [],
    source: { doc: '', clause: '' },
  };

  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'label') {
        type.label = stripWrapping(value());
      } else if (keyword === 'clause') {
        type.clause = stripWrapping(value());
      } else if (keyword === 'description') {
        type.description = stripWrapping(value());
      } else if (keyword === 'sampling') {
        type.sampling = stripWrapping(value());
      } else if (keyword === 'attestation_object') {
        const object = stripWrapping(value());
        if (!(ATTESTATION_OBJECTS as readonly string[]).includes(object)) {
          throw new Error(
            `Parsing error: scheme_type. ID ${id}: Unknown attestation_object "${object}" (valid: ${ATTESTATION_OBJECTS.join(', ')})`,
          );
        }
        type.attestationObject = object as SchemeType['attestationObject'];
      } else if (keyword === 'determination') {
        type.determination = parseKindList(value());
      } else if (keyword === 'attestation') {
        type.attestation = parseKindList(value());
      } else if (keyword === 'surveillance') {
        type.surveillance = parseSchemeSurveillance(unwrapBlock(value()));
      } else if (keyword === 'notes') {
        type.notes = tokenizePackage(unwrapBlock(value()))
          .map(stripWrapping)
          .filter(s => s.length > 0);
      } else if (keyword === 'source') {
        type.source = readSource(unwrapBlock(value()));
      } else {
        return false;
      }
      return true;
    },
    { construct: 'scheme_type', id },
  );

  return ctx => {
    ctx.schemeTypes[id] = type;
    return ctx;
  };
};

function dumpSource(source: SchemeType['source'], indent: string): string {
  if (!source.doc && !source.clause) {
    return '';
  }
  let out = indent + 'source {\n';
  if (source.doc) {
    out += indent + '  doc "' + escapeString(source.doc) + '"\n';
  }
  if (source.clause) {
    out += indent + '  clause "' + escapeString(source.clause) + '"\n';
  }
  out += indent + '}\n';
  return out;
}

export const dumpSchemeActivityKind: Dumper<SchemeActivityKind> = function (k) {
  let out: string = 'scheme_activity_kind ' + k.id + ' {\n';
  out += '  family ' + k.family + '\n';
  if (k.row) {
    out += '  row "' + escapeString(k.row) + '"\n';
  }
  if (k.label) {
    out += '  label "' + escapeString(k.label) + '"\n';
  }
  out += dumpSource(k.source, '  ');
  out += '}\n';
  return out;
};

export const dumpSchemeType: Dumper<SchemeType> = function (t) {
  let out: string = 'scheme_type ' + t.id + ' {\n';
  if (t.label) {
    out += '  label "' + escapeString(t.label) + '"\n';
  }
  if (t.clause) {
    out += '  clause "' + escapeString(t.clause) + '"\n';
  }
  if (t.description) {
    out += '  description "' + escapeString(t.description) + '"\n';
  }
  if (t.sampling) {
    out += '  sampling "' + escapeString(t.sampling) + '"\n';
  }
  if (t.attestationObject) {
    out += '  attestation_object ' + t.attestationObject + '\n';
  }
  if (t.determination.length > 0) {
    out +=
      '  determination { ' +
      t.determination.map(dumpBareSafe).join(' ') +
      ' }\n';
  }
  if (t.attestation.length > 0) {
    out +=
      '  attestation { ' + t.attestation.map(dumpBareSafe).join(' ') + ' }\n';
  }
  if (t.surveillance) {
    out += '  surveillance {\n';
    out +=
      '    required ' + (t.surveillance.required ? 'true' : 'false') + '\n';
    if (t.surveillance.activities.length > 0) {
      out +=
        '    activities { ' +
        t.surveillance.activities.map(dumpBareSafe).join(' ') +
        ' }\n';
    }
    out += '  }\n';
  }
  if (t.notes.length > 0) {
    out += '  notes {\n';
    for (const n of t.notes) {
      out += '    "' + escapeString(n) + '"\n';
    }
    out += '  }\n';
  }
  out += dumpSource(t.source, '  ');
  out += '}\n';
  return out;
};

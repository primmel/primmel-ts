// ─────────────────────────────────────────────────────────────────────
// `certificate_template` construct (smart TODO.roadmap/40 batch 3; the
// packages-as-SSOT epic) — the certificate rendering contract
// (types/CertificateTemplate.ts carries the banner and the grammar
// sketch). The obligation vocabulary is parse-enforced (the fail-closed
// precedent); the characteristic type vocabulary and every reference
// resolution are check-enforced (C136) — the codec stays total.
// ─────────────────────────────────────────────────────────────────────

import type { Dumper, Parser } from '../types';
import tokenize, {
  escapeString,
  stripWrapping,
  unwrapBlock,
} from '../tokenize';
import { forEachEntry } from '../parse-block';
import { dumpBareSafe, stripColon } from './field-parser';
import CertificateTemplate, {
  CertificateAnrSection,
  CertificateCharacteristic,
} from '../../types/CertificateTemplate';

const CERTIFICATE_OBLIGATIONS = ['mandatory', 'optional'] as const;

function readIdList(block: string): string[] {
  return tokenize(stripWrapping(block))
    .map(stripColon)
    .map(stripWrapping)
    .filter(s => s.length > 0);
}

export const parseCertificateTemplate: Parser = (id: string, data: string) => {
  const template: CertificateTemplate = {
    id,
    numberFormat: '',
    dimensionLabels: null,
    characteristics: [],
    anrSection: null,
  };

  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'number_format') {
        template.numberFormat = stripWrapping(value());
      } else if (keyword === 'dimension_labels') {
        const labels = { pattern: '', separator: '' };
        forEachEntry(
          unwrapBlock(value()),
          (k2, v2) => {
            if (k2 === 'pattern') {
              labels.pattern = stripWrapping(v2());
            } else if (k2 === 'separator') {
              labels.separator = stripWrapping(v2());
            } else {
              return false;
            }
            return true;
          },
          { construct: 'certificate_template', id },
        );
        template.dimensionLabels = labels;
      } else if (keyword === 'characteristic') {
        const c: CertificateCharacteristic = {
          id: stripWrapping(stripColon(value())),
          type: '',
          label: '',
          attribute: '',
          attributes: [],
          dimension: '',
          obligation: '',
        };
        forEachEntry(
          unwrapBlock(value()),
          (k2, v2) => {
            if (k2 === 'type') {
              c.type = stripWrapping(v2());
            } else if (k2 === 'label') {
              c.label = stripWrapping(v2());
            } else if (k2 === 'attribute') {
              c.attribute = stripWrapping(v2());
            } else if (k2 === 'attributes') {
              c.attributes = readIdList(v2());
            } else if (k2 === 'dimension') {
              c.dimension = stripWrapping(v2());
            } else if (k2 === 'obligation') {
              const o = stripWrapping(v2());
              if (!(CERTIFICATE_OBLIGATIONS as readonly string[]).includes(o)) {
                throw new Error(
                  `Parsing error: certificate_template. ID ${id}: Unknown obligation "${o}" (valid: ${CERTIFICATE_OBLIGATIONS.join(', ')})`,
                );
              }
              c.obligation = o;
            } else {
              return false;
            }
            return true;
          },
          { construct: 'certificate_template', id },
        );
        template.characteristics.push(c);
      } else if (keyword === 'anr_section') {
        const anr: CertificateAnrSection = {
          title: '',
          coveredLabel: '',
          notEvaluatedLabel: '',
          pendingLabel: '',
          noneTargetedNote: '',
        };
        forEachEntry(
          unwrapBlock(value()),
          (k2, v2) => {
            if (k2 === 'title') {
              anr.title = stripWrapping(v2());
            } else if (k2 === 'covered_label') {
              anr.coveredLabel = stripWrapping(v2());
            } else if (k2 === 'not_evaluated_label') {
              anr.notEvaluatedLabel = stripWrapping(v2());
            } else if (k2 === 'pending_label') {
              anr.pendingLabel = stripWrapping(v2());
            } else if (k2 === 'none_targeted_note') {
              anr.noneTargetedNote = stripWrapping(v2());
            } else {
              return false;
            }
            return true;
          },
          { construct: 'certificate_template', id },
        );
        template.anrSection = anr;
      } else {
        return false;
      }
      return true;
    },
    { construct: 'certificate_template', id },
  );

  return ctx => {
    ctx.certificateTemplates[id] = template;
    return ctx;
  };
};

export const dumpCertificateTemplate: Dumper<CertificateTemplate> = function (
  t,
) {
  let out: string = 'certificate_template ' + dumpBareSafe(t.id) + ' {\n';
  if (t.numberFormat) {
    out += '  number_format "' + escapeString(t.numberFormat) + '"\n';
  }
  if (t.dimensionLabels) {
    out += '  dimension_labels {\n';
    out += '    pattern "' + escapeString(t.dimensionLabels.pattern) + '"\n';
    if (t.dimensionLabels.separator) {
      out +=
        '    separator "' + escapeString(t.dimensionLabels.separator) + '"\n';
    }
    out += '  }\n';
  }
  for (const c of t.characteristics) {
    out += '  characteristic ' + dumpBareSafe(c.id) + ' {\n';
    if (c.type) {
      out += '    type ' + dumpBareSafe(c.type) + '\n';
    }
    if (c.label) {
      out += '    label "' + escapeString(c.label) + '"\n';
    }
    if (c.attribute) {
      out += '    attribute ' + dumpBareSafe(c.attribute) + '\n';
    }
    if (c.attributes.length > 0) {
      out +=
        '    attributes { ' + c.attributes.map(dumpBareSafe).join(' ') + ' }\n';
    }
    if (c.dimension) {
      out += '    dimension ' + dumpBareSafe(c.dimension) + '\n';
    }
    if (c.obligation) {
      out += '    obligation ' + c.obligation + '\n';
    }
    out += '  }\n';
  }
  if (t.anrSection) {
    const a = t.anrSection;
    out += '  anr_section {\n';
    if (a.title) {
      out += '    title "' + escapeString(a.title) + '"\n';
    }
    if (a.coveredLabel) {
      out += '    covered_label "' + escapeString(a.coveredLabel) + '"\n';
    }
    if (a.notEvaluatedLabel) {
      out +=
        '    not_evaluated_label "' + escapeString(a.notEvaluatedLabel) + '"\n';
    }
    if (a.pendingLabel) {
      out += '    pending_label "' + escapeString(a.pendingLabel) + '"\n';
    }
    if (a.noneTargetedNote) {
      out +=
        '    none_targeted_note "' + escapeString(a.noneTargetedNote) + '"\n';
    }
    out += '  }\n';
  }
  out += '}\n';
  return out;
};

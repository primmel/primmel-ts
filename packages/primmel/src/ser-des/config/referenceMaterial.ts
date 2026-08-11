// ─────────────────────────────────────────────────────────────────────
// Reference material construct (data/schemas/reference-materials.yaml,
// TODO.refactor/10 L7 — the reference-material registry):
//   reference_material cgm {
//     kind certified_gas_mixture
//     name "Certified gas mixture (CGM)"
//     definition "..."
//     source { doc "urn:oiml:pub:r:144-1:2013" clause "annex-a" }
//     identity_fields {
//       field composition { description "Component(s) and nominal concentrations" }
//       field certified_value { description "..." unit "ppm" required true }
//       field expiry { description "..." type date }
//     }
//     constraints {
//       constraint uncertainty_ratio_to_mpe {
//         description "..."
//         rule "uncertainty <= mpe_at_point / 3"
//         evidence { uncertainty: cgm_uncertainty mpe_at_point: mpe }
//         override { rule "uncertainty <= mpe_at_point / 2" by issuing_authority evidence cgm_uncertainty_override_approved }
//         on_violation invalidate
//         source { doc "urn:oiml:pub:r:144-1:2013" clause "7.2.2.2" }
//       }
//     }
//   }
//
// Conformance tests link a material via `reference_materials { cgm }`;
// a violated on_violation invalidate constraint voids the run.
// ─────────────────────────────────────────────────────────────────────

import type ReferenceMaterial from '../../types/ReferenceMaterial';
import type {
  MaterialConstraint,
  MaterialIdentityField,
} from '../../types/ReferenceMaterial';
import tokenize from '../tokenize';
import { escapeString, unwrapBlock, stripWrapping } from '../tokenize';
import { forEachEntry, unwrapped, skipUnknownValue } from '../parse-block';
import { readSource, stripColon } from './field-parser';
import {
  parseRef,
  refTargetToSourceRef,
  parseRefFromReaders,
  foldRefIntoLegacy,
  dumpRefs,
  dumpSourceRefAsRef,
} from './ref';
import type { Dumper, Parser } from '../types';

function parseIdentityFields(block: string): MaterialIdentityField[] {
  const out: MaterialIdentityField[] = [];
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (cmd !== 'field') {
      if (i < t.length) {
        unwrapBlock(t[i - 1]);
      }
      continue;
    }
    const field: MaterialIdentityField = {
      name: stripWrapping(t[i++]),
      description: '',
      unit: '',
      type: '',
      required: false,
    };
    if (i < t.length && t[i].startsWith('{')) {
      const ft = tokenize(unwrapBlock(t[i++]));
      let j = 0;
      while (j < ft.length) {
        const fc = ft[j++];
        if (j >= ft.length) {
          break;
        }
        if (fc === 'description') {
          field.description = stripWrapping(ft[j++]);
        } else if (fc === 'unit') {
          field.unit = stripWrapping(ft[j++]);
        } else if (fc === 'type') {
          field.type = stripWrapping(ft[j++]);
        } else if (fc === 'required') {
          field.required = stripWrapping(ft[j++]) === 'true';
        } else {
          j = skipUnknownValue(ft, j, fc);
        }
      }
    }
    out.push(field);
  }
  return out;
}

function parseConstraints(block: string): MaterialConstraint[] {
  const out: MaterialConstraint[] = [];
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (cmd !== 'constraint') {
      if (i < t.length) {
        unwrapBlock(t[i - 1]);
      }
      continue;
    }
    const c: MaterialConstraint = {
      id: stripWrapping(t[i++]),
      description: '',
      rule: '',
      evidence: {},
      override: null,
      onViolation: '',
      source: null,
    };
    if (i < t.length && t[i].startsWith('{')) {
      const ct = tokenize(unwrapBlock(t[i++]));
      let j = 0;
      while (j < ct.length) {
        const cc = ct[j++];
        if (j >= ct.length) {
          break;
        }
        if (cc === 'description') {
          c.description = stripWrapping(ct[j++]);
        } else if (cc === 'rule') {
          c.rule = stripWrapping(ct[j++]);
        } else if (cc === 'evidence') {
          const et = tokenize(unwrapBlock(ct[j++]));
          let k = 0;
          while (k < et.length) {
            const key = stripColon(et[k++]);
            if (k >= et.length) {
              break;
            }
            if (et[k] === ':') {
              k++;
            }
            if (k < et.length) {
              c.evidence[key] = stripWrapping(et[k++]);
            }
          }
        } else if (cc === 'override') {
          const ot = tokenize(unwrapBlock(ct[j++]));
          const override = { rule: '', by: '', evidence: '' };
          let k = 0;
          while (k < ot.length) {
            const oc = ot[k++];
            if (k >= ot.length) {
              break;
            }
            if (oc === 'rule') {
              override.rule = stripWrapping(ot[k++]);
            } else if (oc === 'by') {
              override.by = stripWrapping(ot[k++]);
            } else if (oc === 'evidence') {
              override.evidence = stripWrapping(ot[k++]);
            } else {
              unwrapBlock(ot[k++]);
            }
          }
          c.override = override;
        } else if (cc === 'on_violation') {
          c.onViolation = stripWrapping(ct[j++]);
        } else if (cc === 'source') {
          c.source = readSource(unwrapBlock(ct[j++]));
        } else if (cc === 'ref') {
          // The unified typed reference (docs/primmel/18) — the
          // constraint's provenance folds onto its source slot.
          const rr = parseRef(ct, j, stripWrapping, unwrapBlock);
          j = rr.next;
          if (rr.ref.predicate === 'derives-from' && !c.source) {
            const b = refTargetToSourceRef(rr.ref.target);
            if (b) {
              c.source = b;
            }
          }
        } else {
          j = skipUnknownValue(ct, j, cc);
        }
      }
    }
    out.push(c);
  }
  return out;
}

export const parseReferenceMaterial: Parser = function (id, data) {
  const result: ReferenceMaterial = {
    id,
    kind: '',
    name: '',
    definition: '',
    source: null,
    identityFields: [],
    constraints: [],
  };

  forEachEntry(
    data,
    (keyword, value, peek) => {
      if (keyword === 'kind') {
        result.kind = stripWrapping(value());
      } else if (keyword === 'name') {
        result.name = unwrapped(value);
      } else if (keyword === 'definition') {
        result.definition = unwrapped(value);
      } else if (keyword === 'source') {
        // Repeated provenance blocks accumulate; `source` stays first.
        const src = readSource(unwrapBlock(value()));
        (result.sourceRefs ??= []).push(src);
        if (!result.source) {
          result.source = src;
        }
      } else if (keyword === 'ref') {
        // The unified typed reference (docs/primmel/18).
        const r = parseRefFromReaders(value, peek, stripWrapping, unwrapBlock);
        if (!foldRefIntoLegacy(result, r)) {
          (result.refs ??= []).push(r);
        }
      } else if (keyword === 'identity_fields') {
        result.identityFields = parseIdentityFields(unwrapBlock(value()));
      } else if (keyword === 'constraints') {
        result.constraints = parseConstraints(unwrapBlock(value()));
      } else {
        return false;
      }
      return true;
    },
    { construct: 'reference_material', id },
  );

  return ctx => {
    ctx.referenceMaterials[id] = result;
    return ctx;
  };
};

export const dumpReferenceMaterial: Dumper<ReferenceMaterial> = function (m) {
  let out = 'reference_material ' + m.id + ' {\n';
  if (m.kind) {
    out += '  kind ' + m.kind + '\n';
  }
  if (m.name) {
    out += '  name "' + escapeString(m.name) + '"\n';
  }
  if (m.definition) {
    out += '  definition "' + escapeString(m.definition) + '"\n';
  }
  const rmSources =
    m.sourceRefs && m.sourceRefs.length > 0
      ? m.sourceRefs
      : m.source
        ? [m.source]
        : [];
  for (const s of rmSources) {
    // The canonical provenance spelling (docs/primmel/18 §18.4).
    out += dumpSourceRefAsRef(s, '  ', escapeString);
  }
  out += dumpRefs(m.refs, '  ', escapeString);
  if (m.identityFields.length > 0) {
    out += '  identity_fields {\n';
    for (const f of m.identityFields) {
      let line = '    field ' + f.name + ' { ';
      if (f.description) {
        line += 'description "' + escapeString(f.description) + '" ';
      }
      if (f.unit) {
        line += 'unit "' + escapeString(f.unit) + '" ';
      }
      if (f.type) {
        line += 'type ' + f.type + ' ';
      }
      if (f.required) {
        line += 'required true ';
      }
      out += line + '}\n';
    }
    out += '  }\n';
  }
  if (m.constraints.length > 0) {
    out += '  constraints {\n';
    for (const c of m.constraints) {
      out += '    constraint ' + c.id + ' {\n';
      if (c.description) {
        out += '      description "' + escapeString(c.description) + '"\n';
      }
      if (c.rule) {
        out += '      rule "' + escapeString(c.rule) + '"\n';
      }
      const ekeys = Object.keys(c.evidence);
      if (ekeys.length > 0) {
        out +=
          '      evidence { ' +
          ekeys.map(k => k + ': ' + c.evidence[k]).join(' ') +
          ' }\n';
      }
      if (c.override) {
        out += '      override { rule "' + escapeString(c.override.rule) + '"';
        out += ' by ' + c.override.by;
        if (c.override.evidence) {
          out += ' evidence ' + c.override.evidence;
        }
        out += ' }\n';
      }
      if (c.onViolation) {
        out += '      on_violation ' + c.onViolation + '\n';
      }
      if (c.source && (c.source.doc || c.source.clause)) {
        // The canonical provenance spelling (docs/primmel/18 §18.4).
        out += dumpSourceRefAsRef(c.source, '      ', escapeString);
      }
      out += '    }\n';
    }
    out += '  }\n';
  }
  out += '}\n';
  return out;
};

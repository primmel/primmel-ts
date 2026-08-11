// ─────────────────────────────────────────────────────────────────────
// Subject-chain constructs (Primmel v2, gap G1):
//   instrument, attribute_definition, capability, behavior, condition_set
//
// Grammar sketch:
//   instrument LoadCell {
//     extends MeasuringInstrumentModel
//     definition "..."
//     variant AnaloguePassiveLoadCell { definition "..." }
//     dimension accuracy_class {
//       label "Accuracy class"  scope group  description "..."
//       reference { doc "urn:..." clause "5.1.1" }
//       values { A { description "..." payload { n_lc_limits: "..." } } B C D }
//     }
//     family_criteria { "same material..." "same design..." }
//     family_defaults { dimensions { construction technology } parameters { rated_output } }
//     model_group {
//       definition "..."
//       identical_characteristics { metrological_class n_lc y z }
//       identical_attributes { accuracy_class n_lc y z t_min t_max }
//     }
//   }
//
//   attribute_definition e_max {
//     symbol "E_max"  name "Maximum capacity"  definition "..."
//     source { doc "urn:..." clause "3.5.5" }
//     quantity_kind mass  unit kg  value_type QuantityValue
//     origin design-fixed  scope model  category metrological
//     is_dimension false  enum humidity_class  irdi "..."  derived "ocl{...}"
//   }
//
//   capability digital {
//     label "Digital"  description "..."  abstract false
//     extends analogue-active  requires strain-gauge
//     has_parameters { output_signal software_identification }
//     satisfies_requirements { /req/electronic/software }
//     verified_by_tests { /conf/electronic-tests/software }
//   }
//
//   behavior creep {
//     kind temporal  stimulus force  response "..."
//     source { doc "..." clause "3.7.1" }  verified_by { /conf/... }
//   }
//
//   condition_set load-cell-reference {
//     role reference
//     entries { temperature { value 20 unit degC tolerance 1 } }
//   }
//
// Subject anatomy (Primmel v3, TODO.roadmap/01) — the `subject` construct
// organizes the aspect catalog by the three families is / has / does:
//
//   subject LoadCell {
//     extends MeasuringInstrumentModel
//     is {
//       metadata { name "Load cell" source "urn:oiml:pub:r:60-1:2021#clause-3.1.3" }
//       provenance { manufacturer ACME }
//       structure { }
//       design_parameters { e_max : mass by design }
//       designed_conditions { reference ref-conds rated rated-conds }
//       promises {
//         c6-envelope {
//           target accuracy-class
//           level symbolic C6
//           conditions ocl{self.temperature >= rated.t_min and self.temperature <= rated.t_max}
//           statement "Holds accuracy class C6 across the rated range −10…+40 °C."
//           verified_by { /req/metrological/mpe /conf/metrological-tests/mpe-test }
//           source { doc "urn:oiml:pub:r:60-1:2021" clause "5.1" }
//         }
//         "a statement-only claim (shorthand — linter C43 flags it unverifiable)"
//       }
//       artifacts { }
//     }
//     has {
//       attributes { d_min : mass test_dependent }
//       dimensions { accuracy_class in {A,B,C,D} }
//       state OperationalStates
//       characteristics { creep c_c = ocl{self.indication.delta / self.time.delta} }
//       (block form, TODO.roadmap/10: creep { symbol "c_c" derivation ocl{…}
//        behavior creep quantity_kind verification_interval unit "v"
//        source { doc "…" clause "…" } })
//       environmental_context { "logged 23.4 degC during run 7" }
//       artifact_instances { }
//     }
//     does {
//       behavior measure
//       behavior creep
//     }
//   }
//
// Aspect blocks under the wrong family (or undeclared aspect kinds) are
// recorded on Subject.misplacedAspects for the linter (C6) — the parse
// itself stays lenient.
//
// `extends` merges at resolve time (resolveSubject): each subject merges
// with its parent per aspect-kind rules — maps merge by key (child
// wins), lists append (parent entries first), scalars override (child's
// non-empty value wins). Missing parents and cycle links stay unmerged
// (lint rule subject-extends-resolves reports the missing ones).
// ─────────────────────────────────────────────────────────────────────

import tokenize from '../tokenize';
import {
  escapeString,
  unwrapBlock,
  stripWrapping,
  tokenizePackage,
} from '../tokenize';
import {
  stripColon,
  dumpBareSafe,
  readSource,
  readValueToken,
} from './field-parser';
import {
  parseRef,
  foldRefIntoLegacy,
  refTargetToSourceRef,
  dumpRefs,
  dumpSourceRefAsRef,
} from './ref';
import { parseApplicability, dumpApplicabilityEntries } from './field-parser';
import {
  dumpEndpoint,
  dumpServe,
  parseEndpoint,
  parseServeEntry,
} from './twin';
import { dumpComposedOf, parseComposedOf } from './composition';
import {
  coerceValueToken,
  dumpQuantityBlock,
  dumpScalarToken,
  readQuantityBlock,
} from './quantity';
import type { ConstructDefinition } from './index';
import type { ParseContext } from '../types';
import type {
  AttributeDefinition,
  Behavior,
  Capability,
  ClassificationDimension,
  ConditionEntry,
  ConditionSet,
  DimensionValue,
  Instrument,
  InstrumentComponent,
  InstrumentMeasurand,
  ModelGroupDef,
  PromiseLevel,
  SourceRef,
  StructureEntry,
  Subject,
  SubjectCharacteristic,
  SubjectPromise,
  SubjectVariant,
} from '../../types/Subject';

// ── shared little readers ────────────────────────────────────────────

function dumpSource(
  keyword: string,
  src: SourceRef | null,
  indent: string,
): string {
  if (!src || (!src.doc && !src.clause)) {
    return '';
  }
  const frag = src.fragment ? ` fragment "${escapeString(src.fragment)}"` : '';
  return `${indent}${keyword} { doc "${escapeString(src.doc)}" clause "${escapeString(src.clause)}"${frag} }\n`;
}

function readIdList(block: string): string[] {
  // Wrap-tolerant: `{ a b }` block OR bare scalar — stripWrapping only strips
  // when actually wrapped (unwrapBlock would mangle bare ids).
  return tokenize(stripWrapping(block))
    .map(stripColon)
    .map(stripWrapping)
    .filter(s => s.length > 0);
}

function dumpIdList(keyword: string, ids: string[], indent: string): string {
  if (ids.length === 0) {
    return '';
  }
  return `${indent}${keyword} { ${ids.join(' ')} }\n`;
}

function readReference(block: string): string[] {
  return tokenize(stripWrapping(block))
    .map(stripWrapping)
    .filter(s => s.length > 0);
}

// ── instrument ───────────────────────────────────────────────────────

const parseInstrument: ConstructDefinition['parse'] = function (id, data) {
  const result: Instrument = {
    id,
    extends: '',
    definition: '',
    variants: [],
    dimensions: [],
    perChannel: '',
    familyCriteria: [],
    familyDefaultDimensions: [],
    familyDefaultParameters: [],
    modelGroup: null,
    referenceIds: [],
    measurand: null,
    components: [],
    structure: [],
  };

  const t = tokenizePackage(data);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'extends') {
      result.extends = stripWrapping(t[i++]);
    } else if (cmd === 'measurand_kind') {
      result.measurandKind = stripWrapping(t[i++]);
    } else if (cmd === 'measurand') {
      result.measurand = parseMeasurand(unwrapBlock(t[i++]));
    } else if (cmd === 'component') {
      result.components.push(
        parseComponent(stripWrapping(t[i++]), unwrapBlock(t[i++])),
      );
    } else if (cmd === 'structure') {
      result.structure.push(
        parseStructure(stripWrapping(t[i++]), unwrapBlock(t[i++])),
      );
    } else if (cmd === 'definition') {
      result.definition = stripWrapping(t[i++]);
    } else if (cmd === 'note') {
      result.note = stripWrapping(t[i++]);
    } else if (cmd === 'source') {
      result.source = readSource(unwrapBlock(t[i++]));
    } else if (cmd === 'variant') {
      const variantId = stripWrapping(t[i++]);
      const vblock = i < t.length ? unwrapBlock(t[i++]) : '';
      const v: SubjectVariant = { id: variantId, definition: '' };
      const vt = tokenize(vblock);
      let j = 0;
      while (j < vt.length) {
        const vc = vt[j++];
        if (j >= vt.length) {
          break;
        }
        if (vc === 'name') {
          v.name = stripWrapping(vt[j++]);
        } else if (vc === 'definition') {
          v.definition = stripWrapping(vt[j++]);
        } else if (vc === 'note') {
          v.note = stripWrapping(vt[j++]);
        } else if (vc === 'source') {
          v.source = readSource(unwrapBlock(vt[j++]));
        } else {
          unwrapBlock(vt[j++]);
        }
      }
      result.variants.push(v);
    } else if (cmd === 'dimension') {
      result.dimensions.push(
        parseDimension(stripWrapping(t[i++]), unwrapBlock(t[i++])),
      );
    } else if (cmd === 'per_channel') {
      result.perChannel = stripWrapping(t[i++]);
    } else if (cmd === 'family_criteria') {
      result.familyCriteria = readReference(t[i++]);
    } else if (cmd === 'family') {
      // family { metamodel_class X definition "..." note "..." source { … } }
      const fblk = unwrapBlock(t[i++]);
      const ft = tokenize(fblk);
      let j = 0;
      while (j < ft.length) {
        const fc = ft[j++];
        if (j >= ft.length) {
          break;
        }
        if (fc === 'metamodel_class') {
          result.familyMetamodelClass = stripWrapping(ft[j++]);
        } else if (fc === 'definition') {
          result.familyDefinition = stripWrapping(ft[j++]);
        } else if (fc === 'note') {
          result.familyNote = stripWrapping(ft[j++]);
        } else if (fc === 'source') {
          result.familySource = readSource(unwrapBlock(ft[j++]));
        } else {
          unwrapBlock(ft[j++]);
        }
      }
    } else if (cmd === 'family_defaults') {
      const fblock = unwrapBlock(t[i++]);
      const ft = tokenize(fblock);
      let j = 0;
      while (j < ft.length) {
        const fc = ft[j++];
        if (j >= ft.length) {
          break;
        }
        if (fc === 'dimensions') {
          result.familyDefaultDimensions = readIdList(ft[j++]);
        } else if (fc === 'parameters') {
          result.familyDefaultParameters = readIdList(ft[j++]);
        } else {
          unwrapBlock(ft[j++]);
        }
      }
    } else if (cmd === 'model_group') {
      result.modelGroup = parseModelGroup(unwrapBlock(t[i++]));
    } else if (cmd === 'reference') {
      result.referenceIds = readReference(t[i++]);
    } else if (cmd === 'ref') {
      // The unified typed reference (docs/primmel/18).
      const rr = parseRef(t, i, stripWrapping, unwrapBlock);
      if (!foldRefIntoLegacy(result as never, rr.ref)) {
        (result.refs ??= []).push(rr.ref);
      }
      i = rr.next;
    } else {
      unwrapBlock(t[i++]);
    }
  }

  return ctx => {
    ctx.instruments[id] = result;
    return ctx;
  };
};

/** measurand { kind X description "..." context { … } source { … } } (TODO.roadmap/19, G8). */
function parseMeasurand(block: string): InstrumentMeasurand {
  const m: InstrumentMeasurand = {
    kind: '',
    description: '',
    context: null,
    source: null,
  };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'kind') {
      m.kind = stripWrapping(t[i++]);
    } else if (cmd === 'description') {
      m.description = stripWrapping(t[i++]);
    } else if (cmd === 'context') {
      const ctx = { targetObject: '', identificationMethod: '' };
      const ct = tokenize(unwrapBlock(t[i++]));
      let j = 0;
      while (j < ct.length) {
        const cc = ct[j++];
        if (j >= ct.length) {
          break;
        }
        if (cc === 'target_object') {
          ctx.targetObject = stripWrapping(ct[j++]);
        } else if (cc === 'identification_method') {
          ctx.identificationMethod = stripWrapping(ct[j++]);
        } else {
          unwrapBlock(ct[j++]);
        }
      }
      m.context = ctx;
    } else if (cmd === 'source') {
      m.source = readSource(unwrapBlock(t[i++]));
    } else {
      unwrapBlock(t[i++]);
    }
  }
  return m;
}

/** component <id> { class X definition "..." source { … } } (TODO.roadmap/19, G3). */
function parseComponent(id: string, block: string): InstrumentComponent {
  const c: InstrumentComponent = {
    id,
    classId: '',
    definition: '',
    source: null,
  };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'class') {
      c.classId = stripWrapping(t[i++]);
    } else if (cmd === 'definition') {
      c.definition = stripWrapping(t[i++]);
    } else if (cmd === 'source') {
      c.source = readSource(unwrapBlock(t[i++]));
    } else {
      unwrapBlock(t[i++]);
    }
  }
  return c;
}

/**
 * structure <id> { predicate X subject Y target Z applicability { … }
 * propagation { prop dir … } note "..." source { … } } (TODO.roadmap/19, G3).
 */
function parseStructure(id: string, block: string): StructureEntry {
  const s: StructureEntry = {
    id,
    predicate: '',
    subject: '',
    target: '',
    applicability: [],
    propagation: [],
    note: '',
    source: null,
  };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'predicate') {
      s.predicate = stripWrapping(t[i++]);
    } else if (cmd === 'subject') {
      s.subject = stripWrapping(t[i++]);
    } else if (cmd === 'target') {
      s.target = stripWrapping(t[i++]);
    } else if (cmd === 'applicability') {
      s.applicability = parseApplicability(unwrapBlock(t[i++]));
    } else if (cmd === 'propagation') {
      const pt = tokenize(unwrapBlock(t[i++]));
      for (let j = 0; j + 1 < pt.length; j += 2) {
        s.propagation.push({
          property: stripWrapping(pt[j]),
          direction: stripWrapping(pt[j + 1]),
        });
      }
    } else if (cmd === 'note') {
      s.note = stripWrapping(t[i++]);
    } else if (cmd === 'source') {
      s.source = readSource(unwrapBlock(t[i++]));
    } else {
      unwrapBlock(t[i++]);
    }
  }
  return s;
}

function parseDimension(id: string, block: string): ClassificationDimension {
  const dim: ClassificationDimension = {
    id,
    label: '',
    scope: '',
    cardinality: '',
    labelSeparator: '',
    description: '',
    source: null,
    values: [],
  };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'label') {
      dim.label = stripWrapping(t[i++]);
    } else if (cmd === 'scope') {
      dim.scope = stripWrapping(t[i++]);
    } else if (cmd === 'cardinality') {
      const c = stripWrapping(t[i++]);
      if (c !== 'single' && c !== 'set') {
        throw new Error(
          `Parsing error: dimension. ID ${id}: Unknown cardinality ${c} (valid: single, set)`,
        );
      }
      dim.cardinality = c;
    } else if (cmd === 'label_separator') {
      dim.labelSeparator = stripWrapping(t[i++]);
    } else if (cmd === 'description') {
      dim.description = stripWrapping(t[i++]);
    } else if (cmd === 'reference' || cmd === 'source') {
      dim.source = readSource(unwrapBlock(t[i++]));
    } else if (cmd === 'values') {
      dim.values = parseDimensionValues(unwrapBlock(t[i++]));
    } else {
      unwrapBlock(t[i++]);
    }
  }
  return dim;
}

function parseDimensionValues(block: string): DimensionValue[] {
  const out: DimensionValue[] = [];
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const id = stripColon(t[i++]);
    if (!id) {
      break;
    }
    const value: DimensionValue = {
      id,
      label: '',
      description: '',
      payload: {},
      implies: [],
    };
    if (i < t.length && t[i].startsWith('{')) {
      const vblock = unwrapBlock(t[i++]);
      const vt = tokenize(vblock);
      let j = 0;
      while (j < vt.length) {
        const cmd = vt[j++];
        if (j >= vt.length) {
          break;
        }
        if (cmd === 'label') {
          value.label = stripWrapping(vt[j++]);
        } else if (cmd === 'description') {
          value.description = stripWrapping(vt[j++]);
        } else if (cmd === 'implies') {
          value.implies = readIdList(vt[j++]);
        } else if (cmd === 'term_ref') {
          value.termRef = stripWrapping(vt[j++]);
        } else if (cmd === 'payload') {
          const pblock = unwrapBlock(vt[j++]);
          const pt = tokenize(pblock);
          let k = 0;
          while (k < pt.length) {
            const key = stripColon(pt[k++]);
            if (k >= pt.length) {
              break;
            }
            if (pt[k] === ':') {
              k++;
            }
            if (k < pt.length && pt[k].startsWith('{')) {
              // Nested payload block: n_lc_limits { lower: 50000 upper: unlimited }
              const nt = tokenize(unwrapBlock(pt[k++]));
              const nested: Record<string, string> = {};
              let n = 0;
              while (n < nt.length) {
                const nkey = stripColon(nt[n++]);
                if (n >= nt.length) {
                  break;
                }
                if (nt[n] === ':') {
                  n++;
                }
                if (n < nt.length) {
                  nested[nkey] = stripWrapping(nt[n++]);
                }
              }
              value.payload[key] = nested;
            } else if (k < pt.length) {
              value.payload[key] = stripWrapping(pt[k++]);
            }
          }
        } else {
          unwrapBlock(vt[j++]);
        }
      }
    }
    out.push(value);
  }
  return out;
}

function parseModelGroup(block: string): ModelGroupDef {
  const mg: ModelGroupDef = {
    definition: '',
    identicalCharacteristics: [],
    identicalAttributes: [],
    sources: [],
    sampleSelection: [],
  };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'definition') {
      mg.definition = stripWrapping(t[i++]);
    } else if (cmd === 'identical_characteristics') {
      mg.identicalCharacteristics = readIdList(t[i++]);
    } else if (cmd === 'identical_attributes') {
      mg.identicalAttributes = readIdList(t[i++]);
    } else if (cmd === 'group_by') {
      mg.groupBy = stripWrapping(t[i++]);
    } else if (cmd === 'note') {
      mg.note = stripWrapping(t[i++]);
    } else if (cmd === 'source') {
      mg.sources!.push(readSource(unwrapBlock(t[i++])));
    } else if (cmd === 'sample_selection') {
      mg.sampleSelection!.push(readSource(unwrapBlock(t[i++])));
    } else {
      unwrapBlock(t[i++]);
    }
  }
  return mg;
}

const dumpInstrument = function (inst: Instrument): string {
  let out = 'instrument ' + inst.id + ' {\n';
  if (inst.extends) {
    out += '  extends ' + inst.extends + '\n';
  }
  if (inst.perChannel) {
    out += '  per_channel ' + inst.perChannel + '\n';
  }
  if (inst.measurandKind) {
    out += '  measurand_kind ' + inst.measurandKind + '\n';
  }
  if (inst.measurand) {
    const m = inst.measurand;
    out += '  measurand {\n';
    if (m.kind) {
      out += '    kind ' + m.kind + '\n';
    }
    if (m.description) {
      out += '    description "' + escapeString(m.description) + '"\n';
    }
    if (m.context) {
      out += '    context {';
      if (m.context.targetObject) {
        out += ' target_object "' + escapeString(m.context.targetObject) + '"';
      }
      if (m.context.identificationMethod) {
        out +=
          ' identification_method "' +
          escapeString(m.context.identificationMethod) +
          '"';
      }
      out += ' }\n';
    }
    out += dumpSource('source', m.source, '    ');
    out += '  }\n';
  }
  for (const c of inst.components ?? []) {
    let line = '  component ' + c.id + ' { ';
    if (c.classId) {
      line += 'class ' + c.classId + ' ';
    }
    if (c.definition) {
      line += 'definition "' + escapeString(c.definition) + '" ';
    }
    if (c.source && (c.source.doc || c.source.clause)) {
      line +=
        'source { doc "' +
        escapeString(c.source.doc) +
        '" clause "' +
        escapeString(c.source.clause) +
        '" } ';
    }
    out += line + '}\n';
  }
  for (const s of inst.structure ?? []) {
    out += '  structure ' + s.id + ' {\n';
    if (s.predicate) {
      out += '    predicate ' + s.predicate + '\n';
    }
    if (s.subject) {
      out += '    subject ' + s.subject + '\n';
    }
    if (s.target) {
      out += '    target ' + s.target + '\n';
    }
    if (s.applicability.length > 0) {
      out +=
        '    applicability { ' +
        dumpApplicabilityEntries(s.applicability).trim() +
        ' }\n';
    }
    if (s.propagation.length > 0) {
      out += '    propagation { ';
      for (const p of s.propagation) {
        out += p.property + ' ' + p.direction + ' ';
      }
      out += '}\n';
    }
    if (s.note) {
      out += '    note "' + escapeString(s.note) + '"\n';
    }
    out += dumpSource('source', s.source, '    ');
    out += '  }\n';
  }
  if (inst.definition) {
    out += '  definition "' + escapeString(inst.definition) + '"\n';
  }
  if (inst.note) {
    out += '  note "' + escapeString(inst.note) + '"\n';
  }
  for (const v of inst.variants) {
    let line = '  variant ' + v.id + ' { ';
    if (v.name) {
      line += 'name "' + escapeString(v.name) + '" ';
    }
    line += 'definition "' + escapeString(v.definition) + '" ';
    if (v.note) {
      line += 'note "' + escapeString(v.note) + '" ';
    }
    if (v.source && (v.source.doc || v.source.clause)) {
      line +=
        'source { doc "' +
        escapeString(v.source.doc) +
        '" clause "' +
        escapeString(v.source.clause) +
        '" } ';
    }
    out += line + '}\n';
  }
  for (const d of inst.dimensions) {
    out += '  dimension ' + d.id + ' {\n';
    if (d.label) {
      out += '    label "' + escapeString(d.label) + '"\n';
    }
    if (d.scope) {
      out += '    scope ' + d.scope + '\n';
    }
    if (d.cardinality) {
      out += '    cardinality ' + d.cardinality + '\n';
    }
    if (d.labelSeparator) {
      out += '    label_separator "' + escapeString(d.labelSeparator) + '"\n';
    }
    if (d.description) {
      out += '    description "' + escapeString(d.description) + '"\n';
    }
    out += dumpSource('reference', d.source, '    ');
    if (d.values.length > 0) {
      out += '    values {\n';
      for (const v of d.values) {
        let line = '      ' + v.id;
        const hasProps =
          v.label ||
          v.description ||
          v.termRef ||
          Object.keys(v.payload).length > 0 ||
          v.implies.length > 0;
        if (hasProps) {
          line += ' { ';
          if (v.label) {
            line += 'label "' + escapeString(v.label) + '" ';
          }
          if (v.description) {
            line += 'description "' + escapeString(v.description) + '" ';
          }
          if (v.termRef) {
            line += 'term_ref ' + v.termRef + ' ';
          }
          if (v.implies.length > 0) {
            line += 'implies { ' + v.implies.join(' ') + ' } ';
          }
          if (Object.keys(v.payload).length > 0) {
            line += 'payload { ';
            for (const [k, val] of Object.entries(v.payload)) {
              if (typeof val === 'object' && val !== null) {
                line += k + ' { ';
                for (const [nk, nv] of Object.entries(val)) {
                  line += nk + ': "' + escapeString(String(nv)) + '" ';
                }
                line += '} ';
              } else {
                line += k + ': "' + escapeString(String(val)) + '" ';
              }
            }
            line += '} ';
          }
          line += '}';
        }
        out += line + '\n';
      }
      out += '    }\n';
    }
    out += '  }\n';
  }
  if (
    inst.familyMetamodelClass ||
    inst.familyDefinition ||
    inst.familyNote ||
    (inst.familySource && (inst.familySource.doc || inst.familySource.clause))
  ) {
    out += '  family {\n';
    if (inst.familyMetamodelClass) {
      out += '    metamodel_class ' + inst.familyMetamodelClass + '\n';
    }
    if (inst.familyDefinition) {
      out += '    definition "' + escapeString(inst.familyDefinition) + '"\n';
    }
    if (inst.familyNote) {
      out += '    note "' + escapeString(inst.familyNote) + '"\n';
    }
    out += dumpSource('source', inst.familySource ?? null, '    ');
    out += '  }\n';
  }
  if (inst.familyCriteria.length > 0) {
    out += '  family_criteria {\n';
    for (const c of inst.familyCriteria) {
      out += '    "' + escapeString(c) + '"\n';
    }
    out += '  }\n';
  }
  if (
    inst.familyDefaultDimensions.length > 0 ||
    inst.familyDefaultParameters.length > 0
  ) {
    out += '  family_defaults {\n';
    out += dumpIdList('dimensions', inst.familyDefaultDimensions, '    ');
    out += dumpIdList('parameters', inst.familyDefaultParameters, '    ');
    out += '  }\n';
  }
  if (inst.modelGroup) {
    out += '  model_group {\n';
    if (inst.modelGroup.definition) {
      out +=
        '    definition "' + escapeString(inst.modelGroup.definition) + '"\n';
    }
    if (inst.modelGroup.groupBy) {
      out += '    group_by ' + inst.modelGroup.groupBy + '\n';
    }
    if (inst.modelGroup.note) {
      out += '    note "' + escapeString(inst.modelGroup.note) + '"\n';
    }
    out += dumpIdList(
      'identical_characteristics',
      inst.modelGroup.identicalCharacteristics,
      '    ',
    );
    out += dumpIdList(
      'identical_attributes',
      inst.modelGroup.identicalAttributes,
      '    ',
    );
    for (const s of inst.modelGroup.sources ?? []) {
      out += dumpSource('source', s, '    ');
    }
    for (const s of inst.modelGroup.sampleSelection ?? []) {
      out += dumpSource('sample_selection', s, '    ');
    }
    out += '  }\n';
  }
  out += dumpSource('source', inst.source ?? null, '  ');
  out += dumpIdList('reference', inst.referenceIds, '  ');
  out += '}\n';
  return out;
};

// ── attribute_definition ─────────────────────────────────────────────

const parseAttributeDefinition: ConstructDefinition['parse'] = function (
  id,
  data,
) {
  const result: AttributeDefinition = {
    id,
    symbol: '',
    name: '',
    definition: '',
    source: null,
    quantityKind: '',
    unit: '',
    valueType: '',
    origin: '',
    scope: '',
    category: '',
    isDimension: null,
    enumRef: '',
    irdi: '',
    derived: '',
    referenceIds: [],
  };

  const t = tokenizePackage(data);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'symbol') {
      result.symbol = stripWrapping(t[i++]);
    } else if (cmd === 'name') {
      result.name = stripWrapping(t[i++]);
    } else if (cmd === 'definition') {
      result.definition = stripWrapping(t[i++]);
    } else if (cmd === 'source' || cmd === 'reference') {
      result.source = readSource(unwrapBlock(t[i++]));
    } else if (cmd === 'quantity_kind') {
      result.quantityKind = stripWrapping(t[i++]);
    } else if (cmd === 'unit') {
      result.unit = stripWrapping(t[i++]);
    } else if (cmd === 'value_type') {
      result.valueType = stripWrapping(t[i++]);
    } else if (cmd === 'origin') {
      result.origin = stripWrapping(t[i++]);
    } else if (cmd === 'scope') {
      result.scope = stripWrapping(t[i++]);
    } else if (cmd === 'category') {
      result.category = stripWrapping(t[i++]);
    } else if (cmd === 'is_dimension') {
      result.isDimension = stripWrapping(t[i++]) === 'true';
    } else if (cmd === 'enum') {
      result.enumRef = stripWrapping(t[i++]);
    } else if (cmd === 'enum_values') {
      result.enumValues = readIdList(t[i++]);
    } else if (cmd === 'note') {
      result.note = stripWrapping(t[i++]);
    } else if (cmd === 'irdi') {
      result.irdi = stripWrapping(t[i++]);
    } else if (cmd === 'derived') {
      result.derived = stripWrapping(t[i++]);
    } else {
      unwrapBlock(t[i++]);
    }
  }

  return ctx => {
    ctx.attributeDefinitions[id] = result;
    return ctx;
  };
};

const dumpAttributeDefinition = function (a: AttributeDefinition): string {
  let out = 'attribute_definition ' + a.id + ' {\n';
  if (a.symbol) {
    out += '  symbol "' + escapeString(a.symbol) + '"\n';
  }
  if (a.name) {
    out += '  name "' + escapeString(a.name) + '"\n';
  }
  if (a.definition) {
    out += '  definition "' + escapeString(a.definition) + '"\n';
  }
  out += dumpSource('source', a.source, '  ');
  if (a.quantityKind) {
    out += '  quantity_kind ' + a.quantityKind + '\n';
  }
  if (a.unit) {
    out += '  unit "' + escapeString(a.unit) + '"\n';
  }
  if (a.valueType) {
    out += '  value_type ' + a.valueType + '\n';
  }
  if (a.origin) {
    out += '  origin ' + a.origin + '\n';
  }
  if (a.scope) {
    out += '  scope ' + a.scope + '\n';
  }
  if (a.category) {
    out += '  category ' + a.category + '\n';
  }
  if (a.isDimension !== null && a.isDimension !== undefined) {
    out += '  is_dimension ' + (a.isDimension ? 'true' : 'false') + '\n';
  }
  if (a.enumRef) {
    out += '  enum ' + a.enumRef + '\n';
  }
  if (a.irdi) {
    out += '  irdi "' + escapeString(a.irdi) + '"\n';
  }
  if (a.derived) {
    out += '  derived "' + escapeString(a.derived) + '"\n';
  }
  out += '}\n';
  return out;
};

// ── capability ───────────────────────────────────────────────────────

const parseCapability: ConstructDefinition['parse'] = function (id, data) {
  const result: Capability = {
    id,
    label: '',
    description: '',
    abstract: false,
    extends: [],
    requires: [],
    hasParameters: [],
    satisfiesRequirements: [],
    verifiedByTests: [],
    referenceIds: [],
  };

  const t = tokenizePackage(data);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'label') {
      result.label = stripWrapping(t[i++]);
    } else if (cmd === 'description') {
      result.description = stripWrapping(t[i++]);
    } else if (cmd === 'abstract') {
      result.abstract = stripWrapping(t[i++]) === 'true';
    } else if (cmd === 'extends') {
      result.extends = readIdList(t[i++]);
    } else if (cmd === 'requires') {
      result.requires = readIdList(t[i++]);
    } else if (cmd === 'has_parameters') {
      result.hasParameters = readIdList(t[i++]);
    } else if (cmd === 'satisfies_requirements') {
      result.satisfiesRequirements = readReference(t[i++]);
    } else if (cmd === 'verified_by_tests' || cmd === 'verified_by') {
      result.verifiedByTests = readReference(t[i++]);
    } else if (cmd === 'reference') {
      result.referenceIds = readReference(t[i++]);
    } else {
      unwrapBlock(t[i++]);
    }
  }

  return ctx => {
    ctx.capabilities[id] = result;
    return ctx;
  };
};

const dumpCapability = function (c: Capability): string {
  let out = 'capability ' + c.id + ' {\n';
  if (c.label) {
    out += '  label "' + escapeString(c.label) + '"\n';
  }
  if (c.description) {
    out += '  description "' + escapeString(c.description) + '"\n';
  }
  if (c.abstract) {
    out += '  abstract true\n';
  }
  out += dumpIdList('extends', c.extends, '  ');
  out += dumpIdList('requires', c.requires, '  ');
  out += dumpIdList('has_parameters', c.hasParameters, '  ');
  out += dumpIdList('satisfies_requirements', c.satisfiesRequirements, '  ');
  out += dumpIdList('verified_by_tests', c.verifiedByTests, '  ');
  out += dumpIdList('reference', c.referenceIds, '  ');
  out += '}\n';
  return out;
};

// ── behavior ─────────────────────────────────────────────────────────

const parseBehavior: ConstructDefinition['parse'] = function (id, data) {
  const result: Behavior = {
    id,
    kind: '',
    stimulus: '',
    response: '',
    source: null,
    verifiedBy: [],
    referenceIds: [],
  };

  const t = tokenizePackage(data);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'kind') {
      result.kind = stripWrapping(t[i++]);
    } else if (cmd === 'stimulus') {
      result.stimulus = stripWrapping(t[i++]);
    } else if (cmd === 'response') {
      result.response = stripWrapping(t[i++]);
    } else if (cmd === 'source' || cmd === 'reference') {
      result.source = readSource(unwrapBlock(t[i++]));
    } else if (cmd === 'verified_by' || cmd === 'verified_by_tests') {
      result.verifiedBy = readReference(t[i++]);
    } else {
      unwrapBlock(t[i++]);
    }
  }

  return ctx => {
    ctx.behaviors[id] = result;
    return ctx;
  };
};

const dumpBehavior = function (b: Behavior): string {
  let out = 'behavior ' + b.id + ' {\n';
  if (b.kind) {
    out += '  kind ' + b.kind + '\n';
  }
  if (b.stimulus) {
    out += '  stimulus ' + b.stimulus + '\n';
  }
  if (b.response) {
    out += '  response "' + escapeString(b.response) + '"\n';
  }
  out += dumpSource('source', b.source, '  ');
  out += dumpIdList('verified_by', b.verifiedBy, '  ');
  out += '}\n';
  return out;
};

// ── condition_set ────────────────────────────────────────────────────

const parseConditionSet: ConstructDefinition['parse'] = function (id, data) {
  const result: ConditionSet = {
    id,
    role: '',
    entries: [],
    source: null,
    sources: [],
    referenceIds: [],
  };

  const t = tokenizePackage(data);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'role') {
      result.role = stripWrapping(t[i++]);
    } else if (cmd === 'subject') {
      result.subject = stripWrapping(t[i++]);
    } else if (cmd === 'description') {
      result.description = stripWrapping(t[i++]);
    } else if (cmd === 'entries') {
      result.entries = parseConditionEntries(unwrapBlock(t[i++]));
    } else if (cmd === 'source') {
      // Repeated source blocks accumulate; `source` stays the first entry.
      const src = readSource(unwrapBlock(t[i++]));
      result.sources!.push(src);
      if (!result.source) {
        result.source = src;
      }
    } else if (cmd === 'ref') {
      // The unified typed reference (docs/primmel/18): derives-from folds
      // onto the source/sources provenance channel, cites onto
      // referenceIds, the rest stay as refs.
      const rr = parseRef(t, i, stripWrapping, unwrapBlock);
      i = rr.next;
      if (rr.ref.predicate === 'derives-from') {
        const b = refTargetToSourceRef(rr.ref.target);
        if (b) {
          result.sources!.push(b);
          if (!result.source) {
            result.source = b;
          }
        } else {
          (result.refs ??= []).push(rr.ref);
        }
      } else if (rr.ref.predicate === 'cites') {
        result.referenceIds.push(rr.ref.target);
      } else {
        (result.refs ??= []).push(rr.ref);
      }
    } else if (cmd === 'reference') {
      result.referenceIds = readReference(t[i++]);
    } else {
      unwrapBlock(t[i++]);
    }
  }

  return ctx => {
    ctx.conditionSets[id] = result;
    return ctx;
  };
};

function parseConditionEntries(block: string): ConditionEntry[] {
  const out: ConditionEntry[] = [];
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const qk = stripColon(t[i++]);
    if (!qk) {
      break;
    }
    const entry: ConditionEntry = {
      quantityKind: qk,
      value: '',
      unit: '',
      tolerance: '',
    };
    if (i < t.length && t[i].startsWith('{')) {
      const eblock = unwrapBlock(t[i++]);
      const et = tokenize(eblock);
      let j = 0;
      while (j < et.length) {
        const cmd = et[j++];
        if (j >= et.length) {
          break;
        }
        if (cmd === 'value') {
          entry.value = stripWrapping(et[j++]);
        } else if (cmd === 'unit') {
          entry.unit = stripWrapping(et[j++]);
        } else if (cmd === 'tolerance') {
          entry.tolerance = stripWrapping(et[j++]);
        } else if (cmd === 'note') {
          entry.note = stripWrapping(et[j++]);
        } else {
          unwrapBlock(et[j++]);
        }
      }
    }
    out.push(entry);
  }
  return out;
}

const dumpConditionSet = function (cs: ConditionSet): string {
  let out = 'condition_set ' + cs.id + ' {\n';
  if (cs.role) {
    out += '  role ' + cs.role + '\n';
  }
  if (cs.subject) {
    out += '  subject ' + cs.subject + '\n';
  }
  if (cs.description) {
    out += '  description "' + escapeString(cs.description) + '"\n';
  }
  if (cs.entries.length > 0) {
    out += '  entries {\n';
    for (const e of cs.entries) {
      // Entry values may be free text ("nominal, per installation
      // conditions") — quote whenever not a single safe token.
      let line = '    ' + e.quantityKind + ' { value ' + dumpBareSafe(e.value);
      if (e.unit) {
        line += ' unit "' + escapeString(e.unit) + '"';
      }
      if (e.tolerance) {
        line += ' tolerance ' + dumpBareSafe(e.tolerance);
      }
      if (e.note) {
        line += ' note "' + escapeString(e.note) + '"';
      }
      out += line + ' }\n';
    }
    out += '  }\n';
  }
  const sources =
    cs.sources && cs.sources.length > 0
      ? cs.sources
      : cs.source
        ? [cs.source]
        : [];
  for (const s of sources) {
    // The canonical provenance spelling (docs/primmel/18 §18.4): a
    // URN-anchored block dumps as a derives-from ref line.
    out += dumpSourceRefAsRef(s, '  ', escapeString);
  }
  out += dumpIdList('reference', cs.referenceIds, '  ');
  out += dumpRefs(cs.refs, '  ', escapeString);
  out += '}\n';
  return out;
};

// ── subject (v3 anatomy: is / has / does) ────────────────────────────

/** Read `key value` / `key: value` pairs into a string map. */
function readStringMap(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const key = stripColon(t[i++]);
    if (!key) {
      break;
    }
    if (t[i] === ':') {
      i++;
    }
    if (i < t.length) {
      out[key] = stripWrapping(t[i++]);
    }
  }
  return out;
}

/**
 * Read `<id> : <qualifier tokens…>` entries (design_parameters / attributes).
 * The qualifier runs to the next `<id> :` head or the end of the block;
 * the stored value is the tokens joined with single spaces. The dump
 * re-emits the joined form, so the fixpoint holds.
 */
function readValueMap(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const key = stripColon(t[i++]);
    if (!key) {
      break;
    }
    if (t[i] === ':') {
      i++;
    }
    const parts: string[] = [];
    while (i < t.length && t[i + 1] !== ':') {
      parts.push(stripWrapping(t[i++]));
    }
    out[key] = parts.join(' ');
  }
  return out;
}

/** Read whitespace-separated entries (quoted phrases or bare ids). */
function readStringEntries(block: string): string[] {
  return tokenize(block)
    .map(stripWrapping)
    .filter(s => s.length > 0);
}

/** Read `<id> in { A, B }` dimension-membership entries. */
function readDimensionMap(block: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const key = stripColon(t[i++]);
    if (!key) {
      break;
    }
    if (t[i] === ':') {
      i++;
    }
    if (t[i] === 'in') {
      i++;
    }
    if (i < t.length) {
      const raw = t[i++];
      const inner = raw.startsWith('{') ? unwrapBlock(raw) : stripWrapping(raw);
      out[key] = inner
        .split(/[,\s]+/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
    }
  }
  return out;
}

/**
 * Read `name [symbol] = derivation` characteristic entries. The
 * derivation is an ocl{…} expression (reassembled across whitespace by
 * readValueToken) or a quoted phrase; an absent derivation parses as ''
 * and is flagged by the linter (C7).
 *
 * The `=` separator may arrive FUSED to the name or symbol token
 * (`creep c_c= ocl{…}`, `drift= ocl{…}`) — the tokenizer splits on
 * whitespace only, so a trailing `=` on either token is treated as the
 * separator and the derivation is read from the next token.
 *
 * Block form (TODO.roadmap/10): an entry whose name is followed by a
 * `{ … }` block carries the full register entry — symbol, derivation,
 * behavior (the behavior it quantifies), quantity_kind, unit, source:
 *   mdlo_normalized {
 *     symbol "C_M"
 *     derivation ocl{abs(c_m * t_f / delta_t * (d_max - d_min) / (n * v_min))}
 *     behavior temp-effect-min-dead-load
 *     quantity_kind dimensionless
 *     source { doc "urn:oiml:pub:r:60-3:2021" clause "2.1.4" }
 *   }
 */
function readCharacteristics(
  block: string,
): Record<string, SubjectCharacteristic> {
  const out: Record<string, SubjectCharacteristic> = {};
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    let name = stripColon(t[i++]);
    if (!name) {
      break;
    }
    if (i < t.length && t[i].startsWith('{')) {
      out[name] = readCharacteristicBlock(unwrapBlock(t[i++]));
      continue;
    }
    let symbol = '';
    let derivation = '';
    let fused = false;
    if (name.length > 1 && name.endsWith('=')) {
      name = name.slice(0, -1);
      fused = true;
    }
    if (!fused && i < t.length && t[i] !== '=') {
      // t[i] !== '=' here, so a trailing '=' on the symbol token is fused.
      fused = t[i].endsWith('=');
      symbol = fused ? t[i].slice(0, -1) : t[i];
      i++;
    }
    if (fused || t[i] === '=') {
      if (!fused) {
        i++;
      }
      const read = readValueToken(t, i);
      derivation = stripWrapping(read.text);
      i = read.next;
    }
    out[name] = { symbol, derivation };
  }
  return out;
}

/** Read one block-form characteristic entry (TODO.roadmap/10). */
function readCharacteristicBlock(block: string): SubjectCharacteristic {
  const c: SubjectCharacteristic = { symbol: '', derivation: '' };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'symbol') {
      c.symbol = stripWrapping(t[i++]);
    } else if (cmd === 'derivation' || cmd === 'derive') {
      // ocl{…} expressions reassemble across whitespace (readValueToken).
      const read = readValueToken(t, i);
      c.derivation = stripWrapping(read.text);
      i = read.next;
    } else if (cmd === 'behavior') {
      c.behavior = stripWrapping(t[i++]);
    } else if (cmd === 'quantity_kind') {
      c.quantityKind = stripWrapping(t[i++]);
    } else if (cmd === 'unit') {
      c.unit = stripWrapping(t[i++]);
    } else if (cmd === 'source' || cmd === 'reference') {
      c.source = readSource(unwrapBlock(t[i++]));
    } else {
      unwrapBlock(t[i++]);
    }
  }
  return c;
}

/**
 * Aspects whose payload is a scalar (not a `{ … }` block). When such an
 * aspect is misplaced, its value token must be skipped together with the
 * keyword — otherwise the value is re-read as another (phantom) aspect.
 */
const SCALAR_ASPECTS = new Set(['state', 'behavior']);

/**
 * Misplaced-payload skipping for the twin aspects (TODO.roadmap/32):
 *   endpoint <id> { … }                      — skip the id AND the block;
 *   serve <aspect> via <op> [{ … }]          — skip aspect/via/op + block.
 * Without the skip, a misplaced endpoint/serve cascades into phantom
 * aspects (the id, `via`, the operation name would each re-read as an
 * aspect keyword).
 */
function skipMisplacedPayload(aspect: string, t: string[], i: number): number {
  if (aspect === 'endpoint') {
    if (i < t.length && !t[i].startsWith('{')) {
      i++; // the endpoint id
    }
    if (i < t.length && t[i].startsWith('{')) {
      i++; // the endpoint body
    }
    return i;
  }
  if (aspect === 'serve') {
    if (i < t.length) {
      i++; // the aspect path
    }
    if (t[i] === 'via') {
      i += 2; // `via` + the operation name
    }
    if (i < t.length && t[i].startsWith('{')) {
      i++; // the freshness block
    }
    return i;
  }
  return i;
}

/**
 * Record an aspect key found under the wrong family (or undeclared) for
 * the linter (C6), and skip its payload: one block token, or one scalar
 * value token for the known-scalar aspects.
 */
function recordMisplaced(
  result: Subject,
  family: string,
  cmd: string,
  t: string[],
  i: number,
): number {
  const aspect = stripColon(cmd);
  result.misplacedAspects.push({ family, aspect });
  if (i < t.length && t[i].startsWith('{')) {
    i++;
  } else if (SCALAR_ASPECTS.has(aspect)) {
    i++;
  } else {
    i = skipMisplacedPayload(aspect, t, i);
  }
  return i;
}

/**
 * Read one promise `level` value (TODO.roadmap/08). Three shapes:
 *   level symbolic C6                        → { kind: 'symbolic', symbolic }
 *   level range { min -10 max 40 unit degC } → { kind: 'range', … }
 *   level { value 0.7 unit v }               → { kind: 'quantity', quantity }
 * Returns the level and the next unconsumed token index.
 */
function readPromiseLevel(
  t: string[],
  i: number,
): { level: PromiseLevel; next: number } {
  const tok = t[i] ?? '';
  if (tok === 'symbolic') {
    return {
      level: { kind: 'symbolic', symbolic: stripWrapping(t[i + 1] ?? '') },
      next: i + 2,
    };
  }
  if (tok === 'range') {
    const level: PromiseLevel = { kind: 'range' };
    const inner = tokenize(unwrapBlock(t[i + 1] ?? ''));
    let j = 0;
    while (j < inner.length) {
      const cmd = inner[j++];
      if (j > inner.length) {
        break;
      }
      if (cmd === 'min') {
        level.min = coerceValueToken(inner[j++]);
      } else if (cmd === 'max') {
        level.max = coerceValueToken(inner[j++]);
      } else if (cmd === 'unit') {
        level.unit = stripWrapping(inner[j++]);
      } else {
        unwrapBlock(inner[j++]);
      }
    }
    return { level, next: i + 2 };
  }
  // QuantityValue block form (the full INV-1 contract).
  return {
    level: { kind: 'quantity', quantity: readQuantityBlock(unwrapBlock(tok)) },
    next: i + 1,
  };
}

/**
 * Read is.promises entries (TODO.roadmap/08). Two entry forms:
 *   - rich:  `<id> { target … level … conditions … statement …
 *              verified_by { … } source { … } }`
 *   - shorthand: a quoted phrase or a bare token NOT followed by a block —
 *     the legacy string-list form, parsed as a statement-only promise
 *     (empty id/target/conditions; the linter's C43 flags it as
 *     unverifiable at authoring).
 */
function readPromises(block: string): SubjectPromise[] {
  const out: SubjectPromise[] = [];
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const tok = t[i++];
    if (!tok) {
      break;
    }
    if (tok.startsWith('"') || i >= t.length || !t[i].startsWith('{')) {
      out.push({
        id: '',
        target: '',
        level: null,
        conditions: '',
        statement: stripWrapping(tok),
        verifiedBy: [],
        source: null,
      });
      continue;
    }
    const p: SubjectPromise = {
      id: stripColon(tok),
      target: '',
      level: null,
      conditions: '',
      statement: '',
      verifiedBy: [],
      source: null,
    };
    const inner = tokenize(unwrapBlock(t[i++]));
    let j = 0;
    while (j < inner.length) {
      const cmd = inner[j++];
      if (j >= inner.length) {
        break;
      }
      if (cmd === 'target') {
        p.target = stripWrapping(inner[j++]);
      } else if (cmd === 'level') {
        const read = readPromiseLevel(inner, j);
        p.level = read.level;
        j = read.next;
      } else if (cmd === 'conditions') {
        // ocl{…} expressions reassemble across whitespace (readValueToken).
        const read = readValueToken(inner, j);
        p.conditions = stripWrapping(read.text);
        j = read.next;
      } else if (cmd === 'statement') {
        p.statement = stripWrapping(inner[j++]);
      } else if (cmd === 'verified_by') {
        p.verifiedBy = readIdList(inner[j++]);
      } else if (cmd === 'source') {
        p.source = readSource(unwrapBlock(inner[j++]));
      } else {
        unwrapBlock(inner[j++]);
      }
    }
    out.push(p);
  }
  return out;
}

/** A promise carrying nothing but its prose statement (the shorthand form). */
function isStatementOnlyPromise(p: SubjectPromise): boolean {
  return (
    p.id === '' &&
    !p.target &&
    !p.level &&
    !p.conditions &&
    p.verifiedBy.length === 0 &&
    !p.source
  );
}

function parseSubjectIs(block: string, result: Subject): void {
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'metadata') {
      result.is.metadata = readStringMap(unwrapBlock(t[i++]));
    } else if (cmd === 'provenance') {
      result.is.provenance = readStringMap(unwrapBlock(t[i++]));
    } else if (cmd === 'structure') {
      result.is.structure = readStringEntries(unwrapBlock(t[i++]));
    } else if (cmd === 'design_parameters') {
      result.is.designParameters = readValueMap(unwrapBlock(t[i++]));
    } else if (cmd === 'designed_conditions') {
      result.is.designedConditions = readStringMap(unwrapBlock(t[i++]));
    } else if (cmd === 'promises') {
      result.is.promises = readPromises(unwrapBlock(t[i++]));
    } else if (cmd === 'artifacts') {
      result.is.artifacts = readStringEntries(unwrapBlock(t[i++]));
    } else if (cmd === 'endpoint') {
      // endpoint <id> { … } (TODO.roadmap/32) — the declared API surface.
      const endpointId = stripColon(t[i++] ?? '');
      const body = i < t.length ? unwrapBlock(t[i++]) : '';
      if (endpointId) {
        result.is.endpoints.push(parseEndpoint(endpointId, body));
      }
    } else if (cmd === 'composed_of') {
      // composed_of { … } (TODO.integration/14) — the composition facet
      // of a composite subject.
      result.is.composedOf = parseComposedOf(unwrapBlock(t[i++] ?? ''));
    } else {
      i = recordMisplaced(result, 'is', cmd, t, i);
    }
  }
}

function parseSubjectHas(block: string, result: Subject): void {
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'attributes') {
      result.has.attributes = readValueMap(unwrapBlock(t[i++]));
    } else if (cmd === 'dimensions') {
      result.has.dimensions = readDimensionMap(unwrapBlock(t[i++]));
    } else if (cmd === 'state') {
      result.has.state = stripWrapping(t[i++]);
    } else if (cmd === 'characteristics') {
      result.has.characteristics = readCharacteristics(unwrapBlock(t[i++]));
    } else if (cmd === 'environmental_context') {
      result.has.environmentalContext = readStringEntries(unwrapBlock(t[i++]));
    } else if (cmd === 'artifact_instances') {
      result.has.artifactInstances = readStringEntries(unwrapBlock(t[i++]));
    } else if (cmd === 'serve') {
      // serve <aspect> via <operation> [{ fresh_within <duration> }]
      // (TODO.roadmap/32) — the HAS-level binding with freshness semantics.
      const read = parseServeEntry(t, i);
      result.has.serves.push(read.binding);
      i = read.next;
    } else {
      i = recordMisplaced(result, 'has', cmd, t, i);
    }
  }
}

function parseSubjectDoes(block: string, result: Subject): void {
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'behavior') {
      result.does.behaviors.push(stripWrapping(t[i++]));
    } else {
      i = recordMisplaced(result, 'does', cmd, t, i);
    }
  }
}

const parseSubject: ConstructDefinition['parse'] = function (id, data) {
  const result: Subject = {
    id,
    extends: '',
    is: {
      metadata: {},
      provenance: {},
      structure: [],
      designParameters: {},
      designedConditions: {},
      promises: [],
      artifacts: [],
      endpoints: [],
    },
    has: {
      attributes: {},
      dimensions: {},
      state: '',
      characteristics: {},
      environmentalContext: [],
      artifactInstances: [],
      serves: [],
    },
    does: { behaviors: [] },
    referenceIds: [],
    misplacedAspects: [],
  };

  const t = tokenizePackage(data);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'extends') {
      result.extends = stripWrapping(t[i++]);
    } else if (cmd === 'is') {
      parseSubjectIs(unwrapBlock(t[i++]), result);
    } else if (cmd === 'has') {
      parseSubjectHas(unwrapBlock(t[i++]), result);
    } else if (cmd === 'does') {
      parseSubjectDoes(unwrapBlock(t[i++]), result);
    } else if (cmd === 'reference') {
      result.referenceIds = readReference(t[i++]);
    } else {
      unwrapBlock(t[i++]);
    }
  }

  return ctx => {
    ctx.subjects[id] = result;
    return ctx;
  };
};

// ── subject extends resolution ───────────────────────────────────────

/**
 * Merge PARENT into CHILD per aspect-kind rules (TODO.roadmap/01): maps
 * merge by key (child wins on conflict), lists append (parent entries
 * first, then child's), scalars override (child's non-empty value wins).
 * referenceIds and misplacedAspects are NOT merged: references stay the
 * declaring subject's own, and misplaced aspects are parse-time lint
 * capture the linter already sees on the parent itself.
 */
function mergeSubject(parent: Subject, child: Subject): Subject {
  return {
    id: child.id,
    // The extends link is consumed by the merge — the resolved subject is
    // self-contained, so a dump→load cycle can never re-merge (list
    // aspects would duplicate). Unmerged links keep `extends` (below).
    extends: '',
    is: {
      metadata: { ...parent.is.metadata, ...child.is.metadata },
      provenance: { ...parent.is.provenance, ...child.is.provenance },
      structure: [...parent.is.structure, ...child.is.structure],
      designParameters: {
        ...parent.is.designParameters,
        ...child.is.designParameters,
      },
      designedConditions: {
        ...parent.is.designedConditions,
        ...child.is.designedConditions,
      },
      promises: [...parent.is.promises, ...child.is.promises],
      artifacts: [...parent.is.artifacts, ...child.is.artifacts],
      endpoints: [...parent.is.endpoints, ...child.is.endpoints],
      // The composition facet: the child's declaration wins when present
      // (a composite refines its composition; the parent's carries
      // through unchanged otherwise).
      ...(child.is.composedOf
        ? { composedOf: child.is.composedOf }
        : parent.is.composedOf
          ? { composedOf: parent.is.composedOf }
          : {}),
    },
    has: {
      attributes: { ...parent.has.attributes, ...child.has.attributes },
      dimensions: { ...parent.has.dimensions, ...child.has.dimensions },
      state: child.has.state || parent.has.state,
      characteristics: {
        ...parent.has.characteristics,
        ...child.has.characteristics,
      },
      environmentalContext: [
        ...parent.has.environmentalContext,
        ...child.has.environmentalContext,
      ],
      artifactInstances: [
        ...parent.has.artifactInstances,
        ...child.has.artifactInstances,
      ],
      serves: [...parent.has.serves, ...child.has.serves],
    },
    does: { behaviors: [...parent.does.behaviors, ...child.does.behaviors] },
    referenceIds: child.referenceIds,
    misplacedAspects: child.misplacedAspects,
  };
}

/**
 * Resolve a subject's `extends` chain: merge each subject with its
 * parent from ctx.subjects, recursively when the parent itself extends.
 * Pure — parents are read from the raw parse table and never mutated
 * (several subjects may extend the same parent). Lenient links:
 *   - missing parent → the subject is returned unmerged (the lint rule
 *     subject-extends-resolves reports it);
 *   - cycle → the visited set breaks the cyclic LINK (treated like a
 *     missing parent); acyclic prefixes still merge, so resolution
 *     always terminates.
 */
export function resolveSubject(ctx: ParseContext, item: Subject): Subject {
  const chain = (s: Subject, visited: Set<string>): Subject => {
    const parentId = s.extends;
    if (!parentId || visited.has(parentId)) {
      return s;
    }
    const parent = ctx.subjects[parentId];
    if (!parent) {
      return s;
    }
    visited.add(parentId);
    return mergeSubject(chain(parent, visited), s);
  };
  return chain(item, new Set([item.id]));
}

// ── subject dumpers ──────────────────────────────────────────────────

function dumpSubjectStringMap(
  keyword: string,
  map: Record<string, string>,
): string {
  const keys = Object.keys(map);
  if (keys.length === 0) {
    return '';
  }
  return (
    '    ' +
    keyword +
    ' { ' +
    keys.map(k => k + ' ' + dumpBareSafe(map[k])).join(' ') +
    ' }\n'
  );
}

function dumpSubjectValueMap(
  keyword: string,
  map: Record<string, string>,
): string {
  const keys = Object.keys(map);
  if (keys.length === 0) {
    return '';
  }
  return (
    '    ' +
    keyword +
    ' { ' +
    // Values are free-form qualifiers — route through dumpBareSafe so
    // quotes/braces/whitespace can't break re-parse (same as
    // dumpSubjectStringMap).
    keys
      .map(k => k + ' :' + (map[k] ? ' ' + dumpBareSafe(map[k]) : ''))
      .join(' ') +
    ' }\n'
  );
}

function dumpSubjectEntries(keyword: string, entries: string[]): string {
  if (entries.length === 0) {
    return '';
  }
  return (
    '    ' + keyword + ' { ' + entries.map(dumpBareSafe).join(' ') + ' }\n'
  );
}

function dumpSubjectDimensions(map: Record<string, string[]>): string {
  const keys = Object.keys(map);
  if (keys.length === 0) {
    return '';
  }
  return (
    '    dimensions { ' +
    keys.map(k => k + ' in { ' + map[k].join(', ') + ' }').join(' ') +
    ' }\n'
  );
}

/** Derivations emit bare when ocl{…}/single-token, quoted otherwise. */
function dumpSubjectDerivation(d: string): string {
  return /^ocl\{[\s\S]*\}$/.test(d) ? d : dumpBareSafe(d);
}

/** Dump one promise level (TODO.roadmap/08) — the inverse of readPromiseLevel. */
function dumpPromiseLevel(level: PromiseLevel): string {
  if (level.kind === 'symbolic') {
    return 'symbolic ' + dumpBareSafe(level.symbolic ?? '');
  }
  if (level.kind === 'range') {
    let inner = '';
    if (level.min !== undefined) {
      inner += 'min ' + dumpScalarToken(level.min) + ' ';
    }
    if (level.max !== undefined) {
      inner += 'max ' + dumpScalarToken(level.max) + ' ';
    }
    if (level.unit) {
      inner += 'unit "' + escapeString(level.unit) + '"';
    }
    return 'range { ' + inner.trimEnd() + ' }';
  }
  return dumpQuantityBlock(level.quantity ?? { value: '' });
}

/**
 * Dump is.promises (TODO.roadmap/08). Byte-compat with the legacy string
 * list: a block of statement-only entries keeps the single-line form
 * (`promises { "a" "b" }`); any rich entry switches the block to the
 * multi-line form, one entry per `<id> { … }` block (statement-only
 * entries stay quoted strings on their own lines).
 */
function dumpSubjectPromises(promises: SubjectPromise[]): string {
  if (promises.length === 0) {
    return '';
  }
  if (promises.every(isStatementOnlyPromise)) {
    return (
      '    promises { ' +
      promises.map(p => dumpBareSafe(p.statement)).join(' ') +
      ' }\n'
    );
  }
  let out = '    promises {\n';
  for (const p of promises) {
    if (isStatementOnlyPromise(p)) {
      out += '      ' + dumpBareSafe(p.statement) + '\n';
      continue;
    }
    out += '      ' + dumpBareSafe(p.id) + ' {\n';
    if (p.target) {
      out += '        target ' + dumpBareSafe(p.target) + '\n';
    }
    if (p.level) {
      out += '        level ' + dumpPromiseLevel(p.level) + '\n';
    }
    if (p.conditions) {
      out += '        conditions ' + dumpSubjectDerivation(p.conditions) + '\n';
    }
    if (p.statement) {
      out += '        statement "' + escapeString(p.statement) + '"\n';
    }
    out += dumpIdList('verified_by', p.verifiedBy, '        ');
    out += dumpSource('source', p.source ?? null, '        ');
    out += '      }\n';
  }
  out += '    }\n';
  return out;
}

function dumpSubjectCharacteristics(
  map: Record<string, SubjectCharacteristic>,
): string {
  const keys = Object.keys(map);
  if (keys.length === 0) {
    return '';
  }
  let out = '    characteristics {\n';
  for (const k of keys) {
    const c = map[k];
    const rich =
      c.behavior ||
      c.quantityKind ||
      c.unit ||
      (c.source && (c.source.doc || c.source.clause));
    if (rich) {
      // Block form (TODO.roadmap/10) — the full register entry.
      out += '      ' + k + ' {\n';
      if (c.symbol) {
        out += '        symbol "' + escapeString(c.symbol) + '"\n';
      }
      if (c.derivation) {
        out +=
          '        derivation ' + dumpSubjectDerivation(c.derivation) + '\n';
      }
      if (c.behavior) {
        out += '        behavior ' + dumpBareSafe(c.behavior) + '\n';
      }
      if (c.quantityKind) {
        out += '        quantity_kind ' + dumpBareSafe(c.quantityKind) + '\n';
      }
      if (c.unit) {
        out += '        unit "' + escapeString(c.unit) + '"\n';
      }
      out += dumpSource('source', c.source ?? null, '        ');
      out += '      }\n';
      continue;
    }
    out += '      ' + k + (c.symbol ? ' ' + c.symbol : '');
    if (c.derivation) {
      out += ' = ' + dumpSubjectDerivation(c.derivation);
    }
    out += '\n';
  }
  out += '    }\n';
  return out;
}

/** Dump is.endpoints (TODO.roadmap/32) — one `endpoint <id> { … }` block per
 *  declared endpoint, after the other IS aspects. */
function dumpSubjectEndpoints(endpoints: Subject['is']['endpoints']): string {
  let out = '';
  for (const e of endpoints) {
    out += dumpEndpoint(e, '    ');
  }
  return out;
}

/** Dump has.serves (TODO.roadmap/32) — one `serve … via …` line per binding. */
function dumpSubjectServes(serves: Subject['has']['serves']): string {
  let out = '';
  for (const b of serves) {
    out += dumpServe(b, '    ');
  }
  return out;
}

const dumpSubject = function (s: Subject): string {
  let out = 'subject ' + s.id + ' {\n';
  if (s.extends) {
    out += '  extends ' + s.extends + '\n';
  }
  const isBody =
    dumpSubjectStringMap('metadata', s.is.metadata) +
    dumpSubjectStringMap('provenance', s.is.provenance) +
    dumpSubjectEntries('structure', s.is.structure) +
    dumpSubjectValueMap('design_parameters', s.is.designParameters) +
    dumpSubjectStringMap('designed_conditions', s.is.designedConditions) +
    dumpSubjectPromises(s.is.promises) +
    dumpSubjectEntries('artifacts', s.is.artifacts) +
    dumpSubjectEndpoints(s.is.endpoints) +
    (s.is.composedOf ? dumpComposedOf(s.is.composedOf, '    ') : '');
  if (isBody) {
    out += '  is {\n' + isBody + '  }\n';
  }
  const hasBody =
    dumpSubjectValueMap('attributes', s.has.attributes) +
    dumpSubjectDimensions(s.has.dimensions) +
    (s.has.state ? '    state ' + dumpBareSafe(s.has.state) + '\n' : '') +
    dumpSubjectCharacteristics(s.has.characteristics) +
    dumpSubjectEntries('environmental_context', s.has.environmentalContext) +
    dumpSubjectEntries('artifact_instances', s.has.artifactInstances) +
    dumpSubjectServes(s.has.serves);
  if (hasBody) {
    out += '  has {\n' + hasBody + '  }\n';
  }
  let doesBody = '';
  for (const b of s.does.behaviors) {
    doesBody += '    behavior ' + dumpBareSafe(b) + '\n';
  }
  if (doesBody) {
    out += '  does {\n' + doesBody + '  }\n';
  }
  out += dumpIdList('reference', s.referenceIds, '  ');
  out += '}\n';
  return out;
};

// ── construct registry entries ───────────────────────────────────────

export const instrumentConstruct = {
  keyword: 'instrument',
  field: 'instruments',
  takesID: true,
  parse: parseInstrument,
  dump: dumpInstrument,
} as const;

export const attributeDefinitionConstruct = {
  keyword: 'attribute_definition',
  field: 'attributeDefinitions',
  takesID: true,
  parse: parseAttributeDefinition,
  dump: dumpAttributeDefinition,
} as const;

export const capabilityConstruct = {
  keyword: 'capability',
  field: 'capabilities',
  takesID: true,
  parse: parseCapability,
  dump: dumpCapability,
} as const;

export const behaviorConstruct = {
  keyword: 'behavior',
  field: 'behaviors',
  takesID: true,
  parse: parseBehavior,
  dump: dumpBehavior,
} as const;

export const conditionSetConstruct = {
  keyword: 'condition_set',
  field: 'conditionSets',
  takesID: true,
  parse: parseConditionSet,
  dump: dumpConditionSet,
} as const;

export const subjectConstruct = {
  keyword: 'subject',
  field: 'subjects',
  takesID: true,
  parse: parseSubject,
  resolve: resolveSubject as never,
  dump: dumpSubject,
} as const;

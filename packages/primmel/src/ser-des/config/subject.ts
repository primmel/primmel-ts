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
// ─────────────────────────────────────────────────────────────────────

import tokenize from '../tokenize';
import {
  escapeString,
  unwrapBlock,
  stripWrapping,
  tokenizePackage,
} from '../tokenize';
import { stripColon, dumpBareSafe } from './field-parser';
import type { ConstructDefinition } from './index';
import type {
  AttributeDefinition,
  Behavior,
  Capability,
  ClassificationDimension,
  ConditionEntry,
  ConditionSet,
  DimensionValue,
  Instrument,
  ModelGroupDef,
  SourceRef,
  SubjectVariant,
} from '../../types/Subject';

// ── shared little readers ────────────────────────────────────────────

function readSource(block: string): SourceRef {
  const src: SourceRef = { doc: '', clause: '' };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'doc') {
      src.doc = stripWrapping(t[i++]);
    } else if (cmd === 'clause') {
      src.clause = stripWrapping(t[i++]);
    } else {
      unwrapBlock(t[i++]);
    }
  }
  return src;
}

function dumpSource(
  keyword: string,
  src: SourceRef | null,
  indent: string,
): string {
  if (!src || (!src.doc && !src.clause)) {
    return '';
  }
  return `${indent}${keyword} { doc "${escapeString(src.doc)}" clause "${escapeString(src.clause)}" }\n`;
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
    } else {
      unwrapBlock(t[i++]);
    }
  }

  return ctx => {
    ctx.instruments[id] = result;
    return ctx;
  };
};

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
    isDimension: false,
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
  if (a.isDimension) {
    out += '  is_dimension true\n';
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
    } else if (cmd === 'entries') {
      result.entries = parseConditionEntries(unwrapBlock(t[i++]));
    } else if (cmd === 'source') {
      result.source = readSource(unwrapBlock(t[i++]));
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
      out += line + ' }\n';
    }
    out += '  }\n';
  }
  out += dumpSource('source', cs.source ?? null, '  ');
  out += dumpIdList('reference', cs.referenceIds, '  ');
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

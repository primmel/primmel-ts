// ─────────────────────────────────────────────────────────────────────
// The selection-rule constructs (smart TODO.roadmap/40 batch 3; the
// packages-as-SSOT epic) — `lab_selection_criterion`,
// `sample_selection_rule`, and `specimen_governance_rule` in ONE file
// (the schemeType.ts two-construct precedent; types/SelectionRules.ts
// carries the banner and the grammar sketches). The weight /
// parameter_type / match-operator / test_kind vocabularies are
// parse-enforced (the fail-closed precedent); the model_field
// resolutions and the operator-conditional facets are check-enforced
// (C139) — the codec stays total. The applicability / selector /
// constraint strings are prose or pseudo-code — never resolved.
// ─────────────────────────────────────────────────────────────────────

import type { Dumper, Parser } from '../types';
import tokenize, {
  escapeString,
  stripWrapping,
  unwrapBlock,
} from '../tokenize';
import { forEachEntry } from '../parse-block';
import { dumpBareSafe, stripColon } from './field-parser';
import {
  LabSelectionCriterion,
  SampleSelectionRule,
  SpecimenGovernanceRule,
} from '../../types/SelectionRules';

const CRITERION_WEIGHTS = ['required', 'preferred'] as const;

const CRITERION_PARAMETER_TYPES = [
  'dimension',
  'parameter',
  'operational',
] as const;

const MATCH_OPERATORS = [
  'has_capability',
  'capability_from_field',
  'capability_covers_value',
  'capability_prefix_match',
  'always_pass',
] as const;

const SAMPLE_TEST_KINDS = [
  'full_evaluation',
  'partial_evaluation',
  'deduplicate',
  'humidity',
  'digital_additional',
] as const;

function readStringMap(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  const t = tokenize(unwrapBlock(block));
  for (let i = 0; i + 1 < t.length; i += 2) {
    const k = stripWrapping(stripColon(t[i]!));
    if (k) {
      out[k] = stripWrapping(t[i + 1]!);
    }
  }
  return out;
}

// ── lab_selection_criterion ─────────────────────────────────────────

export const parseLabSelectionCriterion: Parser = (
  id: string,
  data: string,
) => {
  const c: LabSelectionCriterion = {
    id,
    weight: '',
    parameterType: '',
    label: '',
    description: '',
    appliesWhen: null,
    match: null,
  };

  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'weight') {
        const w = stripWrapping(value());
        if (!(CRITERION_WEIGHTS as readonly string[]).includes(w)) {
          throw new Error(
            `Parsing error: lab_selection_criterion. ID ${id}: Unknown weight "${w}" (valid: ${CRITERION_WEIGHTS.join(', ')})`,
          );
        }
        c.weight = w;
      } else if (keyword === 'parameter_type') {
        const p = stripWrapping(value());
        if (!(CRITERION_PARAMETER_TYPES as readonly string[]).includes(p)) {
          throw new Error(
            `Parsing error: lab_selection_criterion. ID ${id}: Unknown parameter_type "${p}" (valid: ${CRITERION_PARAMETER_TYPES.join(', ')})`,
          );
        }
        c.parameterType = p;
      } else if (keyword === 'label') {
        c.label = stripWrapping(value());
      } else if (keyword === 'description') {
        c.description = stripWrapping(value());
      } else if (keyword === 'applies_when') {
        const aw: NonNullable<LabSelectionCriterion['appliesWhen']> = {
          modelField: '',
          in: [],
          equals: '',
          notNull: null,
        };
        forEachEntry(
          unwrapBlock(value()),
          (k2, v2) => {
            if (k2 === 'model_field') {
              aw.modelField = stripWrapping(v2());
            } else if (k2 === 'in') {
              aw.in = tokenize(stripWrapping(v2()))
                .map(stripColon)
                .map(stripWrapping)
                .filter(s => s.length > 0);
            } else if (k2 === 'equals') {
              aw.equals = stripWrapping(v2());
            } else if (k2 === 'not_null') {
              aw.notNull = v2() === 'true';
            } else {
              return false;
            }
            return true;
          },
          { construct: 'lab_selection_criterion applies_when', id },
        );
        c.appliesWhen = aw;
      } else if (keyword === 'match') {
        const m: NonNullable<LabSelectionCriterion['match']> = {
          operator: '',
          requiredCapability: '',
          requiredCapabilityPrefix: '',
          modelField: '',
          labCapabilityPrefix: '',
        };
        forEachEntry(
          unwrapBlock(value()),
          (k2, v2) => {
            if (k2 === 'operator') {
              const o = stripWrapping(v2());
              if (!(MATCH_OPERATORS as readonly string[]).includes(o)) {
                throw new Error(
                  `Parsing error: lab_selection_criterion. ID ${id}: Unknown match operator "${o}" (valid: ${MATCH_OPERATORS.join(', ')})`,
                );
              }
              m.operator = o;
            } else if (k2 === 'required_capability') {
              m.requiredCapability = stripWrapping(v2());
            } else if (k2 === 'required_capability_prefix') {
              m.requiredCapabilityPrefix = stripWrapping(v2());
            } else if (k2 === 'model_field') {
              m.modelField = stripWrapping(v2());
            } else if (k2 === 'lab_capability_prefix') {
              m.labCapabilityPrefix = stripWrapping(v2());
            } else {
              return false;
            }
            return true;
          },
          { construct: 'lab_selection_criterion match', id },
        );
        c.match = m;
      } else {
        return false;
      }
      return true;
    },
    { construct: 'lab_selection_criterion', id },
  );

  return ctx => {
    ctx.labSelectionCriteria[id] = c;
    return ctx;
  };
};

export const dumpLabSelectionCriterion: Dumper<LabSelectionCriterion> =
  function (c) {
    let out: string = 'lab_selection_criterion ' + dumpBareSafe(c.id) + ' {\n';
    if (c.weight) {
      out += '  weight ' + c.weight + '\n';
    }
    if (c.parameterType) {
      out += '  parameter_type ' + c.parameterType + '\n';
    }
    if (c.label) {
      out += '  label "' + escapeString(c.label) + '"\n';
    }
    if (c.description) {
      out += '  description "' + escapeString(c.description) + '"\n';
    }
    if (c.appliesWhen) {
      let line =
        '  applies_when { model_field ' +
        dumpBareSafe(c.appliesWhen.modelField);
      if (c.appliesWhen.in.length > 0) {
        line += ' in { ' + c.appliesWhen.in.map(dumpBareSafe).join(' ') + ' }';
      }
      if (c.appliesWhen.equals) {
        line += ' equals ' + dumpBareSafe(c.appliesWhen.equals);
      }
      if (c.appliesWhen.notNull !== null) {
        line += ' not_null ' + (c.appliesWhen.notNull ? 'true' : 'false');
      }
      out += line + ' }\n';
    }
    if (c.match) {
      out += '  match {\n';
      if (c.match.operator) {
        out += '    operator ' + c.match.operator + '\n';
      }
      if (c.match.requiredCapability) {
        out +=
          '    required_capability "' +
          escapeString(c.match.requiredCapability) +
          '"\n';
      }
      if (c.match.requiredCapabilityPrefix) {
        out +=
          '    required_capability_prefix "' +
          escapeString(c.match.requiredCapabilityPrefix) +
          '"\n';
      }
      if (c.match.modelField) {
        out += '    model_field ' + dumpBareSafe(c.match.modelField) + '\n';
      }
      if (c.match.labCapabilityPrefix) {
        out +=
          '    lab_capability_prefix "' +
          escapeString(c.match.labCapabilityPrefix) +
          '"\n';
      }
      out += '  }\n';
    }
    out += '}\n';
    return out;
  };

// ── sample_selection_rule ───────────────────────────────────────────

export const parseSampleSelectionRule: Parser = (id: string, data: string) => {
  const r: SampleSelectionRule = {
    id,
    step: '',
    rule: '',
    rationale: '',
    applicability: '',
    selector: '',
    testKind: '',
    singleSample: null,
    additionalTests: {},
    post: '',
  };

  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'step') {
        r.step = stripWrapping(value());
      } else if (keyword === 'rule') {
        r.rule = stripWrapping(value());
      } else if (keyword === 'rationale') {
        r.rationale = stripWrapping(value());
      } else if (keyword === 'applicability') {
        r.applicability = stripWrapping(value());
      } else if (keyword === 'selector') {
        r.selector = stripWrapping(value());
      } else if (keyword === 'test_kind') {
        const k = stripWrapping(value());
        if (!(SAMPLE_TEST_KINDS as readonly string[]).includes(k)) {
          throw new Error(
            `Parsing error: sample_selection_rule. ID ${id}: Unknown test_kind "${k}" (valid: ${SAMPLE_TEST_KINDS.join(', ')})`,
          );
        }
        r.testKind = k;
      } else if (keyword === 'single_sample') {
        r.singleSample = value() === 'true';
      } else if (keyword === 'additional_tests') {
        r.additionalTests = readStringMap(value());
      } else if (keyword === 'post') {
        r.post = stripWrapping(value());
      } else {
        return false;
      }
      return true;
    },
    { construct: 'sample_selection_rule', id },
  );

  return ctx => {
    ctx.sampleSelectionRules[id] = r;
    return ctx;
  };
};

export const dumpSampleSelectionRule: Dumper<SampleSelectionRule> = function (
  r,
) {
  let out: string = 'sample_selection_rule ' + dumpBareSafe(r.id) + ' {\n';
  if (r.step) {
    out += '  step "' + escapeString(r.step) + '"\n';
  }
  if (r.rule) {
    out += '  rule "' + escapeString(r.rule) + '"\n';
  }
  if (r.rationale) {
    out += '  rationale "' + escapeString(r.rationale) + '"\n';
  }
  if (r.applicability) {
    out += '  applicability "' + escapeString(r.applicability) + '"\n';
  }
  if (r.selector) {
    out += '  selector "' + escapeString(r.selector) + '"\n';
  }
  if (r.testKind) {
    out += '  test_kind ' + r.testKind + '\n';
  }
  if (r.singleSample !== null) {
    out += '  single_sample ' + (r.singleSample ? 'true' : 'false') + '\n';
  }
  const tests = Object.keys(r.additionalTests);
  if (tests.length > 0) {
    out +=
      '  additional_tests { ' +
      tests
        .map(
          k =>
            dumpBareSafe(k) + ' "' + escapeString(r.additionalTests[k]!) + '"',
        )
        .join(' ') +
      ' }\n';
  }
  if (r.post) {
    out += '  post "' + escapeString(r.post) + '"\n';
  }
  out += '}\n';
  return out;
};

// ── specimen_governance_rule ────────────────────────────────────────

export const parseSpecimenGovernanceRule: Parser = (
  id: string,
  data: string,
) => {
  const r: SpecimenGovernanceRule = {
    id,
    rule: '',
    rationale: '',
    applicability: '',
    constraint: '',
    post: '',
  };

  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'rule') {
        r.rule = stripWrapping(value());
      } else if (keyword === 'rationale') {
        r.rationale = stripWrapping(value());
      } else if (keyword === 'applicability') {
        r.applicability = stripWrapping(value());
      } else if (keyword === 'constraint') {
        r.constraint = stripWrapping(value());
      } else if (keyword === 'post') {
        r.post = stripWrapping(value());
      } else {
        return false;
      }
      return true;
    },
    { construct: 'specimen_governance_rule', id },
  );

  return ctx => {
    ctx.specimenGovernanceRules[id] = r;
    return ctx;
  };
};

export const dumpSpecimenGovernanceRule: Dumper<SpecimenGovernanceRule> =
  function (r) {
    let out: string = 'specimen_governance_rule ' + dumpBareSafe(r.id) + ' {\n';
    if (r.rule) {
      out += '  rule "' + escapeString(r.rule) + '"\n';
    }
    if (r.rationale) {
      out += '  rationale "' + escapeString(r.rationale) + '"\n';
    }
    if (r.applicability) {
      out += '  applicability "' + escapeString(r.applicability) + '"\n';
    }
    if (r.constraint) {
      out += '  constraint "' + escapeString(r.constraint) + '"\n';
    }
    if (r.post) {
      out += '  post "' + escapeString(r.post) + '"\n';
    }
    out += '}\n';
    return out;
  };

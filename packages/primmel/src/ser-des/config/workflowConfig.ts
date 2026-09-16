// ─────────────────────────────────────────────────────────────────────
// `workflow_config` construct (smart TODO.roadmap/40 batch 3; the
// packages-as-SSOT epic) — the certification workflow step register
// (types/WorkflowConfig.ts carries the banner and the grammar sketch).
// The phase vocabulary is parse-enforced (the fail-closed precedent);
// the actor/inputs/outputs resolutions are check-enforced (C137) — the
// codec stays total. The `overlay true` marker (the B3.1 deep-merge
// opt-in) parses like the term precedent and dumps only when true.
// ─────────────────────────────────────────────────────────────────────

import type { Dumper, Parser } from '../types';
import tokenize, {
  escapeString,
  stripWrapping,
  unwrapBlock,
} from '../tokenize';
import { forEachEntry } from '../parse-block';
import { dumpBareSafe, stripColon } from './field-parser';
import WorkflowConfig, { WorkflowStep } from '../../types/WorkflowConfig';

const WORKFLOW_PHASES = [
  'intake',
  'dispatch',
  'testing',
  'evaluation',
  'issuance',
] as const;

function readTokenList(block: string): string[] {
  return tokenize(stripWrapping(block))
    .map(stripColon)
    .map(stripWrapping)
    .filter(s => s.length > 0);
}

function dumpTokenList(keyword: string, ids: string[], indent: string): string {
  if (ids.length === 0) {
    return '';
  }
  return indent + keyword + ' { ' + ids.map(dumpBareSafe).join(' ') + ' }\n';
}

export const parseWorkflowConfig: Parser = (id: string, data: string) => {
  const config: WorkflowConfig = { id, overlay: false, steps: [] };

  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'overlay') {
        config.overlay = value() === 'true';
      } else if (keyword === 'step') {
        const step: WorkflowStep = {
          id: stripWrapping(stripColon(value())),
          phase: null,
          actor: null,
          label: null,
          description: null,
          inputs: [],
          outputs: [],
          gates: [],
        };
        forEachEntry(
          unwrapBlock(value()),
          (k2, v2) => {
            if (k2 === 'phase') {
              const p = stripWrapping(v2());
              if (!(WORKFLOW_PHASES as readonly string[]).includes(p)) {
                throw new Error(
                  `Parsing error: workflow_config. ID ${id}: Unknown phase "${p}" (valid: ${WORKFLOW_PHASES.join(', ')})`,
                );
              }
              step.phase = p;
            } else if (k2 === 'actor') {
              step.actor = stripWrapping(v2());
            } else if (k2 === 'label') {
              step.label = stripWrapping(v2());
            } else if (k2 === 'description') {
              step.description = stripWrapping(v2());
            } else if (k2 === 'inputs') {
              step.inputs = readTokenList(v2());
            } else if (k2 === 'outputs') {
              step.outputs = readTokenList(v2());
            } else if (k2 === 'gates') {
              step.gates = readTokenList(v2());
            } else {
              return false;
            }
            return true;
          },
          { construct: 'workflow_config', id },
        );
        config.steps.push(step);
      } else {
        return false;
      }
      return true;
    },
    { construct: 'workflow_config', id },
  );

  return ctx => {
    ctx.workflowConfigs[id] = config;
    return ctx;
  };
};

export const dumpWorkflowConfig: Dumper<WorkflowConfig> = function (c) {
  let out: string = 'workflow_config ' + dumpBareSafe(c.id) + ' {\n';
  if (c.overlay) {
    out += '  overlay true\n';
  }
  for (const s of c.steps) {
    out += '  step ' + dumpBareSafe(s.id) + ' {\n';
    if (s.phase) {
      out += '    phase ' + s.phase + '\n';
    }
    if (s.actor) {
      out += '    actor ' + dumpBareSafe(s.actor) + '\n';
    }
    if (s.label) {
      out += '    label "' + escapeString(s.label) + '"\n';
    }
    if (s.description) {
      out += '    description "' + escapeString(s.description) + '"\n';
    }
    out += dumpTokenList('inputs', s.inputs, '    ');
    out += dumpTokenList('outputs', s.outputs, '    ');
    if (s.gates.length > 0) {
      out +=
        '    gates { ' +
        s.gates.map(g => '"' + escapeString(g) + '"').join(' ') +
        ' }\n';
    }
    out += '  }\n';
  }
  out += '}\n';
  return out;
};

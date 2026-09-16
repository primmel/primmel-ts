// ─────────────────────────────────────────────────────────────────────
// `workflow_stage` construct (smart TODO.roadmap/40 batch 5 step 5d;
// the packages-as-SSOT epic) — the named pipeline stage grouping the
// workflow constructs (types/WorkflowStage.ts carries the banner and
// the grammar sketch). Every facet is an opaque string or an id list —
// the codec stays total; the members-resolve discipline (elements →
// processes, approvals → approvals, gateways → gateways; the events
// never resolve) is check-enforced (C142, per-register gated).
// ─────────────────────────────────────────────────────────────────────

import type { Dumper, Parser } from '../types';
import tokenize, { escapeString, stripWrapping } from '../tokenize';
import { forEachEntry } from '../parse-block';
import { dumpBareSafe, stripColon } from './field-parser';
import WorkflowStage from '../../types/WorkflowStage';

function readTokenList(block: string): string[] {
  return tokenize(stripWrapping(block))
    .map(stripColon)
    .map(stripWrapping)
    .filter(s => s.length > 0);
}

function dumpTokenList(keyword: string, ids: string[]): string {
  if (ids.length === 0) {
    return '';
  }
  return '  ' + keyword + ' { ' + ids.map(dumpBareSafe).join(' ') + ' }\n';
}

export const parseWorkflowStage: Parser = (id: string, data: string) => {
  const stage: WorkflowStage = {
    id,
    label: '',
    description: '',
    elements: [],
    startEvent: '',
    endEvents: [],
    approvals: [],
    gateways: [],
  };

  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'label') {
        stage.label = stripWrapping(value());
      } else if (keyword === 'description') {
        stage.description = stripWrapping(value());
      } else if (keyword === 'elements') {
        // elements { <process-id>+ } — the member processes (C142).
        stage.elements = readTokenList(value());
      } else if (keyword === 'start_event') {
        // start_event <token> — documentary, never resolved.
        stage.startEvent = stripWrapping(value());
      } else if (keyword === 'end_events') {
        // end_events { <token>+ } — documentary, never resolved.
        stage.endEvents = readTokenList(value());
      } else if (keyword === 'approvals') {
        // approvals { <approval-id>+ } (C142).
        stage.approvals = readTokenList(value());
      } else if (keyword === 'gateways') {
        // gateways { <gateway-id>+ } (C142).
        stage.gateways = readTokenList(value());
      } else {
        return false;
      }
      return true;
    },
    { construct: 'workflow_stage', id },
  );

  return ctx => {
    ctx.workflowStages[id] = stage;
    return ctx;
  };
};

export const dumpWorkflowStage: Dumper<WorkflowStage> = function (s) {
  let out: string = 'workflow_stage ' + dumpBareSafe(s.id) + ' {\n';
  if (s.label) {
    out += '  label "' + escapeString(s.label) + '"\n';
  }
  if (s.description) {
    out += '  description "' + escapeString(s.description) + '"\n';
  }
  out += dumpTokenList('elements', s.elements);
  if (s.startEvent) {
    out += '  start_event ' + dumpBareSafe(s.startEvent) + '\n';
  }
  out += dumpTokenList('end_events', s.endEvents);
  out += dumpTokenList('approvals', s.approvals);
  out += dumpTokenList('gateways', s.gateways);
  out += '}\n';
  return out;
};

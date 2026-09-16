// ─────────────────────────────────────────────────────────────────────
// `verification_pathway` construct (smart TODO.roadmap/40 batch 3; the
// packages-as-SSOT epic) — the metrological-control pathways beyond
// type evaluation (types/VerificationPathway.ts carries the banner and
// the grammar sketch). The kind / trigger-kind / limits-mode
// vocabularies are parse-enforced (the fail-closed precedent); every
// reference resolution is check-enforced (C138) — the codec stays
// total. The window reuses the scheme_lifecycle window sub-grammar; the
// trigger applicability reuses parseApplicability.
// ─────────────────────────────────────────────────────────────────────

import type { Dumper, Parser } from '../types';
import tokenize, {
  escapeString,
  stripWrapping,
  unwrapBlock,
} from '../tokenize';
import { forEachEntry } from '../parse-block';
import {
  dumpApplicabilityEntries,
  dumpBareSafe,
  parseApplicability,
  readSource,
  stripColon,
} from './field-parser';
import VerificationPathway, {
  VerificationMark,
  VerificationTrigger,
  VerificationWindow,
} from '../../types/VerificationPathway';

const VERIFICATION_KINDS = [
  'initial',
  'subsequent',
  'periodic',
  'in-service',
] as const;

const TRIGGER_KINDS = ['timer', 'signal'] as const;

const LIMITS_MODES = ['same-as-type-evaluation', 'override'] as const;

function readIdList(block: string): string[] {
  return tokenize(stripWrapping(block))
    .map(stripColon)
    .map(stripWrapping)
    .filter(s => s.length > 0);
}

function readWindow(block: string): VerificationWindow {
  const window: VerificationWindow = { years: 0, months: 0 };
  const t = tokenize(unwrapBlock(block));
  for (let i = 0; i + 1 < t.length; i += 2) {
    if (t[i] === 'years') {
      window.years = parseInt(stripWrapping(t[i + 1]!), 10) || 0;
    } else if (t[i] === 'months') {
      window.months = parseInt(stripWrapping(t[i + 1]!), 10) || 0;
    }
  }
  return window;
}

function dumpWindow(w: VerificationWindow, indent: string): string {
  let out = indent + 'window {';
  if (w.years > 0) {
    out += ' years ' + w.years;
  }
  if (w.months > 0) {
    out += ' months ' + w.months;
  }
  return out + ' }\n';
}

function dumpSourceLines(
  src: { doc: string; clause: string },
  indent: string,
): string {
  if (!src.doc && !src.clause) {
    return '';
  }
  let out = indent + 'source {\n';
  if (src.doc) {
    out += indent + '  doc "' + escapeString(src.doc) + '"\n';
  }
  if (src.clause) {
    out += indent + '  clause "' + escapeString(src.clause) + '"\n';
  }
  return out + indent + '}\n';
}

export const parseVerificationPathway: Parser = (id: string, data: string) => {
  const pathway: VerificationPathway = {
    id,
    kind: '',
    label: '',
    description: '',
    visualInspection: '',
    tests: [],
    assessment: null,
    limits: null,
    marking: null,
    validity: null,
    source: null,
  };

  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'kind') {
        const k = stripWrapping(value());
        if (!(VERIFICATION_KINDS as readonly string[]).includes(k)) {
          throw new Error(
            `Parsing error: verification_pathway. ID ${id}: Unknown kind "${k}" (valid: ${VERIFICATION_KINDS.join(', ')})`,
          );
        }
        pathway.kind = k;
      } else if (keyword === 'label') {
        pathway.label = stripWrapping(value());
      } else if (keyword === 'description') {
        pathway.description = stripWrapping(value());
      } else if (keyword === 'visual_inspection') {
        pathway.visualInspection = stripWrapping(value());
      } else if (keyword === 'tests') {
        pathway.tests = readIdList(value());
      } else if (keyword === 'assessment') {
        const assessment = { covers: [] as string[], description: '' };
        forEachEntry(
          unwrapBlock(value()),
          (k2, v2) => {
            if (k2 === 'covers') {
              assessment.covers = readIdList(v2());
            } else if (k2 === 'description') {
              assessment.description = stripWrapping(v2());
            } else {
              return false;
            }
            return true;
          },
          { construct: 'verification_pathway assessment', id },
        );
        pathway.assessment = assessment;
      } else if (keyword === 'limits') {
        const limits: NonNullable<VerificationPathway['limits']> = {
          mode: '',
          description: '',
          source: null,
        };
        forEachEntry(
          unwrapBlock(value()),
          (k2, v2) => {
            if (k2 === 'mode') {
              const m = stripWrapping(v2());
              if (!(LIMITS_MODES as readonly string[]).includes(m)) {
                throw new Error(
                  `Parsing error: verification_pathway. ID ${id}: Unknown limits mode "${m}" (valid: ${LIMITS_MODES.join(', ')})`,
                );
              }
              limits.mode = m;
            } else if (k2 === 'description') {
              limits.description = stripWrapping(v2());
            } else if (k2 === 'source') {
              limits.source = readSource(unwrapBlock(v2()));
            } else {
              return false;
            }
            return true;
          },
          { construct: 'verification_pathway limits', id },
        );
        pathway.limits = limits;
      } else if (keyword === 'marking') {
        const marking: NonNullable<VerificationPathway['marking']> = {
          marks: [],
          securing: [],
        };
        forEachEntry(
          unwrapBlock(value()),
          (k2, v2) => {
            if (k2 === 'mark') {
              const mark: VerificationMark = {
                id: stripWrapping(stripColon(v2())),
                mark: '',
                location: '',
                clause: '',
              };
              forEachEntry(
                unwrapBlock(v2()),
                (k3, v3) => {
                  if (k3 === 'mark') {
                    mark.mark = stripWrapping(v3());
                  } else if (k3 === 'location') {
                    mark.location = stripWrapping(v3());
                  } else if (k3 === 'clause') {
                    mark.clause = stripWrapping(v3());
                  } else {
                    return false;
                  }
                  return true;
                },
                { construct: 'verification_pathway marking mark', id },
              );
              marking.marks.push(mark);
            } else if (k2 === 'securing') {
              marking.securing = readIdList(v2());
            } else {
              return false;
            }
            return true;
          },
          { construct: 'verification_pathway marking', id },
        );
        pathway.marking = marking;
      } else if (keyword === 'validity') {
        const validity: NonNullable<VerificationPathway['validity']> = {
          window: null,
          triggers: [],
        };
        forEachEntry(
          unwrapBlock(value()),
          (k2, v2) => {
            if (k2 === 'window') {
              validity.window = readWindow(v2());
            } else if (k2 === 'trigger') {
              const trigger: VerificationTrigger = {
                id: stripWrapping(stripColon(v2())),
                kind: '',
                event: '',
                action: '',
                applicability: [],
                description: '',
                source: null,
              };
              forEachEntry(
                unwrapBlock(v2()),
                (k3, v3) => {
                  if (k3 === 'kind') {
                    const k = stripWrapping(v3());
                    if (!(TRIGGER_KINDS as readonly string[]).includes(k)) {
                      throw new Error(
                        `Parsing error: verification_pathway. ID ${id}: Unknown trigger kind "${k}" (valid: ${TRIGGER_KINDS.join(', ')})`,
                      );
                    }
                    trigger.kind = k;
                  } else if (k3 === 'event') {
                    trigger.event = stripWrapping(v3());
                  } else if (k3 === 'action') {
                    trigger.action = stripWrapping(v3());
                  } else if (k3 === 'applicability') {
                    trigger.applicability = parseApplicability(
                      unwrapBlock(v3()),
                    );
                  } else if (k3 === 'description') {
                    trigger.description = stripWrapping(v3());
                  } else if (k3 === 'source') {
                    trigger.source = readSource(unwrapBlock(v3()));
                  } else {
                    return false;
                  }
                  return true;
                },
                { construct: 'verification_pathway validity trigger', id },
              );
              validity.triggers.push(trigger);
            } else {
              return false;
            }
            return true;
          },
          { construct: 'verification_pathway validity', id },
        );
        pathway.validity = validity;
      } else if (keyword === 'source') {
        pathway.source = readSource(unwrapBlock(value()));
      } else {
        return false;
      }
      return true;
    },
    { construct: 'verification_pathway', id },
  );

  return ctx => {
    ctx.verificationPathways[id] = pathway;
    return ctx;
  };
};

export const dumpVerificationPathway: Dumper<VerificationPathway> = function (
  p,
) {
  let out: string = 'verification_pathway ' + dumpBareSafe(p.id) + ' {\n';
  if (p.kind) {
    out += '  kind ' + p.kind + '\n';
  }
  if (p.label) {
    out += '  label "' + escapeString(p.label) + '"\n';
  }
  if (p.description) {
    out += '  description "' + escapeString(p.description) + '"\n';
  }
  if (p.visualInspection) {
    out += '  visual_inspection "' + escapeString(p.visualInspection) + '"\n';
  }
  if (p.tests.length > 0) {
    out += '  tests { ' + p.tests.map(dumpBareSafe).join(' ') + ' }\n';
  }
  if (p.assessment) {
    out += '  assessment {\n';
    if (p.assessment.covers.length > 0) {
      out +=
        '    covers { ' +
        p.assessment.covers.map(dumpBareSafe).join(' ') +
        ' }\n';
    }
    if (p.assessment.description) {
      out +=
        '    description "' + escapeString(p.assessment.description) + '"\n';
    }
    out += '  }\n';
  }
  if (p.limits) {
    out += '  limits {\n';
    if (p.limits.mode) {
      out += '    mode ' + p.limits.mode + '\n';
    }
    if (p.limits.description) {
      out += '    description "' + escapeString(p.limits.description) + '"\n';
    }
    if (p.limits.source) {
      out += dumpSourceLines(p.limits.source, '    ');
    }
    out += '  }\n';
  }
  if (p.marking) {
    out += '  marking {\n';
    for (const m of p.marking.marks) {
      let line =
        '    mark ' +
        dumpBareSafe(m.id) +
        ' { mark "' +
        escapeString(m.mark) +
        '"';
      if (m.location) {
        line += ' location "' + escapeString(m.location) + '"';
      }
      if (m.clause) {
        line += ' clause "' + escapeString(m.clause) + '"';
      }
      out += line + ' }\n';
    }
    if (p.marking.securing.length > 0) {
      out +=
        '    securing { ' +
        p.marking.securing.map(s => '"' + escapeString(s) + '"').join(' ') +
        ' }\n';
    }
    out += '  }\n';
  }
  if (p.validity) {
    out += '  validity {\n';
    if (p.validity.window) {
      out += dumpWindow(p.validity.window, '    ');
    }
    for (const t of p.validity.triggers) {
      out += '    trigger ' + dumpBareSafe(t.id) + ' {\n';
      if (t.kind) {
        out += '      kind ' + t.kind + '\n';
      }
      if (t.event) {
        out += '      event ' + dumpBareSafe(t.event) + '\n';
      }
      if (t.action) {
        out += '      action ' + dumpBareSafe(t.action) + '\n';
      }
      if (t.applicability.length > 0) {
        out +=
          '      applicability { ' +
          dumpApplicabilityEntries(t.applicability).trimEnd() +
          ' }\n';
      }
      if (t.description) {
        out += '      description "' + escapeString(t.description) + '"\n';
      }
      if (t.source) {
        out += dumpSourceLines(t.source, '      ');
      }
      out += '    }\n';
    }
    out += '  }\n';
  }
  if (p.source) {
    out += dumpSourceLines(p.source, '  ');
  }
  out += '}\n';
  return out;
};

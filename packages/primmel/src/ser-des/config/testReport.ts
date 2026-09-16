// ─────────────────────────────────────────────────────────────────────
// The test-report constructs (smart TODO.roadmap/40 batch 3; the
// packages-as-SSOT epic) — `test_report_skeleton` and
// `test_report_checklist` in ONE file (the schemeType.ts precedent;
// types/TestReport.ts carries the banner and the grammar sketches).
// The required / obligation vocabularies are parse-enforced (the
// fail-closed precedent); every reference resolution is
// check-enforced (C140/C141) — the codec stays total. The checklist's
// `overlay true` marker (the B3.1 deep-merge opt-in) parses like the
// term precedent and dumps only when true; the entry facets default to
// null so an overlay never clobbers the base.
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
  stripColon,
} from './field-parser';
import {
  TestReportChecklist,
  TestReportChecklistEntry,
  TestReportFormEntry,
  TestReportSection,
  TestReportSkeleton,
  TestReportSubsection,
} from '../../types/TestReport';

const REQUIRED_VOCABULARY = ['always', 'conditional'] as const;
const CHECKLIST_OBLIGATIONS = ['shall', 'may'] as const;

// ── the form-entry sub-grammar (shared by sections and subsections) ──

function parseFormEntry(
  id: string,
  block: string,
  parentId: string,
): TestReportFormEntry {
  const entry: TestReportFormEntry = {
    id,
    file: '',
    title: '',
    conformanceTest: '',
    requirements: [],
    required: '',
    applicability: [],
    notes: '',
  };
  forEachEntry(
    block,
    (keyword, value) => {
      if (keyword === 'file') {
        entry.file = stripWrapping(value());
      } else if (keyword === 'title') {
        entry.title = stripWrapping(value());
      } else if (keyword === 'conformance_test') {
        entry.conformanceTest = stripWrapping(value());
      } else if (keyword === 'requirements') {
        entry.requirements = tokenizeList(value());
      } else if (keyword === 'required') {
        const r = stripWrapping(value());
        if (!(REQUIRED_VOCABULARY as readonly string[]).includes(r)) {
          throw new Error(
            `Parsing error: test_report_skeleton. ID ${parentId}: Unknown required "${r}" (valid: ${REQUIRED_VOCABULARY.join(', ')})`,
          );
        }
        entry.required = r;
      } else if (keyword === 'applicability') {
        entry.applicability = parseApplicability(unwrapBlock(value()));
      } else if (keyword === 'notes') {
        entry.notes = stripWrapping(value());
      } else {
        return false;
      }
      return true;
    },
    { construct: 'test_report_skeleton form', id: parentId },
  );
  return entry;
}

function tokenizeList(block: string): string[] {
  return tokenize(stripWrapping(block))
    .map(stripColon)
    .map(stripWrapping)
    .filter(x => x.length > 0);
}

function dumpFormEntry(entry: TestReportFormEntry, indent: string): string {
  let out = indent + 'form ' + dumpBareSafe(entry.id) + ' {\n';
  if (entry.file) {
    out += indent + '  file "' + escapeString(entry.file) + '"\n';
  }
  if (entry.title) {
    out += indent + '  title "' + escapeString(entry.title) + '"\n';
  }
  if (entry.conformanceTest) {
    out +=
      indent +
      '  conformance_test ' +
      dumpBareSafe(entry.conformanceTest) +
      '\n';
  }
  if (entry.requirements.length > 0) {
    out +=
      indent +
      '  requirements { ' +
      entry.requirements.map(dumpBareSafe).join(' ') +
      ' }\n';
  }
  if (entry.required) {
    out += indent + '  required ' + entry.required + '\n';
  }
  if (entry.applicability.length > 0) {
    out +=
      indent +
      '  applicability { ' +
      dumpApplicabilityEntries(entry.applicability).trimEnd() +
      ' }\n';
  }
  if (entry.notes) {
    out += indent + '  notes "' + escapeString(entry.notes) + '"\n';
  }
  out += indent + '}\n';
  return out;
}

// ── test_report_skeleton ────────────────────────────────────────────

export const parseTestReportSkeleton: Parser = (id: string, data: string) => {
  const skeleton: TestReportSkeleton = {
    id,
    title: '',
    description: '',
    note: '',
    sections: [],
  };

  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'title') {
        skeleton.title = stripWrapping(value());
      } else if (keyword === 'description') {
        skeleton.description = stripWrapping(value());
      } else if (keyword === 'note') {
        skeleton.note = stripWrapping(value());
      } else if (keyword === 'section') {
        const section: TestReportSection = {
          id: stripWrapping(stripColon(value())),
          title: '',
          description: '',
          forms: [],
          subsections: [],
        };
        forEachEntry(
          unwrapBlock(value()),
          (k2, v2) => {
            if (k2 === 'title') {
              section.title = stripWrapping(v2());
            } else if (k2 === 'description') {
              section.description = stripWrapping(v2());
            } else if (k2 === 'form') {
              section.forms.push(
                parseFormEntry(
                  stripWrapping(stripColon(v2())),
                  unwrapBlock(v2()),
                  id,
                ),
              );
            } else if (k2 === 'subsection') {
              const subsection: TestReportSubsection = {
                title: stripWrapping(v2()),
                description: '',
                applicability: [],
                forms: [],
              };
              forEachEntry(
                unwrapBlock(v2()),
                (k3, v3) => {
                  if (k3 === 'description') {
                    subsection.description = stripWrapping(v3());
                  } else if (k3 === 'applicability') {
                    subsection.applicability = parseApplicability(
                      unwrapBlock(v3()),
                    );
                  } else if (k3 === 'form') {
                    subsection.forms.push(
                      parseFormEntry(
                        stripWrapping(stripColon(v3())),
                        unwrapBlock(v3()),
                        id,
                      ),
                    );
                  } else {
                    return false;
                  }
                  return true;
                },
                { construct: 'test_report_skeleton subsection', id },
              );
              section.subsections.push(subsection);
            } else {
              return false;
            }
            return true;
          },
          { construct: 'test_report_skeleton section', id },
        );
        skeleton.sections.push(section);
      } else {
        return false;
      }
      return true;
    },
    { construct: 'test_report_skeleton', id },
  );

  return ctx => {
    ctx.testReportSkeletons[id] = skeleton;
    return ctx;
  };
};

export const dumpTestReportSkeleton: Dumper<TestReportSkeleton> = function (s) {
  let out: string = 'test_report_skeleton ' + dumpBareSafe(s.id) + ' {\n';
  if (s.title) {
    out += '  title "' + escapeString(s.title) + '"\n';
  }
  if (s.description) {
    out += '  description "' + escapeString(s.description) + '"\n';
  }
  if (s.note) {
    out += '  note "' + escapeString(s.note) + '"\n';
  }
  for (const section of s.sections) {
    out += '  section ' + dumpBareSafe(section.id) + ' {\n';
    if (section.title) {
      out += '    title "' + escapeString(section.title) + '"\n';
    }
    if (section.description) {
      out += '    description "' + escapeString(section.description) + '"\n';
    }
    for (const f of section.forms) {
      out += dumpFormEntry(f, '    ');
    }
    for (const sub of section.subsections) {
      out += '    subsection "' + escapeString(sub.title) + '" {\n';
      if (sub.description) {
        out += '      description "' + escapeString(sub.description) + '"\n';
      }
      if (sub.applicability.length > 0) {
        out +=
          '      applicability { ' +
          dumpApplicabilityEntries(sub.applicability).trimEnd() +
          ' }\n';
      }
      for (const f of sub.forms) {
        out += dumpFormEntry(f, '      ');
      }
      out += '    }\n';
    }
    out += '  }\n';
  }
  out += '}\n';
  return out;
};

// ── test_report_checklist ───────────────────────────────────────────

export const parseTestReportChecklist: Parser = (id: string, data: string) => {
  const checklist: TestReportChecklist = { id, overlay: false, entries: [] };

  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'overlay') {
        checklist.overlay = value() === 'true';
      } else if (keyword === 'entry') {
        const entry: TestReportChecklistEntry = {
          id: stripWrapping(stripColon(value())),
          element: null,
          description: null,
          obligation: null,
          descriptionNote: null,
          source: null,
          validation: null,
        };
        forEachEntry(
          unwrapBlock(value()),
          (k2, v2) => {
            if (k2 === 'element') {
              entry.element = stripWrapping(v2());
            } else if (k2 === 'description') {
              entry.description = stripWrapping(v2());
            } else if (k2 === 'obligation') {
              const o = stripWrapping(v2());
              if (!(CHECKLIST_OBLIGATIONS as readonly string[]).includes(o)) {
                throw new Error(
                  `Parsing error: test_report_checklist. ID ${id}: Unknown obligation "${o}" (valid: ${CHECKLIST_OBLIGATIONS.join(', ')})`,
                );
              }
              entry.obligation = o;
            } else if (k2 === 'description_note') {
              entry.descriptionNote = stripWrapping(v2());
            } else if (k2 === 'source') {
              entry.source = stripWrapping(v2());
            } else if (k2 === 'validation') {
              entry.validation = stripWrapping(v2());
            } else {
              return false;
            }
            return true;
          },
          { construct: 'test_report_checklist entry', id },
        );
        checklist.entries.push(entry);
      } else {
        return false;
      }
      return true;
    },
    { construct: 'test_report_checklist', id },
  );

  return ctx => {
    ctx.testReportChecklists[id] = checklist;
    return ctx;
  };
};

export const dumpTestReportChecklist: Dumper<TestReportChecklist> = function (
  c,
) {
  let out: string = 'test_report_checklist ' + dumpBareSafe(c.id) + ' {\n';
  if (c.overlay) {
    out += '  overlay true\n';
  }
  for (const e of c.entries) {
    out += '  entry ' + dumpBareSafe(e.id) + ' {\n';
    if (e.element !== null) {
      out += '    element "' + escapeString(e.element) + '"\n';
    }
    if (e.description !== null) {
      out += '    description "' + escapeString(e.description) + '"\n';
    }
    if (e.obligation !== null) {
      out += '    obligation ' + e.obligation + '\n';
    }
    if (e.descriptionNote !== null) {
      out += '    description_note "' + escapeString(e.descriptionNote) + '"\n';
    }
    if (e.source !== null) {
      out += '    source "' + escapeString(e.source) + '"\n';
    }
    if (e.validation !== null) {
      out += '    validation "' + escapeString(e.validation) + '"\n';
    }
    out += '  }\n';
  }
  out += '}\n';
  return out;
};

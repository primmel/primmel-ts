// ─────────────────────────────────────────────────────────────────────
// Test-design block parser + dumper (conformance_test `design { … }`).
//
// Maps data/schemas/cc.yaml $defs/testDesign (TODO.refactor/09):
//
//   design {
//     counts {
//       count field_automatic {
//         min 500
//         clause "4.4"
//         override { condition statistical_analysis by evaluator note "..." }
//       }
//     }
//     severities {
//       severity "1 dry heat (operating)" {
//         criterion I/MPE
//         footnotes { a b }
//         env climatic_environment_class { level 2 }
//         env mechanical_environment_class null
//         env electromagnetic_environment_class {
//           amplitude 10
//           unit "V/m"
//           variable field_strength
//           columns {
//             ac { amplitude 10 unit "V/m" }
//             dc null
//             vehicle_dc { amplitude 10 unit "V" note "..." }
//           }
//         }
//       }
//     }
//     test_points { ref r144-cgm-points }
//     schedule {
//       duration P7D
//       cadence PT24H
//       phases { phase soak { condition "..." window PT2H } }
//       constraints { "apply D_max and hold" }
//     }
//     specimens {
//       count 1
//       max_additional 2
//       selection "ocl{...}"
//       continuity same_eut
//       rules { unit-continuity }
//     }
//   }
// ─────────────────────────────────────────────────────────────────────

import type TestDesign from '../../types/Design';
import type {
  DesignCount,
  DesignSchedule,
  DesignSchedulePhase,
  DesignSeverity,
  DesignSpecimens,
  SeverityCell,
  SeverityValue,
} from '../../types/Design';
import tokenize from '../tokenize';
import { escapeString, unwrapBlock, stripWrapping } from '../tokenize';
import { stripColon } from './field-parser';

function readQuotedList(block: string): string[] {
  return tokenize(stripWrapping(block))
    .map(stripWrapping)
    .filter(s => s.length > 0);
}

function parseSeverityCell(block: string): SeverityCell {
  const cell: SeverityCell = {
    level: null,
    code: '',
    amplitude: null,
    unit: '',
    note: '',
    variable: '',
  };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'level') {
      cell.level = Number(stripWrapping(t[i++]));
    } else if (cmd === 'code') {
      cell.code = stripWrapping(t[i++]);
    } else if (cmd === 'amplitude') {
      cell.amplitude = Number(stripWrapping(t[i++]));
    } else if (cmd === 'unit') {
      cell.unit = stripWrapping(t[i++]);
    } else if (cmd === 'note') {
      cell.note = stripWrapping(t[i++]);
    } else if (cmd === 'variable') {
      cell.variable = stripWrapping(t[i++]);
    } else {
      unwrapBlock(t[i++]);
    }
  }
  return cell;
}

function parseSeverityValue(block: string): SeverityValue {
  const value: SeverityValue = {
    level: null,
    code: '',
    amplitude: null,
    unit: '',
    note: '',
    variable: '',
    columns: null,
  };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'level') {
      value.level = Number(stripWrapping(t[i++]));
    } else if (cmd === 'code') {
      value.code = stripWrapping(t[i++]);
    } else if (cmd === 'amplitude') {
      value.amplitude = Number(stripWrapping(t[i++]));
    } else if (cmd === 'unit') {
      value.unit = stripWrapping(t[i++]);
    } else if (cmd === 'note') {
      value.note = stripWrapping(t[i++]);
    } else if (cmd === 'variable') {
      value.variable = stripWrapping(t[i++]);
    } else if (cmd === 'columns') {
      const ct = tokenize(unwrapBlock(t[i++]));
      const columns: SeverityValue['columns'] = {
        ac: null,
        dc: null,
        vehicleDc: null,
      };
      let j = 0;
      while (j < ct.length) {
        const col = stripColon(ct[j++]);
        if (j >= ct.length) {
          break;
        }
        const tok = ct[j++];
        const cell = tok.startsWith('{')
          ? parseSeverityCell(unwrapBlock(tok))
          : null;
        if (col === 'ac') {
          columns.ac = cell;
        } else if (col === 'dc') {
          columns.dc = cell;
        } else if (col === 'vehicle_dc') {
          columns.vehicleDc = cell;
        }
      }
      value.columns = columns;
    } else {
      unwrapBlock(t[i++]);
    }
  }
  return value;
}

function parseCounts(block: string): DesignCount[] {
  const out: DesignCount[] = [];
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (cmd !== 'count') {
      if (i < t.length) {
        unwrapBlock(t[i - 1]);
      }
      continue;
    }
    const count: DesignCount = {
      context: stripWrapping(t[i++]),
      minCount: 0,
      clause: '',
      note: '',
      override: null,
    };
    if (i < t.length && t[i].startsWith('{')) {
      const ct = tokenize(unwrapBlock(t[i++]));
      let j = 0;
      while (j < ct.length) {
        const cc = ct[j++];
        if (j >= ct.length) {
          break;
        }
        if (cc === 'min') {
          count.minCount = Number(stripWrapping(ct[j++]));
        } else if (cc === 'clause') {
          count.clause = stripWrapping(ct[j++]);
        } else if (cc === 'note') {
          count.note = stripWrapping(ct[j++]);
        } else if (cc === 'override') {
          const ot = tokenize(unwrapBlock(ct[j++]));
          const override = { condition: '', by: '', note: '' };
          let k = 0;
          while (k < ot.length) {
            const oc = ot[k++];
            if (k >= ot.length) {
              break;
            }
            if (oc === 'condition') {
              override.condition = stripWrapping(ot[k++]);
            } else if (oc === 'by') {
              override.by = stripWrapping(ot[k++]);
            } else if (oc === 'note') {
              override.note = stripWrapping(ot[k++]);
            } else {
              unwrapBlock(ot[k++]);
            }
          }
          count.override = override;
        } else {
          unwrapBlock(ct[j++]);
        }
      }
    }
    out.push(count);
  }
  return out;
}

function parseSeverities(block: string): DesignSeverity[] {
  const out: DesignSeverity[] = [];
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (cmd !== 'severity') {
      if (i < t.length) {
        unwrapBlock(t[i - 1]);
      }
      continue;
    }
    const severity: DesignSeverity = {
      row: stripWrapping(t[i++]),
      envClassValues: {},
      criterion: '',
      footnotes: [],
    };
    if (i < t.length && t[i].startsWith('{')) {
      const st = tokenize(unwrapBlock(t[i++]));
      let j = 0;
      while (j < st.length) {
        const sc = st[j++];
        if (j >= st.length) {
          break;
        }
        if (sc === 'criterion') {
          severity.criterion = stripWrapping(st[j++]);
        } else if (sc === 'footnotes') {
          severity.footnotes = readQuotedList(st[j++]);
        } else if (sc === 'env') {
          const classId = stripWrapping(st[j++]);
          const tok = st[j++] ?? '';
          severity.envClassValues[classId] = tok.startsWith('{')
            ? parseSeverityValue(unwrapBlock(tok))
            : null;
        } else {
          unwrapBlock(st[j++]);
        }
      }
    }
    out.push(severity);
  }
  return out;
}

function parseSchedule(block: string): DesignSchedule {
  const schedule: DesignSchedule = {
    duration: '',
    cadence: '',
    phases: [],
    constraints: [],
  };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'duration') {
      schedule.duration = stripWrapping(t[i++]);
    } else if (cmd === 'cadence') {
      schedule.cadence = stripWrapping(t[i++]);
    } else if (cmd === 'phases') {
      const pt = tokenize(unwrapBlock(t[i++]));
      let j = 0;
      while (j < pt.length) {
        const pc = pt[j++];
        if (pc !== 'phase') {
          if (j < pt.length) {
            unwrapBlock(pt[j - 1]);
          }
          continue;
        }
        const phase: DesignSchedulePhase = {
          id: stripWrapping(pt[j++]),
          condition: '',
          window: '',
        };
        if (j < pt.length && pt[j].startsWith('{')) {
          const ht = tokenize(unwrapBlock(pt[j++]));
          let k = 0;
          while (k < ht.length) {
            const hc = ht[k++];
            if (k >= ht.length) {
              break;
            }
            if (hc === 'condition') {
              phase.condition = stripWrapping(ht[k++]);
            } else if (hc === 'window') {
              phase.window = stripWrapping(ht[k++]);
            } else {
              unwrapBlock(ht[k++]);
            }
          }
        }
        schedule.phases.push(phase);
      }
    } else if (cmd === 'constraints') {
      schedule.constraints = readQuotedList(t[i++]);
    } else {
      unwrapBlock(t[i++]);
    }
  }
  return schedule;
}

function parseSpecimens(block: string): DesignSpecimens {
  const specimens: DesignSpecimens = {
    count: null,
    maxAdditional: null,
    selection: '',
    selectionRef: '',
    continuity: '',
    rules: [],
  };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'count') {
      specimens.count = Number(stripWrapping(t[i++]));
    } else if (cmd === 'max_additional') {
      specimens.maxAdditional = Number(stripWrapping(t[i++]));
    } else if (cmd === 'selection') {
      const tok = t[i++];
      if (tok.startsWith('{')) {
        // selection { ref <rule-id> } — sample-selection rule reference.
        const st = tokenize(unwrapBlock(tok));
        let j = 0;
        while (j < st.length) {
          const sc = st[j++];
          if (j >= st.length) {
            break;
          }
          if (sc === 'ref') {
            specimens.selectionRef = stripWrapping(st[j++]);
          } else {
            unwrapBlock(st[j++]);
          }
        }
      } else {
        specimens.selection = stripWrapping(tok);
      }
    } else if (cmd === 'continuity') {
      specimens.continuity = stripWrapping(t[i++]);
    } else if (cmd === 'rules') {
      specimens.rules = readQuotedList(t[i++]);
    } else {
      unwrapBlock(t[i++]);
    }
  }
  return specimens;
}

/** Parse the content of a `design { … }` block. */
export function parseDesign(block: string): TestDesign {
  const design: TestDesign = {
    counts: [],
    severities: [],
    testPointsRef: '',
    schedule: null,
    specimens: null,
  };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'counts') {
      design.counts = parseCounts(unwrapBlock(t[i++]));
    } else if (cmd === 'severities') {
      design.severities = parseSeverities(unwrapBlock(t[i++]));
    } else if (cmd === 'test_points') {
      const pt = tokenize(unwrapBlock(t[i++]));
      let j = 0;
      while (j < pt.length) {
        const pc = pt[j++];
        if (j >= pt.length) {
          break;
        }
        if (pc === 'ref') {
          design.testPointsRef = stripWrapping(pt[j++]);
        } else {
          unwrapBlock(pt[j++]);
        }
      }
    } else if (cmd === 'schedule') {
      design.schedule = parseSchedule(unwrapBlock(t[i++]));
    } else if (cmd === 'specimens') {
      design.specimens = parseSpecimens(unwrapBlock(t[i++]));
    } else {
      unwrapBlock(t[i++]);
    }
  }
  return design;
}

function dumpCell(cell: SeverityCell): string {
  let out = '';
  if (cell.level !== null) {
    out += 'level ' + cell.level + ' ';
  }
  if (cell.code) {
    out += 'code "' + escapeString(cell.code) + '" ';
  }
  if (cell.amplitude !== null) {
    out += 'amplitude ' + cell.amplitude + ' ';
  }
  if (cell.unit) {
    out += 'unit "' + escapeString(cell.unit) + '" ';
  }
  if (cell.note) {
    out += 'note "' + escapeString(cell.note) + '" ';
  }
  if (cell.variable) {
    out += 'variable ' + cell.variable + ' ';
  }
  return out;
}

function dumpSeverityValue(value: SeverityValue): string {
  let out = dumpCell(value);
  if (value.columns) {
    out += 'columns { ';
    out += value.columns.ac ? 'ac { ' + dumpCell(value.columns.ac) + '} ' : 'ac null ';
    out += value.columns.dc ? 'dc { ' + dumpCell(value.columns.dc) + '} ' : 'dc null ';
    out += value.columns.vehicleDc
      ? 'vehicle_dc { ' + dumpCell(value.columns.vehicleDc) + '} '
      : 'vehicle_dc null ';
    out += '} ';
  }
  return out;
}

/**
 * Dump a test design as a multi-line `design { … }` block (with
 * trailing newline) at the given indent.
 */
export function dumpDesign(design: TestDesign, indent: string): string {
  let out = indent + 'design {\n';
  if (design.counts.length > 0) {
    out += indent + '  counts {\n';
    for (const c of design.counts) {
      let line = indent + '    count ' + c.context + ' { min ' + c.minCount + ' ';
      if (c.clause) {
        line += 'clause "' + escapeString(c.clause) + '" ';
      }
      if (c.note) {
        line += 'note "' + escapeString(c.note) + '" ';
      }
      if (c.override) {
        line += 'override { condition ' + c.override.condition;
        line += ' by ' + c.override.by;
        if (c.override.note) {
          line += ' note "' + escapeString(c.override.note) + '"';
        }
        line += ' } ';
      }
      out += line + '}\n';
    }
    out += indent + '  }\n';
  }
  if (design.severities.length > 0) {
    out += indent + '  severities {\n';
    for (const s of design.severities) {
      let line = indent + '    severity "' + escapeString(s.row) + '" { ';
      if (s.criterion) {
        line += 'criterion ' + s.criterion + ' ';
      }
      if (s.footnotes.length > 0) {
        line += 'footnotes { ' + s.footnotes.join(' ') + ' } ';
      }
      for (const [classId, value] of Object.entries(s.envClassValues)) {
        line +=
          'env ' +
          classId +
          ' ' +
          (value ? '{ ' + dumpSeverityValue(value) + '}' : 'null') +
          ' ';
      }
      out += line + '}\n';
    }
    out += indent + '  }\n';
  }
  if (design.testPointsRef) {
    out += indent + '  test_points { ref ' + design.testPointsRef + ' }\n';
  }
  if (design.schedule) {
    const s = design.schedule;
    let line = indent + '  schedule { ';
    if (s.duration) {
      line += 'duration ' + s.duration + ' ';
    }
    if (s.cadence) {
      line += 'cadence ' + s.cadence + ' ';
    }
    if (s.phases.length > 0) {
      line += 'phases { ';
      for (const p of s.phases) {
        line += 'phase ' + p.id + ' { ';
        if (p.condition) {
          line += 'condition "' + escapeString(p.condition) + '" ';
        }
        if (p.window) {
          line += 'window ' + p.window + ' ';
        }
        line += '} ';
      }
      line += '} ';
    }
    if (s.constraints.length > 0) {
      line +=
        'constraints { ' +
        s.constraints.map(c => '"' + escapeString(c) + '"').join(' ') +
        ' } ';
    }
    out += line + '}\n';
  }
  if (design.specimens) {
    const s = design.specimens;
    let line = indent + '  specimens { ';
    if (s.count !== null) {
      line += 'count ' + s.count + ' ';
    }
    if (s.maxAdditional !== null) {
      line += 'max_additional ' + s.maxAdditional + ' ';
    }
    if (s.selectionRef) {
      line += 'selection { ref ' + s.selectionRef + ' } ';
    } else if (s.selection) {
      line += 'selection "' + escapeString(s.selection) + '" ';
    }
    if (s.continuity) {
      line += 'continuity ' + s.continuity + ' ';
    }
    if (s.rules.length > 0) {
      line += 'rules { ' + s.rules.join(' ') + ' } ';
    }
    out += line + '}\n';
  }
  out += indent + '}\n';
  return out;
}

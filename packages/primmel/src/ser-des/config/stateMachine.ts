import type { Dumper, Parser } from '../types';
import tokenize from '../tokenize';
import {
  escapeString,
  unwrapBlock,
  stripWrapping,
  tokenizePackage,
} from '../tokenize';
import { stripColon } from './field-parser';
import type StateMachine from '../../types/StateMachine';
import type { Transition, Cascade, CascadeSet } from '../../types/StateMachine';

export const parseStateMachine: Parser = function (entityName, data) {
  const result: StateMachine = {
    entityName,
    kind: 'lifecycle',
    initialState: '',
    states: [],
    transitions: [],
    referenceIds: [],
  };

  if (data !== '') {
    const t: Array<string> = tokenizePackage(data);
    let i = 0;
    while (i < t.length) {
      const command: string = t[i++];
      if (i < t.length) {
        if (command === 'kind') {
          // The machine family (TODO.roadmap/07): lifecycle (default,
          // workflow entities) or operational (a subject's HAS state).
          const kind = t[i++];
          if (kind !== 'lifecycle' && kind !== 'operational') {
            throw new Error(
              `Parsing error: state_machine. Entity ${entityName}: Unknown kind ${kind} (valid: lifecycle, operational)`,
            );
          }
          result.kind = kind;
        } else if (command === 'initial') {
          result.initialState = t[i++];
        } else if (command === 'states') {
          const stateBlock = unwrapBlock(t[i++]);
          for (const s of stateBlock.split(/\s+/).filter(s => s.length > 0)) {
            result.states.push({ name: s });
          }
        } else if (command === 'transition') {
          // transition <From> | [<From>, <From>, ...] -> <To> [action <ActionName>] { ... }
          // Multi-source lists (G10) fan out to one Transition per source.
          let fromList: string[] = [];
          const fromTok = t[i++];
          if (fromTok.startsWith('[')) {
            let listText = fromTok;
            while (!listText.includes(']') && i < t.length) {
              listText += ' ' + t[i++];
            }
            fromList = listText
              .replace(/^\[/, '')
              .replace(/\]$/, '')
              .split(/[,\s]+/)
              .filter(x => x.length > 0);
          } else {
            fromList = [fromTok];
          }
          // Expect '->'
          if (i < t.length && (t[i] === '->' || t[i] === '→')) {
            i++;
          }
          const to = i < t.length ? t[i++] : '';
          let actionName = '';
          // Optional 'action <Name>' before block
          if (i < t.length && t[i] === 'action') {
            i++;
            if (i < t.length) {
              actionName = t[i++];
            }
          }
          let guard = '';
          const cascades: Cascade[] = [];
          const referenceIds: string[] = [];
          if (i < t.length && t[i].startsWith('{')) {
            const body = unwrapBlock(t[i++]);
            const bt = tokenizePackage(body);
            let j = 0;
            while (j < bt.length) {
              const cmd = bt[j++];
              if (j < bt.length) {
                if (cmd === 'guard') {
                  guard = unwrapBlock(bt[j++]);
                } else if (cmd === 'cascade') {
                  const target = bt[j++];
                  if (j < bt.length) {
                    const cascadeBlock = unwrapBlock(bt[j++]);
                    cascades.push(parseCascade(target, cascadeBlock));
                  }
                } else if (cmd === 'reference') {
                  referenceIds.push(...tokenizePackage(bt[j++]));
                } else {
                  unwrapBlock(bt[j++]);
                }
              }
            }
          }
          for (const from of fromList) {
            const trans: Transition = {
              from,
              to,
              actionName,
              guard,
              cascades,
              referenceIds,
            };
            result.transitions.push(trans);
          }
        } else if (command === 'reference') {
          result.referenceIds.push(...tokenizePackage(t[i++]));
        } else {
          i++; // forward-compatible: skip unknown keyword value
        }
      } else {
        throw new Error(
          `Parsing error: state_machine. Entity ${entityName}: Expecting value for ${command}`,
        );
      }
    }
  }

  return ctx => {
    ctx.stateMachines[entityName] = result;
    return ctx;
  };
};

function parseCascade(target: string, block: string): Cascade {
  const cascade: Cascade = {
    targetEntity: target,
    where: '',
    set: [],
    create: null,
  };
  const t = tokenizePackage(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i < t.length) {
      if (cmd === 'where') {
        cascade.where = unwrapBlock(t[i++]);
      } else if (cmd === 'set') {
        const setBlock = unwrapBlock(t[i++]);
        const st = tokenize(setBlock);
        let j = 0;
        while (j < st.length) {
          const field = stripColon(st[j++]);
          if (j < st.length) {
            if (st[j] === ':') {
              j++;
            }
            if (j < st.length) {
              const value = stripWrapping(st[j++]);
              const setEntry: CascadeSet = { field, value };
              cascade.set.push(setEntry);
            }
          }
        }
      } else if (cmd === 'create') {
        // create { key: value ... } — cascade that CREATES a record (G10)
        const createBlock = unwrapBlock(t[i++]);
        const ct = tokenize(createBlock);
        const fields: Record<string, string> = {};
        let k = 0;
        while (k < ct.length) {
          const key = stripColon(ct[k++]);
          if (k >= ct.length) {
            break;
          }
          if (ct[k] === ':') {
            k++;
          }
          if (k < ct.length) {
            fields[key] = stripWrapping(ct[k++]);
          }
        }
        cascade.create = fields;
      } else {
        unwrapBlock(t[i++]);
      }
    }
  }
  return cascade;
}

export const dumpStateMachine: Dumper<StateMachine> = function (sm) {
  let out = 'state_machine ' + sm.entityName + ' {\n';
  // The family line is emitted only for operational machines: lifecycle is
  // the v2 default, so omitting it keeps pre-v3 dumps byte-identical.
  if (sm.kind === 'operational') {
    out += '  kind operational\n';
  }
  out += '  initial ' + sm.initialState + '\n';
  if (sm.states.length > 0) {
    out += '  states {\n';
    for (const s of sm.states) {
      out += '    ' + s.name + '\n';
    }
    out += '  }\n';
  }
  // Group consecutive multi-source transitions back into [A, B] -> D form
  // (parse fans them out; dump re-groups when to/action/guard/cascades match).
  const groups: Array<{
    to: string;
    actionName: string;
    guard: string;
    cascades: (typeof sm.transitions)[number]['cascades'];
    referenceIds: string[];
    froms: string[];
  }> = [];
  for (const t of sm.transitions) {
    const key = (x: typeof t) =>
      [
        x.to,
        x.actionName,
        x.guard,
        JSON.stringify(x.cascades),
        JSON.stringify(x.referenceIds),
      ].join('|');
    const last = groups[groups.length - 1];
    if (
      last &&
      key({ ...t, from: '' } as typeof t) ===
        key({ ...last, from: '' } as never)
    ) {
      last.froms.push(t.from);
    } else {
      groups.push({
        to: t.to,
        actionName: t.actionName,
        guard: t.guard,
        cascades: t.cascades,
        referenceIds: t.referenceIds,
        froms: [t.from],
      });
    }
  }
  for (const g of groups) {
    const fromText =
      g.froms.length > 1 ? '[' + g.froms.join(', ') + ']' : g.froms[0];
    out += '  transition ' + fromText + ' -> ' + g.to;
    if (g.actionName) {
      out += ' action ' + g.actionName;
    }
    out += ' {\n';
    if (g.guard) {
      out += '    guard "' + escapeString(g.guard) + '"\n';
    }
    for (const c of g.cascades) {
      out += '    cascade ' + c.targetEntity + ' {\n';
      if (c.where) {
        out += '      where "' + escapeString(c.where) + '"\n';
      }
      if (c.set.length > 0) {
        out += '      set {\n';
        for (const s of c.set) {
          out += '        ' + s.field + ': "' + escapeString(s.value) + '"\n';
        }
        out += '      }\n';
      }
      if (c.create && Object.keys(c.create).length > 0) {
        out += '      create {\n';
        for (const [k, v] of Object.entries(c.create)) {
          out += '        ' + k + ': "' + escapeString(v) + '"\n';
        }
        out += '      }\n';
      }
      out += '    }\n';
    }
    out += '  }\n';
  }
  out += '}\n';
  return out;
};

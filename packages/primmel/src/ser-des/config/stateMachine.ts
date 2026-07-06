import type { Dumper, Parser } from '../types';
import { removePackage, tokenizePackage } from '../tokenize';
import type StateMachine from '../../types/StateMachine';
import type { Transition, Cascade, CascadeSet } from '../../types/StateMachine';

export const parseStateMachine: Parser = function (entityName, data) {
  const result: StateMachine = {
    entityName,
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
        if (command === 'initial') {
          result.initialState = t[i++];
        } else if (command === 'states') {
          const stateBlock = removePackage(t[i++]);
          for (const s of stateBlock.split(/\s+/).filter(s => s.length > 0)) {
            result.states.push({ name: s });
          }
        } else if (command === 'transition') {
          // transition <From> -> <To> [action <ActionName>] { ... }
          const from = t[i++];
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
            const body = removePackage(t[i++]);
            const bt = tokenizePackage(body);
            let j = 0;
            while (j < bt.length) {
              const cmd = bt[j++];
              if (j < bt.length) {
                if (cmd === 'guard') {
                  guard = removePackage(bt[j++]);
                } else if (cmd === 'cascade') {
                  const target = bt[j++];
                  if (j < bt.length) {
                    const cascadeBlock = removePackage(bt[j++]);
                    cascades.push(parseCascade(target, cascadeBlock));
                  }
                } else if (cmd === 'reference') {
                  referenceIds.push(...tokenizePackage(bt[j++]));
                } else {
                  removePackage(bt[j++]);
                }
              }
            }
          }
          const trans: Transition = {
            from,
            to,
            actionName,
            guard,
            cascades,
            referenceIds,
          };
          result.transitions.push(trans);
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
  const cascade: Cascade = { targetEntity: target, where: '', set: [] };
  const t = tokenizePackage(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i < t.length) {
      if (cmd === 'where') {
        cascade.where = removePackage(t[i++]);
      } else if (cmd === 'set') {
        const setBlock = removePackage(t[i++]);
        const st = tokenizePackage(setBlock);
        let j = 0;
        while (j < st.length) {
          const field = st[j++];
          if (j < st.length) {
            if (st[j] === ':') {
              j++;
            }
            if (j < st.length) {
              const value = removePackage(st[j++]);
              const setEntry: CascadeSet = { field, value };
              cascade.set.push(setEntry);
            }
          }
        }
      } else {
        removePackage(t[i++]);
      }
    }
  }
  return cascade;
}

export const dumpStateMachine: Dumper<StateMachine> = function (sm) {
  let out = 'state_machine ' + sm.entityName + ' {\n';
  out += '  initial ' + sm.initialState + '\n';
  if (sm.states.length > 0) {
    out += '  states {\n';
    for (const s of sm.states) {
      out += '    ' + s.name + '\n';
    }
    out += '  }\n';
  }
  for (const t of sm.transitions) {
    out += '  transition ' + t.from + ' -> ' + t.to;
    if (t.actionName) {
      out += ' action ' + t.actionName;
    }
    out += ' {\n';
    if (t.guard) {
      out += '    guard "' + t.guard + '"\n';
    }
    for (const c of t.cascades) {
      out += '    cascade ' + c.targetEntity + ' {\n';
      if (c.where) {
        out += '      where "' + c.where + '"\n';
      }
      if (c.set.length > 0) {
        out += '      set {\n';
        for (const s of c.set) {
          out += '        ' + s.field + ': "' + s.value + '"\n';
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

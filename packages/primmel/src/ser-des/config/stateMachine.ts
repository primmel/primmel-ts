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
import type {
  Transition,
  Cascade,
  CascadeAction,
  CascadeSet,
} from '../../types/StateMachine';
import { CASCADE_ACTIONS } from '../../types/StateMachine';

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
        } else if (command === 'state') {
          // state <name> — the v3.4 bare declaration (spec: state
          // machines; the twin-cert corpus spelling). Coexists with the
          // legacy `states { … }` list; either populates result.states.
          // An attached block is consumed and skipped (no grammar defined
          // for one yet — the parser stays total, as everywhere).
          const name = t[i++];
          result.states.push({ name });
          result.statesDeclared = true;
          if (i < t.length && t[i].startsWith('{')) {
            unwrapBlock(t[i++]);
          }
        } else if (command === 'transition') {
          // transition <From> | [<From>, <From>, ...] -> <To> [action <ActionName>] { ... }
          //   — the legacy arrow form — or the v3.4 named form:
          // transition <name> { from <S> | {<S...>} to <S> [action <n>]
          // [guard "..."] [cascade <T> {...}] ... }  (spec: state
          // machines; the twin-cert corpus spelling). The two are told
          // apart by the SECOND token: a block opens the named form.
          // Multi-source lists (G10, either form) fan out to one
          // Transition per source.
          let fromList: string[] = [];
          const fromTok = t[i++];
          if (i < t.length && t[i].startsWith('{')) {
            const name = fromTok;
            const body = unwrapBlock(t[i++]);
            const bt = tokenizePackage(body);
            let to = '';
            let actionName = '';
            let guard = '';
            const cascades: Cascade[] = [];
            const referenceIds: string[] = [];
            let j = 0;
            while (j < bt.length) {
              const cmd = bt[j++];
              if (j < bt.length) {
                if (cmd === 'from') {
                  const fromValue = bt[j++];
                  if (fromValue.startsWith('{')) {
                    fromList = unwrapBlock(fromValue)
                      .split(/[,\s]+/)
                      .filter(x => x.length > 0);
                  } else {
                    fromList = [fromValue];
                  }
                } else if (cmd === 'to') {
                  to = bt[j++];
                } else if (cmd === 'action') {
                  actionName = bt[j++];
                } else if (cmd === 'guard') {
                  guard = unwrapBlock(bt[j++]);
                } else if (cmd === 'cascade') {
                  const target = bt[j++];
                  if (j < bt.length) {
                    cascades.push(parseCascade(target, unwrapBlock(bt[j++])));
                  }
                } else if (cmd === 'reference') {
                  referenceIds.push(...tokenizePackage(bt[j++]));
                } else {
                  unwrapBlock(bt[j++]);
                }
              }
            }
            for (const from of fromList) {
              result.transitions.push({
                name,
                from,
                to,
                actionName,
                guard,
                cascades,
                referenceIds,
              });
            }
            continue;
          }
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
    action: null,
    targetEntity: target,
    where: '',
    via: '',
    with: {},
    set: [],
    create: null,
  };
  const t = tokenizePackage(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i < t.length) {
      if (cmd === 'action') {
        // action <lock|submit|notify|record> — the semantic side-effect
        // vocabulary (task 52). Closed: an unknown action is a parse
        // error, so a misspelt action can never silently degrade to a
        // no-op cascade.
        const action = t[i++];
        if (!CASCADE_ACTIONS.includes(action as CascadeAction)) {
          throw new Error(
            `Parsing error: state_machine cascade. Unknown action ${action} (valid: ${CASCADE_ACTIONS.join(', ')})`,
          );
        }
        cascade.action = action as CascadeAction;
      } else if (cmd === 'where') {
        cascade.where = unwrapBlock(t[i++]);
      } else if (cmd === 'via') {
        // via <transition-action> — the target machine's transition the
        // status write routes through (smart gap-close E12). A bare
        // action-name token, like the step's `action` spelling; the
        // parser stays total (a missing value leaves ''), and C95 owns
        // the routing contract (resolves / matches the written status /
        // unguarded / forbidden elsewhere).
        cascade.via = t[i++];
      } else if (cmd === 'with') {
        // with { key: value ... } — action-cascade parameters (task 52)
        cascade.with = parseFieldMap(t[i++]);
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
        cascade.create = parseFieldMap(t[i++]);
      } else {
        unwrapBlock(t[i++]);
      }
    }
  }
  // The semantic action form and the mechanical set/create form are
  // mutually exclusive (the YAML schema's oneOf forbids a mixed block).
  // Reject the mix at parse time too: prl-to-yaml emits only the action
  // branch, so accepting a mixed block here would silently drop the
  // set/create half (task-52 review).
  if (cascade.action && (cascade.set.length > 0 || cascade.create !== null)) {
    throw new Error(
      `Parsing error: state_machine cascade. Target ${target} mixes action with set/create — the two forms are mutually exclusive (schema oneOf)`,
    );
  }
  return cascade;
}

/** Parse a `{ key: value ... }` block (quoted values) into a field map. */
function parseFieldMap(block: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const ct = tokenize(unwrapBlock(block));
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
  return fields;
}

/** Emit one cascade block at the given indent (the body lines ride +2). */
function emitCascade(c: Cascade, indent: number): string {
  const pad = ' '.repeat(indent);
  const pad2 = ' '.repeat(indent + 2);
  let out = pad + 'cascade ' + c.targetEntity + ' {\n';
  if (c.action) {
    out += pad2 + 'action ' + c.action + '\n';
  }
  if (c.where) {
    out += pad2 + 'where "' + escapeString(c.where) + '"\n';
  }
  // via sits between the selector (where) and the payload
  // (with/set/create): select the records, route the status write,
  // deliver the payload (smart gap-close E12).
  if (c.via) {
    out += pad2 + 'via ' + c.via + '\n';
  }
  if (c.with && Object.keys(c.with).length > 0) {
    out += pad2 + 'with {\n';
    for (const [k, v] of Object.entries(c.with)) {
      out += ' '.repeat(indent + 4) + k + ': "' + escapeString(v) + '"\n';
    }
    out += pad2 + '}\n';
  }
  if (c.set.length > 0) {
    out += pad2 + 'set {\n';
    for (const st of c.set) {
      out +=
        ' '.repeat(indent + 4) +
        st.field +
        ': "' +
        escapeString(st.value) +
        '"\n';
    }
    out += pad2 + '}\n';
  }
  if (c.create && Object.keys(c.create).length > 0) {
    out += pad2 + 'create {\n';
    for (const [k, v] of Object.entries(c.create)) {
      out += ' '.repeat(indent + 4) + k + ': "' + escapeString(v) + '"\n';
    }
    out += pad2 + '}\n';
  }
  out += pad + '}\n';
  return out;
}

export const dumpStateMachine: Dumper<StateMachine> = function (sm) {
  let out = 'state_machine ' + sm.entityName + ' {\n';
  // The family line is emitted only for operational machines: lifecycle is
  // the v2 default, so omitting it keeps pre-v3 dumps byte-identical.
  if (sm.kind === 'operational') {
    out += '  kind operational\n';
  }
  // The initial line is emitted only when set. The spec marks `initial`
  // required (state-machines §2: "Initial state. Required."), so an
  // empty initial is a model error the checker owns (C109) — the
  // serializer never emits the dangling keyword: an `initial ` line
  // reparses with the NEXT token (`states`) as the value, silently
  // mangling the machine (the editor wave-03 finding).
  if (sm.initialState) {
    out += '  initial ' + sm.initialState + '\n';
  }
  if (sm.states.length > 0) {
    if (sm.statesDeclared) {
      // The v3.4 bare declarations — replay the authored spelling.
      for (const s of sm.states) {
        out += '  state ' + s.name + '\n';
      }
    } else {
      out += '  states {\n';
      for (const s of sm.states) {
        out += '    ' + s.name + '\n';
      }
      out += '  }\n';
    }
  }
  // Group consecutive transitions back into their authored forms (parse
  // fans multi-source lists out; dump re-groups). Named transitions
  // regroup by name, arrow transitions by the shared endpoints/action/
  // guard/cascades key — the two spellings never merge into one another.
  type Group = {
    name?: string;
    to: string;
    actionName: string;
    guard: string;
    cascades: (typeof sm.transitions)[number]['cascades'];
    referenceIds: string[];
    froms: string[];
  };
  const arrowKey = (x: Omit<Transition, 'from'>) =>
    [
      x.to,
      x.actionName,
      x.guard,
      JSON.stringify(x.cascades),
      JSON.stringify(x.referenceIds),
    ].join('|');
  const groups: Group[] = [];
  for (const t of sm.transitions) {
    const last = groups[groups.length - 1];
    if (t.name) {
      if (last && last.name === t.name && arrowKey(last) === arrowKey(t)) {
        last.froms.push(t.from);
      } else {
        groups.push({
          name: t.name,
          to: t.to,
          actionName: t.actionName,
          guard: t.guard,
          cascades: t.cascades,
          referenceIds: t.referenceIds,
          froms: [t.from],
        });
      }
    } else if (last && !last.name && arrowKey(last) === arrowKey(t)) {
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
    const fromsText =
      g.froms.length > 1 ? '[' + g.froms.join(', ') + ']' : g.froms[0];
    if (g.name) {
      // The named form. A bare from/to block stays on one line (the
      // twin-cert corpus spelling); facets reopen the block.
      const bare =
        g.froms.length === 1 &&
        !g.actionName &&
        !g.guard &&
        g.cascades.length === 0 &&
        g.referenceIds.length === 0;
      if (bare) {
        out += '  transition ' + g.name + ' { from ' + fromsText;
        out += ' to ' + g.to + ' }\n';
        continue;
      }
      out += '  transition ' + g.name + ' {\n';
      out += '    from ' + (g.froms.length > 1 ? '{ ' : '') + fromsText;
      out += (g.froms.length > 1 ? ' }' : '') + '\n';
      out += '    to ' + g.to + '\n';
      if (g.actionName) {
        out += '    action ' + g.actionName + '\n';
      }
      if (g.guard) {
        out += '    guard "' + escapeString(g.guard) + '"\n';
      }
      for (const c of g.cascades) {
        out += emitCascade(c, 4);
      }
      out += '  }\n';
      continue;
    }
    out += '  transition ' + fromsText + ' -> ' + g.to;
    if (g.actionName) {
      out += ' action ' + g.actionName;
    }
    out += ' {\n';
    if (g.guard) {
      out += '    guard "' + escapeString(g.guard) + '"\n';
    }
    for (const c of g.cascades) {
      out += emitCascade(c, 4);
    }
    out += '  }\n';
  }
  out += '}\n';
  return out;
};

import type { Dumper, Parser } from '../types';
import { escapeString } from '../tokenize';
import { forEachEntry, unwrapped } from '../parse-block';
import Role from '../../types/Role';

export const parseRole: Parser = (id: string, data: string) => {
  const role: Role = {
    id: id,
    name: '',
  };

  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'name') {
        role.name = unwrapped(value);
      } else {
        return false;
      }
      return true;
    },
    { construct: 'role', id },
  );

  return ctx => {
    ctx.roles[id] = role;
    return ctx;
  };
};

export const dumpRole: Dumper<Role> = function (role) {
  let out: string = 'role ' + role.id + ' {\n';
  out += '  name "' + escapeString(role.name) + '"\n';
  out += '}\n';
  return out;
};

import type { Dumper, Parser } from '../types';
import { removePackage, tokenizePackage } from '../tokenize';
import Role from '../../types/Role';

export const parseRole: Parser = (id: string, data: string) => {
  const role: Role = {
    id: id,
    name: '',
  };
  const t: Array<string> = tokenizePackage(data);
  let i = 0;
  while (i < t.length) {
    const keyword: string = t[i++];
    if (i < t.length) {
      if (keyword === 'name') {
        role.name = removePackage(t[i++]);
      } else {
        i++; // forward-compatible: skip unknown keyword value
      }
    } else {
      throw new Error(
        `Parsing error: role. ID ${id}: Expecting value for ${keyword}`,
      );
    }
  }
  return ctx => {
    ctx.roles[id] = role;
    return ctx;
  };
};

export const dumpRole: Dumper<Role> = function (role) {
  let out: string = 'role ' + role.id + ' {\n';
  out += '  name "' + role.name + '"\n';
  out += '}\n';
  return out;
};

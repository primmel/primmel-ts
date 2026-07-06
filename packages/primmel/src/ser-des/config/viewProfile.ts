import type { Dumper, Parser } from '../types';
import { removePackage, tokenizePackage } from '../tokenize';
import type ViewProfile from '../../types/ViewProfile';

export const parseViewProfile: Parser = function (id, data) {
  const result: ViewProfile = {
    id,
    description: '',
    roles: [],
    visibleElements: [],
  };

  if (data !== '') {
    const t: Array<string> = tokenizePackage(data);
    let i = 0;
    while (i < t.length) {
      const command: string = t[i++];
      if (i < t.length) {
        if (command === 'description') {
          result.description = removePackage(t[i++]);
        } else if (command === 'roles') {
          result.roles = tokenizePackage(t[i++]);
        } else if (command === 'visible') {
          result.visibleElements = tokenizePackage(t[i++]);
        } else {
          i++; // forward-compatible: skip unknown keyword value
        }
      } else {
        throw new Error(
          `Parsing error: view_profile. ID ${id}: Expecting value for ${command}`,
        );
      }
    }
  }

  return ctx => {
    ctx.viewProfiles[id] = result;
    return ctx;
  };
};

export const dumpViewProfile: Dumper<ViewProfile> = function (vp) {
  let out = 'view_profile ' + vp.id + ' {\n';
  if (vp.description) {
    out += '  description "' + vp.description + '"\n';
  }
  if (vp.roles.length > 0) {
    out += '  roles ' + vp.roles.join(' ') + '\n';
  }
  if (vp.visibleElements.length > 0) {
    out += '  visible ' + vp.visibleElements.join(' ') + '\n';
  }
  out += '}\n';
  return out;
};

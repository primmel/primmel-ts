import type { Dumper, Parser } from '../types';
import { tokenizePackage } from '../tokenize';
import { forEachEntry, unwrapped } from '../parse-block';
import type ViewProfile from '../../types/ViewProfile';

export const parseViewProfile: Parser = function (id, data) {
  const result: ViewProfile = {
    id,
    description: '',
    roles: [],
    visibleElements: [],
  };

  forEachEntry(
    data,
    (command, value) => {
      if (command === 'description') {
        result.description = unwrapped(value);
      } else if (command === 'roles') {
        result.roles = tokenizePackage(value());
      } else if (command === 'visible') {
        result.visibleElements = tokenizePackage(value());
      } else {
        return false;
      }
      return true;
    },
    { construct: 'view_profile', id },
  );

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

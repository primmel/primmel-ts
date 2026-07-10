import type { Dumper, Parser } from '../types';
import { forEachEntry, unwrapped } from '../parse-block';
import type MapProfile from '../../types/MapProfile';

export const parseMapProfile: Parser = function (namespace, data) {
  const result: MapProfile = {
    namespace,
    description: '',
    mappings: {},
  };

  forEachEntry(
    data,
    (command, value) => {
      if (command === 'description') {
        result.description = unwrapped(value);
      } else if (command === 'mapping') {
        // mapping block: source → target pairs
        const block = unwrapped(value);
        for (const line of block
          .split(/\n+/)
          .map(s => s.trim())
          .filter(s => s)) {
          const m = line.match(/^(\S+)\s*->\s*(\S+)$/);
          if (m) {
            result.mappings[m[1]] = m[2];
          }
        }
      } else {
        return false;
      }
      return true;
    },
    { construct: 'map_profile', id: namespace },
  );

  return ctx => {
    ctx.mapProfiles[namespace] = result;
    return ctx;
  };
};

export const dumpMapProfile: Dumper<MapProfile> = function (mp) {
  let out = 'map_profile ' + mp.namespace + ' {\n';
  if (mp.description) {
    out += '  description "' + mp.description + '"\n';
  }
  const keys = Object.keys(mp.mappings);
  if (keys.length > 0) {
    out += '  mapping {\n';
    for (const k of keys) {
      out += '    ' + k + ' -> ' + mp.mappings[k] + '\n';
    }
    out += '  }\n';
  }
  out += '}\n';
  return out;
};

import type { Dumper, Parser } from '../types';
import { removePackage, tokenizePackage } from '../tokenize';
import type MapProfile from '../../types/MapProfile';

export const parseMapProfile: Parser = function (namespace, data) {
  const result: MapProfile = {
    namespace,
    description: '',
    mappings: {},
  };

  if (data !== '') {
    const t: Array<string> = tokenizePackage(data);
    let i = 0;
    while (i < t.length) {
      const command: string = t[i++];
      if (i < t.length) {
        if (command === 'description') {
          result.description = removePackage(t[i++]);
        } else if (command === 'mapping') {
          // mapping block: source → target pairs
          const block = removePackage(t[i++]);
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
          i++; // forward-compatible: skip unknown keyword value
        }
      } else {
        throw new Error(
          `Parsing error: map_profile. NS ${namespace}: Expecting value for ${command}`,
        );
      }
    }
  }

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

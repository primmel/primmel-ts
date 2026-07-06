import type { Dumper, Parser } from '../types';
import { removePackage, tokenizePackage } from '../tokenize';
import type Link from '../../types/Link';
import type { LinkKind } from '../../types/Link';

const VALID_LINK_KINDS: LinkKind[] = ['REPO', 'URL'];

export const parseLink: Parser = function (id, data) {
  const result: Link = { id, kind: 'URL', target: '', namespace: '' };

  if (data !== '') {
    const t: Array<string> = tokenizePackage(data);
    let i = 0;
    while (i < t.length) {
      const command: string = t[i++];
      if (i < t.length) {
        if (command === 'type' || command === 'kind') {
          const v = t[i++] as LinkKind;
          if (!VALID_LINK_KINDS.includes(v)) {
            throw new Error(
              `Parsing error: link. ID ${id}: Unknown kind ${v} (valid: ${VALID_LINK_KINDS.join(
                ', ',
              )})`,
            );
          }
          result.kind = v;
        } else if (
          command === 'target' ||
          command === 'path' ||
          command === 'url'
        ) {
          result.target = removePackage(t[i++]);
        } else if (command === 'namespace' || command === 'ns') {
          result.namespace = removePackage(t[i++]);
        } else {
          i++; // forward-compatible: skip unknown keyword value
        }
      } else {
        throw new Error(
          `Parsing error: link. ID ${id}: Expecting value for ${command}`,
        );
      }
    }
  }

  return ctx => {
    ctx.links[id] = result;
    return ctx;
  };
};

export const dumpLink: Dumper<Link> = function (l) {
  let out = 'link ' + l.id + ' {\n';
  out += '  type ' + l.kind + '\n';
  out += '  target "' + l.target + '"\n';
  if (l.namespace) {
    out += '  namespace "' + l.namespace + '"\n';
  }
  out += '}\n';
  return out;
};

import type { Dumper, Parser } from '../types';
import { escapeString, stripWrapping, tokenizePackage } from '../tokenize';
import { forEachEntry, unwrapped } from '../parse-block';
import { dumpBareSafe } from './field-parser';
import type ViewProfile from '../../types/ViewProfile';

// Read a list facet's single value token into entries. The canonical
// spelling is the brace block (`roles { A B }`); the bracket form
// (`roles [A]`) and a bare single entry are accepted on read. A bare
// token must NEVER pass through tokenizePackage — its unconditional
// unwrapBlock strips the token's first and last characters (the VL-1
// quirk: `roles qms-manager` parsed to "ms-manage"). Entries store
// unquoted; the dump re-quotes whitespace-carrying entries.
function parseListFacet(v: string): string[] {
  return v.startsWith('{') || v.startsWith('[')
    ? tokenizePackage(v).map(stripWrapping)
    : [stripWrapping(v)];
}

export const parseViewProfile: Parser = function (id, data) {
  const result: ViewProfile = {
    id,
    description: '',
    roles: [],
    visibleElements: [],
    against: '',
  };

  forEachEntry(
    data,
    (command, value) => {
      if (command === 'description') {
        result.description = unwrapped(value);
      } else if (command === 'roles') {
        result.roles = parseListFacet(value());
      } else if (command === 'visible') {
        result.visibleElements = parseListFacet(value());
      } else if (command === 'against') {
        result.against = value().trim();
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
    out += '  description "' + escapeString(vp.description) + '"\n';
  }
  if (vp.roles.length > 0) {
    // The list facets carry the braces: an unbraced dump emits one token
    // per entry, the pairwise parse walk desyncs, and the trailing facet
    // dies value-less (`Expecting value for qms-ref` — issue #79).
    out += '  roles { ' + vp.roles.map(dumpBareSafe).join(' ') + ' }\n';
  }
  if (vp.visibleElements.length > 0) {
    out +=
      '  visible { ' + vp.visibleElements.map(dumpBareSafe).join(' ') + ' }\n';
  }
  if (vp.against) {
    out += '  against ' + vp.against + '\n';
  }
  out += '}\n';
  return out;
};

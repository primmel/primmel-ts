import type Metadata from '../../types/Metadata';
import type { Dumper, Parser } from '../types';
import { escapeString, removePackage, tokenizePackage } from '../tokenize';

export const parseMetadata: Parser = function (token) {
  const metadata: Metadata = {
    schema: '',
    author: '',
    title: '',
    edition: '',
    namespace: '',
    shortname: '',
  };

  if (token !== '') {
    const t: string[] = tokenizePackage(token);
    let i = 0;

    while (i < t.length) {
      const keyword: string = t[i++];
      if (i < t.length) {
        if (keyword === 'title') {
          metadata.title = removePackage(t[i++]);
        } else if (keyword === 'schema') {
          metadata.schema = removePackage(t[i++]);
        } else if (keyword === 'edition') {
          metadata.edition = removePackage(t[i++]);
        } else if (keyword === 'author') {
          metadata.author = removePackage(t[i++]);
        } else if (keyword === 'namespace') {
          metadata.namespace = removePackage(t[i++]);
        } else if (keyword === 'shortname') {
          metadata.shortname = removePackage(t[i++]);
        } else {
          throw new Error(
            'Parsing error: metadata. Unknown keyword ' + keyword,
          );
        }
      } else {
        throw new Error(
          'Parsing error: metadata. Expecting value for ' + keyword,
        );
      }
    }
  }

  return ctx => {
    ctx.metadata = metadata;
    return ctx;
  };
};

export const dumpMetadata: Dumper<Metadata> = function (meta) {
  let out = 'metadata {\n';
  out += '  title "' + escapeString(meta.title) + '"\n';
  out += '  schema "' + escapeString(meta.schema) + '"\n';
  out += '  edition "' + escapeString(meta.edition) + '"\n';
  out += '  author "' + escapeString(meta.author) + '"\n';
  out += '  namespace "' + escapeString(meta.namespace) + '"\n';
  out += '}\n';
  return out;
};

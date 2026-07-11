import type { Dumper, Parser } from '../types';
import { escapeString, unwrapBlock, tokenizePackage } from '../tokenize';
import type Figure from '../../types/Figure';

export const parseFigure: Parser = function (id, data) {
  const result: Figure = { id, title: '', src: '' };

  if (data !== '') {
    const t: Array<string> = tokenizePackage(data);
    let i = 0;
    while (i < t.length) {
      const command: string = t[i++];
      if (i < t.length) {
        if (command === 'title') {
          result.title = unwrapBlock(t[i++]);
        } else if (command === 'src') {
          result.src = unwrapBlock(t[i++]);
        } else {
          i++; // forward-compatible: skip unknown keyword value
        }
      } else {
        throw new Error(
          `Parsing error: figure. ID ${id}: Expecting value for ${command}`,
        );
      }
    }
  }

  return ctx => {
    ctx.figures[id] = result;
    return ctx;
  };
};

export const dumpFigure: Dumper<Figure> = function (f) {
  let out = 'figure ' + f.id + ' {\n';
  out += '  title "' + escapeString(f.title) + '"\n';
  out += '  src "' + escapeString(f.src) + '"\n';
  out += '}\n';
  return out;
};

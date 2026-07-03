import type { Dumper, Parser } from '../types';
import { removePackage, tokenizePackage } from '../tokenize';
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
          result.title = removePackage(t[i++]);
        } else if (command === 'src') {
          result.src = removePackage(t[i++]);
        } else {
          throw new Error(`Parsing error: figure. ID ${id}: Unknown keyword ${command}`);
        }
      } else {
        throw new Error(`Parsing error: figure. ID ${id}: Expecting value for ${command}`);
      }
    }
  }

  return ctx => ({ ...ctx, figures: { ...ctx.figures, [id]: result } });
};

export const dumpFigure: Dumper<Figure> = function (f) {
  let out = 'figure ' + f.id + ' {\n';
  out += '  title "' + f.title + '"\n';
  out += '  src "' + f.src + '"\n';
  out += '}\n';
  return out;
};

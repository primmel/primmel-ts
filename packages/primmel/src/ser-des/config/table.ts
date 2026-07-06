import type { Dumper, Parser } from '../types';
import { removePackage, tokenizePackage } from '../tokenize';
import type Table from '../../types/Table';

export const parseTable: Parser = function (id, data) {
  const result: Table = {
    id,
    title: '',
    columns: '',
    display: '',
    data: [],
    domain: null,
  };

  if (data !== '') {
    const t: Array<string> = tokenizePackage(data);
    let i = 0;
    while (i < t.length) {
      const command: string = t[i++];
      if (i < t.length) {
        if (command === 'title') {
          result.title = removePackage(t[i++]);
        } else if (command === 'columns') {
          result.columns = removePackage(t[i++]);
        } else if (command === 'display') {
          result.display = removePackage(t[i++]);
        } else if (command === 'domain') {
          // Domain block is captured as raw package string
          result.domain = removePackage(t[i++]) as unknown as Record<
            string,
            unknown
          >;
        } else if (command === 'data') {
          // Data block contains CSV-like rows
          const dataBlock = removePackage(t[i++]);
          result.data = parseTableData(dataBlock);
        } else {
          i++; // forward-compatible: skip unknown keyword value
        }
      } else {
        throw new Error(
          `Parsing error: table. ID ${id}: Expecting value for ${command}`,
        );
      }
    }
  }

  return ctx => {
    ctx.tables[id] = result;
    return ctx;
  };
};

function parseTableData(block: string): string[][] {
  // Simple line-by-line, whitespace-separated. Strip leading/trailing quotes per cell.
  const rows = block
    .split(/\n+/)
    .map(r => r.trim())
    .filter(r => r.length > 0);
  return rows.map(row => {
    // Match quoted cells first, then whitespace-separated tokens
    const cells: string[] = [];
    const re = /"([^"]*)"|(\S+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(row)) !== null) {
      cells.push(m[1] ?? m[2] ?? '');
    }
    return cells;
  });
}

export const dumpTable: Dumper<Table> = function (t) {
  let out = 'table ' + t.id + ' {\n';
  out += '  title "' + t.title + '"\n';
  out += '  columns "' + t.columns + '"\n';
  if (t.display) {
    out += '  display "' + t.display + '"\n';
  }
  if (t.domain) {
    out += '  domain { }\n';
  }
  if (t.data.length > 0) {
    out += '  data {\n';
    for (const row of t.data) {
      const cells = row.map(c => `"${c}"`).join(' ');
      out += '    ' + cells + '\n';
    }
    out += '  }\n';
  }
  out += '}\n';
  return out;
};

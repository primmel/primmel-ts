export default function tokenize(x: string): string[] {
  const set: string[] = [];
  let t = '';
  let i = 0;
  while (i < x.length) {
    let char: string = x.charAt(i);

    // ── Comment handling: skip // and # to end of line ──
    if (
      char === '#' ||
      (char === '/' && i + 1 < x.length && x.charAt(i + 1) === '/')
    ) {
      while (i < x.length && x.charAt(i) !== '\n') {
        i++;
      }
      continue;
    }

    if (!isWhiteSpace(char)) {
      t += char;
      i++;
      if (char === '"') {
        // Scan string token, honouring backslash escapes so that
        // embedded quotes (\"..") don't terminate the string early.
        while (i < x.length) {
          char = x.charAt(i);
          if (char === '\\' && i + 1 < x.length) {
            t += char + x.charAt(i + 1);
            i += 2;
            continue;
          }
          t += char;
          i++;
          if (char === '"') {
            break;
          }
        }
      } else if (char === '{') {
        let count = 1;
        while (i < x.length && count > 0) {
          char = x.charAt(i);
          // Skip string content: don't count braces inside quoted strings
          if (char === '"') {
            t += char;
            i++;
            while (i < x.length) {
              const c = x.charAt(i);
              if (c === '\\' && i + 1 < x.length) {
                t += c + x.charAt(i + 1);
                i += 2;
                continue;
              }
              t += c;
              i++;
              if (c === '"') {
                break;
              }
            }
            continue;
          }
          if (char === '{') {
            count++;
          }
          if (char === '}') {
            count--;
          }
          t += char;
          i++;
        }
      } else {
        while (i < x.length && !isWhiteSpace(x.charAt(i))) {
          t += x.charAt(i);
          i++;
        }
      }
      set.push(t);
      t = '';
    } else {
      i++;
    }
  }
  return set;
}

export function tokenizePackage(x: string): Array<string> {
  return tokenize(removePackage(x));
}

export function removePackage(x: string): string {
  if (x.length >= 2) {
    return x.substr(1, x.length - 2);
  } else {
    return x;
  }
}

export function tokenizeAttributes(x: string): Array<string> {
  x = removePackage(x);
  const set: Array<string> = [];
  let t = '';
  let i = 0;
  while (i < x.length) {
    let char: string = x.charAt(i);
    if (!isWhiteSpace(char)) {
      t += char;
      i++;
      if (char === '{') {
        let count = 1;
        while (i < x.length && count > 0) {
          char = x.charAt(i);
          // String-awareness: don't count braces inside quoted strings.
          if (char === '"') {
            t += char;
            i++;
            while (i < x.length) {
              const c = x.charAt(i);
              if (c === '\\' && i + 1 < x.length) {
                t += c + x.charAt(i + 1);
                i += 2;
                continue;
              }
              t += c;
              i++;
              if (c === '"') {
                break;
              }
            }
            continue;
          }
          if (char === '{') {
            count++;
          }
          if (char === '}') {
            count--;
          }
          t += char;
          i++;
        }
        i++;
      } else {
        while (i < x.length && x.charAt(i) !== '{') {
          t += x.charAt(i);
          i++;
        }
      }
      set.push(t);
      t = '';
    } else {
      i++;
    }
  }
  return set;
}

function isWhiteSpace(x: string): boolean {
  return /\s/.test(x);
}

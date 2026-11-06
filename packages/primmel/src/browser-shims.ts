// The browser-bundle shims (the vite.browser build's node:path /
// node:fs aliases). The bundle's import graph carries modules whose
// module SCOPE touches node:path (the locators plane's registry-file
// key, ser-des/includes' include regexes) — vite's default browser
// stub for node builtins is a no-op exports object, so those scope
// evaluations crashed the whole bundle at import. The path half is a
// real (POSIX-only) implementation: the browser never resolves real
// filesystem paths, but the module scopes must EVALUATE. The fs half
// throws at CALL time with a clear message — the filesystem plane is
// node-only by design; a browser caller gets an honest error, never
// an import crash.

const isAbsolute = (p: string): boolean => p.startsWith('/');

const basename = (p: string): string => {
  const parts = p.split('/');
  return parts[parts.length - 1] ?? p;
};

const dirname = (p: string): string => {
  const idx = p.lastIndexOf('/');
  if (idx <= 0) {
    return idx === 0 ? '/' : '.';
  }
  return p.slice(0, idx);
};

const join = (...parts: string[]): string => {
  const joined: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') {
      continue;
    }
    if (isAbsolute(part)) {
      joined.length = 0;
    }
    for (const seg of part.split('/')) {
      if (seg === '' || seg === '.') {
        continue;
      }
      if (seg === '..') {
        joined.pop();
        continue;
      }
      joined.push(seg);
    }
  }
  return '/' + joined.join('/');
};

const normalize = (p: string): string => join('/', p);

const relative = (from: string, to: string): string => {
  const a = normalize(from).split('/').filter(Boolean);
  const b = normalize(to).split('/').filter(Boolean);
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) {
    i++;
  }
  return join('/', ...Array(a.length - i).fill('..'), ...b.slice(i)).slice(1);
};

const resolve = (...parts: string[]): string => join('/', ...parts);

const sep = '/';

const fsUnavailable = (fn: string): Error =>
  new Error(
    `fs.${fn} is not available in the browser bundle — the filesystem plane is node-only (primmel/primmel-ts)`,
  );

// The union of the names the bundle's import graph reads from
// node:path and node:fs — both aliases point here, so the module
// exports them flat.
export {
  basename,
  dirname,
  isAbsolute,
  join,
  normalize,
  relative,
  resolve,
  sep,
};

export const existsSync = (): boolean => {
  throw fsUnavailable('existsSync');
};

export const readFileSync = (): string => {
  throw fsUnavailable('readFileSync');
};

export const readdirSync = (): string[] => {
  throw fsUnavailable('readdirSync');
};

export const statSync = (): object => {
  throw fsUnavailable('statSync');
};

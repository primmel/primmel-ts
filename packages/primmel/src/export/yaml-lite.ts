// ─────────────────────────────────────────────────────────────────────
// The YAML-subset block reader (primmel/primmel-ts#84): the raw blocks
// the kernel keeps verbatim — a requirement's `acceptance_criteria`
// block above all — are YAML, migrated into the `.prl` source 1:1 and
// re-parsed consumer-side ever since. This reader is the upstream half
// of that retirement: the block mappings, block sequences, and flow
// scalars the migrated packages actually use, nothing more (no anchors,
// no flow collections, no multi-line plain scalars, no comments — a
// block carrying any of those walks off the subset and the caller keeps
// the raw string). The fidelity target is `yaml.safe_load` on the real
// corpus blocks, pinned by test.
// ─────────────────────────────────────────────────────────────────────

/** One physical line, its indentation remembered. */
interface Line {
  indent: number;
  text: string;
}

const NUMERIC = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;

/**
 * The plain-scalar resolutions the subset makes: null, the booleans,
 * the decimal numbers; every other token stays a string (quoted forms
 * unquote first). Deliberately narrower than YAML 1.1 (no dates, no
 * sexagesimals, no yes/no booleans) — none appear in the migrated
 * blocks, and a string where PyYAML sees a date round-trips honestly
 * where the reverse would not.
 */
function parseScalar(raw: string): unknown {
  const s = raw.trim();
  if (s === '' || s === '~' || s === 'null' || s === 'Null' || s === 'NULL') {
    return null;
  }
  if (s === 'true' || s === 'True' || s === 'TRUE') {
    return true;
  }
  if (s === 'false' || s === 'False' || s === 'FALSE') {
    return false;
  }
  if (NUMERIC.test(s)) {
    return Number(s);
  }
  if (s[0] === '"' || s[0] === "'") {
    return unquote(s, s[0]);
  }
  return s;
}

/** A quoted scalar: double-quoted escapes, single-quoted doubling. */
function unquote(s: string, q: '"' | "'"): string {
  if (s.length < 2 || s[s.length - 1] !== q) {
    return s;
  }
  const body = s.slice(1, -1);
  if (q === "'") {
    return body.replace(/''/g, "'");
  }
  let out = '';
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c !== '\\' || i === body.length - 1) {
      out += c;
      continue;
    }
    const e = body[++i];
    if (e === 'n') {
      out += '\n';
    } else if (e === 't') {
      out += '\t';
    } else if (e === 'r') {
      out += '\r';
    } else if (e === '0') {
      out += '\0';
    } else if (e === '\\' || e === '"') {
      out += e;
    } else {
      out += '\\' + e;
    }
  }
  return out;
}

/** The `key:` head of a mapping line — null when the line has none. */
function splitKey(text: string): [string, string] | null {
  const colon = text.indexOf(':');
  if (colon <= 0) {
    return null;
  }
  const key = text.slice(0, colon);
  if (/[\s"']/.test(key)) {
    return null;
  }
  return [key, text.slice(colon + 1)];
}

/**
 * Parse the block-mapping/sequence subset at `indent`; returns the
 * index the walk stopped at. `lines` mutates in one place: a
 * `- key: …` sequence item rewrites itself to its content at the
 * item's inner indent, so the walk below sees a normal line.
 */
function parseValue(
  lines: Line[],
  i: number,
  indent: number,
): [number, unknown] {
  if (i >= lines.length) {
    return [i, null];
  }
  const t = lines[i].text;
  if (t === '-' || t.startsWith('- ')) {
    return parseSequence(lines, i, indent);
  }
  return parseMapping(lines, i, indent);
}

function parseSequence(
  lines: Line[],
  i: number,
  indent: number,
): [number, unknown[]] {
  const out: unknown[] = [];
  while (
    i < lines.length &&
    lines[i].indent === indent &&
    (lines[i].text === '-' || lines[i].text.startsWith('- '))
  ) {
    const content = lines[i].text === '-' ? '' : lines[i].text.slice(2).trim();
    if (content === '') {
      i++;
      const next = i < lines.length ? lines[i].indent : -1;
      if (next > indent) {
        const [end, value] = parseValue(lines, i, next);
        out.push(value);
        i = end;
      } else {
        out.push(null);
      }
      continue;
    }
    const nested = content === '-' || content.startsWith('- ');
    if (nested || splitKey(content) !== null) {
      // The item head becomes a normal line at the inner indent (the
      // `- ` marker's width); the walk consumes the item's body.
      lines[i] = { indent: indent + 2, text: content };
      const [end, value] = nested
        ? parseSequence(lines, i, indent + 2)
        : parseMapping(lines, i, indent + 2);
      out.push(value);
      i = end;
    } else {
      out.push(parseScalar(content));
      i++;
    }
  }
  return [i, out];
}

function parseMapping(
  lines: Line[],
  i: number,
  indent: number,
): [number, Record<string, unknown>] {
  const map: Record<string, unknown> = {};
  while (i < lines.length) {
    const line = lines[i];
    if (
      line.indent !== indent ||
      line.text === '-' ||
      line.text.startsWith('- ')
    ) {
      break;
    }
    const kv = splitKey(line.text);
    if (!kv) {
      break;
    }
    const [key, rest] = kv;
    i++;
    if (rest.trim() === '') {
      const next = i < lines.length ? lines[i].indent : -1;
      if (next > indent) {
        const [end, value] = parseValue(lines, i, next);
        map[key] = value;
        i = end;
      } else {
        map[key] = null;
      }
    } else {
      map[key] = parseScalar(rest);
    }
  }
  return [i, map];
}

/**
 * Parse one raw authored block (the requirement's `acceptance_criteria`
 * above all) into the JSON value `yaml.safe_load` would produce — or
 * `undefined` when the text is not a mapping of the subset (free text,
 * a keyword-form block), signalling the caller to keep the raw string.
 *
 * The kernel keeps the block `trim()`-ed, which dedents the FIRST line
 * to column 0 while its siblings keep the file indentation. The walk
 * therefore tries the plausible base indents — the head line's own and
 * its siblings' — and takes the first that consumes the whole block.
 */
export function parseYamlBlock(
  text: string,
): Record<string, unknown> | undefined {
  const scanned: Line[] = [];
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') {
      continue;
    }
    scanned.push({
      indent: raw.length - raw.trimStart().length,
      text: raw.trim(),
    });
  }
  if (scanned.length === 0 || splitKey(scanned[0].text) === null) {
    return undefined;
  }
  const bases = new Set<number>([
    scanned[0].indent,
    scanned[1]?.indent ?? scanned[0].indent,
  ]);
  for (const base of bases) {
    // The candidate base may sit BELOW the dedented head line's column
    // — the head rides virtually at the base for that walk.
    const lines = scanned.map(l =>
      l === scanned[0] && l.indent < base ? { indent: base, text: l.text } : l,
    );
    const [end, map] = parseMapping(lines, 0, base);
    if (end === lines.length && Object.keys(map).length > 0) {
      return map;
    }
  }
  return undefined;
}

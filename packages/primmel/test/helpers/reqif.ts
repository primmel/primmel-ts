// ─────────────────────────────────────────────────────────────────────
// Shared helpers for the ReqIF export tests: a minimal XML parser for
// parse-back assertions (the repo has no XML dependency and must not
// gain one for a test), query helpers over the parsed tree, and the
// tiny fixture package the modality / hierarchy / relation / golden
// specs run against.
//
// The parser handles exactly what the exporter emits: the prolog, XML
// comments, elements, attributes, text, self-closing tags, and the five
// predefined entities. It is NOT a general-purpose XML parser.
// ─────────────────────────────────────────────────────────────────────

import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface XmlElement {
  tag: string;
  attrs: Record<string, string>;
  children: (XmlElement | string)[];
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

/** Parses one XML document into an element tree; throws on malformed input. */
export function parseXml(xml: string): XmlElement {
  let i = 0;
  const err = (m: string): never => {
    throw new Error(`XML parse error at offset ${i}: ${m}`);
  };
  const unescape = (s: string): string =>
    s.replace(/&(amp|lt|gt|quot|apos);/g, (_, e: string) => ENTITIES[e]);
  const skipMisc = (): void => {
    for (;;) {
      if (xml.startsWith('<!--', i)) {
        const end = xml.indexOf('-->', i + 4);
        if (end < 0) {
          err('unterminated comment');
        }
        i = end + 3;
      } else if (xml.startsWith('<?', i)) {
        const end = xml.indexOf('?>', i + 2);
        if (end < 0) {
          err('unterminated processing instruction');
        }
        i = end + 2;
      } else if (i < xml.length && /\s/.test(xml[i])) {
        i++;
      } else {
        return;
      }
    }
  };
  const parseElement = (): XmlElement => {
    if (xml[i] !== '<' || xml.startsWith('</', i)) {
      err('expected an opening tag');
    }
    i++;
    const nameMatch = /^[A-Za-z_][\w:.-]*/.exec(xml.slice(i));
    if (!nameMatch) {
      err('bad tag name');
    }
    const tag = nameMatch![0];
    i += tag.length;
    const attrs: Record<string, string> = {};
    for (;;) {
      while (i < xml.length && /\s/.test(xml[i])) {
        i++;
      }
      if (xml.startsWith('/>', i)) {
        i += 2;
        return { tag, attrs, children: [] };
      }
      if (xml[i] === '>') {
        i++;
        break;
      }
      const am = /^([\w:.-]+)="((?:[^"&]|&\w+;)*)"/.exec(xml.slice(i));
      if (!am) {
        err('bad attribute');
      }
      if (am![1] in attrs) {
        err(`duplicate attribute ${am![1]}`);
      }
      attrs[am![1]] = unescape(am![2]);
      i += am![0].length;
    }
    const children: (XmlElement | string)[] = [];
    let text = '';
    const flushText = (): void => {
      if (text.trim() !== '') {
        children.push(unescape(text.trim()));
      }
      text = '';
    };
    for (;;) {
      if (i >= xml.length) {
        err('unexpected end of input');
      }
      if (xml.startsWith('</', i)) {
        const end = xml.indexOf('>', i + 2);
        if (end < 0) {
          err('unterminated close tag');
        }
        const closeTag = xml.slice(i + 2, end).trim();
        if (closeTag !== tag) {
          err(`mismatched close tag </${closeTag}> for <${tag}>`);
        }
        i = end + 1;
        flushText();
        return { tag, attrs, children };
      }
      if (xml.startsWith('<!--', i)) {
        const end = xml.indexOf('-->', i + 4);
        if (end < 0) {
          err('unterminated comment');
        }
        i = end + 3;
        continue;
      }
      if (xml[i] === '<') {
        flushText();
        children.push(parseElement());
        continue;
      }
      text += xml[i];
      i++;
    }
  };
  skipMisc();
  const root = parseElement();
  skipMisc();
  if (i < xml.length) {
    err('trailing content after the root element');
  }
  return root;
}

/** All descendant elements (including `el` itself) with the given tag. */
export function findAll(el: XmlElement, tag: string): XmlElement[] {
  const out: XmlElement[] = [];
  const walk = (e: XmlElement): void => {
    if (e.tag === tag) {
      out.push(e);
    }
    for (const c of e.children) {
      if (typeof c !== 'string') {
        walk(c);
      }
    }
  };
  walk(el);
  return out;
}

/** The first direct child element with the given tag, or null. */
export function child(el: XmlElement, tag: string): XmlElement | null {
  for (const c of el.children) {
    if (typeof c !== 'string' && c.tag === tag) {
      return c;
    }
  }
  return null;
}

/** Concatenated text content of an element (recursively). */
export function textOf(el: XmlElement): string {
  return el.children.map(c => (typeof c === 'string' ? c : textOf(c))).join('');
}

/**
 * One SPEC-OBJECT's values as a map from attribute-definition ref to
 * value: THE-VALUE for strings, the enum-value ref for enumerations,
 * the inner text for XHTML.
 */
export function specObjectValues(obj: XmlElement): Map<string, string> {
  const out = new Map<string, string>();
  const values = child(obj, 'VALUES');
  if (!values) {
    return out;
  }
  for (const c of values.children) {
    if (typeof c === 'string') {
      continue;
    }
    const def = child(c, 'DEFINITION');
    const refEl = def?.children.find(
      (x): x is XmlElement => typeof x !== 'string',
    );
    const ref = refEl ? textOf(refEl) : '';
    if (c.tag === 'ATTRIBUTE-VALUE-STRING') {
      out.set(ref, c.attrs['THE-VALUE']);
    } else if (c.tag === 'ATTRIBUTE-VALUE-ENUMERATION') {
      out.set(ref, findAll(c, 'ENUM-VALUE-REF').map(textOf).join(','));
    } else if (c.tag === 'ATTRIBUTE-VALUE-XHTML') {
      const tv = child(c, 'THE-VALUE');
      out.set(ref, tv ? textOf(tv) : '');
    }
  }
  return out;
}

/** Indexes a document's SPEC-OBJECTs by their IDENTIFIER. */
export function specObjectsById(root: XmlElement): Map<string, XmlElement> {
  const out = new Map<string, XmlElement>();
  for (const o of findAll(root, 'SPEC-OBJECT')) {
    out.set(o.attrs['IDENTIFIER'], o);
  }
  return out;
}

export interface HierarchyTree {
  ref: string;
  children: HierarchyTree[];
}

/** The SPECIFICATION's hierarchy as a tree of spec-object IDENTIFIERs. */
export function hierarchyTree(root: XmlElement): HierarchyTree[] {
  const spec = findAll(root, 'SPECIFICATION')[0];
  const node = (h: XmlElement): HierarchyTree => {
    const obj = child(h, 'OBJECT');
    const refEl = obj ? child(obj, 'SPEC-OBJECT-REF') : null;
    const ch = child(h, 'CHILDREN');
    return {
      ref: refEl ? textOf(refEl) : '',
      children: (ch?.children ?? [])
        .filter((x): x is XmlElement => typeof x !== 'string')
        .map(node),
    };
  };
  const top = spec ? child(spec, 'CHILDREN') : null;
  return (top?.children ?? [])
    .filter((x): x is XmlElement => typeof x !== 'string')
    .map(node);
}

/** The fixed timestamp the deterministic specs (golden) export with. */
export const FIXTURE_NOW = '2026-07-26T00:00:00.000Z';

/**
 * The counterexample package (review task-27b): a title containing
 * `--` (XML-comment injection probe), a requirement with an unknown
 * obligation spelling and a binds_to entry naming an unexported
 * `/`-addressed id alongside a subject-chain path.
 */
export function buildCounterexamplePackage(): string {
  const parent = mkdtempSync(join(tmpdir(), 'primmel-reqif-counter-'));
  const dir = join(parent, 'pkg');
  mkdirSync(dir);
  writeFileSync(
    join(dir, 'package.primmel'),
    `package {
  id dashy-pkg
  kind rec
  title "R 99 -- the dashy package"
  version "1"
  editions { 1 }
  baseUrn "urn:test:dashy:1"
  description "d"
}`,
  );
  mkdirSync(join(dir, 'specification'));
  writeFileSync(
    join(dir, 'specification', 'reqs.prl'),
    `requirement /req/one {
  name "One"
  statement "The widget shall bind."
  binds_to { /req/not-exported sample.x }
  obligation SHALL
}

requirement /req/two {
  name "Two"
  statement "The widget may rest."
  obligation may
}`,
  );
  return dir;
}

/**
 * The tiny fixture package: two classes (one depending on the other),
 * four requirements (shall default / should / may / an orphan outside
 * any class; escaping-problem characters in the alpha statement;
 * a binding and a dependency naming another requirement; a dependency
 * on an id nothing exports), and one targeting conformance test.
 */
export function buildFixturePackage(): string {
  const parent = mkdtempSync(join(tmpdir(), 'primmel-reqif-'));
  const dir = join(parent, 'pkg');
  mkdirSync(dir);
  writeFileSync(
    join(dir, 'package.primmel'),
    `package {
  id test-pkg
  kind rec
  title "Test package"
  version "1"
  editions { 1 }
  baseUrn "urn:test:pkg:1"
  description "A tiny export fixture."
}`,
  );
  mkdirSync(join(dir, 'specification'));
  writeFileSync(
    join(dir, 'specification', 'requirements.prl'),
    `requirement_class /req/scope {
  name "Scope requirements"
  title "Scope requirements"
  dependencies { /req/other }
}

requirement_class /req/other {
  name "Other requirements"
}

requirement /req/scope/alpha {
  name "Alpha"
  statement "The widget shall frobnicate & pass <all> \\"checks\\"."
  guidance "Frobnicate gently."
  binds_to { family.parameters.x /req/scope/beta }
  limit {
    expression "ocl{family.parameters.x > 0}"
    uses { family.parameters.x }
  }
  dependencies { /req/scope/beta /req/missing }
  verification { method examination description "By inspection." }
  source { doc "urn:test:r:1:2021" clause "5.2" }
  source { doc "urn:test:r:1:2021" clause "5.2.1" }
}

requirement /req/scope/beta {
  name "Beta"
  statement "The widget should glow."
  obligation should
  source { doc "urn:test:r:1:2021" clause "5.3" }
}

requirement /req/scope/gamma {
  name "Gamma"
  statement "The widget may hum."
  obligation may
}

requirement /req/orphan {
  name "Orphan"
  statement "The widget shall stand alone."
}`,
  );
  writeFileSync(
    join(dir, 'specification', 'conformance.prl'),
    `conformance_test /conf/scope-tests/alpha-check {
  name "Alpha check"
  purpose "Verify the widget frobnicates."
  targets { /req/scope/alpha }
}`,
  );
  return dir;
}

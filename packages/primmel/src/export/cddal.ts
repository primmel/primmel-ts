// ─────────────────────────────────────────────────────────────────────
// CDDAL export (TODO.reconfigure/04, "CDDAL interop"): the dictionary
// subset of a Primmel package projected into the CDD Authoring Language
// (opencdd/cddal-spec) for interop with the OpenCDD toolchain.
//
// The projection is POWER-TYPED, because CDD has no separate
// instance-entity: an individual is a subclass-of-one. The mapping:
//
//   class C { a, b }              →  instance C < MDC_C002 {
//                                       code: C
//                                       superclass: UNIVERSE   // or `extends`
//                                       applicable_properties: { a, b }
//                                     }
//   instance s of C { a: 2.2 t }  →  instance s < MDC_C002 {
//                                       code: s
//                                       superclass: C          // the `of`
//                                       a: "2.2 t"
//                                     }
//
// Every Primmel identifier survives verbatim (the class id, the
// instance id, the field ids); every exhibited value rides as a
// property assignment; the instance's `of` rides as the CDD
// superclass — the round-trip stability requirement (cddal-spec
// clause 11; kernel rule R5) holds with no exceptions on this subset.
//
// The projection also carries the definition layer's shape: every
// class field with a declared attribute definition projects as an
// MDC_C003 property entity (its code is the declared IRDI — the `irdi`
// facet or the `corresponds iec-cdd` concept — or the Primmel field
// id; its declaration name is the field's safe symbol, which
// applicable_properties references, the spec's own symbolic-reference
// pattern), and every enum projects as an MDC_C005 value list with one
// MDC_C010 value term per value.
//
// Primmel package includes are INLINED before the projection runs (the
// loader composes first), so a composed dictionary projects as one
// document — the same inclusion semantics CDDAL's import achieves
// textually; per-file CDDAL documents are a consumer choice, not a
// projection requirement. Language-tagged definition alternates ride
// the package's l10n files (text blocks whose trailing address
// segment names the element's field — the C89 tail rule in
// miniature): `definition.fra-Latn: "…"` beside the default `en`.
//
// ONE-WAY lossy projection like every interop projection: the CDDAL
// text is generated, never authored, never re-imported as truth.
// ─────────────────────────────────────────────────────────────────────

import { loadPackage } from '../ser-des/package';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import type Standard from '../types/Standard';
import type { QuantityValue } from '../types/Quantity';

export const CDDAL_PROJECTION_VERSION = 'primmel-cddal/1';

export interface CddalExportStats {
  /** Classes projected as class entities (instances of MDC_C002). */
  classes: number;
  /** Instances projected as subclass-of-one class entities. */
  instances: number;
  /** Property assignments emitted (exhibited values). */
  assignments: number;
  /** Class fields projected as MDC_C003 property entities. */
  properties: number;
  /** Enums projected as MDC_C005 value lists (with their value terms). */
  valueLists: number;
}

export interface CddalExport {
  version: typeof CDDAL_PROJECTION_VERSION;
  cddal: string;
  stats: CddalExportStats;
}

function escapeCddalString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function quote(s: string): string {
  return `"${escapeCddalString(s)}"`;
}

/** A CDDAL identifier is [A-Za-z0-9_]; Primmel ids also carry hyphens
 *  and dots (smp-hbk-hlci-001, ref derives URNs). The NAME slot of an
 *  instance declaration must be a plain identifier, so a Primmel id
 *  rides there sanitized — the VERBATIM id rides the `code:` assignment
 *  (quoted when unsafe), which cddal-spec clause 11 names as the
 *  round-trip identity ("the same IRDI, code, and meta-class
 *  membership"). */
function safeSymbol(id: string): string {
  const s = id.replace(/[^A-Za-z0-9_]+/g, '_');
  return /^[0-9]/.test(s) ? `N${s}` : s;
}

function isSafeIdentifier(id: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(id);
}

/** A code assignment: the verbatim Primmel id. */
function codeAssignment(id: string): string {
  return isSafeIdentifier(id) ? id : quote(id);
}

/** A quantity assignment: the value with its unit, one token pair. */
function quantity(v: QuantityValue): string {
  return quote(
    v.unit !== undefined && v.unit !== ''
      ? `${v.value} ${v.unit}`
      : String(v.value),
  );
}

/** One l10n alternate: `text <address> { spell <tag> "…" }` — indexed by
 *  the address's trailing `<id>.<field>` segment (the C89
 *  longest-prefix rule in miniature: a block addressed at an element's
 *  field belongs to that element's field). */
function readL10n(
  files: string[],
  read: (p: string) => string,
): Map<string, { tag: string; value: string }[]> {
  const out = new Map<string, { tag: string; value: string }[]>();
  const block = /text\s+([\w./#-]+)\s*\{([\s\S]*?)\}/g;
  const spell = /spell\s+([\w-]+)\s+"((?:[^"\\]|\\.)*)"/g;
  for (const f of files.filter(f => /(^|\/)l10n\.[^/]+\.prl$/.test(f))) {
    const src = read(f);
    for (const m of src.matchAll(block)) {
      const addr = m[1]!;
      const tail = addr.split('/').pop() ?? addr;
      for (const sp of (m[2] ?? '').matchAll(spell)) {
        const list = out.get(tail) ?? [];
        list.push({ tag: sp[1]!, value: sp[2]! });
        out.set(tail, list);
      }
    }
  }
  return out;
}

/** The language-tagged definitions for an element field, if the
 *  package's l10n files carry alternates. */
function l10nDefinitions(
  l10n: Map<string, { tag: string; value: string }[]>,
  id: string,
  field: string,
): { tag: string; value: string }[] {
  return l10n.get(`${id}.${field}`) ?? [];
}

export function projectCddal(
  model: Standard,
  packageId: string,
  l10n: Map<string, { tag: string; value: string }[]> = new Map(),
): CddalExport {
  const lines: string[] = [
    `# ${CDDAL_PROJECTION_VERSION} — the dictionary subset of ${packageId}`,
    '# (generated by primmel export cddal — never authored, never re-imported)',
    '',
  ];
  const stats: CddalExportStats = {
    classes: 0,
    instances: 0,
    assignments: 0,
    properties: 0,
    valueLists: 0,
  };
  const attrDefs = new Map(
    (model.attributeDefinitions ?? []).map(a => [a.id, a]),
  );

  for (const c of model.dataclasses) {
    stats.classes++;
    lines.push(`instance ${safeSymbol(c.id)} < MDC_C002 {`);
    lines.push(`  code: ${codeAssignment(c.id)}`);
    if (c.description) {
      lines.push(`  definition.en: ${quote(c.description)}`);
      for (const alt of l10nDefinitions(l10n, c.id, 'description')) {
        lines.push(`  definition.${alt.tag}: ${quote(alt.value)}`);
      }
    }
    lines.push(
      `  superclass: ${c.extends !== undefined ? safeSymbol(c.extends) : 'UNIVERSE'}`,
    );
    if (c.attributes.length > 0) {
      lines.push(
        `  applicable_properties: { ${c.attributes.map(a => safeSymbol(a.id)).join(', ')} }`,
      );
    }
    lines.push('}');
    lines.push('');
    // The definition layer: each field with a declared attribute
    // definition projects as a property entity whose code is the
    // declared IRDI where the definition carries one.
    for (const a of c.attributes) {
      const def = attrDefs.get(a.id);
      if (!def) {
        continue;
      }
      const irdi =
        def.irdi ||
        def.correspondences?.find(x => x.scheme === 'iec-cdd')?.concept;
      stats.properties++;
      lines.push(`instance ${safeSymbol(a.id)} < MDC_C003 {`);
      lines.push(
        `  code: ${codeAssignment(irdi !== undefined && irdi !== '' ? irdi : a.id)}`,
      );
      if (def.definition) {
        lines.push(`  definition.en: ${quote(def.definition)}`);
        for (const alt of l10nDefinitions(l10n, a.id, 'definition')) {
          lines.push(`  definition.${alt.tag}: ${quote(alt.value)}`);
        }
      }
      lines.push('}');
      lines.push('');
    }
  }

  for (const e of model.enums ?? []) {
    stats.valueLists++;
    lines.push(`instance ${safeSymbol(e.id)} < MDC_C005 {`);
    lines.push(`  code: ${codeAssignment(e.id)}`);
    if (e.values.length > 0) {
      lines.push(
        `  MDC_P043: ( ${e.values.map(v => safeSymbol(v.id)).join(', ')} )`,
      );
    }
    lines.push('}');
    lines.push('');
    for (const v of e.values) {
      lines.push(`instance ${safeSymbol(v.id)} < MDC_C010 {`);
      lines.push(`  code: ${codeAssignment(v.id)}`);
      lines.push('}');
      lines.push('');
    }
  }

  for (const inst of model.instances) {
    stats.instances++;
    lines.push(`instance ${safeSymbol(inst.id)} < MDC_C002 {`);
    lines.push(`  code: ${codeAssignment(inst.id)}`);
    if (inst.of) {
      lines.push(`  superclass: ${safeSymbol(inst.of)}`);
    }
    for (const [id, v] of Object.entries(inst.has?.attributes ?? {})) {
      stats.assignments++;
      lines.push(`  ${safeSymbol(id)}: ${quantity(v)}`);
    }
    lines.push('}');
    lines.push('');
  }

  if (stats.classes === 0 && stats.instances === 0 && stats.valueLists === 0) {
    throw new Error(
      'no dictionary content: the CDDAL projection carries classes and instances',
    );
  }

  return {
    version: CDDAL_PROJECTION_VERSION,
    cddal: lines.join('\n'),
    stats,
  };
}

export function exportPackageCddal(dir: string): CddalExport {
  const model = loadPackage(dir);
  const l10nFiles = readdirSync(dir)
    .filter(e => /^l10n\.[^/]+\.prl$/.test(e))
    .map(e => join(dir, e));
  const l10n = readL10n(l10nFiles, p => readFileSync(p, 'utf8'));
  return projectCddal(model, basename(resolve(dir)), l10n);
}

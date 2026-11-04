// ─────────────────────────────────────────────────────────────────────
// The spelling-codes family — checkSpellingCodes moved wholesale from check.ts (the
// family-module decomposition). The compiler and the suite pin the
// move.
// ─────────────────────────────────────────────────────────────────────

import type { CheckIssue } from '../check';
import { parseConversionCode, parseSpellingCode } from '../spelling';
import type Standard from '../types/Standard';

function textAddressKey(item: unknown, segment: string): boolean {
  if (typeof item !== 'object' || item === null) {
    return false;
  }
  const rec = item as Record<string, unknown>;
  if (rec.name === segment) {
    return true;
  }
  if (typeof rec.order === 'number' && String(rec.order) === segment) {
    return true;
  }
  if (typeof rec.slot === 'number' && String(rec.slot) === segment) {
    return true;
  }
  return false;
}

export function checkSpellingCodes(standard: Standard): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const err = (check: string, message: string) =>
    issues.push({ check, severity: 'error', message });
  const warn = (check: string, message: string) =>
    issues.push({ check, severity: 'warning', message });
  const m = standard.packageManifest;

  if (m?.defaultSpelling) {
    const parsed = parseSpellingCode(m.defaultSpelling);
    if (typeof parsed === 'string') {
      err(
        'C89',
        `package "${m.id}": default_spelling "${m.defaultSpelling}" — ${parsed} (spelling-code-wellformed)`,
      );
    }
    if (
      (m.spellings ?? []).length > 0 &&
      !m.spellings!.includes(m.defaultSpelling)
    ) {
      err(
        'C89',
        `package "${m.id}": default_spelling "${m.defaultSpelling}" is not in the declared spellings set (spelling-code-wellformed)`,
      );
    }
  }
  for (const s of m?.spellings ?? []) {
    const parsed = parseSpellingCode(s);
    if (typeof parsed === 'string') {
      err(
        'C89',
        `package "${m!.id}": declared spelling "${s}" — ${parsed} (spelling-code-wellformed)`,
      );
    }
  }

  const texts = standard.texts ?? [];
  if (texts.length === 0) {
    return issues;
  }

  // The element registry a text block may address — every id-keyed
  // collection (prose lives on requirements, terms, forms, subjects…).
  // The walk needs the element OBJECTS, not just the ids: a nested
  // address (<element-id>.<path…>.<field>) resolves segment by segment
  // into the addressed element's structure.
  const elements = new Map<string, unknown>();
  const ID_COLLECTIONS: (keyof Standard)[] = [
    'requirements',
    'requirementClasses',
    'conformanceTests',
    'conformanceClasses',
    'terms',
    'forms',
    'subforms',
    'symbols',
    'tables',
    'calculations',
    'notes',
    'provisions',
    'processes',
    'instruments',
    'attributeDefinitions',
    'capabilities',
    'behaviors',
    'subjects',
    'referenceMaterials',
    'artifactDefinitions',
    'monitors',
    'passports',
    'invariants',
    'testSequences',
    'stateMachines',
    'figures',
    'links',
  ];
  for (const field of ID_COLLECTIONS) {
    for (const item of (standard[field] as { id?: string }[]) ?? []) {
      if (item?.id) {
        elements.set(item.id, item);
      }
    }
  }
  // The prose-field vocabulary a text block may address (machine content
  // — identifiers, bind paths, OCL, snake_case keys — is never
  // spelling-coded, doctrine §10.7).
  const PROSE_FIELDS = new Set([
    'name',
    'title',
    'label',
    'term',
    'definition',
    'statement',
    'description',
    'guidance',
    'note',
    'notes',
    'scope_note',
    'subject',
    'message',
    'designation',
    'placeholder',
    'true_label',
    'false_label',
    'examples',
  ]);

  for (const t of texts) {
    const dot = t.id.lastIndexOf('.');
    if (dot <= 0 || dot === t.id.length - 1) {
      err(
        'C89',
        `text "${t.id}": the address is <element-id>.<field> (a nested prose field addresses <element-id>.<path…>.<field>) (spelling-code-wellformed)`,
      );
    } else {
      const segments = t.id.split('.');
      if (segments.some(s => s === '')) {
        err(
          'C89',
          `text "${t.id}": empty path segment — the address is <element-id>.<path…>.<field> (spelling-code-wellformed)`,
        );
      } else {
        // The addressed element is the LONGEST dot-boundary prefix of the
        // address registered in the package (element ids may themselves
        // carry dots — r144-3/sec-3.4); the rest is the path into the
        // element's structure. On a one-segment path this degenerates to
        // the <element-id>.<field> split.
        let elementId = '';
        let path: string[] = [];
        const tried: string[] = [];
        for (let i = segments.length - 1; i >= 1; i--) {
          const candidate = segments.slice(0, i).join('.');
          tried.push(candidate);
          if (elements.has(candidate)) {
            elementId = candidate;
            path = segments.slice(i);
            break;
          }
        }
        if (elementId === '') {
          // Every dot-boundary prefix was tried (longest first — element
          // ids may carry dots); the one-level "last-dot split" mental
          // model would name only the longest, so the message lists the
          // tried set (TODO.v2/13 item 3a).
          err(
            'C89',
            `text "${t.id}": no element "${tried[0]}" in the package — every dot-boundary prefix was tried (${tried.map(c => `"${c}"`).join(', ')}); the addressed element is the LONGEST registered prefix (spelling-code-wellformed)`,
          );
        } else {
          // Walk the intermediate segments: an object segment names a
          // nested structure (an own property whose value is an object or
          // list), a list segment keys ONE item by its declared key. The
          // terminal segment must be a prose field the addressed
          // structure CARRIES (own property — a prose slot the parser
          // fills only when authored is addressable exactly then; there
          // is nothing to alternate where no default value lives).
          const field = path[path.length - 1];
          let node: unknown = elements.get(elementId);
          let soFar = elementId;
          let resolved = true;
          for (let s = 0; s < path.length - 1 && resolved; s++) {
            const seg = path[s];
            if (Array.isArray(node)) {
              const matches = node.filter(item => textAddressKey(item, seg));
              if (matches.length !== 1) {
                err(
                  'C89',
                  matches.length === 0
                    ? `text "${t.id}": no item keyed "${seg}" under "${soFar}" — a list item addresses by its declared key (a field or parameter name, a step's order, a subject's slot) (spelling-code-wellformed)`
                    : `text "${t.id}": "${seg}" keys ${matches.length} items under "${soFar}" — the address is ambiguous (spelling-code-wellformed)`,
                );
                resolved = false;
              } else {
                node = matches[0];
                soFar += `.${seg}`;
              }
            } else if (
              !Object.prototype.hasOwnProperty.call(node, seg) ||
              typeof (node as Record<string, unknown>)[seg] !== 'object' ||
              (node as Record<string, unknown>)[seg] === null
            ) {
              err(
                'C89',
                `text "${t.id}": "${soFar}" has no nested structure "${seg}" (spelling-code-wellformed)`,
              );
              resolved = false;
            } else {
              node = (node as Record<string, unknown>)[seg];
              soFar += `.${seg}`;
            }
          }
          if (resolved) {
            if (Array.isArray(node)) {
              err(
                'C89',
                `text "${t.id}": "${soFar}" is a list — address one item's prose field by its key ("${soFar}.<key>.${field}") (spelling-code-wellformed)`,
              );
            } else if (!PROSE_FIELDS.has(field)) {
              err(
                'C89',
                `text "${t.id}": "${field}" is not a prose field (spelling-code-wellformed)`,
              );
            } else if (
              // The snake_case → camelCase fallback is terminal-only by
              // design (the docstring's pin): the terminal segment is a
              // vocabulary lookup (snake_case prose vocabulary → the
              // parsed camelCase property), an intermediate segment is a
              // structure/key name taken verbatim.
              !Object.prototype.hasOwnProperty.call(node, field) &&
              !Object.prototype.hasOwnProperty.call(
                node,
                field.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
              )
            ) {
              err(
                'C89',
                `text "${t.id}": "${soFar}" carries no prose field "${field}" — the default spelling's value belongs inline on the addressed structure (spelling-code-wellformed)`,
              );
            }
          }
        }
      }
    }
    const seen = new Set<string>();
    for (const e of t.entries) {
      const parsed = parseSpellingCode(e.spelling);
      if (typeof parsed === 'string') {
        err(
          'C89',
          `text "${t.id}": spelling code "${e.spelling}" — ${parsed} (spelling-code-wellformed)`,
        );
      }
      if (m?.defaultSpelling && e.spelling === m.defaultSpelling) {
        err(
          'C89',
          `text "${t.id}": "${e.spelling}" is the package's default spelling — its value belongs inline on the element, not in a text block (spelling-code-wellformed)`,
        );
      }
      if (seen.has(e.spelling)) {
        err(
          'C89',
          `text "${t.id}": duplicate "${e.spelling}" value — one value per code per content set; use an extension code to distinguish variants (spelling-code-wellformed)`,
        );
      }
      seen.add(e.spelling);
      if (e.via) {
        const via = parseConversionCode(e.via);
        if (typeof via === 'string') {
          err(
            'C89',
            `text "${t.id}": via "${e.via}" — ${via} (spelling-code-wellformed)`,
          );
        } else if (via.titular.toLowerCase().startsWith('zz-')) {
          warn(
            'C89',
            `text "${t.id}": via "${e.via}" is a user-assigned (zz-) conversion code — it validates, but user-assigned codes are not portable (spelling-code-wellformed)`,
          );
        }
      }
    }
  }
  return issues;
}

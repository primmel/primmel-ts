// ─────────────────────────────────────────────────────────────────────
// The term-aliases family — checkTermAliases moved wholesale from check.ts (the
// family-module decomposition). The compiler and the suite pin the
// move.
// ─────────────────────────────────────────────────────────────────────

import type { CheckIssue } from '../check';
import type Standard from '../types/Standard';

export function checkTermAliases(standard: Standard): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const err = (message: string) =>
    issues.push({ check: 'C110', severity: 'error', message });
  const warn = (message: string) =>
    issues.push({ check: 'C110', severity: 'warning', message });

  const FACETS = ['aliases', 'colloquial', 'abbreviations', 'deprecated'];

  for (const t of standard.terms ?? []) {
    // The family scopes of the term: the default-spelling lists plus one
    // scope per spelling-tagged variant.
    const scopes: [string, Record<string, string[] | undefined>][] = [
      [
        '',
        {
          aliases: t.aliases ?? t.alt,
          colloquial: t.colloquial,
          abbreviations: t.abbreviations,
          deprecated: t.deprecated,
        },
      ],
      ...Object.entries(t.aliasSpellings ?? {}).map(
        ([code, v]): [string, Record<string, string[] | undefined>] => [
          ` ${code}`,
          { ...v },
        ],
      ),
    ];
    for (const [tag, scope] of scopes) {
      const where = (facet: string) =>
        `term ${t.id}: ${facet}${tag ? ` ${tag}` : ''}`;
      for (const facet of FACETS) {
        const seen = new Set<string>();
        for (const entry of scope[facet] ?? []) {
          if (seen.has(entry)) {
            err(
              `${where(facet)}: duplicate entry "${entry}" — one entry has one home (term-alias-shape)`,
            );
          }
          seen.add(entry);
        }
      }
      const home = new Map<string, string>();
      for (const facet of FACETS) {
        for (const entry of scope[facet] ?? []) {
          const prior = home.get(entry);
          if (prior !== undefined && prior !== facet) {
            // Rollout warning leg (see the rule's doc comment): the
            // spec's error tightens when the estate re-authors.
            warn(
              `${where(facet)}: "${entry}" already appears in ${prior} — one entry has one home (term-alias-shape)`,
            );
          } else {
            home.set(entry, facet);
          }
        }
      }
    }
    // The label echo: any entry that restates the term's own label
    // bridges nothing (checked across every scope).
    if (t.label) {
      for (const [tag, scope] of scopes) {
        for (const facet of FACETS) {
          if ((scope[facet] ?? []).includes(t.label)) {
            warn(
              `term ${t.id}: ${facet}${tag ? ` ${tag}` : ''} entry "${t.label}" merely echoes the term's label — an alias adds a bridge or it does not belong (term-alias-shape)`,
            );
          }
        }
      }
    }
  }
  return issues;
}

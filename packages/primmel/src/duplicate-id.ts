// ─────────────────────────────────────────────────────────────────────
// Duplicate-ID detection helper.
//
// Runs at parse time (not post-parse) because the parser silently
// overwrites duplicate entries in `ctx.<field>`. Without this check,
// a duplicate ID would just clobber the earlier declaration and the
// caller would never see the issue. By catching the second occurrence
// at the moment it's parsed, the issue survives into `ctx.issues`.
// ─────────────────────────────────────────────────────────────────────

import type { Position } from './ser-des/tokenize';
import type { ValidationIssue } from './validate';
import type { ParseContext } from './ser-des/types';

export interface DuplicateIdChecker {
  /**
   * Record a declaration. Returns a ValidationIssue if this (field, id)
   * has been seen before; returns undefined otherwise.
   */
  check(
    field: keyof ParseContext,
    keyword: string,
    id: string,
    position: Position,
  ): ValidationIssue | undefined;
}

export function createDuplicateIdChecker(): DuplicateIdChecker {
  const seen = new Map<keyof ParseContext, Map<string, Position>>();

  return {
    check(field, keyword, id, position) {
      let fieldMap = seen.get(field);
      if (!fieldMap) {
        fieldMap = new Map();
        seen.set(field, fieldMap);
      }

      const prior = fieldMap.get(id);
      if (prior) {
        return {
          severity: 'error',
          code: 'duplicate-id',
          construct: String(field),
          id,
          message: `Duplicate ${keyword} id "${id}" (first declared at line ${prior.line} col ${prior.col}) — earlier declaration overwritten`,
          position: { ...position },
        };
      }

      fieldMap.set(id, position);
      return undefined;
    },
  };
}

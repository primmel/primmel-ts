// ─────────────────────────────────────────────────────────────────────
// The generation-ratchet family (C176 + C178): the manifest's declared
// language generation and the legacy-carrier deprecation ratchet. A
// declared generation must be well-formed (v<major>[.<minor>]) — the
// strict-parse contract's key. The deprecation mechanism (register W6)
// warns the legacy quoted expression carriers (`expression "ocl{…}"`,
// the quoted derive / derivation / check) once a package declares the
// generation that deprecates them. The generation constant is INERT
// until the owner's release bump — no package declares it today, so
// nothing warns; flipping the constant (or packages declaring the
// newer generation) activates the ratchet. The inline blocks are the
// only forward form.
//
// The ratchet counts only carriers the language can parse — the
// legacy-string population that never parsed (the prose judgments, the
// bracket idioms, the bar-abs) is inert data on a separate retirement
// track, never a C178 finding.
//
// THE FAMILY-MODULE PATTERN (the check.ts decomposition, one family
// at a time): the family takes the context record it actually uses —
// the package dir (the manifest read), `standard`, and the two emit
// closures — and nothing else. The bodies move verbatim from check.ts;
// the compiler and the suite pin the move.
// ─────────────────────────────────────────────────────────────────────

import { readPackageManifest } from '../ser-des/package';
import { parseExpression } from '../expressions';
import type Standard from '../types/Standard';

export interface GenerationRatchetContext {
  dir: string;
  standard: Standard;
  err: (check: string, message: string) => void;
  warn: (check: string, message: string) => void;
}

export function runGenerationRatchetFamily({
  dir,
  standard,
  err,
  warn,
}: GenerationRatchetContext): void {
  // ── C176 language-declared-wellformed ───────────────────────────────
  // A declared language generation must be well-formed (v<digit>[.digit])
  // — the strict-parse contract's key. The unknown-keyword errors come
  // from the parse itself (the strict mode); this rule only checks the
  // declaration's shape.
  // ── C178 legacy-carrier-deprecated ──────────────────────────────────
  // The deprecation mechanism (register W6): the legacy quoted
  // expression carriers (`expression "ocl{…}"`, the quoted derive /
  // derivation / check) warn once a package declares the generation
  // that deprecates them. The generation constant is INERT until the
  // owner's release bump — no package declares it today, so nothing
  // warns; flipping the constant (or packages declaring the newer
  // generation) activates the ratchet. The inline blocks are the only
  // forward form.
  const DEPRECATION_GENERATION = 'v3.4';
  // the ratchet counts only carriers the language can parse — the
  // legacy-string population that never parsed (the prose judgments, the
  // bracket idioms, the bar-abs) is inert data on a separate retirement
  // track, never a C178 finding
  const migratableCarrier = (source: string): boolean => {
    // the quoted carrier stores the ocl{…} wrapper verbatim — probe the
    // body the same way the fold's identifier reader does
    const inner =
      source.startsWith('ocl{') && source.endsWith('}')
        ? source.slice(4, -1)
        : source;
    try {
      parseExpression(inner);
      return true;
    } catch {
      return false;
    }
  };
  const generationRank = (g: string): number => {
    const m = g.match(/^v(\d+)(?:\.(\d+))?$/);
    if (!m) {
      return -1;
    }
    return Number(m[1]) * 1000 + Number(m[2] ?? '0');
  };
  try {
    const mf = readPackageManifest(dir);
    if (mf.language !== undefined) {
      if (!/^v\d+(\.\d+)?$/.test(mf.language)) {
        err(
          'C176',
          `the declared language "${mf.language}" is not a generation (v<major>[.<minor>]) (language-declared-wellformed)`,
        );
      } else if (
        generationRank(mf.language) >= generationRank(DEPRECATION_GENERATION)
      ) {
        let legacy = 0;
        for (const r of standard.requirements ?? []) {
          if (
            r.limit &&
            !r.limit.argsBound &&
            r.limit.expression &&
            migratableCarrier(r.limit.expression)
          ) {
            legacy += 1;
          }
        }
        for (const v of standard.verdicts ?? []) {
          const derive = (v as { derive?: string }).derive;
          if (
            derive &&
            !(v as { deriveBound?: boolean }).deriveBound &&
            migratableCarrier(derive)
          ) {
            legacy += 1;
          }
        }
        for (const t of standard.conformanceTests ?? []) {
          for (const v of t.variables ?? []) {
            if (
              v.derivation &&
              !v.derivationBound &&
              migratableCarrier(v.derivation)
            ) {
              legacy += 1;
            }
          }
          for (const p of t.preconditions ?? []) {
            if (p.check && !p.checkBound && migratableCarrier(p.check)) {
              legacy += 1;
            }
          }
        }
        for (const c of standard.constraints ?? []) {
          if (c.check && !c.checkBound && migratableCarrier(c.check)) {
            legacy += 1;
          }
        }
        // the check construct's own expression carrier (the corpus's
        // dominant plane — the canonical verdict declarations) and the
        // process steps' completion gates
        for (const c of standard.checks ?? []) {
          // a FOLDED check is the parse-side view of its owner's carrier
          // (C161) — the owner's facet is counted by its own leg above;
          // counting the view would double-count one carrier
          if (
            c.expression &&
            !c.expressionBound &&
            !c.folds &&
            migratableCarrier(c.expression)
          ) {
            legacy += 1;
          }
        }
        for (const p of standard.processes ?? []) {
          for (const st of (p as { steps?: unknown[] }).steps ?? []) {
            const completion = (st as { completion?: string }).completion;
            if (
              completion &&
              !(st as { completionBound?: boolean }).completionBound &&
              migratableCarrier(completion)
            ) {
              legacy += 1;
            }
          }
        }
        if (legacy > 0) {
          warn(
            'C178',
            `${legacy} quoted expression carrier${legacy === 1 ? '' : 's'} — the ocl{…} string form is deprecated as of ${DEPRECATION_GENERATION}; migrate to the inline blocks (expression { … }, derive { … }, derivation { … }, check { … }) (legacy-carrier-deprecated)`,
          );
        }
      }
    }
  } catch {
    // the manifest unreadable — the load errors own that
  }
}

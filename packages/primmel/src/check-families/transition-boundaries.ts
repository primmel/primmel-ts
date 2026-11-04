// ─────────────────────────────────────────────────────────────────────
// The transition-boundaries family (C74–C76, TODO.roadmap/38):
// composition is sound only when the upstream output signature covers
// the downstream input signature — the algebra's
// ∘: t₁: A→B, t₂: B→C ⊢ t₂∘t₁: A→C. The boundary types are the task-02
// quantity-kind/type tokens on signature parameters and registers,
// resolved to KINDS through the package's quantity registers (a kind id
// directly, or a unit id/symbol via its declared kind — the C33
// machinery, passed in from the quantities family's register walk);
// unresolved tokens compare as plain type names. An untyped ('') name
// is unconstrained and composes with anything (gradual typing —
// untyped legacy content stays silent). With no kind hierarchy, kind
// equality IS the covariant rule: the written/output kind must equal
// the read/input kind. C74 — one name, one type; C75 — the step-chain
// dataflow covers every read (a must-analysis, shrink-to-fixpoint) and
// no write is dead; C76 — a `calls` step binds the callee's declared
// signature completely and kind-compatibly.
//
// THE FAMILY-MODULE PATTERN (the check.ts decomposition, one family
// at a time): the family takes the context record it actually uses —
// `standard`, the quantities indexes, and the two emit closures — and
// nothing else. The bodies move verbatim from check.ts; the compiler
// and the suite pin the move.
// ─────────────────────────────────────────────────────────────────────

import type { ProcessParameter, ProcessStep } from '../types/process';
import type Standard from '../types/Standard';
import type { QuantitiesIndexes } from './quantities';

export interface TransitionBoundariesContext extends QuantitiesIndexes {
  standard: Standard;
  err: (check: string, message: string) => void;
  warn: (check: string, message: string) => void;
}

export function runTransitionBoundariesFamily({
  standard,
  kindDecl,
  kindOfUnit,
  err,
  warn,
}: TransitionBoundariesContext): void {
  type ResolvedType = { kind: string } | { token: string } | null;
  const resolveParamType = (type: string): ResolvedType => {
    const t = type.trim();
    if (t === '') {
      return null;
    }
    if (kindDecl.has(t)) {
      return { kind: t };
    }
    const k = kindOfUnit(t);
    if (k !== undefined) {
      return { kind: k };
    }
    return { token: t };
  };
  const typesCompatible = (a: ResolvedType, b: ResolvedType): boolean => {
    if (a === null || b === null) {
      return true;
    }
    if ('kind' in a && 'kind' in b) {
      return a.kind === b.kind;
    }
    if ('token' in a && 'token' in b) {
      return a.token === b.token;
    }
    return false;
  };

  const processById = new Map((standard.processes ?? []).map(q => [q.id, q]));
  for (const p of standard.processes ?? []) {
    // The declared type sites of one name: signature in/out + registers.
    // A step's read/write names carry no type of their own — the boundary
    // type of a handoff is whatever the declarations say, so a name with
    // TWO conflicting declarations is the kind-incompatible boundary.
    const sites = new Map<string, Array<{ pos: string; type: string }>>();
    const noteSites =
      (pos: string) =>
      (prm: ProcessParameter): void => {
        sites.set(prm.name, [
          ...(sites.get(prm.name) ?? []),
          { pos, type: prm.type },
        ]);
      };
    (p.signature?.inputs ?? []).forEach(noteSites('signature in'));
    (p.signature?.outputs ?? []).forEach(noteSites('signature out'));
    (p.registers ?? []).forEach(noteSites('registers'));
    // The first declared site answers the caller-side type of a name
    // (C74 owns the conflict when sites disagree).
    const declaredTypeOf = (name: string): string | undefined =>
      sites.get(name)?.[0]?.type;

    // C74 — one name, ONE type (process-io-type-coherence). Runs on the
    // abstract form too: the signature/registers coherence is a
    // declaration-level fact, independent of the `does` body.
    for (const [name, decls] of sites) {
      let conflict: { a: string; b: string } | null = null;
      for (let x = 0; x < decls.length && !conflict; x++) {
        for (let y = x + 1; y < decls.length && !conflict; y++) {
          if (
            !typesCompatible(
              resolveParamType(decls[x].type),
              resolveParamType(decls[y].type),
            )
          ) {
            conflict = {
              a: `${decls[x].pos} "${decls[x].type}"`,
              b: `${decls[y].pos} "${decls[y].type}"`,
            };
          }
        }
      }
      if (conflict) {
        err(
          'C74',
          `process ${p.id}: "${name}" declares incompatible types — ${conflict.a} vs ${conflict.b} — one name, one type at a transition boundary (process-io-type-coherence)`,
        );
      }
    }

    const flow = p.does;
    if (!flow) {
      continue;
    }
    const steps = flow.steps ?? [];
    const edges = flow.edges ?? [];
    const stepById = new Map(steps.map(s => [s.id, s]));
    // Effective step I/O: the declared reads/writes plus the wait target
    // (a read) and the caller-side names of a call's `with` bindings.
    const readsOf = (s: ProcessStep): Set<string> =>
      new Set([
        ...s.reads,
        ...(s.wait ? [s.wait] : []),
        ...s.callIn.map(b => b.bind),
      ]);
    const writesOf = (s: ProcessStep): Set<string> =>
      new Set([...s.writes, ...s.callOut.map(b => b.bind)]);
    // The C12 declared-name vocabulary (registers + signature + instance
    // keys + the process's own state).
    const declaredNames = new Set<string>(['state', ...sites.keys()]);
    for (const v of Object.values(p.instances?.values ?? {})) {
      for (const k of Object.keys(v)) {
        declaredNames.add(k);
      }
    }
    // Names the process is PROVIDED with at entry: the IN parameters, the
    // per-classification instance values, and the operational state —
    // ambient HAS, available at every step without a writer in the flow.
    const provided = new Set<string>(['state']);
    for (const prm of p.signature?.inputs ?? []) {
      provided.add(prm.name);
    }
    for (const v of Object.values(p.instances?.values ?? {})) {
      for (const k of Object.keys(v)) {
        provided.add(k);
      }
    }
    // Edge conditions read self.<name> AFTER the source step completes.
    const condReads = new Map<string, Set<string>>();
    for (const e of edges) {
      const re = /\bself\.([A-Za-z_][A-Za-z0-9_]*)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(e.condition)) !== null) {
        condReads.set(e.from, (condReads.get(e.from) ?? new Set()).add(m[1]));
      }
    }

    // C75 — the step-chain dataflow covers every read: a must-analysis
    // (definitely-written on EVERY incoming path) over the flow graph,
    // computed as a shrink-to-fixpoint from the top (all written names).
    // Known limitation: the intersection runs over ALL predecessors
    // uniformly, so a parallel_gateway fork's conjunctive branches are
    // treated as alternative paths — a value written on one parallel
    // branch and read after the join (guaranteed bound under the concept
    // doc §4.2 "unordered conjunction" semantics) is reported uncovered.
    // The direction is safe (over-reports, never misses a real gap).
    // Follow-up: distinguish same-fork conjunctive predecessors (union)
    // from choice predecessors (intersection).
    const allWritten = new Set<string>();
    for (const s of steps) {
      writesOf(s).forEach(n => allWritten.add(n));
    }
    const preds = new Map<string, string[]>();
    for (const e of edges) {
      if (stepById.has(e.from) && stepById.has(e.to)) {
        preds.set(e.to, [...(preds.get(e.to) ?? []), e.from]);
      }
    }
    const availIn = new Map<string, Set<string>>();
    for (const s of steps) {
      availIn.set(s.id, new Set(allWritten));
    }
    let changed = true;
    while (changed) {
      changed = false;
      for (const s of steps) {
        const ps = preds.get(s.id) ?? [];
        let next = new Set<string>();
        if (ps.length > 0) {
          next = new Set(allWritten);
          for (const pid of ps) {
            const pOut = new Set([
              ...(availIn.get(pid) ?? []),
              ...writesOf(stepById.get(pid)!),
            ]);
            next = new Set([...next].filter(n => pOut.has(n)));
          }
        }
        const cur = availIn.get(s.id)!;
        if (next.size !== cur.size || [...next].some(n => !cur.has(n))) {
          availIn.set(s.id, next);
          changed = true;
        }
      }
    }
    const availOut = (s: ProcessStep): Set<string> =>
      new Set([...(availIn.get(s.id) ?? []), ...writesOf(s)]);

    // C75 (error leg) — a read with no writer on every incoming path and
    // no provided home reads a never-bound value. Undeclared names are
    // C12's finding, not repeated here.
    for (const s of steps) {
      for (const n of readsOf(s)) {
        if (!declaredNames.has(n) || provided.has(n)) {
          continue;
        }
        if (!(availIn.get(s.id) ?? new Set<string>()).has(n)) {
          err(
            'C75',
            `process ${p.id}: step "${s.id}" reads "${n}", which is neither an IN parameter/instance value nor written on every incoming flow path (process-flow-io-cover)`,
          );
        }
      }
      for (const n of condReads.get(s.id) ?? new Set<string>()) {
        if (!declaredNames.has(n) || provided.has(n)) {
          continue;
        }
        if (!availOut(s).has(n)) {
          err(
            'C75',
            `process ${p.id}: the edge condition at "${s.id}" reads "${n}", which is neither an IN parameter/instance value nor written on every incoming flow path (process-flow-io-cover)`,
          );
        }
      }
    }
    // C75 (warning leg) — a write with no reader is a dead output: no
    // step reads it, no edge condition references it, and no OUT
    // parameter names it. A capture-step write lands in evidence through
    // the capture form (the form is its reader), so it is never dead.
    const allRead = new Set<string>();
    for (const s of steps) {
      readsOf(s).forEach(n => allRead.add(n));
    }
    for (const names of condReads.values()) {
      names.forEach(n => allRead.add(n));
    }
    const outNames = new Set((p.signature?.outputs ?? []).map(o => o.name));
    for (const s of steps) {
      if (s.capture) {
        continue;
      }
      for (const n of writesOf(s)) {
        if (!declaredNames.has(n)) {
          continue;
        }
        if (!allRead.has(n) && !outNames.has(n)) {
          warn(
            'C75',
            `process ${p.id}: step "${s.id}" writes "${n}", which no step reads and no OUT parameter names — a dead output (process-flow-io-cover)`,
          );
        }
      }
    }

    // C76 — a `calls` step binds the callee's declared signature
    // completely and kind-compatibly (subprocess-signature-bound). The
    // callee lookup runs against the COMPOSED process set, so a call
    // across a `uses` boundary is checked the same way (post-merge).
    for (const s of steps) {
      if (!s.calls) {
        continue;
      }
      const callee = processById.get(s.calls);
      if (!callee) {
        err(
          'C76',
          `process ${p.id}: step "${s.id}" calls "${s.calls}", which is not a declared process (subprocess-signature-bound)`,
        );
        continue;
      }
      const sig = callee.signature;
      if (!sig) {
        if (s.callIn.length > 0 || s.callOut.length > 0) {
          err(
            'C76',
            `process ${p.id}: step "${s.id}" carries a with {…} binding, but "${s.calls}" declares no signature — there is nothing to bind (subprocess-signature-bound)`,
          );
        }
        continue;
      }
      const checkBindings = (
        direction: 'IN' | 'OUT',
        params: ProcessParameter[],
        bindings: { param: string; bind: string }[],
      ): void => {
        for (const prm of params) {
          const bs = bindings.filter(b => b.param === prm.name);
          if (bs.length === 0) {
            err(
              'C76',
              `process ${p.id}: step "${s.id}" calls "${callee.id}": ${direction} parameter "${prm.name}" is not ${direction === 'IN' ? 'bound from a caller register' : 'mapped back to a caller register'} — the signature binds completely (subprocess-signature-bound)`,
            );
          } else if (bs.length > 1) {
            err(
              'C76',
              `process ${p.id}: step "${s.id}" calls "${callee.id}": ${direction} parameter "${prm.name}" is bound ${bs.length} times — exactly once (subprocess-signature-bound)`,
            );
          }
        }
        for (const b of bindings) {
          const prm = params.find(q => q.name === b.param);
          if (!prm) {
            err(
              'C76',
              `process ${p.id}: step "${s.id}" calls "${callee.id}": "${b.param}" is not a declared ${direction} parameter of the callee (subprocess-signature-bound)`,
            );
            continue;
          }
          const callerType = declaredTypeOf(b.bind);
          if (callerType === undefined) {
            continue; // undeclared caller-side name — C12's finding
          }
          // IN: the caller register feeds the callee's input; OUT: the
          // callee's output lands in the caller register. Kind equality
          // both ways (no kind hierarchy — see the section header).
          if (
            !typesCompatible(
              resolveParamType(callerType),
              resolveParamType(prm.type),
            )
          ) {
            err(
              'C76',
              `process ${p.id}: step "${s.id}" calls "${callee.id}": caller "${b.bind}" (${callerType || 'untyped'}) and ${direction} parameter "${b.param}" (${prm.type || 'untyped'}) are not kind-compatible (subprocess-signature-bound)`,
            );
          }
        }
      };
      checkBindings('IN', sig.inputs, s.callIn);
      checkBindings('OUT', sig.outputs, s.callOut);
    }
  }
}

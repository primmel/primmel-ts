// ─────────────────────────────────────────────────────────────────────
// The declared derived planes (CRITIQUE-2 #3, TODO.lang-gaps/21):
// derived data is a CONCEPT — a plane the parse derives and the
// serializer never emits. The C160-class bug (a hoisted plane leaking
// into the dump and growing every round-trip) is unrepresentable when
// every derived plane is declared here and the fixpoint guard asserts
// the declaration against the dumpers: a plane cannot leak undeclared,
// and a declared plane cannot regress into the wire.
// ─────────────────────────────────────────────────────────────────────

export interface DerivedPlane {
  /** The Standard path, documentation form. */
  path: string;
  /** What derives the plane, and why serializing it would corrupt the
   *  document. */
  doctrine: string;
}

export const DERIVED_PLANES: readonly DerivedPlane[] = [
  {
    path: 'processes[].stepRequires',
    doctrine:
      "the C160 plane: the pass-1 parse hoists the steps' own `requires` facets into it, and the parse rebuilds it from those lines on every load — serializing it would re-ingest as a fresh process-level `requires` and grow the document every round (the fixpoint the corpus round-trip gate caught on 1.21.14). The steps' own lines are the serialization truth.",
  },
  {
    path: 'checks[].folds',
    doctrine:
      "the boolean fold (C161, TODO.lang-gaps/03): a folded check is the parse-side VIEW of its owner spelling — the serializer emits the canonical form only (dump skips checks carrying folds), and composition re-derives the folds from the merged owners.",
  },
];

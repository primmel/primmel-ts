// ─────────────────────────────────────────────────────────────────────
// The evaluation profile (smart TODO.roadmap/40 batch 3; the
// packages-as-SSOT epic) — a NAMED dimension-value preset selecting the
// applicable requirements/tests/calculations (the applicability
// machinery is a filter; this is the named preset over it):
//
//   evaluation_profile class-a-digital-nh {
//     dimensions { accuracy_class A technology digital humidity_class NH }
//     description "Class A digital, no humidity test"
//   }
//
// The dimensions map keys on DIMENSION ids (profiles select over
// dimensions) — NOT the evaluation-dimension FIELD names (r60: profile
// key humidity_class vs field name humidity_symbol); the two namespaces
// never mix. Optional per package: r91/r144 declare none, and no
// empty-register requirement exists.
//
// C135 evaluation-profile-coherence: every dimensions key resolves to a
// declared classification dimension and every value to one of that
// dimension's declared values (per-register gated; an OPEN dimension
// accepts any value) — the smart R4/R8 applicability mirror.
// ─────────────────────────────────────────────────────────────────────

export default interface EvaluationProfile {
  /** Kebab-case profile id (class-a-digital-nh). */
  id: string;
  /** The dimension-value preset: dimension id → value id, in declared
   *  order (the byte contract keys dimension ids before description). */
  dimensions: Record<string, string>;
  /** What the profile selects. */
  description: string;
}
